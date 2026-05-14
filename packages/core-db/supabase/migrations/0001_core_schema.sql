-- ============================================================================
-- TRADES SAAS — CORE SCHEMA MIGRATION
-- Run this against a fresh Supabase project.
-- All tables live in the public schema.
-- ============================================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";       -- fuzzy customer search
create extension if not exists "vector";         -- pgvector for RAG (future)

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type trade_type as enum (
  'hvac', 'plumbing', 'electrical', 'roofing',
  'general_contractor', 'landscaping', 'painting',
  'flooring', 'pest_control', 'other'
);

create type module_name as enum (
  'leads', 'estimates', 'reviews'
);

create type user_role as enum (
  'owner', 'admin', 'tech'
);

create type job_status as enum (
  'lead', 'scheduled', 'active', 'complete', 'closed', 'cancelled'
);

create type job_source as enum (
  'manual', 'website_form', 'missed_call', 'referral',
  'google', 'facebook', 'yelp', 'other'
);

create type contact_method as enum (
  'sms', 'email', 'call'
);

create type comm_channel as enum (
  'sms', 'email', 'call', 'in_app'
);

create type comm_direction as enum (
  'inbound', 'outbound'
);

create type comm_status as enum (
  'pending', 'sent', 'delivered', 'failed', 'read'
);

create type source_module as enum (
  'leads', 'estimates', 'reviews', 'core'
);

create type job_event_type as enum (
  'job.created', 'job.scheduled', 'job.started',
  'job.completed', 'job.cancelled', 'job.reopened',
  'lead.captured', 'lead.assigned', 'follow_up.sent', 'follow_up.skipped',
  'estimate.created', 'estimate.sent', 'estimate.viewed',
  'estimate.accepted', 'estimate.rejected', 'estimate.expired',
  'review.requested', 'review.received', 'review.responded'
);

-- ─── Helper: updated_at trigger ──────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── Helper: job number generator ────────────────────────────────────────────

create sequence if not exists job_number_seq start 1000;

create or replace function generate_job_number()
returns text as $$
begin
  return 'J-' || lpad(nextval('job_number_seq')::text, 5, '0');
end;
$$ language plpgsql;

-- ============================================================================
-- TABLES
-- ============================================================================

-- ─── Organizations ───────────────────────────────────────────────────────────

