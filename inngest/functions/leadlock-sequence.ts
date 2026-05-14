import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '../client';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function generateSms(
  trade: string,
  businessName: string,
  ownerFirstName: string,
  step: number,
): Promise<string> {
  const stepContext = step === 0
    ? 'This is an immediate text-back right after a missed call.'
    : step === 1
    ? 'This is a 24-hour follow-up. The person called yesterday and has not replied yet.'
    : 'This is a final follow-up 48 hours after the first contact. Keep it brief and warm.';

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `Write a short SMS for a ${trade} contractor named ${ownerFirstName} at ${businessName}.
${stepContext}
Requirements:
- Under 160 characters
- No emojis
- GSM-7 characters only (no curly quotes, em-dashes, etc.)
- Warm and specific to the missed call — not generic
- End with the contractor's first name
Return only the SMS text, nothing else.`,
      },
    ],
  });

  const text = msg.content[0];
  if (text.type !== 'text') throw new Error('Unexpected response type');
  return text.text.trim().slice(0, 160);
}

async function sendTelnyxSms(to: string, from: string, body: string): Promise<string> {
  const res = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, text: body }),
  });
  if (!res.ok) throw new Error(`Telnyx error: ${await res.text()}`);
  const data = await res.json() as { data: { id: string } };
  return data.data.id;
}

export const leadlockSequence = inngest.createFunction(
  { id: 'leadlock-sequence', name: 'LeadLock Follow-up Sequence' },
  { event: 'leadlock/lead.created' },

  async ({ event, step }) => {
    const { lead_id, org_id, phone, called_number, trade, owner_first_name, business_name } = event.data;
    const supabase = getSupabase();

    // ── Step 0: Immediate text-back ─────────────────────────────────────────
    await step.run('send-immediate-sms', async () => {
      const body     = await generateSms(trade, business_name, owner_first_name, 0);
      const msgId    = await sendTelnyxSms(phone, called_number, body);

      await supabase.from('lead_messages').insert({
        org_id,
        lead_id,
        direction: 'outbound',
        body,
        status: 'sent',
        telnyx_msg_id: msgId,
        sequence_step: 0,
        sent_at: new Date().toISOString(),
      });

      await supabase.from('leads').update({
        status: 'contacted',
        updated_at: new Date().toISOString(),
      }).eq('id', lead_id);

      await supabase.from('lead_sequences').update({
        current_step: 1,
        updated_at: new Date().toISOString(),
      }).eq('lead_id', lead_id);
    });

    // ── Wait up to 24h for a reply ───────────────────────────────────────────
    const reply24 = await step.waitForEvent('wait-24h-reply', {
      event: 'leadlock/lead.replied',
      match: 'data.lead_id',
      timeout: '24h',
    });

    if (reply24) {
      await step.run('mark-completed-24h', async () => {
        await supabase.from('lead_sequences').update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        }).eq('lead_id', lead_id);
      });
      return;
    }

    // ── Step 1: 24-hour follow-up ────────────────────────────────────────────
    await step.run('send-24h-followup', async () => {
      const { data: seq } = await supabase
        .from('lead_sequences')
        .select('status')
        .eq('lead_id', lead_id)
        .single();

      if (!seq || seq.status !== 'active') return;

      const body  = await generateSms(trade, business_name, owner_first_name, 1);
      const msgId = await sendTelnyxSms(phone, called_number, body);

      await supabase.from('lead_messages').insert({
        org_id,
        lead_id,
        direction: 'outbound',
        body,
        status: 'sent',
        telnyx_msg_id: msgId,
        sequence_step: 1,
        sent_at: new Date().toISOString(),
      });

      await supabase.from('lead_sequences').update({
        current_step: 2,
        updated_at: new Date().toISOString(),
      }).eq('lead_id', lead_id);
    });

    // ── Wait up to 48h for a reply ───────────────────────────────────────────
    const reply48 = await step.waitForEvent('wait-48h-reply', {
      event: 'leadlock/lead.replied',
      match: 'data.lead_id',
      timeout: '48h',
    });

    if (reply48) {
      await step.run('mark-completed-48h', async () => {
        await supabase.from('lead_sequences').update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        }).eq('lead_id', lead_id);
      });
      return;
    }

    // ── Step 2: Final touch ──────────────────────────────────────────────────
    await step.run('send-final-touch', async () => {
      const { data: seq } = await supabase
        .from('lead_sequences')
        .select('status')
        .eq('lead_id', lead_id)
        .single();

      if (!seq || seq.status !== 'active') return;

      const body  = await generateSms(trade, business_name, owner_first_name, 2);
      const msgId = await sendTelnyxSms(phone, called_number, body);

      await supabase.from('lead_messages').insert({
        org_id,
        lead_id,
        direction: 'outbound',
        body,
        status: 'sent',
        telnyx_msg_id: msgId,
        sequence_step: 2,
        sent_at: new Date().toISOString(),
      });

      // Only mark lost if still contacted (not manually updated)
      const { data: lead } = await supabase
        .from('leads')
        .select('status')
        .eq('id', lead_id)
        .single();

      if (lead?.status === 'contacted') {
        await supabase.from('leads').update({
          status: 'lost',
          updated_at: new Date().toISOString(),
        }).eq('id', lead_id);
      }

      await supabase.from('lead_sequences').update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      }).eq('lead_id', lead_id);
    });
  }
);
