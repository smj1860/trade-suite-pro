import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// WEBHOOK HANDLERS
//
// Both Telnyx and Resend POST delivery events to your endpoint.
// Deploy these as Supabase Edge Functions:
//
//   supabase/functions/webhook-telnyx/index.ts  → handleTelnyxWebhook()
//   supabase/functions/webhook-resend/index.ts  → handleResendWebhook()
//
// Both functions update the communication_log status field based on the
// external_id stored at send time. This keeps delivery tracking accurate
// without polling provider APIs.
// =============================================================================

// ─── Telnyx ──────────────────────────────────────────────────────────────────
//
//  Telnyx events we care about:
//    message.finalized  → delivered | sending_failed | delivery_failed
//    message.received   → inbound SMS from a customer
//
//  Telnyx signs webhooks with a public key. Verify before processing.
//  Signature verification is done in the Edge Function wrapper, not here.

interface TelnyxMessageFinalizedEvent {
  data: {
    event_type: 'message.finalized';
    payload: {
      id:               string;   // message ID — matches external_id in comm_log
      to:               Array<{ status: 'delivered' | 'sending_failed' | 'delivery_failed' }>;
    };
  };
}

interface TelnyxMessageReceivedEvent {
  data: {
    event_type: 'message.received';
    payload: {
      id:   string;
      from: { phone_number: string };
      to:   Array<{ phone_number: string }>;
      text: string;
    };
  };
}

type TelnyxEvent = TelnyxMessageFinalizedEvent | TelnyxMessageReceivedEvent;

export async function handleTelnyxWebhook(
  supabase: SupabaseClient,
  event: TelnyxEvent
): Promise<{ handled: boolean }> {
  const { event_type } = event.data;

  if (event_type === 'message.finalized') {
    const e = event as TelnyxMessageFinalizedEvent;
    const raw_status = e.data.payload.to[0]?.status ?? 'delivery_failed';

    const status =
      raw_status === 'delivered'
        ? 'delivered'
        : 'failed';

    await supabase
      .from('communication_log')
      .update({
        status,
        error: status === 'failed' ? raw_status : null,
      })
      .eq('external_id', e.data.payload.id)
      .eq('direction',   'outbound');

    return { handled: true };
  }

  if (event_type === 'message.received') {
    // Inbound SMS — look up which org owns this number, then log it
    // The org lookup is handled by the Edge Function wrapper since it
    // requires knowing which org is mapped to the Telnyx number.
    // This handler just acknowledges receipt.
    return { handled: true };
  }

  return { handled: false };
}

// ─── Resend ──────────────────────────────────────────────────────────────────
//
//  Resend events we care about:
//    email.delivered   → mark as delivered
//    email.opened      → mark as read
//    email.bounced     → mark as failed
//    email.complained  → mark as failed + flag customer email opt-out

type ResendEventType =
  | 'email.delivered'
  | 'email.opened'
  | 'email.bounced'
  | 'email.complained';

interface ResendWebhookEvent {
  type:  ResendEventType;
  data: {
    email_id: string;  // matches external_id in comm_log
    to:       string[];
  };
}

export async function handleResendWebhook(
  supabase: SupabaseClient,
  event: ResendWebhookEvent
): Promise<{ handled: boolean }> {
  const { type, data } = event;
  const external_id = data.email_id;

  switch (type) {
    case 'email.delivered': {
      await supabase
        .from('communication_log')
        .update({ status: 'delivered' })
        .eq('external_id', external_id);
      return { handled: true };
    }

    case 'email.opened': {
      await supabase
        .from('communication_log')
        .update({ status: 'read' })
        .eq('external_id', external_id);
      return { handled: true };
    }

    case 'email.bounced': {
      await supabase
        .from('communication_log')
        .update({ status: 'failed', error: 'email_bounced' })
        .eq('external_id', external_id);
      return { handled: true };
    }

    case 'email.complained': {
      // Hard complaint → mark failed + auto opt-out the customer's email
      const { data: logs } = await supabase
        .from('communication_log')
        .select('customer_id')
        .eq('external_id', external_id)
        .limit(1)
        .single();

      if (logs?.customer_id) {
        await Promise.all([
          supabase
            .from('communication_log')
            .update({ status: 'failed', error: 'email_complaint' })
            .eq('external_id', external_id),
          // Auto opt-out — respect the complaint immediately
          supabase
            .from('customers')
            .update({ email_opt_out: true })
            .eq('id', logs.customer_id),
        ]);
      }

      return { handled: true };
    }

    default:
      return { handled: false };
  }
}
