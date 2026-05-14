import { createClient } from '@supabase/supabase-js';
import { inngest } from '../client';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const omnibidEstimateWatcher = inngest.createFunction(
  { id: 'omnibid-estimate-watcher', name: 'OmniBid Estimate Follow-up Watcher' },
  { event: 'omnibid/estimate.sent' },

  async ({ event, step }) => {
    const { estimate_id, org_id, customer_email, customer_name } = event.data;

    // Wait 48h for payment
    const paid = await step.waitForEvent('wait-48h-for-payment', {
      event: 'omnibid/estimate.paid',
      match: 'data.estimate_id',
      timeout: '48h',
    });

    if (paid) return;

    // Send follow-up email via Resend
    await step.run('send-followup-email', async () => {
      const supabase = getSupabase();

      const { data: estimate } = await supabase
        .from('estimates')
        .select('status, estimate_number, total_cents, org:organizations(name)')
        .eq('id', estimate_id)
        .single();

      if (!estimate || estimate.status === 'accepted' || estimate.status === 'declined') return;

      const orgName = (estimate.org as any)?.name ?? 'Your contractor';
      const total = (estimate.total_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${orgName} <estimates@${process.env.RESEND_DOMAIN ?? 'mail.tradesuite.app'}>`,
          to: [customer_email],
          subject: `Following up on Estimate ${estimate.estimate_number}`,
          html: `<p>Hi ${customer_name ?? 'there'},</p><p>Just following up on estimate ${estimate.estimate_number} for ${total}. Please let us know if you have any questions.</p><p>— ${orgName}</p>`,
        }),
      });
    });
  }
);
