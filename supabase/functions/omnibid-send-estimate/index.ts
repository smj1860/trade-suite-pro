import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe           from 'https://esm.sh/stripe@14';
import { Resend }       from 'https://esm.sh/resend@3';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const resend   = new Resend(Deno.env.get('RESEND_API_KEY')!);

function fmt(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { estimate_id } = await req.json() as { estimate_id: string };

  const { data: estimate } = await supabase
    .from('estimates')
    .select('*, customers(*), organizations(*)')
    .eq('id', estimate_id)
    .single();

  if (!estimate) return new Response('Not found', { status: 404 });

  const { data: items } = await supabase
    .from('estimate_line_items')
    .select('*')
    .eq('estimate_id', estimate_id)
    .order('sort_order');

  const customer = (estimate as any).customers;
  const org      = (estimate as any).organizations;

  if (!customer?.email) return new Response('Customer email required', { status: 400 });

  const { data: member } = await supabase
    .from('org_members').select('id').eq('org_id', estimate.org_id).eq('user_id', user.id).single();
  if (!member) return new Response('Forbidden', { status: 403 });

  try {
    const price = await stripe.prices.create({
      currency:     'usd',
      unit_amount:  estimate.total_cents,
      product_data: { name: `${org.name} — Estimate ${estimate.estimate_number}` },
    });
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata:   { estimate_id, org_id: estimate.org_id },
    });

    const rows = (items ?? []).map((item: any) =>
      `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #2d2d2d">${item.description}</td>
        <td style="padding:8px 0;border-bottom:1px solid #2d2d2d;text-align:right">${item.quantity} ${item.unit ?? ''}</td>
        <td style="padding:8px 0;border-bottom:1px solid #2d2d2d;text-align:right;font-weight:600">${fmt(item.total_cents)}</td>
      </tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><body style="font-family:Inter,system-ui,sans-serif;background:#1A1A1A;color:#fff;max-width:600px;margin:0 auto;padding:32px 20px">
      <h1 style="font-size:24px;margin:0 0 4px">${org.name}</h1>
      <p style="color:#C0C0C0;margin:0 0 32px">${estimate.estimate_number}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead><tr style="border-bottom:2px solid #FF6600">
          <th style="text-align:left;padding-bottom:8px;color:#C0C0C0">Description</th>
          <th style="text-align:right;padding-bottom:8px;color:#C0C0C0">Qty</th>
          <th style="text-align:right;padding-bottom:8px;color:#C0C0C0">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="text-align:right;margin-bottom:32px">
        <p style="color:#C0C0C0">Subtotal: <strong style="color:#fff">${fmt(estimate.subtotal_cents)}</strong></p>
        <p style="color:#C0C0C0">Tax: <strong style="color:#fff">${fmt(estimate.tax_cents)}</strong></p>
        <p style="font-size:20px">Total: <strong style="color:#FF6600">${fmt(estimate.total_cents)}</strong></p>
      </div>
      ${estimate.customer_note ? `<div style="background:#2D2D2D;padding:16px;border-radius:8px;margin-bottom:32px"><p style="margin:0;color:#C0C0C0">Notes</p><p style="margin:8px 0 0">${estimate.customer_note}</p></div>` : ''}
      <div style="text-align:center;background:#FF6600;border-radius:12px;padding:32px">
        <p style="color:#fff;font-size:18px;font-weight:700;margin:0 0 16px">Ready to move forward?</p>
        <a href="${link.url}" style="display:inline-block;background:#fff;color:#FF6600;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">Accept &amp; Pay Online</a>
      </div>
    </body></html>`;

    await resend.emails.send({
      from:    `${org.name} <estimates@mail.tradesuite.com>`,
      to:      [customer.email],
      subject: `Your estimate from ${org.name} — ${estimate.estimate_number}`,
      html,
    });

    await supabase.from('estimates').update({
      status:   'sent',
      sent_at:  new Date().toISOString(),
      sent_via: 'email',
      pdf_url:  link.url,
    }).eq('id', estimate_id);

    return new Response(JSON.stringify({ payment_link_url: link.url }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('omnibid-send-estimate error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
