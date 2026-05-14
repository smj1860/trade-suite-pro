import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe           from 'https://esm.sh/stripe@14';

const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { returnUrl } = await req.json() as { returnUrl: string };

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id, organizations(stripe_customer_id)')
    .eq('user_id', user.id)
    .single();

  const stripeCustomerId = (member?.organizations as any)?.stripe_customer_id;

  if (!stripeCustomerId) {
    return new Response(
      JSON.stringify({ error: 'No Stripe customer found. Please contact support.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer:   stripeCustomerId,
    return_url: returnUrl,
  });

  return new Response(
    JSON.stringify({ url: session.url }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
