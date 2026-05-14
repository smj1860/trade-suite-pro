import type { SourceModule } from './communication';

// ─── Event Types ──────────────────────────────────────────────────────────────
//
//  Modules don't import each other. They communicate by writing job_events.
//  Inngest listens for these and triggers the appropriate module workflows.
//
//  Example: Estimates writes 'job.completed' → Inngest triggers Reviews follow-up.
//  If Reviews module isn't active for the org, no listener fires. Nothing breaks.

export type JobEventType =
  // Core job lifecycle
  | 'job.created'
  | 'job.scheduled'
  | 'job.started'
  | 'job.completed'
  | 'job.cancelled'
  | 'job.reopened'

  // Leads module
  | 'lead.captured'
  | 'lead.assigned'
  | 'follow_up.sent'
  | 'follow_up.skipped'

  // Estimates module
  | 'estimate.created'
  | 'estimate.sent'
  | 'estimate.viewed'
  | 'estimate.accepted'
  | 'estimate.rejected'
  | 'estimate.expired'

  // Reviews module
  | 'review.requested'
  | 'review.received'
  | 'review.responded';

// ─── Job Event ────────────────────────────────────────────────────────────────

export interface JobEvent {
  id: string;
  job_id: string;
  org_id: string;
  event_type: JobEventType;

  // Arbitrary payload — each module defines its own shape
  payload: Record<string, unknown>;

  source_module: SourceModule;

  // null if triggered by an automated workflow (Inngest)
  created_by: string | null;

  created_at: string;
}

export type JobEventInsert = Omit<JobEvent, 'id' | 'created_at'>;

// ─── Typed payload helpers per event ─────────────────────────────────────────

export interface EstimateSentPayload {
  estimate_id: string;
  sent_via: 'sms' | 'email';
  amount_cents: number;
}

export interface EstimateViewedPayload {
  estimate_id: string;
  viewed_at: string;
}

export interface EstimateAcceptedPayload {
  estimate_id: string;
  accepted_at: string;
  signature_url: string | null;
}

export interface ReviewReceivedPayload {
  platform: 'google' | 'yelp' | 'facebook' | 'direct';
  rating: number;
  review_url: string | null;
}
