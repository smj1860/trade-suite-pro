import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe           from 'https://esm.sh/stripe@14';

const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function getActiveModulesFromSubscription(subscription: Stripe.Subscription): Promise<string[]> {
  const modules: string[] = [];
  for (const item of subscription.items.data) {
    const product = await stripe.products.retrieve(item.price.product as string);
    const module  = product.metadata?.module;
    if (module && ['leads', 'estimates', 'reviews'].includes(module)) {
      modules.push(module);
    }
  }
  return modules;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const isActive   = subscription.status === 'active' || subscription.status === 'trialing';

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) {
    console.warn('stripe-webhook: no org found for customer', customerId);
    return;
  }

  const activeModules = isActive
    ? await getActiveModulesFromSubscription(subscription)
    : [];

  await supabase
    .from('organizations')
    .update({
      active_modules:         activeModules,
      stripe_subscription_id: subscription.id,
    })
    .eq('id', org.id);

  console.log(`stripe-webhook: org ${org.id} → modules [${activeModules.join(', ')}]`);
}

serve(async (req) => {
  const sig    = req.headers.get('stripe-signature') ?? '';
  const body   = await req.text();
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error('stripe-webhook signature error:', err);
    return new Response('Webhook signature invalid', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const meta    = (invoice as any).metadata ?? {};
        if (meta.estimate_id) {
          await fetch(Deno.env.get('INNGEST_EVENT_URL') ?? 'https://inn.gs/e', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('INNGEST_EVENT_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: 'omnibid/estimate.paid',
              data: {
                estimate_id: meta.estimate_id,
                org_id:      meta.org_id,
                amount_paid: invoice.amount_paid,
              },
            }),
          });
        }
        break;
      }

      default:
        // ignore
    }
  } catch (err) {
    console.error('stripe-webhook processing error:', err);
    return new Response('Internal error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
});
