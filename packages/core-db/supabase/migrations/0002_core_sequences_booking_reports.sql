-- ============================================================================
-- TRADESUITE — CORE PATCH: SEQUENCES, BOOKING TOKENS, REPORT RUNS
--
-- Adds three tables that the module schema discussions revealed belong in
-- core (not in individual modules) because they cross module boundaries
-- or are needed before any module is active.
--
--  follow_up_sequences  → state machine for LeadLock drip sequences.
--                         OmniBid reads/triggers these via job_events,
--                         so state must be visible to all modules.
--
--  booking_tokens       → tokenized booking links sent in the very first
--                         missed-call SMS, before any module is active.
--
--  report_runs          → scheduled report log for RepuGuard monthly
--                         summaries. Tracked at core so Inngest can
--                         deduplicate across restarts.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_bytes for tokens

-- ============================================================================
-- ENUMS
-- ============================================================================

create type sequence_status as enum (
  'active',       -- steps still firing
  'paused',       -- manually paused by owner/admin
  'completed',    -- all steps fired with no response needed
  'cancelled'     -- stopped early (customer replied, booked, estimate accepted)
);

create type report_status as enum (
  'pending',      -- queued, not yet started
  'generating',   -- Inngest job is running
  'sent',         -- delivered to recipient
  'failed'        -- error during generation or send
);

create type report_type as enum (
  'monthly_reputation',    -- RepuGuard monthly star/count summary
  'weekly_leads',          -- LeadLock weekly lead + conversion summary
  'monthly_revenue'        -- OmniBid monthly estimate + won job summary
);

-- ============================================================================
-- FOLLOW-UP SEQUENCES
--
-- One row per active sequence per job. When a sequence is cancelled or
-- completed, the row is updated (not deleted) so history is preserved.
--
-- Steps are not stored here — they live in the leads module as
-- sequence_templates. This table only tracks WHICH step the job is on
-- and WHEN the next step fires.
-- ============================================================================

