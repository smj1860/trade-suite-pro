// ============================================================================
// OMNIBID — ESTIMATES
// ============================================================================

export type EstimateStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'superseded';

export type EstimateTier = 'single' | 'good' | 'better' | 'best';

export const ESTIMATE_TIER_LABELS: Record<EstimateTier, string> = {
  single: 'Standard',
  good:   'Good',
  better: 'Better',
  best:   'Best',
};

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  draft:      'Draft',
  sent:       'Sent',
  viewed:     'Viewed',
  accepted:   'Accepted',
  rejected:   'Declined',
  expired:    'Expired',
  superseded: 'Revised',
};

export interface Estimate {
  id: string;
  org_id: string;
  job_id: string;
  customer_id: string;
  created_by: string;

  estimate_number: string;
  status: EstimateStatus;
  ai_generated: boolean;

  expiry_date: string | null;

  subtotal_cents: number;
  tax_rate: number;
  tax_cents: number;
  total_cents: number;

  customer_note: string | null;
  internal_note: string | null;

  sent_at: string | null;
  sent_via: 'sms' | 'email' | null;
  viewed_at: string | null;
  view_count: number;

  accepted_at: string | null;
  accepted_tier: EstimateTier | null;
  signature_url: string | null;
  rejection_reason: string | null;

  pdf_url: string | null;
  view_token: string;

  created_at: string;
  updated_at: string;
}

export type EstimateInsert = Omit<Estimate, 'id' | 'estimate_number' | 'view_token' | 'created_at' | 'updated_at'>;
export type EstimateUpdate = Partial<Omit<EstimateInsert, 'org_id' | 'job_id' | 'customer_id' | 'created_by'>>;

// ─── Line Items ───────────────────────────────────────────────────────────────

export interface EstimateLineItem {
  id: string;
  org_id: string;
  estimate_id: string;

  tier: EstimateTier;
  sort_order: number;

  description: string;
  category: 'labor' | 'materials' | 'equipment' | 'other' | null;

  quantity: number;
  unit: string | null;
  unit_price_cents: number;
  total_cents: number;

  is_customer_facing: boolean;

  created_at: string;
}

export type EstimateLineItemInsert = Omit<EstimateLineItem, 'id' | 'created_at'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function estimateViewUrl(
  token: string,
  baseUrl = 'https://app.tradesuite.com'
): string {
  return `${baseUrl}/estimate/${token}`;
}

export function isEstimateEditable(status: EstimateStatus): boolean {
  return status === 'draft';
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

// ============================================================================
// OMNIBID — INVOICES
// ============================================================================

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'void';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:   'Draft',
  sent:    'Sent',
  viewed:  'Viewed',
  partial: 'Partial Payment',
  paid:    'Paid',
  overdue: 'Overdue',
  void:    'Void',
};

export type PaymentMethod = 'card_terminal' | 'payment_link' | 'cash' | 'check';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card_terminal:  'Card (On-site)',
  payment_link:   'Card (Online)',
  cash:           'Cash',
  check:          'Check',
};

export interface Invoice {
  id: string;
  org_id: string;
  job_id: string;
  customer_id: string;
  estimate_id: string;

  invoice_number: string;
  status: InvoiceStatus;

  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;          // generated column: total - paid

  due_date: string | null;
  customer_note: string | null;

  stripe_payment_intent_id: string | null;
  payment_link_url: string | null;
  payment_link_expires_at: string | null;

  sent_at: string | null;
  sent_via: 'sms' | 'email' | null;
  viewed_at: string | null;
  view_count: number;

  paid_at: string | null;
  view_token: string;
  pdf_url: string | null;

  created_at: string;
  updated_at: string;
}

export type InvoiceInsert = Omit<Invoice, 'id' | 'invoice_number' | 'balance_cents' | 'view_token' | 'created_at' | 'updated_at'>;

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface InvoicePayment {
  id: string;
  org_id: string;
  invoice_id: string;

  amount_cents: number;
  method: PaymentMethod;

  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;

  recorded_by: string | null;
  reference_number: string | null;

  paid_at: string;
  notes: string | null;

  created_at: string;
}

export type InvoicePaymentInsert = Omit<InvoicePayment, 'id' | 'created_at'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function invoiceViewUrl(
  token: string,
  baseUrl = 'https://app.tradesuite.com'
): string {
  return `${baseUrl}/invoice/${token}`;
}

export function isInvoicePaid(invoice: Invoice): boolean {
  return invoice.status === 'paid';
}

export function invoiceIsOverdue(invoice: Invoice): boolean {
  if (!invoice.due_date) return false;
  if (['paid', 'void'].includes(invoice.status)) return false;
  return new Date(invoice.due_date) < new Date();
}
