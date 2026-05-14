-- ============================================================================
-- OMNIBID MODULE SCHEMA
--
-- Estimates, line items, Good/Better/Best tiers, invoices, and payments.
-- Depends on core schema (organizations, customers, jobs, users).
--
-- Workflow:
--   Job site walkthrough
--     → AI generates estimate (draft)
--     → Contractor reviews + adjusts
--     → Estimate sent to customer (SMS/email)
--     → Customer views and accepts (or rejects)
--     → Accepted estimate → converted to invoice
--     → Invoice sent with payment link (Stripe)
--     → Customer pays via link OR contractor collects on-site via Terminal
--     → Job event 'job.completed' fires → RepuGuard sequence starts
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

create type estimate_status as enum (
  'draft',       -- being built, not sent
  'sent',        -- sent to customer, awaiting response
  'viewed',      -- customer opened the estimate link
  'accepted',    -- customer approved
  'rejected',    -- customer declined
  'expired',     -- past expiry_date with no response
  'superseded'   -- a revised estimate was sent, this one is no longer active
);

create type estimate_tier as enum (
  'single',   -- one price, no tiers
  'good',     -- Good / Better / Best — lowest option
  'better',
  'best'
);

create type invoice_status as enum (
  'draft',      -- converted from estimate, not yet sent
  'sent',       -- payment link sent to customer
  'viewed',     -- customer opened payment link
  'partial',    -- partial payment received
  'paid',       -- paid in full
  'overdue',    -- past due_date with balance remaining
  'void'        -- cancelled
);

create type payment_method as enum (
  'card_terminal',    -- Stripe Terminal (on-site card reader)
  'payment_link',     -- Stripe payment link (customer pays online)
  'cash',             -- recorded manually
  'check'             -- recorded manually
);

-- ============================================================================
-- ESTIMATES
-- ============================================================================

