// ─── Channel & Direction ──────────────────────────────────────────────────────

export type CommunicationChannel = 'sms' | 'email' | 'call' | 'in_app';
export type CommunicationDirection = 'inbound' | 'outbound';
export type CommunicationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

// Which module triggered this communication
export type SourceModule = 'leads' | 'estimates' | 'reviews' | 'core';

// ─── Communication Log ────────────────────────────────────────────────────────
//
//  Every SMS, email, and call logged here — a single timeline per customer.
//  core-notify checks this before sending to prevent duplicate messages.

export interface CommunicationLog {
  id: string;
  org_id: string;
  job_id: string | null;
  customer_id: string;

  channel: CommunicationChannel;
  direction: CommunicationDirection;

  // For email
  subject: string | null;
  body: string;

  status: CommunicationStatus;
  source_module: SourceModule;

  // Provider message ID for delivery tracking (Telnyx or Resend)
  external_id: string | null;

  // Error detail if status is 'failed'
  error: string | null;

  created_at: string;
}

export type CommunicationLogInsert = Omit<CommunicationLog, 'id' | 'created_at'>;
