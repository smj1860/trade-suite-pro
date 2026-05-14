// packages/module-omnibid/src/types.ts

export type EstimateStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'invoiced'
  | 'paid';

export type PriceUnit = 'each' | 'hour' | 'sqft' | 'lnft' | 'ton' | 'lb' | 'ft';

export interface PriceBookItem {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: PriceUnit;
  unit_price: number;
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
  estimate_number: string;
  status: EstimateStatus;
  title: string | null;
  notes: string | null;
  customer_notes: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  stripe_payment_link_id: string | null;
  stripe_payment_link_url: string | null;
  resend_email_id: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EstimateItem {
  id: string;
  org_id: string;
  estimate_id: string;
  price_book_id: string | null;
  sort_order: number;
  name: string;
  description: string | null;
  quantity: number;
  unit: PriceUnit;
  unit_price: number;
  line_total: number;          // computed column
  taxable: boolean;
  created_at: string;
}

// Composed type for the UI
export interface EstimateWithItems extends Estimate {
  items: EstimateItem[];
}

// Payload from the voice-parse Edge Function
export interface VoiceParseResult {
  title: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: PriceUnit;
    unit_price: number;
    price_book_id: string | null;  // matched item, or null if ad-hoc
    confidence: 'high' | 'medium' | 'low';
  }>;
  raw_transcript: string;
}

// Inngest event
export interface EstimateSentEvent {
  name: 'omnibid/estimate.sent';
  data: {
    estimate_id: string;
    org_id: string;
    customer_email: string;
    customer_name: string | null;
  };
}
