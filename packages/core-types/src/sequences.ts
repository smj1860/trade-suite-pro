import type { JobEventType } from './events';
import type { SourceModule } from './communication';

// ============================================================================
// FOLLOW-UP SEQUENCES
// ============================================================================

export type SequenceStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export type CancelledReason =
  | 'customer_replied'
  | 'customer_booked'
  | 'estimate_accepted'
  | 'job_cancelled'
  | 'manual'
  | 'opted_out';

export interface FollowUpSequence {
  id: string;
  org_id: string;
  job_id: string;
  customer_id: string;

  status: SequenceStatus;

  current_step: number;    // 0-indexed
  total_steps: number;     // default 4 (Day 1 / 3 / 5 / 10)

  trigger_event: JobEventType;
  source_module: SourceModule;

  last_fired_at: string | null;
  next_fire_at: string | null;

  cancelled_reason: CancelledReason | null;
  cancelled_at: string | null;

  created_at: string;
  updated_at: string;
}

export type FollowUpSequenceInsert = Omit<
  FollowUpSequence,
  'id' | 'created_at' | 'updated_at'
>;

// ─── Progress helper ──────────────────────────────────────────────────────────

export function sequenceProgress(seq: FollowUpSequence): {
  stepsRemaining: number;
  percentComplete: number;
  isTerminal: boolean;
} {
  const stepsRemaining = seq.total_steps - seq.current_step;
  const percentComplete = Math.round((seq.current_step / seq.total_steps) * 100);
  const isTerminal = seq.status === 'completed' || seq.status === 'cancelled';
  return { stepsRemaining, percentComplete, isTerminal };
}

// ============================================================================
// BOOKING TOKENS
// ============================================================================

export interface BookingToken {
  id: string;
  org_id: string;
  job_id: string;
  customer_id: string;

  token: string;             // 32-char hex, e.g. "a3f9b2c1..."

  clicked_at: string | null;
  click_count: number;
  booked_at: string | null;

  expires_at: string;
  is_revoked: boolean;

  created_at: string;
}

export type BookingTokenInsert = Omit<BookingToken, 'id' | 'token' | 'created_at'>;

// ─── Token state helpers ──────────────────────────────────────────────────────

export function isTokenValid(token: BookingToken): boolean {
  if (token.is_revoked) return false;
  if (new Date(token.expires_at) < new Date()) return false;
  return true;
}

export function bookingUrl(token: string, baseUrl = 'https://app.tradesuite.com'): string {
  return `${baseUrl}/book/${token}`;
}

// ============================================================================
// REPORT RUNS
// ============================================================================

export type ReportStatus = 'pending' | 'generating' | 'sent' | 'failed';

export type ReportType =
  | 'monthly_reputation'   // RepuGuard
  | 'weekly_leads'         // LeadLock
  | 'monthly_revenue';     // OmniBid

// Typed payloads per report type
export interface MonthlyReputationPayload {
  avg_rating: number;
  total_reviews: number;
  new_reviews_this_period: number;
  rating_change: number;       // delta from previous period
  platform_breakdown: Record<string, { count: number; avg_rating: number }>;
  top_review_snippet: string | null;
  negative_review_count: number;
}

export interface WeeklyLeadsPayload {
  new_leads: number;
  leads_converted: number;
  conversion_rate: number;
  sequences_active: number;
  sequences_completed: number;
  avg_response_time_minutes: number | null;
}

export interface MonthlyRevenuePayload {
  estimates_sent: number;
  estimates_accepted: number;
  win_rate: number;
  total_estimated_value_cents: number;
  total_won_value_cents: number;
  avg_estimate_value_cents: number;
}

export type ReportPayload =
  | MonthlyReputationPayload
  | WeeklyLeadsPayload
  | MonthlyRevenuePayload;

export interface ReportRun {
  id: string;
  org_id: string;

  report_type: ReportType;
  source_module: SourceModule;

  period_start: string;
  period_end: string;

  status: ReportStatus;

  sent_at: string | null;
  sent_to_email: string | null;

  error: string | null;
  retry_count: number;

  payload: ReportPayload | null;

  created_at: string;
  updated_at: string;
}

export type ReportRunInsert = Omit<ReportRun, 'id' | 'created_at' | 'updated_at'>;
