// packages/module-omnibid/src/schema.ts
// PowerSync local schema for OmniBid.
// Price book is fully synced — needed offline for building estimates on-site.
// Estimate items are synced; estimate PDFs are not (generated server-side).

import { column, Schema, Table } from '@powersync/web';

const price_book = new Table(
  {
    org_id:      column.text,
    name:        column.text,
    description: column.text,
    category:    column.text,
    unit:        column.text,
    unit_price:  column.real,
    taxable:     column.integer,   // 0 | 1
    aliases:     column.text,      // JSON array stored as text
    active:      column.integer,
    created_at:  column.text,
    updated_at:  column.text,
  },
  { indexes: { by_category: ['category', 'name'] } }
);

const estimates = new Table(
  {
    org_id:                  column.text,
    customer_id:             column.text,
    job_id:                  column.text,
    estimate_number:         column.text,
    status:                  column.text,
    title:                   column.text,
    notes:                   column.text,
    customer_notes:          column.text,
    subtotal:                column.real,
    tax_rate:                column.real,
    tax_amount:              column.real,
    total:                   column.real,
    stripe_payment_link_url: column.text,
    sent_at:                 column.text,
    viewed_at:               column.text,
    accepted_at:             column.text,
    paid_at:                 column.text,
    expires_at:              column.text,
    created_at:              column.text,
    updated_at:              column.text,
  },
  { indexes: { by_status: ['status', 'created_at'] } }
);

const estimate_items = new Table(
  {
    org_id:        column.text,
    estimate_id:   column.text,
    price_book_id: column.text,
    sort_order:    column.integer,
    name:          column.text,
    description:   column.text,
    quantity:      column.real,
    unit:          column.text,
    unit_price:    column.real,
    line_total:    column.real,
    taxable:       column.integer,
    created_at:    column.text,
  },
  { indexes: { by_estimate: ['estimate_id', 'sort_order'] } }
);

export const omnibidSchema = new Schema({ price_book, estimates, estimate_items });
