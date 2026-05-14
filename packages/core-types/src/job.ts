import type { TradeType } from './organization';

// ─── Job Status ───────────────────────────────────────────────────────────────
//
//  Status flows in one direction. Each module advances the status:
//
//  lead → scheduled     (Leads module)
//  scheduled → active   (Leads module — job starts)
//  active → complete    (Estimates module — work signed off)
//  complete → closed    (Reviews module — review cycle done)
//
//  cancelled is a terminal state reachable from any status.

export type JobStatus =
  | 'lead'
  | 'scheduled'
  | 'active'
  | 'complete'
  | 'closed'
  | 'cancelled';

// ─── Job Source ───────────────────────────────────────────────────────────────

export type JobSource =
  | 'manual'
  | 'website_form'
  | 'missed_call'
  | 'referral'
  | 'google'
  | 'facebook'
  | 'yelp'
  | 'other';

// ─── Job ──────────────────────────────────────────────────────────────────────

export interface Job {
  id: string;
  org_id: string;
  customer_id: string;

  title: string;
  description: string | null;

  status: JobStatus;
  source: JobSource;

  // Which user is doing this job (field tech)
  assigned_to: string | null;           // user.id

  // Physical location of the work (may differ from customer address)
  location: string | null;
  trade_type: TradeType | null;

  // Scheduling
  scheduled_at: string | null;          // ISO 8601
  completed_at: string | null;

  // Financial — stored in cents to avoid floating point issues
  estimated_value_cents: number | null;
  final_value_cents: number | null;

  // Internal reference number (auto-generated, human-readable)
  job_number: string;

  created_at: string;
  updated_at: string;
}

export type JobInsert = Omit<Job, 'id' | 'job_number' | 'created_at' | 'updated_at'>;
export type JobUpdate = Partial<Omit<JobInsert, 'org_id' | 'customer_id'>>;

// ─── Job with related data (for detail views) ─────────────────────────────────

export interface JobDetail extends Job {
  customer_name: string;
  customer_phone: string | null;
  assigned_to_name: string | null;
}

// ─── Status transition helpers ────────────────────────────────────────────────

export const JOB_STATUS_ORDER: JobStatus[] = [
  'lead',
  'scheduled',
  'active',
  'complete',
  'closed',
];

export function canAdvanceStatus(current: JobStatus): JobStatus | null {
  const idx = JOB_STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx === JOB_STATUS_ORDER.length - 1) return null;
  return JOB_STATUS_ORDER[idx + 1] ?? null;
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  lead: 'Lead',
  scheduled: 'Scheduled',
  active: 'In Progress',
  complete: 'Complete',
  closed: 'Closed',
  cancelled: 'Cancelled',
};