create table estimates (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null references organizations(id) on delete cascade,
  job_id              uuid not null references jobs(id) on delete cascade,
  customer_id         uuid not null references customers(id) on delete cascade,
  created_by          uuid not null references users(id) on delete restrict,

  -- Human-readable reference number
  estimate_number     text not null unique
                        default 'EST-' || lpad(nextval('job_number_seq')::text, 5, '0'),

  status              estimate_status not null default 'draft',

  -- Did AI generate the initial draft?
  ai_generated        boolean not null default false,

  -- Expiry — contractor can set how long the estimate is valid
  expiry_date         date,

  -- Totals (all in cents)
  subtotal_cents      integer not null default 0 check (subtotal_cents >= 0),
  tax_rate            numeric(5,4) not null default 0,    -- e.g. 0.0875 = 8.75%
  tax_cents           integer not null default 0 check (tax_cents >= 0),
  total_cents         integer not null default 0 check (total_cents >= 0),

  -- Customer-facing note (appears on the estimate PDF)
  customer_note       text,

  -- Internal note (never shown to customer)
  internal_note       text,

  -- Delivery tracking
  sent_at             timestamptz,
  sent_via            text,              -- 'sms' | 'email'
  viewed_at           timestamptz,
  view_count          integer not null default 0,

  -- Acceptance
  accepted_at         timestamptz,
  accepted_tier       estimate_tier,     -- which tier they chose (if multi-tier)
  signature_url       text,              -- Supabase Storage path to signature image
  rejection_reason    text,

  -- PDF
  pdf_url             text,              -- generated and stored in Supabase Storage

  -- Public token for the customer-facing estimate page (read-only, no auth)
  view_token          text unique default encode(gen_random_bytes(16), 'hex'),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index estimates_org_id_idx on estimates(org_id);
create index estimates_job_id_idx on estimates(job_id);
create index estimates_customer_id_idx on estimates(customer_id);
create index estimates_status_idx on estimates(org_id, status);
create index estimates_view_token_idx on estimates(view_token);   -- public page lookup

create trigger estimates_updated_at
  before update on estimates
  for each row execute function set_updated_at();

-- ============================================================================
-- ESTIMATE LINE ITEMS
--
-- Each estimate has line items for labor, materials, and other costs.
-- For Good/Better/Best estimates, line items are tagged with a tier.
-- 'single' tier items appear in all tiers.
-- ============================================================================

create table estimate_line_items (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  estimate_id     uuid not null references estimates(id) on delete cascade,

  -- Which tier this line item belongs to
  -- 'single' = appears in all tiers (or estimate has no tiers)
  tier            estimate_tier not null default 'single',

  sort_order      integer not null default 0,

  description     text not null,
  category        text,          -- 'labor', 'materials', 'equipment', 'other'

  quantity        numeric(10,2) not null default 1 check (quantity > 0),
  unit            text,          -- 'hours', 'sq ft', 'units', etc.
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  total_cents     integer not null default 0,    -- computed: quantity * unit_price_cents

  -- Show/hide on customer-facing estimate (some items are internal cost tracking)
  is_customer_facing boolean not null default true,

  created_at      timestamptz not null default now()
);

create index estimate_line_items_estimate_id_idx on estimate_line_items(estimate_id);

-- ─── Auto-recalculate estimate totals when line items change ──────────────────

create or replace function recalculate_estimate_totals()
returns trigger as $$
declare
  v_subtotal integer;
  v_tax_rate numeric;
  v_tax integer;
begin
  -- Use the estimate_id from whichever row triggered this
  with item_totals as (
    select
      coalesce(sum(total_cents) filter (
        where tier = 'single'
          or tier = (
            select accepted_tier from estimates
            where id = coalesce(new.estimate_id, old.estimate_id)
          )
          or (select accepted_tier from estimates
              where id = coalesce(new.estimate_id, old.estimate_id)) is null
      ), 0) as subtotal
    from estimate_line_items
    where estimate_id = coalesce(new.estimate_id, old.estimate_id)
      and is_customer_facing = true
  )
  select
    subtotal,
    e.tax_rate,
    round(subtotal * e.tax_rate)
  into v_subtotal, v_tax_rate, v_tax
  from item_totals
  join estimates e on e.id = coalesce(new.estimate_id, old.estimate_id);

  update estimates set
    subtotal_cents = v_subtotal,
    tax_cents      = v_tax,
    total_cents    = v_subtotal + v_tax
  where id = coalesce(new.estimate_id, old.estimate_id);

  return new;
end;
$$ language plpgsql;

create trigger estimate_line_items_recalculate
  after insert or update or delete on estimate_line_items
  for each row execute function recalculate_estimate_totals();

-- ============================================================================
-- INVOICES
--
-- An invoice is always converted from an accepted estimate.
-- estimate_id is required — you can't create an invoice from scratch.
-- This preserves the full paper trail from quote to payment.
-- ============================================================================

create table invoices (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null references organizations(id) on delete cascade,
  job_id              uuid not null references jobs(id) on delete cascade,
  customer_id         uuid not null references customers(id) on delete cascade,
  estimate_id         uuid not null unique references estimates(id) on delete restrict,

  invoice_number      text not null unique
                        default 'INV-' || lpad(nextval('job_number_seq')::text, 5, '0'),

  status              invoice_status not null default 'draft',

  -- Financials (in cents) — copied from accepted estimate at conversion time
  subtotal_cents      integer not null check (subtotal_cents >= 0),
  tax_cents           integer not null check (tax_cents >= 0),
  total_cents         integer not null check (total_cents >= 0),

  -- Running balance
  paid_cents          integer not null default 0 check (paid_cents >= 0),
  balance_cents       integer generated always as (total_cents - paid_cents) stored,

  due_date            date,

  -- Customer-facing note on the invoice
  customer_note       text,

  -- Stripe
  stripe_payment_intent_id  text unique,
  payment_link_url          text,              -- Stripe-hosted payment page
  payment_link_expires_at   timestamptz,

  -- Delivery
  sent_at             timestamptz,
  sent_via            text,
  viewed_at           timestamptz,
  view_count          integer not null default 0,

  paid_at             timestamptz,

  -- Public token for customer-facing invoice page
  view_token          text unique default encode(gen_random_bytes(16), 'hex'),

  pdf_url             text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index invoices_org_id_idx on invoices(org_id);
create index invoices_job_id_idx on invoices(job_id);
create index invoices_customer_id_idx on invoices(customer_id);
create index invoices_status_idx on invoices(org_id, status);
create index invoices_due_date_idx on invoices(due_date)
  where status in ('sent', 'viewed', 'partial');   -- overdue check query

create trigger invoices_updated_at
  before update on invoices
  for each row execute function set_updated_at();

-- ─── Auto-mark invoice overdue ────────────────────────────────────────────────
-- Run this from a pg_cron job or Inngest scheduled function daily.

create or replace function mark_overdue_invoices()
returns void as $$
  update invoices
  set status = 'overdue'
  where due_date < current_date
    and status in ('sent', 'viewed', 'partial')
    and balance_cents > 0;
$$ language sql;

-- ============================================================================
-- INVOICE PAYMENTS
--
-- One invoice can have multiple payments (partial payments, then final).
-- Each payment is one Stripe charge or one manual record.
-- ============================================================================

create table invoice_payments (
  id                          uuid primary key default uuid_generate_v4(),
  org_id                      uuid not null references organizations(id) on delete cascade,
  invoice_id                  uuid not null references invoices(id) on delete cascade,

  amount_cents                integer not null check (amount_cents > 0),
  method                      payment_method not null,

  -- Stripe identifiers (null for cash/check)
  stripe_payment_intent_id    text unique,
  stripe_charge_id            text unique,

  -- For cash/check: who recorded it and any reference number
  recorded_by                 uuid references users(id) on delete set null,
  reference_number            text,     -- check number, etc.

  paid_at                     timestamptz not null default now(),
  notes                       text,

  created_at                  timestamptz not null default now()
);

create index invoice_payments_invoice_id_idx on invoice_payments(invoice_id);
create index invoice_payments_org_id_idx on invoice_payments(org_id);

-- ─── Auto-update invoice paid_cents and status after payment ──────────────────

create or replace function update_invoice_after_payment()
returns trigger as $$
declare
  v_total_paid integer;
  v_invoice_total integer;
begin
  select
    coalesce(sum(amount_cents), 0),
    total_cents
  into v_total_paid, v_invoice_total
  from invoice_payments
  join invoices on invoices.id = coalesce(new.invoice_id, old.invoice_id)
  where invoice_payments.invoice_id = coalesce(new.invoice_id, old.invoice_id);

  update invoices set
    paid_cents = v_total_paid,
    status = case
      when v_total_paid >= v_invoice_total then 'paid'
      when v_total_paid > 0               then 'partial'
      else status
    end,
    paid_at = case
      when v_total_paid >= v_invoice_total then now()
      else paid_at
    end
  where id = coalesce(new.invoice_id, old.invoice_id);

  return new;
end;
$$ language plpgsql;

create trigger invoice_payments_update_invoice
  after insert or delete on invoice_payments
  for each row execute function update_invoice_after_payment();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table estimates           enable row level security;
alter table estimate_line_items enable row level security;
alter table invoices            enable row level security;
alter table invoice_payments    enable row level security;

-- ─── Estimates ───────────────────────────────────────────────────────────────

create policy "estimates_select_owner_admin" on estimates
  for select using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

create policy "estimates_select_tech" on estimates
  for select using (
    org_id = current_user_org_id()
    and current_user_role() = 'tech'
    and job_id in (select id from jobs where assigned_to = current_user_id())
  );

create policy "estimates_insert" on estimates
  for insert with check (org_id = current_user_org_id());

create policy "estimates_update" on estimates
  for update using (
    org_id = current_user_org_id()
    and (
      current_user_role() in ('owner', 'admin')
      or (current_user_role() = 'tech'
          and job_id in (select id from jobs where assigned_to = current_user_id())
          and status = 'draft')
    )
  );

-- ─── Estimate Line Items ──────────────────────────────────────────────────────

create policy "line_items_select" on estimate_line_items
  for select using (org_id = current_user_org_id());

create policy "line_items_insert" on estimate_line_items
  for insert with check (org_id = current_user_org_id());

create policy "line_items_update" on estimate_line_items
  for update using (org_id = current_user_org_id());

create policy "line_items_delete" on estimate_line_items
  for delete using (org_id = current_user_org_id());

-- ─── Invoices ────────────────────────────────────────────────────────────────

create policy "invoices_select_owner_admin" on invoices
  for select using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

create policy "invoices_select_tech" on invoices
  for select using (
    org_id = current_user_org_id()
    and current_user_role() = 'tech'
    and job_id in (select id from jobs where assigned_to = current_user_id())
  );

create policy "invoices_insert" on invoices
  for insert with check (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

create policy "invoices_update" on invoices
  for update using (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

-- ─── Invoice Payments ────────────────────────────────────────────────────────

create policy "payments_select" on invoice_payments
  for select using (org_id = current_user_org_id());

create policy "payments_insert" on invoice_payments
  for insert with check (
    org_id = current_user_org_id()
    and current_user_role() in ('owner', 'admin')
  );

-- Payments are immutable — no update or delete policies.
-- Corrections are handled by voiding the invoice and creating a new one.

-- ============================================================================
-- REALTIME
-- ============================================================================

alter publication supabase_realtime add table estimates;
alter publication supabase_realtime add table invoices;
alter publication supabase_realtime add table invoice_payments;
