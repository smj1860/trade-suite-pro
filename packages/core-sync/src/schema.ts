import { column, Schema, Table } from '@powersync/web';

// =============================================================================
// TRADESUITE — LOCAL SQLITE SCHEMA
//
// Defines the tables that PowerSync replicates into the device's SQLite DB.
// These mirror the Postgres schema but adapted for SQLite:
//   - No UUID type          → column.text
//   - No JSONB              → column.text  (JSON.stringify / JSON.parse)
//   - No Postgres enums     → column.text
//   - No timestamptz        → column.text  (ISO 8601 string)
//   - No boolean            → column.integer (0 | 1)
//   - No generated columns  → column.integer (computed locally)
//   - Arrays (text[])       → column.text  (JSON.stringify)
//
// Column names must match exactly what the sync-rules.yaml SELECT returns.
// =============================================================================

// ─── Core: Organizations ─────────────────────────────────────────────────────

const organizations = new Table(
  {
    name:              column.text,
    phone:             column.text,
    email:             column.text,
    address:           column.text,
    city:              column.text,
    state:             column.text,
    zip:               column.text,
    logo_url:          column.text,
    trade_types:       column.text,    // JSON: string[]
    timezone:          column.text,
    active_modules:    column.text,    // JSON: ModuleName[]
    created_at:        column.text,
    updated_at:        column.text,
  },
  { indexes: {} }
);

// ─── Core: Users ─────────────────────────────────────────────────────────────

const users = new Table(
  {
    org_id:              column.text,
    name:                column.text,
    email:               column.text,
    phone:               column.text,
    role:                column.text,    // 'owner' | 'admin' | 'tech'
    is_active:           column.integer, // 0 | 1
    avatar_url:          column.text,
    notification_prefs:  column.text,    // JSON: NotificationPrefs
    created_at:          column.text,
    updated_at:          column.text,
  },
  {
    indexes: {
      org_id: ['org_id'],
    },
  }
);

// ─── Core: Customers ─────────────────────────────────────────────────────────

const customers = new Table(
  {
    org_id:                   column.text,
    name:                     column.text,
    phone:                    column.text,
    email:                    column.text,
    address:                  column.text,
    city:                     column.text,
    state:                    column.text,
    zip:                      column.text,
    preferred_contact_method: column.text,
    notes:                    column.text,
    tags:                     column.text,    // JSON: string[]
    sms_opt_out:              column.integer,
    email_opt_out:            column.integer,
    created_at:               column.text,
    updated_at:               column.text,
  },
  {
    indexes: {
      org_id:  ['org_id'],
      // SQLite FTS is handled separately for name search
    },
  }
);

// ─── Core: Customer Assets ───────────────────────────────────────────────────

const customer_assets = new Table(
  {
    org_id:           column.text,
    customer_id:      column.text,
    asset_type:       column.text,
    name:             column.text,
    make:             column.text,
    model:            column.text,
    serial_number:    column.text,
    refrigerant_type: column.text,
    install_date:     column.text,
    warranty_expiry:  column.text,
    last_service_date: column.text,
    location_notes:   column.text,
    notes:            column.text,
    is_active:        column.integer,
    created_at:       column.text,
    updated_at:       column.text,
  },
  {
    indexes: {
      customer_id: ['customer_id'],
      org_id:      ['org_id'],
    },
  }
);

// ─── Core: Job-Asset links ────────────────────────────────────────────────────

const job_assets = new Table(
  {
    job_id:   column.text,
    asset_id: column.text,
    org_id:   column.text,
  },
  {
    indexes: {
      job_id:   ['job_id'],
      asset_id: ['asset_id'],
    },
  }
);

// ─── Core: Jobs ──────────────────────────────────────────────────────────────

const jobs = new Table(
  {
    org_id:                 column.text,
    customer_id:            column.text,
    title:                  column.text,
    description:            column.text,
    status:                 column.text,
    source:                 column.text,
    assigned_to:            column.text,
    location:               column.text,
    trade_type:             column.text,
    scheduled_at:           column.text,
    completed_at:           column.text,
    estimated_value_cents:  column.integer,
    final_value_cents:      column.integer,
    job_number:             column.text,
    created_at:             column.text,
    updated_at:             column.text,
  },
  {
    indexes: {
      org_id:      ['org_id'],
      customer_id: ['customer_id'],
      assigned_to: ['assigned_to'],
      status:      ['org_id', 'status'],
      scheduled:   ['scheduled_at'],
    },
  }
);

// ─── Core: Job Notes ─────────────────────────────────────────────────────────

const job_notes = new Table(
  {
    org_id:             column.text,
    job_id:             column.text,
    created_by:         column.text,
    body:               column.text,
    is_customer_facing: column.integer,
    is_pinned:          column.integer,
    created_at:         column.text,
    updated_at:         column.text,
  },
  {
    indexes: {
      job_id: ['job_id'],
    },
  }
);

// ─── Core: Job Photos ────────────────────────────────────────────────────────

const job_photos = new Table(
  {
    org_id:            column.text,
    job_id:            column.text,
    asset_id:          column.text,
    uploaded_by:       column.text,
    photo_type:        column.text,
    storage_path:      column.text,
    storage_url:       column.text,
    filename:          column.text,
    mime_type:         column.text,
    size_bytes:        column.integer,
    caption:           column.text,
    include_in_report: column.integer,
    created_at:        column.text,
  },
  {
    indexes: {
      job_id:     ['job_id'],
      photo_type: ['job_id', 'photo_type'],
    },
  }
);

// ─── Core: Job Events ────────────────────────────────────────────────────────

