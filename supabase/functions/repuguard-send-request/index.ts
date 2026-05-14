import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic        from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

const supabase  = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

async function generateSms(orgName: string, trade: string, customerFirstName: string | null, platform: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 160,
    system:     'Write a short SMS asking a customer to leave a review. Under 140 chars. Warm, not pushy. No emojis. GSM-7 only. Return only the SMS text.',
    messages:   [{ role: 'user', content: `${orgName} (${trade}) completed work${customerFirstName ? ` for ${customerFirstName}` : ''}. Ask for a ${platform} review. Include {LINK} as a placeholder for the review URL.` }],
  });
  return (msg.content[0] as any).text?.trim() ?? `Thanks for choosing ${orgName}! We'd love your review: {LINK}`;
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { job_id, customer_id, org_id } = await req.json() as { job_id: string; customer_id: string; org_id: string };

  const [orgRes, customerRes] = await Promise.all([
    supabase.from('organizations').select('name, trade_types, telnyx_number, google_review_url, yelp_review_url').eq('id', org_id).single(),
    supabase.from('customers').select('id, first_name, phone, email').eq('id', customer_id).single(),
  ]);

  const org      = orgRes.data;
  const customer = customerRes.data;

  if (!org || !customer) return new Response('Not found', { status: 404 });

  const platform  = org.google_review_url ? 'google' : org.yelp_review_url ? 'yelp' : 'google';
  const reviewUrl = org.google_review_url ?? org.yelp_review_url ?? '';
  const trade     = org.trade_types?.[0] ?? 'home services';

  const { data: request } = await supabase.from('review_requests').insert({
    org_id, job_id: job_id || null, customer_id,
    platform, review_url: reviewUrl,
  }).select().single();

  if (!request) return new Response('Failed to create request', { status: 500 });

  if (customer.phone && org.telnyx_number) {
    const template = await generateSms(org.name, trade, customer.first_name ?? null, platform);
    const smsBody  = template.replace('{LINK}', reviewUrl);

    await fetch('https://api.telnyx.com/v2/messages', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('TELNYX_API_KEY')}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from: org.telnyx_number, to: customer.phone, text: smsBody }),
    });

    await supabase.from('review_requests').update({
      status: 'sent', sent_via: 'sms', sent_at: new Date().toISOString(),
    }).eq('id', request.id);
  }

  return new Response(JSON.stringify({ id: request.id }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
