import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { job_id, customer_id, org_id } = await req.json() as {
    job_id: string; customer_id: string; org_id: string;
  };

  const { data: org } = await supabase
    .from('organizations')
    .select('active_modules, review_delay_hours')
    .eq('id', org_id).single();

  if (!org?.active_modules?.includes('reviews')) {
    return new Response(JSON.stringify({ skipped: true, reason: 'reviews module not active' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(Deno.env.get('INNGEST_EVENT_URL') ?? 'https://inn.gs/e', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('INNGEST_EVENT_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'repuguard/job.completed',
      data: {
        job_id,
        customer_id,
        org_id,
        delay_hours: org.review_delay_hours ?? 24,
      },
    }),
  });

  if (!res.ok) {
    console.error('trigger-repuguard: Inngest error', await res.text());
    return new Response('Inngest error', { status: 500 });
  }

  return new Response(JSON.stringify({ fired: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
