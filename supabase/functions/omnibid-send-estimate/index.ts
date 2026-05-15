import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe           from 'https://esm.sh/stripe@14';
import { Resend }       from 'https://esm.sh/resend@3';
import { htmlToPdf, uploadPdf, fmtCents } from '../_shared/pdf.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const resend   = new Resend(Deno.env.get('RESEND_API_KEY')!);

function buildEstimateHtml(
  estimate: Record<string, unknown>,
  items: Record<string, unknown>[],
  org: Record<string, unknown>,
  customer: Record<string, unknown>,
  paymentUrl: string
): string {
  const est  = estimate as any;
  const rows = items
    .filter((i: any) => i.is_customer_facing)
    .map((item: any) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #2d2d2d;color:#fff">${item.description}</td>
        <td style="padding:10px 0;border-bottom:1px solid #2d2d2d;text-align:right;color:#C0C0C0">${item.quantity}${item.unit ? ' ' + item.unit : ''}</td>
        <td style="padding:10px 0;border-bottom:1px solid #2d2d2d;text-align:right;color:#C0C0C0">${fmtCents(item.unit_price_cents)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #2d2d2d;text-align:right;font-weight:700;color:#fff">${fmtCents(item.total_cents)}</td>
      </tr>`)
    .join('');

  const expiryLine = est.expiry_date
    ? `<p style="color:#f87171;font-size:13px;margin:4px 0 0">Expires ${new Date(est.expiry_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, system-ui, sans-serif; background: #1A1A1A; color: #fff; padding: 48px 40px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding-bottom: 10px; border-bottom: 2px solid #FF6600; color: #C0C0C0; font-size: 13px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
    th:not(:first-child) { text-align: right; }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px">
    <div>
      <h1 style="font-size:28px;font-weight:800;color:#fff">${(org as any).name}</h1>
      ${(org as any).phone ? `<p style="color:#C0C0C0;margin-top:4px">${(org as any).phone}</p>` : ''}
      ${(org as any).email ? `<p style="color:#C0C0C0">${(org as any).email}</p>` : ''}
    </div>
    <div style="text-align:right">
      <div style="background:#FF6600;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:4px 12px;border-radius:4px;margin-bottom:8px;display:inline-block">ESTIMATE</div>
      <p style="font-size:22px;font-weight:700;color:#fff">${est.estimate_number}</p>
      <p style="color:#C0C0C0;font-size:14px;margin-top:4px">
        ${new Date(est.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>
      ${expiryLine}
    </div>
  </div>

  <div style="margin-bottom:40px;padding:20px;background:#2D2D2D;border-radius:8px">
    <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#C0C0C0;margin-bottom:8px">PREPARED FOR</p>
    <p style="font-weight:700;color:#fff">${(customer as any).first_name ?? ''} ${(customer as any).last_name ?? ''}</p>
    ${(customer as any).email ? `<p style="color:#C0C0C0;font-size:14px;margin-top:2px">${(customer as any).email}</p>` : ''}
    ${(customer as any).phone ? `<p style="color:#C0C0C0;font-size:14px;margin-top:2px">${(customer as any).phone}</p>` : ''}
  </div>

  <table style="margin-bottom:32px">
    <thead>
      <tr>
        <th style="width:50%">Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="text-align:right;margin-bottom:40px">
    <table style="width:280px;margin-left:auto">
      <tr>
        <td style="padding:6px 0;color:#C0C0C0">Subtotal</td>
        <td style="padding:6px 0;text-align:right;color:#fff;font-weight:600">${fmtCents(est.subtotal_cents)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#C0C0C0">Tax (${((est.tax_rate ?? 0) * 100).toFixed(2)}%)</td>
        <td style="padding:6px 0;text-align:right;color:#fff;font-weight:600">${fmtCents(est.tax_cents)}</td>
      </tr>
      <tr style="border-top:2px solid #FF6600">
        <td style="padding:12px 0;font-size:18px;font-weight:800;color:#fff">Total</td>
        <td style="padding:12px 0;text-align:right;font-size:22px;font-weight:800;color:#FF6600">${fmtCents(est.total_cents)}</td>
      </tr>
    </table>
  </div>

  ${est.customer_note ? `
  <div style="padding:20px;background:#2D2D2D;border-radius:8px;margin-bottom:40px">
    <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#C0C0C0;margin-bottom:8px">NOTES</p>
    <p style="color:#fff;line-height:1.6">${est.customer_note}</p>
  </div>` : ''}

  <div style="background:#FF6600;border-radius:12px;padding:32px;text-align:center">
    <p style="color:#fff;font-size:18px;font-weight:800;margin-bottom:8px">Ready to move forward?</p>
    <p style="color:rgba(255,255,255,0.85);font-size:14px;margin-bottom:20px">Accept and pay securely online</p>
    <a href="${paymentUrl}" style="display:inline-block;background:#fff;color:#FF6600;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:800;font-size:16px">
      Accept &amp; Pay — ${fmtCents(est.total_cents)}
    </a>
    <p style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:16px">Powered by Stripe — 100% secure</p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { estimate_id } = await req.json() as { estimate_id: string };

  const [estRes, itemsRes] = await Promise.all([
    supabase.from('estimates').select('*, customers(*), organizations(*)').eq('id', estimate_id).single(),
    supabase.from('estimate_line_items').select('*').eq('estimate_id', estimate_id).order('sort_order'),
  ]);

  if (!estRes.data) return new Response('Estimate not found', { status: 404 });

  const estimate = estRes.data;
  const items    = itemsRes.data ?? [];
  const customer = (estimate as any).customers;
  const org      = (estimate as any).organizations;

  if (!customer?.email) return new Response('Customer email required', { status: 400 });

  const { data: userRow } = await supabase.from('users').select('id').eq('id', user.id).eq('org_id', estimate.org_id).single();
  if (!userRow) return new Response('Forbidden', { status: 403 });

  try {
    // 1. Stripe Payment Link
    const price = await stripe.prices.create({
      currency:     'usd',
      unit_amount:  estimate.total_cents,
      product_data: { name: `${org.name} — Estimate ${estimate.estimate_number}` },
    });
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata:   { estimate_id, org_id: estimate.org_id },
    });

    // 2. Generate PDF
    const html     = buildEstimateHtml(estimate, items, org, customer, link.url);
    const pdfBytes = await htmlToPdf(html);
    const filename = `${estimate.estimate_number.replace(/[^a-z0-9-]/gi, '-')}.pdf`;
    const pdfUrl   = await uploadPdf(estimate.org_id, 'estimates', filename, pdfBytes);

    // 3. Send email with PDF attachment
    await resend.emails.send({
      from:    `${org.name} <estimates@mail.tradesuite.com>`,
      to:      [customer.email],
      subject: `Your estimate from ${org.name} — ${estimate.estimate_number}`,
      html: `<div style="font-family:Inter,system-ui,sans-serif;background:#1A1A1A;color:#fff;padding:32px;max-width:600px;margin:0 auto">
        <h2 style="color:#fff;margin-bottom:8px">Hi ${customer.first_name ?? 'there'},</h2>
        <p style="color:#C0C0C0;margin-bottom:24px">Please find your estimate attached. You can also view and accept it online:</p>
        <a href="${link.url}" style="display:inline-block;background:#FF6600;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;margin-bottom:24px">
          View &amp; Accept Estimate
        </a>
        <p style="color:#6b6b6b;font-size:13px">— ${org.name}</p>
      </div>`,
      attachments: [{ filename, content: btoa(String.fromCharCode(...pdfBytes)) }],
    });

    // 4. Update estimate
    await supabase.from('estimates').update({
      status:   'sent',
      sent_at:  new Date().toISOString(),
      sent_via: 'email',
      pdf_url:  pdfUrl,
    }).eq('id', estimate_id);

    return new Response(JSON.stringify({ payment_link_url: link.url, pdf_url: pdfUrl }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('omnibid-send-estimate error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