const job_events = new Table(
  {
    org_id:        column.text,
    job_id:        column.text,
    event_type:    column.text,
    payload:       column.text,    // JSON: Record<string, unknown>
    source_module: column.text,
    created_by:    column.text,
    created_at:    column.text,
  },
  {
    indexes: {
      job_id:     ['job_id'],
      event_type: ['org_id', 'event_type'],
    },
  }
);

// ─── Core: Communication Log ─────────────────────────────────────────────────

const communication_log = new Table(
  {
    org_id:        column.text,
    job_id:        column.text,
    customer_id:   column.text,
    channel:       column.text,
    direction:     column.text,
    subject:       column.text,
    body:          column.text,
    status:        column.text,
    source_module: column.text,
    external_id:   column.text,
    created_at:    column.text,
  },
  {
    indexes: {
      customer_id: ['customer_id'],
      job_id:      ['job_id'],
    },
  }
);

// ─── Core: Follow-Up Sequences ───────────────────────────────────────────────

const follow_up_sequences = new Table(
  {
    org_id:           column.text,
    job_id:           column.text,
    customer_id:      column.text,
    status:           column.text,
    current_step:     column.integer,
    total_steps:      column.integer,
    trigger_event:    column.text,
    source_module:    column.text,
    last_fired_at:    column.text,
    next_fire_at:     column.text,
    cancelled_reason: column.text,
    cancelled_at:     column.text,
    created_at:       column.text,
    updated_at:       column.text,
  },
  {
    indexes: {
      job_id: ['job_id'],
      status: ['status'],
    },
  }
);

// ─── Core: Booking Tokens ────────────────────────────────────────────────────

const booking_tokens = new Table(
  {
    org_id:      column.text,
    job_id:      column.text,
    customer_id: column.text,
    token:       column.text,
    clicked_at:  column.text,
    click_count: column.integer,
    booked_at:   column.text,
    expires_at:  column.text,
    is_revoked:  column.integer,
    created_at:  column.text,
  },
  {
    indexes: {
      job_id: ['job_id'],
      token:  ['token'],
    },
  }
);

// ─── OmniBid: Estimates ──────────────────────────────────────────────────────

const estimates = new Table(
  {
    org_id:          column.text,
    job_id:          column.text,
    customer_id:     column.text,
    created_by:      column.text,
    estimate_number: column.text,
    status:          column.text,
    ai_generated:    column.integer,
    expiry_date:     column.text,
    subtotal_cents:  column.integer,
    tax_rate:        column.real,
    tax_cents:       column.integer,
    total_cents:     column.integer,
    customer_note:   column.text,
    internal_note:   column.text,    // null for tech role (filtered in sync-rules)
    sent_at:         column.text,
    sent_via:        column.text,
    viewed_at:       column.text,
    view_count:      column.integer,
    accepted_at:     column.text,
    accepted_tier:   column.text,
    pdf_url:         column.text,
    view_token:      column.text,
    created_at:      column.text,
    updated_at:      column.text,
  },
  {
    indexes: {
      job_id: ['job_id'],
      status: ['org_id', 'status'],
    },
  }
);

// ─── OmniBid: Estimate Line Items ────────────────────────────────────────────

const estimate_line_items = new Table(
  {
    org_id:            column.text,
    estimate_id:       column.text,
    tier:              column.text,
    sort_order:        column.integer,
    description:       column.text,
    category:          column.text,
    quantity:          column.real,
    unit:              column.text,
    unit_price_cents:  column.integer,
    total_cents:       column.integer,
    is_customer_facing: column.integer,
    created_at:        column.text,
  },
  {
    indexes: {
      estimate_id: ['estimate_id'],
    },
  }
);

// ─── OmniBid: Invoices ───────────────────────────────────────────────────────

const invoices = new Table(
  {
    org_id:                 column.text,
    job_id:                 column.text,
    customer_id:            column.text,
    estimate_id:            column.text,
    invoice_number:         column.text,
    status:                 column.text,
    subtotal_cents:         column.integer,
    tax_cents:              column.integer,
    total_cents:            column.integer,
    paid_cents:             column.integer,
    balance_cents:          column.integer,
    due_date:               column.text,
    customer_note:          column.text,
    payment_link_url:       column.text,
    sent_at:                column.text,
    sent_via:               column.text,
    viewed_at:              column.text,
    view_count:             column.integer,
    paid_at:                column.text,
    view_token:             column.text,
    created_at:             column.text,
    updated_at:             column.text,
  },
  {
    indexes: {
      job_id: ['job_id'],
      status: ['org_id', 'status'],
    },
  }
);

// ─── OmniBid: Invoice Payments ───────────────────────────────────────────────

const invoice_payments = new Table(
  {
    org_id:                    column.text,
    invoice_id:                column.text,
    amount_cents:              column.integer,
    method:                    column.text,
    stripe_payment_intent_id:  column.text,
    recorded_by:               column.text,
    reference_number:          column.text,
    paid_at:                   column.text,
    notes:                     column.text,
    created_at:                column.text,
  },
  {
    indexes: {
      invoice_id: ['invoice_id'],
    },
  }
);

// =============================================================================
// ASSEMBLED SCHEMA
// This is what you pass to PowerSyncDatabase({ schema })
// =============================================================================

export const AppSchema = new Schema({
  // Core
  organizations,
  users,
  customers,
  customer_assets,
  job_assets,
  jobs,
  job_notes,
  job_photos,
  job_events,
  communication_log,
  follow_up_sequences,
  booking_tokens,

  // OmniBid
  estimates,
  estimate_line_items,
  invoices,
  invoice_payments,
});

export type Database = (typeof AppSchema)['types'];