create table follow_up_sequences (
  id                uuid primary key default uuid_generate_v4(),
  org_id            uuid not null references organizations(id) on delete cascade,
  job_id            uuid not null references jobs(id) on delete cascade,
  customer_id       uuid not null references customers(id) on delete cascade,

  status            sequence_status not null default 'active',

  -- Step tracking (0-indexed — step 0 is the first message)
  current_step      integer not null default 0 check (current_step >= 0),
  total_steps       integer not null default 4 check (total_steps > 0),

  -- What event started this sequence
  -- e.g. 'lead.captured' (missed call) or 'estimate.sent' (OmniBid)
  trigger_event     job_event_type not null,
  source_module     source_module not null,

  -- Timing
  last_fired_at     timestamptz,
  next_fire_at      timestamptz,

  -- Populated when status → cancelled
  cancelled_reason  text,    -- e.g. 'customer_replied', 'estimate_accepted', 'manual'
  cancelled_at      timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Only one ACTIVE sequence per job at a time
create unique index follow_up_sequences_active_job_idx
  on follow_up_sequences(job_id)
  where status = 'active';

create index follow_up_sequences_org_id_idx on follow_up_sequences(org_id);
create index follow_up_sequences_next_fire_idx
  on follow_up_sequences(next_fire_at)
  where status = 'active';    -- Inngest polls this to find sequences due to fire

create trigger follow_up_sequences_updated_at
  before update on follow_up_sequences
  for each row execute function set_updated_at();

comment on table follow_up_sequences is
  'State machine for LeadLock drip sequences. One active row per job max.
   Inngest queries next_fire_at to schedule step execution.
   Cancelled when: customer replies, books, or estimate is accepted.';

-- ============================================================================
-- BOOKING TOKENS
--
-- Short-lived tokenized URLs included in every first-contact SMS.
-- Example: https://app.tradesuite.com/book/a3f9b2c1...
-- The token resolves to a pre-filled booking page for that customer+job.
-- ============================================================================

create table booking_tokens (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  job_id          uuid not null references jobs(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete cascade,

  -- 32-char hex token — URL safe, unique, unguessable
  token           text not null unique
                    default encode(gen_random_bytes(16), 'hex'),

  -- Engagement tracking
  clicked_at      timestamptz,
  click_count     integer not null default 0,
  booked_at       timestamptz,

  -- Expiry — 7 days default, renewable
  expires_at      timestamptz not null default now() + interval '7 days',

  -- Soft invalidation without deleting the record
  is_revoked      boolean not null default false,

  created_at      timestamptz not null default now()
);

create index booking_tokens_token_idx on booking_tokens(token);
create index booking_tokens_job_id_idx on booking_tokens(job_id);
create index booking_tokens_org_id_idx on booking_tokens(org_id);

comment on table booking_tokens is
  'Tokenized booking links included in first-contact missed-call SMS.
   Expires after 7 days. click_count tracks engagement even before booking.
   is_revoked allows invalidation without deleting history.';

-- ─── Helper function: generate a booking URL ──────────────────────────────────

create or replace function booking_token_url(token text)
returns text as $$
  -- Replace with your actual domain before going live
  select 'https://app.tradesuite.com/book/' || token;
$$ language sql immutable;

-- ============================================================================
-- REPORT RUNS
--
-- Tracks every scheduled report generation attempt.
-- Used by Inngest to avoid duplicate sends after retries.
-- Payload stored as jsonb so reports can be re-sent without regenerating.
-- ============================================================================

create table report_runs (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,

  report_type     report_type not null,
  source_module   source_module not null,

  -- The time window this report covers
  period_start    timestamptz not null,
  period_end      timestamptz not null,

  status          report_status not null default 'pending',

  -- Delivery
  sent_at         timestamptz,
  sent_to_email   text,        -- recipient email at send time (org owner)

  -- Error detail for failed runs
  error           text,
  retry_count     integer not null default 0,

  -- Full report data — stored so the report can be re-delivered without
  -- re-querying all the underlying data
  payload         jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Prevent duplicate reports for the same org + type + period
create unique index report_runs_dedup_idx
  on report_runs(org_id, report_type, period_start, period_end)
  where status != 'failed';

create index report_runs_org_id_idx on report_runs(org_id);
create index report_runs_status_idx on report_runs(status)
  where status in ('pending', 'generating');   -- Inngest polls these

create trigger report_runs_updated_at
  before update on report_runs
  for each row execute function set_updated_at();

comment on table report_runs is
  'Tracks every report generation attempt for RepuGuard, LeadLock, OmniBid.
   Unique constraint on (org, type, period) prevents duplicate sends after
   Inngest retries. Payload stored for re-delivery without re-querying.';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table follow_up_sequences  enable row level security;
alter table booking_tokens        enable row level security;
alter table report_runs           enable row level security;

-- ─── Follow-up Sequences ─────────────────────────────────────────────────────
-- Techs can see sequences for their assigned jobs only.
-- Owner/admin see all.

create policy "sequences_select_owner_admin" on follow_up_sequences
  for select using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

create policy "sequences_select_tech" on follow_up_sequences
  for select using (
    org_id = current_user_org_id()
    and current_user_role() = 'tech'
    and job_id in (
      select id from jobs where assigned_to = current_user_id()
    )
  );

create policy "sequences_insert" on follow_up_sequences
  for insert with check (org_id = current_user_org_id());

create policy "sequences_update" on follow_up_sequences
  for update using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

-- Sequences are never hard-deleted — cancelled_reason tracks why they stopped

-- ─── Booking Tokens ──────────────────────────────────────────────────────────
-- All org users can read tokens (needed to verify bookings in the dashboard).
-- Only owner/admin can revoke.

create policy "booking_tokens_select" on booking_tokens
  for select using (org_id = current_user_org_id());

create policy "booking_tokens_insert" on booking_tokens
  for insert with check (org_id = current_user_org_id());

create policy "booking_tokens_update" on booking_tokens
  for update using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

-- ─── Report Runs ─────────────────────────────────────────────────────────────
-- Techs have no business seeing report runs.
-- Owner/admin only.

create policy "report_runs_select" on report_runs
  for select using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

create policy "report_runs_insert" on report_runs
  for insert with check (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

create policy "report_runs_update" on report_runs
  for update using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

-- ============================================================================
-- REALTIME
-- Sequences are realtime so the dashboard reacts when Inngest updates them.
-- ============================================================================

alter publication supabase_realtime add table follow_up_sequences;
