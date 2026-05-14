-- ============================================================================
-- TRADESUITE — CORE PATCH: FIELD NOTES, CUSTOMER ASSETS, PHOTOS, CALENDAR
--
--  job_notes             → tech field notes per job (internal + customer-facing)
--  customer_assets       → equipment records per customer (HVAC units, water
--                          heaters, panels, etc.) — visible to all modules
--  job_photos            → structured before/during/after photo documentation
--  calendar_integrations → iCal feed tokens + future Google OAuth storage
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

create type photo_type as enum (
  'before',     -- site condition before work begins
  'during',     -- work in progress
  'after',      -- completed work
  'equipment',  -- nameplate scan or equipment photo
  'general'     -- anything else
);

create type asset_type as enum (
  'hvac_unit',          -- furnace, AC, heat pump, mini-split
  'water_heater',
  'electrical_panel',
  'plumbing_fixture',
  'roof_section',
  'appliance',
  'other'
);

create type calendar_provider as enum (
  'ical',       -- read-only iCal feed (phase 1)
  'google'      -- two-way Google Calendar OAuth (phase 2)
);

create type sync_direction as enum (
  'outbound',       -- TradeSuite → calendar only (iCal)
  'bidirectional'   -- two-way (Google OAuth)
);

-- ============================================================================
-- JOB NOTES
--
-- Unstructured tech notes per job. Separate from communication_log
-- (which is customer-facing touchpoints) and attachments (files).
--
-- is_customer_facing controls whether the note appears on invoices/reports.
-- Internal notes are visible to org users only.
-- ============================================================================

create table job_notes (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null references organizations(id) on delete cascade,
  job_id              uuid not null references jobs(id) on delete cascade,
  created_by          uuid not null references users(id) on delete restrict,

  body                text not null check (char_length(body) > 0),

  -- false = internal only (default), true = appears on customer invoice/report
  is_customer_facing  boolean not null default false,

  -- If this note is pinned it appears at the top of the job timeline
  is_pinned           boolean not null default false,

  created_at          timestamptz not null default now(),

  -- Notes are soft-edited — store edit history implicitly via updated_at
  updated_at          timestamptz not null default now()
);

create index job_notes_job_id_idx on job_notes(job_id);
create index job_notes_org_id_idx on job_notes(org_id);

create trigger job_notes_updated_at
  before update on job_notes
  for each row execute function set_updated_at();

comment on table job_notes is
  'Tech field notes per job. is_customer_facing=true surfaces on invoices
   and completion reports. Internal notes are never shown to customers.';

-- ============================================================================
-- CUSTOMER ASSETS
--
-- Equipment and system records per customer. Created when a unit is
-- installed or first serviced. Referenced by jobs, estimates, and
-- RepuGuard proactive outreach ("your unit is 8 years old").
--
-- The ocr_text field on attachments handles nameplate scans.
-- This table holds the structured data extracted from those scans.
-- ============================================================================

create table customer_assets (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null references organizations(id) on delete cascade,
  customer_id         uuid not null references customers(id) on delete cascade,

  asset_type          asset_type not null,
  name                text not null,           -- e.g. "Main HVAC Unit", "Water Heater #2"

  -- Equipment identity
  make                text,                    -- e.g. "Carrier"
  model               text,                    -- e.g. "24ACC636A003"
  serial_number       text,
  refrigerant_type    text,                    -- HVAC: R-410A, R-22, R-32 etc.

  -- Dates
  install_date        date,
  warranty_expiry     date,
  last_service_date   date,                    -- auto-updated on job complete

  -- Physical location at the property
  location_notes      text,                    -- e.g. "Attic, north side"

  notes               text,
  is_active           boolean not null default true,   -- false = removed/replaced

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index customer_assets_customer_id_idx on customer_assets(customer_id);
create index customer_assets_org_id_idx on customer_assets(org_id);
create index customer_assets_warranty_idx
  on customer_assets(warranty_expiry)
  where warranty_expiry is not null and is_active = true;   -- RepuGuard proactive alerts

create trigger customer_assets_updated_at
  before update on customer_assets
  for each row execute function set_updated_at();

comment on table customer_assets is
  'Equipment and systems per customer. Feeds into estimates (pre-fill from
   known equipment), OmniBid (warranty-based pricing), and RepuGuard
   (proactive outreach when warranties expire or service is overdue).';

