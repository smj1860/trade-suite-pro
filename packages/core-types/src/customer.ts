// ─── Contact Method ───────────────────────────────────────────────────────────

export type ContactMethod = 'sms' | 'email' | 'call';

// ─── Customer ─────────────────────────────────────────────────────────────────
//
//  One customer record is shared across all three modules.
//  A customer can have many jobs over their lifetime.

export interface Customer {
  id: string;
  org_id: string;
  name: string;
  phone: string | null;
  email: string | null;

  // Address — stored flat for easy display and map lookup
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;

  preferred_contact_method: ContactMethod;

  // Freeform notes visible to all users in the org
  notes: string | null;

  // Tags for filtering (e.g. "vip", "commercial", "warranty")
  tags: string[];

  // Opt-out flags — respect these before sending any message
  sms_opt_out: boolean;
  email_opt_out: boolean;

  created_at: string;
  updated_at: string;
}

export type CustomerInsert = Omit<Customer, 'id' | 'created_at' | 'updated_at'>;
export type CustomerUpdate = Partial<Omit<CustomerInsert, 'org_id'>>;

// ─── Customer with job count (for list views) ─────────────────────────────────

export interface CustomerSummary extends Customer {
  job_count: number;
  last_job_at: string | null;
  total_revenue_cents: number;
}
