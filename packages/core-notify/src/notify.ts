import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CommunicationChannel,
  CommunicationLogInsert,
  SourceModule,
} from '@trades-saas/core-types';
import { telnyxSend, resendSend } from './providers';
import { checkDuplicate } from './dedup';
import type { RenderedMessage } from './templates';

// =============================================================================
// UNIFIED NOTIFY()
//
// This is the only function modules ever call to send a message.
// It handles, in order:
//
//   1. Opt-out check        — never message a customer who opted out
//   2. Contact info check   — can't send SMS without a phone number
//   3. Channel resolution   — 'auto' picks the customer's preferred channel
//   4. Dedup check          — blocks duplicate sends within the window
//   5. Send via provider    — Telnyx (SMS) or Resend (email)
//   6. Log to comm_log      — always, including failed sends
//
// Returns a result describing what happened and why, so callers can
// react appropriately (retry, skip, escalate to other channel, etc.)
// =============================================================================

export interface NotifyOptions {
  // Who to message
  customer: {
    id:                       string;
    phone:                    string | null;
    email:                    string | null;
    preferred_contact_method: 'sms' | 'email' | 'call';
    sms_opt_out:              boolean;
    email_opt_out:            boolean;
  };

  // What to send — pre-rendered by the caller (via core-ai or templates.ts)
  message: RenderedMessage;

  // Context
  org_id:        string;
  job_id?:       string;
  source_module: SourceModule;

  // Dedup window in minutes. 0 = always send (manual sends, tests)
  dedup_window_minutes?: number;

  // Supabase client — passed in so this works both server-side (service role)
  // and client-side (anon key) without coupling to a specific client instance
  supabase: SupabaseClient;
}

// ─── Result types ─────────────────────────────────────────────────────────────

export type SkipReason =
  | 'opted_out'
  | 'no_phone'
  | 'no_email'
  | 'duplicate'
  | 'channel_mismatch';  // e.g. email template but customer has no email

export interface NotifyResult {
  sent:                 boolean;
  skipped:              boolean;
  skip_reason?:         SkipReason;
  communication_log_id: string | null;
  external_id:          string | null;   // Telnyx/Resend message ID
  error:                string | null;
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function notify(opts: NotifyOptions): Promise<NotifyResult> {
  const { customer, message, org_id, job_id, source_module, supabase } = opts;
  const dedup_window = opts.dedup_window_minutes ?? 0;

  // Resolve the actual channel from the rendered message
  const channel: CommunicationChannel = message.channel;

  // ── 1. Opt-out check ───────────────────────────────────────────────────────

  if (channel === 'sms' && customer.sms_opt_out) {
    return skip('opted_out', null);
  }
  if (channel === 'email' && customer.email_opt_out) {
    return skip('opted_out', null);
  }

  // ── 2. Contact info check ──────────────────────────────────────────────────

  if (channel === 'sms' && !customer.phone) {
    return skip('no_phone', null);
  }
  if (channel === 'email' && !customer.email) {
    return skip('no_email', null);
  }

  // ── 3. Dedup check ─────────────────────────────────────────────────────────

  const dedup = await checkDuplicate(supabase, {
    customer_id:    customer.id,
    channel,
    source_module,
    window_minutes: dedup_window,
  });

  if (dedup.is_duplicate) {
    console.info(
      `[core-notify] Dedup blocked: ${channel} to customer ${customer.id} ` +
      `(${dedup.minutes_since}m ago, window: ${dedup_window}m)`
    );
    return skip('duplicate', null);
  }

  // ── 4. Send ────────────────────────────────────────────────────────────────

  let external_id: string | null = null;
  let sendError:   string | null = null;

  try {
    if (channel === 'sms') {
      const result = await telnyxSend(customer.phone!, message.body);
      external_id = result.message_id;
    } else {
      const email = message as Extract<RenderedMessage, { channel: 'email' }>;
      const result = await resendSend({
        to:      customer.email!,
        subject: email.subject,
        html:    email.html,
        text:    email.body,
      });
      external_id = result.message_id;
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
    console.error('[core-notify] Send failed:', sendError);
  }

  // ── 5. Log to communication_log (always — including failures) ──────────────

  const log_id = await writeCommLog(supabase, {
    org_id,
    customer_id:   customer.id,
    job_id:        job_id ?? null,
    channel,
    direction:     'outbound',
    subject:       message.channel === 'email' ? message.subject : null,
    body:          message.body,
    status:        sendError ? 'failed' : 'sent',
    source_module,
    external_id,
    error:         sendError,
  });

  if (sendError) {
    return {
      sent:                 false,
      skipped:              false,
      communication_log_id: log_id,
      external_id:          null,
      error:                sendError,
    };
  }

  return {
    sent:                 true,
    skipped:              false,
    communication_log_id: log_id,
    external_id,
    error:                null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function skip(reason: SkipReason, log_id: string | null): NotifyResult {
  return {
    sent:                 false,
    skipped:              true,
    skip_reason:          reason,
    communication_log_id: log_id,
    external_id:          null,
    error:                null,
  };
}

async function writeCommLog(
  supabase: SupabaseClient,
  entry: CommunicationLogInsert
): Promise<string | null> {
  const { data, error } = await supabase
    .from('communication_log')
    .insert(entry)
    .select('id')
    .single();

  if (error) {
    console.error('[core-notify] Failed to write communication_log:', error.message);
    return null;
  }

  return data?.id ?? null;
}

// ─── Inbound SMS logger ───────────────────────────────────────────────────────
//
//  Call this from the Telnyx inbound webhook handler to log customer replies.

export async function logInboundSms(
  supabase: SupabaseClient,
  opts: {
    org_id:       string;
    customer_id:  string;
    job_id?:      string;
    body:         string;
    external_id:  string;
  }
): Promise<string | null> {
  return writeCommLog(supabase, {
    org_id:        opts.org_id,
    customer_id:   opts.customer_id,
    job_id:        opts.job_id ?? null,
    channel:       'sms',
    direction:     'inbound',
    subject:       null,
    body:          opts.body,
    status:        'delivered',
    source_module: 'core',
    external_id:   opts.external_id,
    error:         null,
  });
}
