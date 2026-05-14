import { inngest }      from '../client';
import { createClient } from '@supabase/supabase-js';
import { Resend }       from 'resend';
import Anthropic        from '@anthropic-ai/sdk';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const resend    = new Resend(process.env.RESEND_API_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const omnibidEstimateWatcher = inngest.createFunction(
  { id: 'omnibid-estimate-watcher', name: 'OmniBid: Estimate Watcher', retries: 3 },
  { event: 'omnibid/estimate.sent' },

  async ({ event, step }) => {
    const { estimate_id, org_id, customer_email, customer_name } = event.data;

    // Wait 48h for payment
    const paid = await step.waitForEvent('wait-for-payment', {
      event:   'omnibid/estimate.paid',
      match:   'data.estimate_id',
      timeout: '48h',
    });

    if (paid) {
      await step.run('mark-paid', async () => {
        getSupabase().from('estimates').update({
          status: 'paid', paid_at: new Date().toISOString(),
        }).eq('id', estimate_id);
      });
      return { status: 'paid' };
    }

    // Check if still actionable
    const estResult = await step.run('check-estimate', async () =>
      getSupabase().from('estimates')
        .select('status, estimate_number, total_cents, pdf_url, organizations(name)')
        .eq('id', estimate_id).single()
    );

    const est = (estResult as any)?.data;
    if (!est || !['sent', 'viewed'].includes(est.status)) {
      return { status: 'already_actioned' };
    }

    const orgName = (est.organizations as any)?.name ?? 'us';
    const payUrl  = est.pdf_url ?? '';
    const total   = `$${(est.total_cents / 100).toFixed(2)}`;

    // Generate follow-up email with Claude and send via Resend
    await step.run('send-followup', async () => {
      const msg = await anthropic.messages.create({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 200,
        system:     `Write a 2-sentence follow-up email for ${orgName}. Friendly, not pushy. No emojis. Return only the body text.`,
        messages:   [{ role: 'user', content: `Follow up on estimate ${est.estimate_number} (${total}). Not responded in 48h. Include: ${payUrl}${customer_name ? `. Customer: ${customer_name}` : ''}` }],
      });
      const body = (msg.content[0] as any).text?.trim() ?? '';

      await resend.emails.send({
        from:    `${orgName} <estimates@mail.tradesuite.com>`,
        to:      [customer_email],
        subject: `Following up — Estimate ${est.estimate_number}`,
        text:    `${body}\n\n— ${orgName}`,
      });
    });

    // Wait 5 more days
    const latePaid = await step.waitForEvent('wait-for-late-payment', {
      event:   'omnibid/estimate.paid',
      match:   'data.estimate_id',
      timeout: '120h',
    });

    if (latePaid) {
      await step.run('mark-paid-late', async () => {
        getSupabase().from('estimates').update({
          status: 'paid', paid_at: new Date().toISOString(),
        }).eq('id', estimate_id);
      });
      return { status: 'paid_late' };
    }

    return { status: 'no_response' };
  }
);
