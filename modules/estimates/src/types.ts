export type EstimateStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'invoiced'
  | 'paid'
  | 'superseded';

export type PriceUnit = 'each' | 'hour' | 'sqft' | 'lnft' | 'ton' | 'lb' | 'ft';

export interface PriceBookItem {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: PriceUnit;
  unit_price: number;   // dollars (price book stores dollars)
  taxable: boolean;
  aliases: string[] | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Estimate {
  id: string;
  org_id: string;
  customer_id: string | null;
  job_id: string | null;
  created_by: string | null;
  estimate_number: string;
  status: EstimateStatus;
  ai_generated: number | null;
  expiry_date: string | null;
  subtotal_cents: number;
  tax_rate: number;
  tax_cents: number;
  total_cents: number;
  customer_note: string | null;
  internal_note: string | null;
  sent_at: string | null;
  sent_via: string | null;
  viewed_at: string | null;
  view_count: number;
  accepted_at: string | null;
  accepted_tier: string | null;
  pdf_url: string | null;
  view_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface EstimateItem {
  id: string;
  org_id: string;
  estimate_id: string;
  tier: string;
  sort_order: number;
  description: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  unit_price_cents: number;
  total_cents: number;
  is_customer_facing: number;   // SQLite 0|1
  created_at: string;
}

export interface EstimateWithItems extends Estimate {
  items: EstimateItem[];
}

export interface VoiceParseResult {
  title: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: PriceUnit;
    unit_price: number;
    price_book_id: string | null;
    confidence: 'high' | 'medium' | 'low';
  }>;
  raw_transcript: string;
}

export interface EstimateSentEvent {
  name: 'omnibid/estimate.sent';
  data: {
    estimate_id: string;
    org_id: string;
    customer_email: string;
    customer_name: string | null;
  };
}

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'void';

export interface Invoice {
  id: string;
  org_id: string;
  job_id: string;
  customer_id: string;
  created_by: string;
  estimate_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal_cents: number;
  tax_cents: number;
  tax_rate: number;
  total_cents: number;
  balance_cents: number;
  due_date: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  payment_link_url: string | null;
  view_token: string | null;
  customer_note: string | null;
  created_at: string;
  updated_at: string;
}
