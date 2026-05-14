import type { SupabaseClient } from '@supabase/supabase-js';
import type { CommunicationChannel, SourceModule } from '@trades-saas/core-types';

// =============================================================================
// DEDUP GUARD
//
// Every outbound message passes through this check first.
// Prevents the same module from sending the same channel message to the same
// customer within a configurable time window.
//
// Use cases this prevents:
//   - Inngest retry sending the same follow-up SMS twice
//   - Two modules both requesting a review from the same customer
//   - A webhook handler re-processing a duplicate event
//
// The check is intentionally conservative — a false positive (blocked send)
// is far less damaging than a false negative (customer gets spammed).
// =============================================================================

export interface DedupCheckOptions {
  customer_id:      string;
  channel:          CommunicationChannel;
  source_module:    SourceModule;
  window_minutes:   number;             // 0 = always send, no dedup
}

export interface DedupResult {
  is_duplicate:     boolean;
  last_sent_at:     string | null;      // ISO timestamp of the blocked message
  minutes_since:    number | null;
}

export async function checkDuplicate(
  supabase: SupabaseClient,
  opts: DedupCheckOptions
): Promise<DedupResult> {
  // Window of 0 means bypass entirely (manual sends, tests)
  if (opts.window_minutes <= 0) {
    return { is_duplicate: false, last_sent_at: null, minutes_since: null };
  }

  const since = new Date(
    Date.now() - opts.window_minutes * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from('communication_log')
    .select('id, created_at')
    .eq('customer_id',   opts.customer_id)
    .eq('channel',       opts.channel)
    .eq('source_module', opts.source_module)
    .eq('direction',     'outbound')
    .in('status',        ['sent', 'delivered'])
    .gte('created_at',   since)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    // Fail open — if we can't check, allow the send rather than block forever
    console.warn('[core-notify] Dedup check failed, allowing send:', error.message);
    return { is_duplicate: false, last_sent_at: null, minutes_since: null };
  }

  if (!data || data.length === 0) {
    return { is_duplicate: false, last_sent_at: null, minutes_since: null };
  }

  const last = data[0]!;
  const minutes_since = Math.round(
    (Date.now() - new Date(last.created_at).getTime()) / 60_000
  );

  return {
    is_duplicate:  true,
    last_sent_at:  last.created_at,
    minutes_since,
  };
}

// ─── Recommended dedup windows by use case ────────────────────────────────────
//
//  These are defaults. Callers can override per-send.

export const DEDUP_WINDOWS = {
  missed_call_sms:     60,     // 1 hour  — don't text twice if they call twice
  follow_up_sequence:  60 * 4, // 4 hours — sequence steps shouldn't fire twice
  estimate_sent:       60 * 2, // 2 hours — don't resend estimate repeatedly
  review_request:      60 * 48,// 48 hours — respectful gap between review asks
  review_followup:     60 * 24,// 24 hours — one follow-up per day max
  booking_confirmation:60,     // 1 hour
  manual:              0,      // never dedup manual sends from the dashboard
} as const satisfies Record<string, number>;

export type DedupWindowKey = keyof typeof DEDUP_WINDOWS;
