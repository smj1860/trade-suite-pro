import { Resend } from 'resend';

// =============================================================================
// PROVIDER CLIENTS
//
// Both clients are lazy-initialized singletons.
// They throw immediately if the required env var is missing so misconfiguration
// fails loudly at startup rather than silently at send time.
// =============================================================================

// ─── Environment helpers ──────────────────────────────────────────────────────

function requireEnv(key: string): string {
  // Works in Node (Inngest/Edge Functions) and Vite (import.meta.env)
  const value =
    (typeof process !== 'undefined' && process.env[key]) ||
    ((import.meta as unknown as Record<string, Record<string, string>>).env?.[key]);

  if (!value) {
    throw new Error(
      `[core-notify] Missing required environment variable: ${key}`
    );
  }
  return value;
}

// ─── Telnyx ──────────────────────────────────────────────────────────────────
//
//  We call the Telnyx REST API directly with fetch — no SDK needed.
//  This keeps the bundle lean and works in edge runtimes.
//
//  Required env vars:
//    TELNYX_API_KEY          — API v2 key from Telnyx dashboard
//    TELNYX_PHONE_NUMBER     — The toll-free number (e.g. +18005551234)
//    TELNYX_MESSAGING_PROFILE_ID  — From Telnyx dashboard (for 10DLC/TFN)

export interface TelnyxSendResult {
  message_id: string;
  status: string;
}

export async function telnyxSend(
  to: string,
  body: string
): Promise<TelnyxSendResult> {
  const apiKey = requireEnv('TELNYX_API_KEY');
  const from   = requireEnv('TELNYX_PHONE_NUMBER');

  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to,
      text: body,
      messaging_profile_id: requireEnv('TELNYX_MESSAGING_PROFILE_ID'),
      type: 'SMS',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(
      `[Telnyx] SMS send failed (${response.status}): ${JSON.stringify(err)}`
    );
  }

  const data = await response.json() as { data: { id: string; to: Array<{ status: string }> } };
  return {
    message_id: data.data.id,
    status:     data.data.to[0]?.status ?? 'queued',
  };
}

// ─── Resend ──────────────────────────────────────────────────────────────────
//
//  Required env vars:
//    RESEND_API_KEY    — from Resend dashboard
//    RESEND_FROM_EMAIL — verified sender address (e.g. jobs@tradesuite.com)

let _resend: Resend | null = null;

export function getResendClient(): Resend {
  if (_resend) return _resend;
  _resend = new Resend(requireEnv('RESEND_API_KEY'));
  return _resend;
}

export interface ResendSendResult {
  message_id: string;
}

export async function resendSend(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  reply_to?: string;
}): Promise<ResendSendResult> {
  const resend  = getResendClient();
  const from    = requireEnv('RESEND_FROM_EMAIL');

  const { data, error } = await resend.emails.send({
    from,
    to:       options.to,
    subject:  options.subject,
    html:     options.html,
    text:     options.text,
    ...(options.reply_to ? { reply_to: options.reply_to } : {}),
  });

  if (error || !data) {
    throw new Error(`[Resend] Email send failed: ${error?.message ?? 'Unknown error'}`);
  }

  return { message_id: data.id };
}
