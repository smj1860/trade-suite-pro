import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-04-10' });

const INNGEST_EVENT_KEY = Deno.env.get('INNGEST_EVENT_KEY') ?? '';
const INNGEST_URL       = Deno.env.get('INNGEST_URL') ?? 'https://inn.gs/e';

async function buildHtmlEmail(params: {
  estimateNumber: string;
  customerName: string;
  orgName: string;
  totalCents: number;
  paymentLinkUrl: string;
  lineItems: Array<{ description: string; total_cents: number }>;
}): Promise<string> {
  const { estimateNumber, customerName, orgName, totalCents, paymentLinkUrl, lineItems } = params;
  const total = (totalCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const itemRows = lineItems
    .map(i => `<tr><td style="padding:8px 0;border-bottom:1px solid #3d3d3d">${i.description}</td><td style="padding:8px 0;border-bottom:1px solid #3d3d3d;text-align:right">${(i.total_cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<body style="background:#1A1A1A;color:#fff;font-family:system-ui,sans-serif;margin:0;padding:32px">
  <div style="max-width:600px;margin:0 auto">
    <h1 style="color:#FF6600;font-size:28px;margin:0 0 8px">${orgName}</h1>
    <p style="color:#C0C0C0;margin:0 0 32px">Estimate ${estimateNumber}</p>
    <p>Hi ${customerName ?? 'there'},</p>
    <p>Here is your estimate from ${orgName}. Please review and accept below.</p>
    <table style="width:100%;margin:24px 0">
      <thead><tr><th style="text-align:left;color:#C0C0C0;font-size:12px;padding-bottom:8px">Item</th><th style="text-align:right;color:#C0C0C0;font-size:12px;padding-bottom:8px">Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr><td style="padding-top:16px;font-weight:bold;font-size:18px">Total</td><td style="padding-top:16px;font-weight:bold;font-size:18px;text-align:right;color:#FF6600">${total}</td></tr></tfoot>
    </table>
    <a href="${paymentLinkUrl}" style="display:inline-block;background:#FF6600;color:#fff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:bold;font-size:16px;margin:24px 0">Accept & Pay ${total}</a>
    <p style="color:#6b6b6b;font-size:12px;margin-top:32px">This estimate was prepared by ${orgName}.</p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) return new Response('Unauthorized', { status: 401 });

  const { estimate_id } = await req.json() as { estimate_id: string };

  // Fetch estimate + items + customer + org
  const { data: estimate } = await supabase
    .from('estimates')
    .select('*, customer:customers(*), org:organizations(*)')
    .eq('id', estimate_id)
    .single();

  if (!estimate) return new Response('Not found', { status: 404 });

  const { data: lineItems } = await supabase
    .from('estimate_line_items')
    .select('description, total_cents, is_customer_facing')
    .eq('estimate_id', estimate_id)
    .eq('is_customer_facing', true)
    .order('sort_order');

  try {
    // Create Stripe Payment Link
    const product = await stripe.products.create({
      name: `Estimate ${estimate.estimate_number} — ${estimate.org.name}`,
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: estimate.total_cents,
      currency: 'usd',
    });
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { estimate_id, org_id: estimate.org_id },
    });

    // Send email via Resend
    const customerEmail: string = estimate.customer?.email;
    const customerName: string  = estimate.customer?.name ?? '';

    if (customerEmail) {
      const html = await buildHtmlEmail({
        estimateNumber: estimate.estimate_number,
        customerName,
        orgName: estimate.org.name,
        totalCents: estimate.total_cents,
        paymentLinkUrl: paymentLink.url,
        lineItems: lineItems ?? [],
      });

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${estimate.org.name} <estimates@${Deno.env.get('RESEND_DOMAIN') ?? 'mail.tradesuite.app'}>`,
          to: [customerEmail],
          subject: `Estimate ${estimate.estimate_number} from ${estimate.org.name}`,
          html,
        }),
      });
    }

    // Update estimate status
    await supabase.from('estimates').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_via: 'email',
      updated_at: new Date().toISOString(),
    }).eq('id', estimate_id);

    // Fire Inngest event
    await fetch(`${INNGEST_URL}/${INNGEST_EVENT_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'omnibid/estimate.sent',
        data: {
          estimate_id,
          org_id: estimate.org_id,
          customer_email: customerEmail,
          customer_name: customerName,
          payment_link_url: paymentLink.url,
        },
      }),
    });

    return new Response(JSON.stringify({ payment_link_url: paymentLink.url }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