create table organizations (
  id                      uuid primary key default uuid_generate_v4(),
  name                    text not null,
  phone                   text,
  email                   text,
  address                 text,
  city                    text,
  state                   text,
  zip                     text,
  logo_url                text,
  trade_types             trade_type[] not null default '{}',
  timezone                text not null default 'America/Chicago',
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  active_modules          module_name[] not null default '{}',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger organizations_updated_at
  before update on organizations
  for each row execute function set_updated_at();

comment on column organizations.active_modules is
  'Written by Stripe webhooks. Controls which modules are unlocked for this org.';

-- ─── Users ───────────────────────────────────────────────────────────────────

create table users (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null references organizations(id) on delete cascade,
  supabase_auth_id    uuid not null unique references auth.users(id) on delete cascade,
  name                text not null,
  email               text not null,
  phone               text,
  role                user_role not null default 'tech',
  notification_prefs  jsonb not null default '{
    "new_lead": true,
    "job_assigned": true,
    "estimate_viewed": true,
    "estimate_accepted": true,
    "review_received": true,
    "channels": ["sms", "email"]
  }',
  is_active           boolean not null default true,
  avatar_url          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index users_org_id_idx on users(org_id);
create index users_supabase_auth_id_idx on users(supabase_auth_id);

create trigger users_updated_at
  before update on users
  for each row execute function set_updated_at();

-- ─── Customers ───────────────────────────────────────────────────────────────

create table customers (
  id                        uuid primary key default uuid_generate_v4(),
  org_id                    uuid not null references organizations(id) on delete cascade,
  name                      text not null,
  phone                     text,
  email                     text,
  address                   text,
  city                      text,
  state                     text,
  zip                       text,
  preferred_contact_method  contact_method not null default 'sms',
  notes                     text,
  tags                      text[] not null default '{}',
  sms_opt_out               boolean not null default false,
  email_opt_out             boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index customers_org_id_idx on customers(org_id);
create index customers_phone_idx on customers(phone) where phone is not null;
create index customers_email_idx on customers(email) where email is not null;
-- Trigram index for fuzzy name search
create index customers_name_trgm_idx on customers using gin(name gin_trgm_ops);

create trigger customers_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- ─── Jobs ────────────────────────────────────────────────────────────────────

create table jobs (
  id                      uuid primary key default uuid_generate_v4(),
  org_id                  uuid not null references organizations(id) on delete cascade,
  customer_id             uuid not null references customers(id) on delete restrict,
  title                   text not null,
  description             text,
  status                  job_status not null default 'lead',
  source                  job_source not null default 'manual',
  assigned_to             uuid references users(id) on delete set null,
  location                text,
  trade_type              trade_type,
  scheduled_at            timestamptz,
  completed_at            timestamptz,
  estimated_value_cents   integer check (estimated_value_cents >= 0),
  final_value_cents       integer check (final_value_cents >= 0),
  job_number              text not null unique default generate_job_number(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index jobs_org_id_idx on jobs(org_id);
create index jobs_customer_id_idx on jobs(customer_id);
create index jobs_assigned_to_idx on jobs(assigned_to) where assigned_to is not null;
create index jobs_status_idx on jobs(org_id, status);
create index jobs_scheduled_at_idx on jobs(org_id, scheduled_at) where scheduled_at is not null;

create trigger jobs_updated_at
  before update on jobs
  for each row execute function set_updated_at();

-- ─── Communication Log ────────────────────────────────────────────────────────

create table communication_log (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  job_id          uuid references jobs(id) on delete set null,
  customer_id     uuid not null references customers(id) on delete cascade,
  channel         comm_channel not null,
  direction       comm_direction not null,
  subject         text,
  body            text not null,
  status          comm_status not null default 'pending',
  source_module   source_module not null default 'core',
  external_id     text,   -- Telnyx or Resend message ID
  error           text,
  created_at      timestamptz not null default now()
);

-- No updated_at — log entries are immutable. Status updates insert a new row.
create index comm_log_org_id_idx on communication_log(org_id);
create index comm_log_customer_id_idx on communication_log(customer_id);
create index comm_log_job_id_idx on communication_log(job_id) where job_id is not null;
create index comm_log_created_at_idx on communication_log(org_id, created_at desc);

comment on table communication_log is
  'Immutable log of every SMS, email, and call. Check this before sending to prevent duplicates.';

-- ─── Attachments ─────────────────────────────────────────────────────────────

create table attachments (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  job_id          uuid references jobs(id) on delete set null,
  customer_id     uuid references customers(id) on delete set null,
  uploaded_by     uuid not null references users(id) on delete restrict,
  storage_path    text not null,
  storage_url     text not null,
  filename        text not null,
  mime_type       text not null,
  size_bytes      integer not null check (size_bytes > 0),
  source_module   source_module not null default 'core',
  ocr_text        text,
  created_at      timestamptz not null default now()
);

create index attachments_org_id_idx on attachments(org_id);
create index attachments_job_id_idx on attachments(job_id) where job_id is not null;

-- ─── Job Events ──────────────────────────────────────────────────────────────

create table job_events (
  id              uuid primary key default uuid_generate_v4(),
  job_id          uuid not null references jobs(id) on delete cascade,
  org_id          uuid not null references organizations(id) on delete cascade,
  event_type      job_event_type not null,
  payload         jsonb not null default '{}',
  source_module   source_module not null,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index job_events_job_id_idx on job_events(job_id);
create index job_events_org_id_idx on job_events(org_id);
create index job_events_event_type_idx on job_events(org_id, event_type);
create index job_events_created_at_idx on job_events(org_id, created_at desc);

comment on table job_events is
  'Inter-module event bus. Modules write here; Inngest listens. Modules never import each other.
   Module keys: leads = LeadLock (TBC), estimates = OmniBid, reviews = RepuGuard.';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table organizations      enable row level security;
alter table users              enable row level security;
alter table customers          enable row level security;
alter table jobs               enable row level security;
alter table communication_log  enable row level security;
alter table attachments        enable row level security;
alter table job_events         enable row level security;

-- ─── Helper: get current user's org_id and role ───────────────────────────────

create or replace function current_user_org_id()
returns uuid as $$
  select org_id from users where supabase_auth_id = auth.uid()
$$ language sql security definer stable;

create or replace function current_user_role()
returns user_role as $$
  select role from users where supabase_auth_id = auth.uid()
$$ language sql security definer stable;

create or replace function current_user_id()
returns uuid as $$
  select id from users where supabase_auth_id = auth.uid()
$$ language sql security definer stable;

-- ─── Organizations ───────────────────────────────────────────────────────────
-- Users can only see their own org.

create policy "org_select" on organizations
  for select using (id = current_user_org_id());

create policy "org_update" on organizations
  for update using (
    id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

-- ─── Users ───────────────────────────────────────────────────────────────────
-- Users can see all users in their org.
-- Only owner/admin can manage users.

create policy "users_select" on users
  for select using (org_id = current_user_org_id());

create policy "users_insert" on users
  for insert with check (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

create policy "users_update" on users
  for update using (
    org_id = current_user_org_id()
    and (
      -- Can always update your own record
      supabase_auth_id = auth.uid()
      -- Owner/admin can update anyone
      or current_user_role() in ('owner', 'admin')
    )
  );

create policy "users_delete" on users
  for delete using (
    org_id = current_user_org_id()
    and current_user_role() = 'owner'
    and supabase_auth_id != auth.uid() -- Can't delete yourself
  );

-- ─── Customers ───────────────────────────────────────────────────────────────
-- All users in an org can see all customers.
-- Techs cannot delete customers.

create policy "customers_select" on customers
  for select using (org_id = current_user_org_id());

create policy "customers_insert" on customers
  for insert with check (org_id = current_user_org_id());

create policy "customers_update" on customers
  for update using (org_id = current_user_org_id());

create policy "customers_delete" on customers
  for delete using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

-- ─── Jobs ────────────────────────────────────────────────────────────────────
-- Techs can only see jobs assigned to them.
-- Owner/admin can see all jobs in the org.

create policy "jobs_select_owner_admin" on jobs
  for select using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

create policy "jobs_select_tech" on jobs
  for select using (
    org_id = current_user_org_id()
    and current_user_role() = 'tech'
    and assigned_to = current_user_id()
  );

create policy "jobs_insert" on jobs
  for insert with check (org_id = current_user_org_id());

create policy "jobs_update" on jobs
  for update using (
    org_id = current_user_org_id()
    and (
      current_user_role() in ('owner', 'admin')
      or assigned_to = current_user_id()
    )
  );

create policy "jobs_delete" on jobs
  for delete using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

-- ─── Communication Log ────────────────────────────────────────────────────────
-- Techs can only see comms for their assigned jobs.

create policy "comm_log_select_owner_admin" on communication_log
  for select using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

create policy "comm_log_select_tech" on communication_log
  for select using (
    org_id = current_user_org_id()
    and current_user_role() = 'tech'
    and job_id in (
      select id from jobs
      where assigned_to = current_user_id()
    )
  );

create policy "comm_log_insert" on communication_log
  for insert with check (org_id = current_user_org_id());

-- Log entries are immutable — no update or delete policies.

-- ─── Attachments ─────────────────────────────────────────────────────────────

create policy "attachments_select" on attachments
  for select using (org_id = current_user_org_id());

create policy "attachments_insert" on attachments
  for insert with check (org_id = current_user_org_id());

create policy "attachments_delete" on attachments
  for delete using (
    org_id = current_user_org_id()
    and (
      uploaded_by = current_user_id()
      or current_user_role() in ('owner', 'admin')
    )
  );

-- ─── Job Events ──────────────────────────────────────────────────────────────

create policy "job_events_select" on job_events
  for select using (org_id = current_user_org_id());

create policy "job_events_insert" on job_events
  for insert with check (org_id = current_user_org_id());

-- Events are immutable — no update or delete policies.

-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- Supabase Realtime lets the app react to changes without polling.
-- ============================================================================

alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table job_events;
alter publication supabase_realtime add table communication_log;
