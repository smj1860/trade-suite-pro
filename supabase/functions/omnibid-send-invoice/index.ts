import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe           from 'https://esm.sh/stripe@14';
import { Resend }       from 'https://esm.sh/resend@3';
import { htmlToPdf, uploadPdf, fmtCents } from '../_shared/pdf.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const resend   = new Resend(Deno.env.get('RESEND_API_KEY')!);

function buildInvoiceHtml(
  invoice: Record<string, unknown>,
  payments: Record<string, unknown>[],
  estimate: Record<string, unknown> | null,
  org: Record<string, unknown>,
  customer: Record<string, unknown>,
  paymentUrl: string
): string {
  const inv      = invoice as any;
  const orgData  = org as any;
  const cust     = customer as any;
  const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount_cents ?? 0), 0);
  const balance   = inv.balance_cents ?? (inv.total_cents - totalPaid);
  const isPaid    = inv.status === 'paid' || balance <= 0;

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
      <h1 style="font-size:28px;font-weight:800;color:#fff">${orgData.name}</h1>
      ${orgData.phone ? `<p style="color:#C0C0C0;margin-top:4px">${orgData.phone}</p>` : ''}
      ${orgData.email ? `<p style="color:#C0C0C0">${orgData.email}</p>` : ''}
    </div>
    <div style="text-align:right">
      <div style="background:${isPaid ? '#166046' : '#FF6600'};color:#fff;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:4px 12px;border-radius:4px;margin-bottom:8px;display:inline-block">
        ${isPaid ? 'PAID' : 'INVOICE'}
      </div>
      <p style="font-size:22px;font-weight:700;color:#fff">${inv.invoice_number}</p>
      <p style="color:#C0C0C0;font-size:14px;margin-top:4px">
        ${new Date(inv.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>
      ${inv.due_date ? `<p style="color:${isPaid ? '#34d399' : '#f87171'};font-size:13px;margin-top:4px">Due ${new Date(inv.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>` : ''}
    </div>
  </div>

  <div style="margin-bottom:40px;padding:20px;background:#2D2D2D;border-radius:8px">
    <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#C0C0C0;margin-bottom:8px">BILL TO</p>
    <p style="font-weight:700;color:#fff">${cust.first_name ?? ''} ${cust.last_name ?? ''}</p>
    ${cust.email ? `<p style="color:#C0C0C0;font-size:14px;margin-top:2px">${cust.email}</p>` : ''}
    ${cust.phone ? `<p style="color:#C0C0C0;font-size:14px;margin-top:2px">${cust.phone}</p>` : ''}
  </div>

  ${estimate ? `<div style="margin-bottom:32px;padding:12px 20px;background:#2D2D2D;border-radius:8px;border-left:3px solid #FF6600">
    <p style="color:#C0C0C0;font-size:13px">Re: Estimate ${(estimate as any).estimate_number}</p>
  </div>` : ''}

  <div style="margin-bottom:40px">
    <table style="width:320px;margin-left:auto">
      <tr>
        <td style="padding:8px 0;color:#C0C0C0">Subtotal</td>
        <td style="padding:8px 0;text-align:right;color:#fff;font-weight:600">${fmtCents(inv.subtotal_cents)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#C0C0C0">Tax</td>
        <td style="padding:8px 0;text-align:right;color:#fff;font-weight:600">${fmtCents(inv.tax_cents)}</td>
      </tr>
      <tr style="border-top:1px solid #3d3d3d">
        <td style="padding:10px 0;font-weight:700;color:#fff">Invoice Total</td>
        <td style="padding:10px 0;text-align:right;font-weight:700;color:#fff">${fmtCents(inv.total_cents)}</td>
      </tr>
      ${totalPaid > 0 ? `<tr>
        <td style="padding:8px 0;color:#34d399">Paid</td>
        <td style="padding:8px 0;text-align:right;color:#34d399;font-weight:600">− ${fmtCents(totalPaid)}</td>
      </tr>` : ''}
      <tr style="border-top:2px solid #FF6600">
        <td style="padding:14px 0;font-size:18px;font-weight:800;color:#fff">Balance Due</td>
        <td style="padding:14px 0;text-align:right;font-size:22px;font-weight:800;color:${isPaid ? '#34d399' : '#FF6600'}">
          ${isPaid ? 'PAID' : fmtCents(balance)}
        </td>
      </tr>
    </table>
  </div>

  ${inv.customer_note ? `<div style="padding:20px;background:#2D2D2D;border-radius:8px;margin-bottom:40px">
    <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#C0C0C0;margin-bottom:8px">NOTES</p>
    <p style="color:#fff;line-height:1.6">${inv.customer_note}</p>
  </div>` : ''}

  ${!isPaid ? `
  <div style="background:#FF6600;border-radius:12px;padding:32px;text-align:center">
    <p style="color:#fff;font-size:18px;font-weight:800;margin-bottom:8px">Balance due: ${fmtCents(balance)}</p>
    <p style="color:rgba(255,255,255,0.85);font-size:14px;margin-bottom:20px">Pay securely online</p>
    <a href="${paymentUrl}" style="display:inline-block;background:#fff;color:#FF6600;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:800;font-size:16px">Pay Now — ${fmtCents(balance)}</a>
    <p style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:16px">Powered by Stripe — 100% secure</p>
  </div>` : `
  <div style="background:#1a3d2e;border:1px solid #166046;border-radius:12px;padding:24px;text-align:center">
    <p style="color:#34d399;font-size:18px;font-weight:800">✓ Paid in full — thank you!</p>
    ${inv.paid_at ? `<p style="color:#C0C0C0;font-size:13px;margin-top:4px">${new Date(inv.paid_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>` : ''}
  </div>`}
</body>
</html>`;
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { invoice_id } = await req.json() as { invoice_id: string };

  const [invRes, paymentsRes] = await Promise.all([
    supabase.from('invoices')
      .select('*, customers(*), organizations(*), estimates(estimate_number)')
      .eq('id', invoice_id).single(),
    supabase.from('invoice_payments').select('*').eq('invoice_id', invoice_id),
  ]);

  if (!invRes.data) return new Response('Invoice not found', { status: 404 });

  const invoice  = invRes.data;
  const payments = paymentsRes.data ?? [];
  const customer = (invoice as any).customers;
  const org      = (invoice as any).organizations;
  const estimate = (invoice as any).estimates ?? null;

  if (!customer?.email) return new Response('Customer email required', { status: 400 });

  const { data: userRow } = await supabase.from('users').select('id').eq('id', user.id).eq('org_id', invoice.org_id).single();
  if (!userRow) return new Response('Forbidden', { status: 403 });

  const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount_cents ?? 0), 0);
  const balance   = invoice.balance_cents ?? (invoice.total_cents - totalPaid);
  const isPaid    = invoice.status === 'paid' || balance <= 0;

  try {
    let paymentUrl = invoice.payment_link_url ?? '';

    if (!isPaid && !invoice.payment_link_url) {
      const price = await stripe.prices.create({
        currency:     'usd',
        unit_amount:  balance,
        product_data: { name: `${org.name} — Invoice ${invoice.invoice_number}` },
      });
      const link = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata:   { invoice_id, org_id: invoice.org_id },
      });
      paymentUrl = link.url;
      await supabase.from('invoices').update({ payment_link_url: paymentUrl }).eq('id', invoice_id);
    }

    const html     = buildInvoiceHtml(invoice, payments, estimate, org, customer, paymentUrl);
    const pdfBytes = await htmlToPdf(html);
    const filename = `${invoice.invoice_number.replace(/[^a-z0-9-]/gi, '-')}.pdf`;
    const pdfUrl   = await uploadPdf(invoice.org_id, 'invoices', filename, pdfBytes);

    const subject = isPaid
      ? `Receipt from ${org.name} — ${invoice.invoice_number}`
      : `Invoice from ${org.name} — ${invoice.invoice_number}`;

    await resend.emails.send({
      from:    `${org.name} <invoices@mail.tradesuite.com>`,
      to:      [customer.email],
      subject,
      html: `<div style="font-family:Inter,system-ui,sans-serif;background:#1A1A1A;color:#fff;padding:32px;max-width:600px;margin:0 auto">
        <h2 style="color:#fff;margin-bottom:8px">Hi ${customer.first_name ?? 'there'},</h2>
        ${isPaid
          ? `<p style="color:#C0C0C0;margin-bottom:24px">Thank you for your payment! Your receipt is attached.</p>`
          : `<p style="color:#C0C0C0;margin-bottom:24px">Your invoice is attached. The balance due is <strong style="color:#FF6600">${fmtCents(balance)}</strong>.</p>
             <a href="${paymentUrl}" style="display:inline-block;background:#FF6600;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;margin-bottom:24px">Pay Now</a>`
        }
        <p style="color:#6b6b6b;font-size:13px">— ${org.name}</p>
      </div>`,
      attachments: [{ filename, content: btoa(String.fromCharCode(...pdfBytes)) }],
    });

    if (!isPaid) {
      await supabase.from('invoices').update({
        status:   'sent',
        sent_at:  new Date().toISOString(),
        sent_via: 'email',
      }).eq('id', invoice_id).eq('status', 'draft');
    }

    return new Response(JSON.stringify({ pdf_url: pdfUrl, payment_link_url: paymentUrl }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('omnibid-send-invoice error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