-- ─── Link: which job serviced which asset ─────────────────────────────────────
-- Many-to-many: one job can service multiple assets, one asset can
-- appear across many jobs. Junction table keeps this clean.

create table job_assets (
  job_id      uuid not null references jobs(id) on delete cascade,
  asset_id    uuid not null references customer_assets(id) on delete cascade,
  org_id      uuid not null references organizations(id) on delete cascade,
  primary key (job_id, asset_id)
);

create index job_assets_asset_id_idx on job_assets(asset_id);

-- ─── Auto-update last_service_date when a job completes ───────────────────────

create or replace function update_asset_service_date()
returns trigger as $$
begin
  if new.status = 'complete' and old.status != 'complete' then
    update customer_assets
    set last_service_date = current_date
    where id in (
      select asset_id from job_assets where job_id = new.id
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger jobs_asset_service_date
  after update on jobs
  for each row execute function update_asset_service_date();

-- ============================================================================
-- JOB PHOTOS
--
-- Structured photo documentation separate from general attachments.
-- Before/during/after slots give contractors a defensible record of
-- site condition and proof of completed work.
--
-- storage_path references Supabase Storage. The record here holds the
-- metadata + context; the file lives in the storage bucket.
-- ============================================================================

create table job_photos (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  job_id          uuid not null references jobs(id) on delete cascade,

  -- Optional: photo of a specific piece of equipment
  asset_id        uuid references customer_assets(id) on delete set null,

  uploaded_by     uuid not null references users(id) on delete restrict,

  photo_type      photo_type not null default 'general',

  -- Supabase Storage
  storage_path    text not null,
  storage_url     text not null,
  filename        text not null,
  mime_type       text not null,
  size_bytes      integer not null check (size_bytes > 0),

  -- Optional caption — appears in completion report and invoice
  caption         text,

  -- OCR text if this is a nameplate/equipment scan (Claude vision)
  ocr_text        text,

  -- Include in customer-facing completion report
  include_in_report boolean not null default false,

  created_at      timestamptz not null default now()
);

create index job_photos_job_id_idx on job_photos(job_id);
create index job_photos_org_id_idx on job_photos(org_id);
create index job_photos_type_idx on job_photos(job_id, photo_type);

comment on table job_photos is
  'Structured before/during/after photo documentation per job.
   Before photos establish site condition (liability).
   After photos prove completed work (disputes, reviews).
   include_in_report=true surfaces them in the completion PDF.';

-- ============================================================================
-- CALENDAR INTEGRATIONS
--
-- Phase 1: iCal feed — one secret token per org. Contractors paste the
-- feed URL into Google Calendar, Apple Calendar, or Outlook. TradeSuite
-- generates an .ics feed from the jobs table on demand.
--
-- Phase 2: Google Calendar OAuth — store access/refresh tokens here.
-- Two-way sync: TradeSuite job → Google event, Google event change →
-- TradeSuite job update (via webhook).
--
-- One row per provider per org.
-- ============================================================================

create table calendar_integrations (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null references organizations(id) on delete cascade,

  provider            calendar_provider not null,

  -- ─── iCal (Phase 1) ──────────────────────────────────────────────────────
  -- Secret token embedded in the feed URL. Rotating this invalidates the
  -- subscription — used if the contractor wants to revoke access.
  ical_token          text unique default encode(gen_random_bytes(24), 'hex'),

  -- ─── Google OAuth (Phase 2) ──────────────────────────────────────────────
  google_account_email    text,
  google_calendar_id      text,          -- target calendar ID in Google
  google_access_token     text,          -- short-lived, refresh regularly
  google_refresh_token    text,          -- long-lived, store securely
  google_token_expiry     timestamptz,

  sync_direction      sync_direction not null default 'outbound',

  -- Which job statuses to include in the calendar
  -- Default: scheduled + active jobs appear; leads don't
  include_statuses    job_status[] not null default '{scheduled,active}',

  last_synced_at      timestamptz,
  is_active           boolean not null default true,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One integration per provider per org
  unique (org_id, provider)
);

create index calendar_integrations_org_id_idx on calendar_integrations(org_id);
create index calendar_integrations_ical_token_idx
  on calendar_integrations(ical_token)
  where ical_token is not null;    -- lookup by token when serving .ics feed

create trigger calendar_integrations_updated_at
  before update on calendar_integrations
  for each row execute function set_updated_at();

comment on table calendar_integrations is
  'iCal feed tokens (Phase 1) and Google Calendar OAuth tokens (Phase 2).
   iCal: serve /cal/{ical_token}.ics from a Supabase Edge Function.
   Google: use refresh_token to keep access_token current via cron.
   Rotating ical_token invalidates all existing subscriptions for that org.';

-- ─── Helper: build the iCal feed URL ─────────────────────────────────────────

create or replace function ical_feed_url(token text)
returns text as $$
  select 'https://app.tradesuite.com/cal/' || token || '.ics';
$$ language sql immutable;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table job_notes             enable row level security;
alter table customer_assets       enable row level security;
alter table job_assets            enable row level security;
alter table job_photos            enable row level security;
alter table calendar_integrations enable row level security;

-- ─── Job Notes ───────────────────────────────────────────────────────────────
-- All org users can read notes on their jobs.
-- Techs can only read/write notes for their assigned jobs.

create policy "job_notes_select_owner_admin" on job_notes
  for select using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

create policy "job_notes_select_tech" on job_notes
  for select using (
    org_id = current_user_org_id()
    and current_user_role() = 'tech'
    and job_id in (
      select id from jobs where assigned_to = current_user_id()
    )
  );

create policy "job_notes_insert" on job_notes
  for insert with check (
    org_id = current_user_org_id()
    and created_by = current_user_id()
  );

create policy "job_notes_update" on job_notes
  for update using (
    org_id = current_user_org_id()
    and (
      -- Can edit your own notes
      created_by = current_user_id()
      -- Owner/admin can edit any note
      or current_user_role() in ('owner', 'admin')
    )
  );

create policy "job_notes_delete" on job_notes
  for delete using (
    org_id = current_user_org_id()
    and (
      created_by = current_user_id()
      or current_user_role() in ('owner', 'admin')
    )
  );

-- ─── Customer Assets ─────────────────────────────────────────────────────────

create policy "customer_assets_select" on customer_assets
  for select using (org_id = current_user_org_id());

create policy "customer_assets_insert" on customer_assets
  for insert with check (org_id = current_user_org_id());

create policy "customer_assets_update" on customer_assets
  for update using (org_id = current_user_org_id());

create policy "customer_assets_delete" on customer_assets
  for delete using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

-- ─── Job Assets (junction) ───────────────────────────────────────────────────

create policy "job_assets_select" on job_assets
  for select using (org_id = current_user_org_id());

create policy "job_assets_insert" on job_assets
  for insert with check (org_id = current_user_org_id());

create policy "job_assets_delete" on job_assets
  for delete using (org_id = current_user_org_id());

-- ─── Job Photos ──────────────────────────────────────────────────────────────

create policy "job_photos_select" on job_photos
  for select using (org_id = current_user_org_id());

create policy "job_photos_insert" on job_photos
  for insert with check (
    org_id = current_user_org_id()
    and uploaded_by = current_user_id()
  );

create policy "job_photos_delete" on job_photos
  for delete using (
    org_id = current_user_org_id()
    and (
      uploaded_by = current_user_id()
      or current_user_role() in ('owner', 'admin')
    )
  );

-- ─── Calendar Integrations ───────────────────────────────────────────────────
-- Techs have no reason to see or manage calendar integrations.

create policy "calendar_select" on calendar_integrations
  for select using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

create policy "calendar_insert" on calendar_integrations
  for insert with check (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

create policy "calendar_update" on calendar_integrations
  for update using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

create policy "calendar_delete" on calendar_integrations
  for delete using (
    org_id = current_user_org_id()
    and current_user_role() = 'owner'
  );

-- ============================================================================
-- REALTIME
-- Job notes are realtime so the owner sees tech notes appear live.
-- ============================================================================

alter publication supabase_realtime add table job_notes;
alter publication supabase_realtime add table job_photos;
