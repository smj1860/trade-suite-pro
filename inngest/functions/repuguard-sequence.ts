import { inngest }      from '../client';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export const repuguardSequence = inngest.createFunction(
  { id: 'repuguard-review-sequence', name: 'RepuGuard: Review Request Sequence', retries: 3 },
  { event: 'repuguard/job.completed' },

  async ({ event, step }) => {
    const { job_id, customer_id, org_id, delay_hours } = event.data;

    const orgResult = await step.run('check-org-config', async () =>
      getSupabase().from('organizations')
        .select('google_review_url, yelp_review_url, telnyx_number, review_delay_hours')
        .eq('id', org_id).single()
    );

    const org = (orgResult as any)?.data;
    if (!org?.google_review_url && !org?.yelp_review_url) {
      return { status: 'skipped', reason: 'No review platform configured' };
    }

    const waitHours = delay_hours ?? org.review_delay_hours ?? 24;
    await step.sleep('wait-before-sending', `${waitHours}h`);

    await step.run('send-review-request', async () => {
      await fetch(`${process.env.SUPABASE_URL}/functions/v1/repuguard-send-request`, {
        method:  'POST',
        headers: {
          'Authorization':             `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type':              'application/json',
          'x-supabase-service-role':   'true',
        },
        body: JSON.stringify({ job_id, customer_id, org_id }),
      });
    });

    return { status: 'sent' };
  }
);
