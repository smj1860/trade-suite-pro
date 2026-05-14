import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const INNGEST_EVENT_KEY = Deno.env.get('INNGEST_EVENT_KEY') ?? '';
const INNGEST_URL       = Deno.env.get('INNGEST_URL') ?? 'https://inn.gs/e';
const TELNYX_PUBLIC_KEY = Deno.env.get('TELNYX_PUBLIC_KEY') ?? '';

async function verifyTelnyxSignature(
  req: Request,
  body: string,
): Promise<boolean> {
  const sig       = req.headers.get('telnyx-signature-ed25519') ?? '';
  const timestamp = req.headers.get('telnyx-timestamp') ?? '';
  if (!sig || !timestamp || !TELNYX_PUBLIC_KEY) return false;

  try {
    const keyBytes = hexToBytes(TELNYX_PUBLIC_KEY);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyBytes, { name: 'Ed25519' }, false, ['verify']
    );
    const message  = new TextEncoder().encode(`${timestamp}|${body}`);
    const sigBytes = hexToBytes(sig);
    return crypto.subtle.verify('Ed25519', cryptoKey, sigBytes, message);
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function sendInngestEvent(name: string, data: Record<string, unknown>) {
  await fetch(`${INNGEST_URL}/${INNGEST_EVENT_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();

  const valid = await verifyTelnyxSignature(req, body);
  if (!valid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(body);
  const eventType: string = payload?.data?.event_type ?? '';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  if (eventType === 'call.hangup') {
    const callData    = payload.data.payload;
    const calledNum   = callData.to ?? callData.call_leg_id;
    const callerPhone = callData.from;
    const callSid     = callData.call_control_id ?? callData.call_session_id;

    // Resolve org by telnyx_number
    const { data: org } = await supabase
      .from('organizations')
      .select('id, trade, owner_first_name, name')
      .eq('telnyx_number', calledNum)
      .single();

    if (!org) return new Response('OK', { status: 200 });

    // Upsert lead
    const { data: lead } = await supabase
      .from('leads')
      .upsert(
        {
          org_id: org.id,
          phone: callerPhone,
          source: 'missed_call',
          call_sid: callSid,
          called_number: calledNum,
          missed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,phone', ignoreDuplicates: false }
      )
      .select()
      .single();

    if (!lead) return new Response('OK', { status: 200 });

    // Upsert lead_sequence
    await supabase.from('lead_sequences').upsert(
      { org_id: org.id, lead_id: lead.id, status: 'active', current_step: 0 },
      { onConflict: 'lead_id' }
    );

    await sendInngestEvent('leadlock/lead.created', {
      lead_id:          lead.id,
      org_id:           org.id,
      phone:            callerPhone,
      called_number:    calledNum,
      trade:            org.trade,
      owner_first_name: org.owner_first_name,
      business_name:    org.name,
    });
  } else if (eventType === 'message.received') {
    const msgData  = payload.data.payload;
    const fromPhone = msgData.from?.phone_number ?? msgData.from;
    const toPhone   = msgData.to?.[0]?.phone_number ?? msgData.to;
    const msgBody   = msgData.text ?? '';
    const msgId     = msgData.id ?? null;

    // Resolve org
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('telnyx_number', toPhone)
      .single();

    if (!org) return new Response('OK', { status: 200 });

    // Find lead
    const { data: lead } = await supabase
      .from('leads')
      .select('id, status')
      .eq('org_id', org.id)
      .eq('phone', fromPhone)
      .single();

    if (!lead) return new Response('OK', { status: 200 });

    // Insert inbound message
    await supabase.from('lead_messages').insert({
      org_id: org.id,
      lead_id: lead.id,
      direction: 'inbound',
      body: msgBody,
      status: 'delivered',
      telnyx_msg_id: msgId,
      sent_at: new Date().toISOString(),
    });

    // Update lead status and replied_at
    await supabase.from('leads').update({
      status: 'replied',
      replied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id);

    // Cancel sequence
    await supabase.from('lead_sequences')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('lead_id', lead.id)
      .eq('status', 'active');

    await sendInngestEvent('leadlock/lead.replied', {
      lead_id: lead.id,
      org_id:  org.id,
      phone:   fromPhone,
      body:    msgBody,
    });
  }

  return new Response('OK', { status: 200 });
});
