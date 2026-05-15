# CLAUDE.md — TradeSuite Phase 3
> Execution file. Read completely then work top to bottom without pausing.
> Phase 1 built core + LeadLock. Phase 2 built OmniBid backend, RepuGuard, and Stripe.
> Phase 3 adds PDF generation, invoice send flow, missing triggers, settings UI, and closes all remaining gaps.

---

## DO NOT RECREATE — CONFIRMED COMPLETE

```
All core packages and migrations
supabase/functions/stripe-portal/         ✓
supabase/functions/stripe-webhook/        ✓
supabase/functions/omnibid-voice-parse/   ✓
supabase/functions/omnibid-send-estimate/ ✓  (needs PDF upgrade — see Task 2)
supabase/functions/repuguard-send-request/ ✓
inngest/serve.ts                          ✓
inngest/functions/leadlock-sequence.ts    ✓
inngest/functions/omnibid-estimate-watcher.ts ✓
inngest/functions/repuguard-sequence.ts   ✓
modules/leads/                            ✓  complete
modules/estimates/                        ✓  complete
modules/reviews/                          ✓  complete
supabase/migrations/20260514_leadlock.sql ✓
supabase/migrations/20260515_repuguard.sql ✓
modules/estimates/supabase/migrations/0001_omnibid_schema.sql ✓
```

---

## HARD RULES (never break)

- Package prefix: `@trades-saas/` only
- Vite + React 18 — no Next.js patterns
- Font: Inter only
- Colors: token classes only (`bg-brand`, `bg-surface`, `bg-surface-raised`, `text-content`, `text-content-secondary`, `text-content-muted`)
- Reads: PowerSync `useQuery` — never `supabase.from().select()` in components
- Money: cents in DB, `(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})` in display
- `set_updated_at()` already exists — never redefine
- Edge Functions: Deno — `https://esm.sh/` or `https://deno.land/` imports only
- Touch targets: 48px minimum

---

# TASK LIST

---

## TASK 1 — Storage bucket + PDF infrastructure migration

Create `supabase/migrations/20260516_storage_documents.sql`:

```sql
-- Create the documents storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,                          -- private — URLs are signed
  10485760,                       -- 10MB max per file
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can only read documents for their own org
CREATE POLICY "documents_org_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (
      SELECT org_id::text FROM public.users WHERE id = auth.uid() LIMIT 1
    )
  );

-- Service role can write (Edge Functions upload PDFs)
CREATE POLICY "documents_service_write" ON storage.objects
  FOR INSERT TO service_role WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents_service_update" ON storage.objects
  FOR UPDATE TO service_role USING (bucket_id = 'documents');
```

---

## TASK 2 — PDF generation helper (shared Deno module)

Create `supabase/functions/_shared/pdf.ts`.
This is imported by both `omnibid-send-estimate` and `omnibid-send-invoice`.

PDF generation strategy: POST the HTML to a Gotenberg instance (self-hosted or the free demo).
Store the resulting PDF bytes in Supabase Storage and return a signed URL.

```typescript
// supabase/functions/_shared/pdf.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

/**
 * Convert an HTML string to a PDF using Gotenberg.
 * Set PDF_API_URL env var to your Gotenberg instance.
 * Free demo: https://demo.gotenberg.dev  (rate-limited — use for dev only)
 * Production: deploy Gotenberg to Railway/Fly.io and set the URL.
 */
export async function htmlToPdf(html: string): Promise<Uint8Array> {
  const apiUrl = Deno.env.get('PDF_API_URL') ?? 'https://demo.gotenberg.dev';

  const form = new FormData();
  form.append(
    'files',
    new Blob([html], { type: 'text/html' }),
    'index.html'
  );

  // Gotenberg paper size + margins optimised for an invoice/estimate document
  const res = await fetch(`${apiUrl}/forms/chromium/convert/html`, {
    method: 'POST',
    body: form,
    // Optional Gotenberg headers for paper size
    headers: {
      'Gotenberg-Output-Filename': 'document.pdf',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PDF generation failed (${res.status}): ${text}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Upload a PDF to Supabase Storage (documents bucket).
 * Returns a signed URL valid for 7 days.
 * Path format: {org_id}/{document_type}/{filename}
 */
export async function uploadPdf(
  orgId: string,
  folder: 'estimates' | 'invoices',
  filename: string,
  pdfBytes: Uint8Array
): Promise<string> {
  const path = `${orgId}/${folder}/${filename}`;

  const { error } = await supabase.storage
    .from('documents')
    .upload(path, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  // Signed URL — valid 7 days (604800 seconds)
  const { data: signed } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, 604800);

  if (!signed?.signedUrl) throw new Error('Failed to create signed URL');

  return signed.signedUrl;
}

/** Format cents as USD string for use inside PDF HTML templates */
export function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
```

---

## TASK 3 — Update `omnibid-send-estimate` to generate and attach PDF

Replace the entire contents of `supabase/functions/omnibid-send-estimate/index.ts`:

```typescript
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

  const expiryLine = (estimate as any).expiry_date
    ? `<p style="color:#f87171;font-size:13px;margin:4px 0 0">Expires ${new Date((estimate as any).expiry_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>`
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
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px">
    <div>
      <h1 style="font-size:28px;font-weight:800;color:#fff">${(org as any).name}</h1>
      ${(org as any).phone ? `<p style="color:#C0C0C0;margin-top:4px">${(org as any).phone}</p>` : ''}
      ${(org as any).email ? `<p style="color:#C0C0C0">${(org as any).email}</p>` : ''}
    </div>
    <div style="text-align:right">
      <div style="background:#FF6600;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:4px 12px;border-radius:4px;margin-bottom:8px;display:inline-block">ESTIMATE</div>
      <p style="font-size:22px;font-weight:700;color:#fff">${(estimate as any).estimate_number}</p>
      <p style="color:#C0C0C0;font-size:14px;margin-top:4px">
        ${new Date((estimate as any).created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>
      ${expiryLine}
    </div>
  </div>

  <!-- Bill To -->
  <div style="margin-bottom:40px;padding:20px;background:#2D2D2D;border-radius:8px">
    <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#C0C0C0;margin-bottom:8px">PREPARED FOR</p>
    <p style="font-weight:700;color:#fff">${(customer as any).first_name ?? ''} ${(customer as any).last_name ?? ''}</p>
    ${(customer as any).email ? `<p style="color:#C0C0C0;font-size:14px;margin-top:2px">${(customer as any).email}</p>` : ''}
    ${(customer as any).phone ? `<p style="color:#C0C0C0;font-size:14px;margin-top:2px">${(customer as any).phone}</p>` : ''}
  </div>

  <!-- Line Items -->
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

  <!-- Totals -->
  <div style="text-align:right;margin-bottom:40px">
    <table style="width:280px;margin-left:auto">
      <tr>
        <td style="padding:6px 0;color:#C0C0C0">Subtotal</td>
        <td style="padding:6px 0;text-align:right;color:#fff;font-weight:600">${fmtCents((estimate as any).subtotal_cents)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#C0C0C0">Tax (${((estimate as any).tax_rate * 100).toFixed(2)}%)</td>
        <td style="padding:6px 0;text-align:right;color:#fff;font-weight:600">${fmtCents((estimate as any).tax_cents)}</td>
      </tr>
      <tr style="border-top:2px solid #FF6600">
        <td style="padding:12px 0;font-size:18px;font-weight:800;color:#fff">Total</td>
        <td style="padding:12px 0;text-align:right;font-size:22px;font-weight:800;color:#FF6600">${fmtCents((estimate as any).total_cents)}</td>
      </tr>
    </table>
  </div>

  ${(estimate as any).customer_note ? `
  <div style="padding:20px;background:#2D2D2D;border-radius:8px;margin-bottom:40px">
    <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#C0C0C0;margin-bottom:8px">NOTES</p>
    <p style="color:#fff;line-height:1.6">${(estimate as any).customer_note}</p>
  </div>` : ''}

  <!-- CTA -->
  <div style="background:#FF6600;border-radius:12px;padding:32px;text-align:center">
    <p style="color:#fff;font-size:18px;font-weight:800;margin-bottom:8px">Ready to move forward?</p>
    <p style="color:rgba(255,255,255,0.85);font-size:14px;margin-bottom:20px">Accept and pay securely online</p>
    <a href="${paymentUrl}" style="display:inline-block;background:#fff;color:#FF6600;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:800;font-size:16px">
      Accept &amp; Pay — ${fmtCents((estimate as any).total_cents)}
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

  // Fetch all needed data
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

  // Auth check — user must belong to this org
  const { data: userRow } = await supabase.from('users').select('id').eq('id', user.id).eq('org_id', estimate.org_id).single();
  if (!userRow) return new Response('Forbidden', { status: 403 });

  try {
    // 1. Create Stripe Payment Link
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: estimate.total_cents,
      product_data: { name: `${org.name} — Estimate ${estimate.estimate_number}` },
    });
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { estimate_id, org_id: estimate.org_id },
    });

    // 2. Generate PDF
    const html      = buildEstimateHtml(estimate, items, org, customer, link.url);
    const pdfBytes  = await htmlToPdf(html);
    const filename  = `${estimate.estimate_number.replace(/[^a-z0-9-]/gi, '-')}.pdf`;
    const pdfUrl    = await uploadPdf(estimate.org_id, 'estimates', filename, pdfBytes);

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
      attachments: [{
        filename,
        content: btoa(String.fromCharCode(...pdfBytes)),
      }],
    });

    // 4. Update estimate record
    await supabase.from('estimates').update({
      status:   'sent',
      sent_at:  new Date().toISOString(),
      sent_via: 'email',
      pdf_url:  pdfUrl,           // now the actual PDF in Storage, not the payment link
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
```

Deploy:
```bash
supabase functions deploy omnibid-send-estimate
```

---

## TASK 4 — New `omnibid-send-invoice` Edge Function

Create `supabase/functions/omnibid-send-invoice/index.ts`:

```typescript
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
  const invoiceData = invoice as any;
  const orgData     = org as any;
  const custData    = customer as any;
  const totalPaid   = payments.reduce((s: number, p: any) => s + (p.amount_cents ?? 0), 0);
  const balance     = invoiceData.balance_cents ?? (invoiceData.total_cents - totalPaid);

  const isPaid = invoiceData.status === 'paid' || balance <= 0;

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
  <!-- Header -->
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
      <p style="font-size:22px;font-weight:700;color:#fff">${invoiceData.invoice_number}</p>
      <p style="color:#C0C0C0;font-size:14px;margin-top:4px">
        ${new Date(invoiceData.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>
      ${invoiceData.due_date ? `<p style="color:${isPaid ? '#34d399' : '#f87171'};font-size:13px;margin-top:4px">
        Due ${new Date(invoiceData.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>` : ''}
    </div>
  </div>

  <!-- Bill To -->
  <div style="margin-bottom:40px;padding:20px;background:#2D2D2D;border-radius:8px">
    <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#C0C0C0;margin-bottom:8px">BILL TO</p>
    <p style="font-weight:700;color:#fff">${custData.first_name ?? ''} ${custData.last_name ?? ''}</p>
    ${custData.email ? `<p style="color:#C0C0C0;font-size:14px;margin-top:2px">${custData.email}</p>` : ''}
    ${custData.phone ? `<p style="color:#C0C0C0;font-size:14px;margin-top:2px">${custData.phone}</p>` : ''}
  </div>

  ${estimate ? `<div style="margin-bottom:32px;padding:12px 20px;background:#2D2D2D;border-radius:8px;border-left:3px solid #FF6600">
    <p style="color:#C0C0C0;font-size:13px">Re: Estimate ${(estimate as any).estimate_number}</p>
  </div>` : ''}

  <!-- Totals Summary -->
  <div style="margin-bottom:40px">
    <table style="width:320px;margin-left:auto">
      <tr>
        <td style="padding:8px 0;color:#C0C0C0">Subtotal</td>
        <td style="padding:8px 0;text-align:right;color:#fff;font-weight:600">${fmtCents(invoiceData.subtotal_cents)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#C0C0C0">Tax</td>
        <td style="padding:8px 0;text-align:right;color:#fff;font-weight:600">${fmtCents(invoiceData.tax_cents)}</td>
      </tr>
      <tr style="border-top:1px solid #3d3d3d">
        <td style="padding:10px 0;font-weight:700;color:#fff">Invoice Total</td>
        <td style="padding:10px 0;text-align:right;font-weight:700;color:#fff">${fmtCents(invoiceData.total_cents)}</td>
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

  ${invoiceData.customer_note ? `
  <div style="padding:20px;background:#2D2D2D;border-radius:8px;margin-bottom:40px">
    <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#C0C0C0;margin-bottom:8px">NOTES</p>
    <p style="color:#fff;line-height:1.6">${invoiceData.customer_note}</p>
  </div>` : ''}

  ${!isPaid ? `
  <!-- Pay CTA -->
  <div style="background:#FF6600;border-radius:12px;padding:32px;text-align:center">
    <p style="color:#fff;font-size:18px;font-weight:800;margin-bottom:8px">Balance due: ${fmtCents(balance)}</p>
    <p style="color:rgba(255,255,255,0.85);font-size:14px;margin-bottom:20px">Pay securely online — takes less than a minute</p>
    <a href="${paymentUrl}" style="display:inline-block;background:#fff;color:#FF6600;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:800;font-size:16px">
      Pay Now — ${fmtCents(balance)}
    </a>
    <p style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:16px">Powered by Stripe — 100% secure</p>
  </div>` : `
  <!-- Paid confirmation -->
  <div style="background:#1a3d2e;border:1px solid #166046;border-radius:12px;padding:24px;text-align:center">
    <p style="color:#34d399;font-size:18px;font-weight:800">✓ Paid in full — thank you!</p>
    ${invoiceData.paid_at ? `<p style="color:#C0C0C0;font-size:13px;margin-top:4px">
      ${new Date(invoiceData.paid_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
    </p>` : ''}
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

  // Fetch invoice + related data
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

  // Auth check
  const { data: userRow } = await supabase.from('users').select('id').eq('id', user.id).eq('org_id', invoice.org_id).single();
  if (!userRow) return new Response('Forbidden', { status: 403 });

  const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount_cents ?? 0), 0);
  const balance   = invoice.balance_cents ?? (invoice.total_cents - totalPaid);
  const isPaid    = invoice.status === 'paid' || balance <= 0;

  try {
    let paymentUrl = invoice.payment_link_url ?? '';

    // Create Stripe Payment Link if invoice is unpaid and no link exists yet
    if (!isPaid && !invoice.payment_link_url) {
      const price = await stripe.prices.create({
        currency: 'usd',
        unit_amount: balance,
        product_data: { name: `${org.name} — Invoice ${invoice.invoice_number}` },
      });
      const link = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: { invoice_id, org_id: invoice.org_id },
      });
      paymentUrl = link.url;

      await supabase.from('invoices').update({ payment_link_url: paymentUrl }).eq('id', invoice_id);
    }

    // Generate PDF
    const html     = buildInvoiceHtml(invoice, payments, estimate, org, customer, paymentUrl);
    const pdfBytes = await htmlToPdf(html);
    const filename = `${invoice.invoice_number.replace(/[^a-z0-9-]/gi, '-')}.pdf`;
    const pdfUrl   = await uploadPdf(invoice.org_id, 'invoices', filename, pdfBytes);

    // Send email with PDF attachment
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
      attachments: [{
        filename,
        content: btoa(String.fromCharCode(...pdfBytes)),
      }],
    });

    // Update invoice sent status
    if (!isPaid) {
      await supabase.from('invoices').update({
        status:  'sent',
        sent_at: new Date().toISOString(),
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
```

Deploy:
```bash
supabase functions deploy omnibid-send-invoice
```

---

## TASK 5 — Add `sendInvoice` to OmniBid hooks

Open `modules/estimates/src/hooks/useEstimates.ts` and add this to `useEstimateActions`:

```typescript
const sendInvoice = useCallback(async (invoiceId: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/omnibid-send-invoice`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ pdf_url: string; payment_link_url: string }>;
}, []);
```

Export it from the return value of `useEstimateActions`.

---

## TASK 6 — Add `PDF_API_URL` and `STRIPE_WEBHOOK_SECRET` to environment docs

Update `.env.example` or the env documentation at the repo root to include:

```bash
# PDF generation (Gotenberg)
# Dev: use https://demo.gotenberg.dev (rate-limited, do not use in production)
# Prod: deploy Gotenberg to Railway/Fly.io — docker image: gotenberg/gotenberg:8
PDF_API_URL=https://demo.gotenberg.dev

# Stripe webhook signing secret (from Stripe dashboard → Webhooks → signing secret)
STRIPE_WEBHOOK_SECRET=whsec_...
```

Also add `PDF_API_URL` and `STRIPE_WEBHOOK_SECRET` as secrets for the relevant Edge Functions:
```bash
supabase secrets set PDF_API_URL=https://demo.gotenberg.dev
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## TASK 7 — Add review_requests to AppSchema and sync rules

### 7a. Open `packages/core-sync/src/schema.ts`

Check if `review_requests` is already in `AppSchema`. If not, add it:

```typescript
const review_requests = new Table(
  {
    org_id:      column.text,
    job_id:      column.text,
    customer_id: column.text,
    status:      column.text,
    sent_via:    column.text,
    platform:    column.text,
    review_url:  column.text,
    sent_at:     column.text,
    clicked_at:  column.text,
    reviewed_at: column.text,
    star_rating: column.integer,
    review_text: column.text,
    inngest_run_id: column.text,
    created_at:  column.text,
    updated_at:  column.text,
  },
  { indexes: { by_status: ['status', 'created_at'] } }
);

// Add to AppSchema export:
// review_requests,
```

### 7b. Open `packages/core-sync/sync-rules.yaml`

Verify `review_requests` is present. If not, add:
```yaml
- SELECT * FROM review_requests WHERE org_id = bucket.org_id
```

---

## TASK 8 — Wire RepuGuard trigger on job completion

When a job is marked complete in the app, we need to fire the `repuguard/job.completed` Inngest event. Find `apps/pwa/src/pages/JobDetailPage.tsx` and locate where job status is updated to `'complete'` or `'closed'`.

After the Supabase update call that changes status to complete, add:

```typescript
// Fire RepuGuard review sequence via Inngest
if (newStatus === 'complete' || newStatus === 'closed') {
  const { data: { session } } = await supabase.auth.getSession();
  fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-repuguard`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id:      job.id,
        customer_id: job.customer_id,
        org_id:      job.org_id,
      }),
    }
  ).catch(console.error); // fire-and-forget
}
```

Create `supabase/functions/trigger-repuguard/index.ts` to receive this and fire the Inngest event:

```typescript
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

  // Verify org has RepuGuard active
  const { data: org } = await supabase
    .from('organizations')
    .select('active_modules, review_delay_hours')
    .eq('id', org_id).single();

  if (!org?.active_modules?.includes('reviews')) {
    return new Response(JSON.stringify({ skipped: true, reason: 'reviews module not active' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fire Inngest event
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
```

Deploy:
```bash
supabase functions deploy trigger-repuguard
```

---

## TASK 9 — Settings: Review platform URLs

Open `apps/pwa/src/pages/settings/SettingsPage.tsx`. Add a "Review Links" section (or find where org settings are edited). Add three URL inputs:

```tsx
// Inside the settings form, add a section for review links.
// These save directly to supabase.from('organizations').update(...)

// Fields to add:
// google_review_url   — label: "Google Review Link"
// yelp_review_url     — label: "Yelp Review Link"
// facebook_review_url — label: "Facebook Review Link"
// review_delay_hours  — label: "Hours after job completion to send request" (number input, default 24)
```

The save should call:
```typescript
await supabase.from('organizations')
  .update({
    google_review_url:   googleUrl || null,
    yelp_review_url:     yelpUrl || null,
    facebook_review_url: facebookUrl || null,
    review_delay_hours:  delayHours,
  })
  .eq('id', org.id);
```

Show a toast/confirmation on save. Use the same card/input styling as the rest of the settings page.

---

## TASK 10 — Settings: Price book management page

Create `apps/pwa/src/pages/settings/PriceBookPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePriceBook } from '@trades-saas/estimates';
import { getSupabaseClient } from '@trades-saas/core-auth';
import { useOrgId } from '@trades-saas/core-ui';   // or however orgId is accessed

const supabase = getSupabaseClient();

export default function PriceBookPage() {
  const navigate = useNavigate();
  const orgId    = useOrgId();
  const { data: items } = usePriceBook();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', category: '', unit: 'each', unit_price: '', description: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!form.name || !form.unit_price) return;
    setSaving(true);
    try {
      await supabase.from('price_book').insert({
        org_id:     orgId,
        name:       form.name,
        category:   form.category || null,
        unit:       form.unit,
        unit_price: parseFloat(form.unit_price),   // price book stores dollars
        active:     true,
      });
      setForm({ name: '', category: '', unit: 'each', unit_price: '', description: '' });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    await supabase.from('price_book').update({ active: !currentActive }).eq('id', id);
  }

  async function handleDelete(id: string) {
    await supabase.from('price_book').delete().eq('id', id);
  }

  // Group by category
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const cat = item.category ?? 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
        <button onClick={() => navigate('/settings')} className="text-content-secondary hover:text-content p-1 -ml-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-field-lg font-extrabold text-content flex-1">Price Book</h1>
        <button
          onClick={() => setShowForm(true)}
          className="text-field-xs font-bold bg-brand text-white px-3 py-2 rounded-button hover:bg-brand-mid transition-colors"
        >
          + Add Item
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Add form */}
        {showForm && (
          <div className="m-4 p-4 bg-surface-raised rounded-card border border-surface-border">
            <p className="text-field-sm font-bold text-content mb-3">New Item</p>
            <div className="space-y-2">
              {[
                { key: 'name', label: 'Name', placeholder: 'e.g. Install 2-ton AC unit' },
                { key: 'category', label: 'Category', placeholder: 'e.g. HVAC, Labor, Materials' },
                { key: 'description', label: 'Description (optional)', placeholder: '' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-field-xs text-content-muted block mb-1">{label}</label>
                  <input
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2 border border-surface-border focus:border-brand outline-none"
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-field-xs text-content-muted block mb-1">Unit</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2 border border-surface-border focus:border-brand outline-none"
                  >
                    {['each', 'hour', 'sqft', 'lnft', 'ton', 'lb', 'ft'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-field-xs text-content-muted block mb-1">Price ($)</label>
                  <input
                    type="number"
                    value={form.unit_price}
                    onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full bg-surface-sunken text-content text-field-sm font-mono rounded-input px-3 py-2 border border-surface-border focus:border-brand outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 text-field-sm text-content-secondary border border-surface-border rounded-button hover:border-content-muted transition-colors">
                Cancel
              </button>
              <button onClick={handleAdd} disabled={saving || !form.name || !form.unit_price}
                className="flex-1 py-2 text-field-sm font-bold bg-brand text-white rounded-button hover:bg-brand-mid transition-colors disabled:opacity-30">
                {saving ? 'Saving...' : 'Add Item'}
              </button>
            </div>
          </div>
        )}

        {/* Grouped list */}
        {Object.entries(grouped).map(([category, catItems]) => (
          <div key={category}>
            <p className="px-4 py-2 text-[10px] font-bold text-content-muted uppercase tracking-widest bg-surface/80 sticky top-0">
              {category}
            </p>
            {catItems.map(item => (
              <div key={item.id} className={`flex items-center gap-3 px-4 py-3 border-b border-surface-border ${!item.active ? 'opacity-40' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-field-sm font-semibold text-content truncate">{item.name}</p>
                  <p className="text-field-xs text-content-muted">
                    ${item.unit_price.toFixed(2)} / {item.unit}
                  </p>
                </div>
                <button onClick={() => handleToggleActive(item.id, !!item.active)}
                  className="text-field-xs text-content-muted hover:text-content px-2 py-1 rounded transition-colors">
                  {item.active ? 'Hide' : 'Show'}
                </button>
                <button onClick={() => handleDelete(item.id)}
                  className="text-field-xs text-danger hover:text-red-300 px-2 py-1 rounded transition-colors">
                  Delete
                </button>
              </div>
            ))}
          </div>
        ))}

        {items.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center h-64 text-center px-8">
            <p className="text-field-sm font-bold text-content-secondary">No items yet</p>
            <p className="text-field-xs text-content-muted mt-1">Add your services and materials above</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

Add route to `apps/pwa/src/App.tsx`:
```tsx
const PriceBookPage = lazy(() => import('./pages/settings/PriceBookPage'));
// Add route inside AuthenticatedShell:
<Route path="/settings/price-book" element={<PriceBookPage />} />
```

Add link in `SettingsPage.tsx` (find the settings menu list and add):
```tsx
{ label: 'Price Book', path: '/settings/price-book', icon: '📋' }
```

---

## TASK 11 — Add Inngest event key secret

The `trigger-repuguard` function and `stripe-webhook` both need `INNGEST_EVENT_KEY` and `INNGEST_EVENT_URL`:
```bash
supabase secrets set INNGEST_EVENT_KEY=your-inngest-event-key
supabase secrets set INNGEST_EVENT_URL=https://inn.gs/e
```

Verify `inngest/serve.ts` has `INNGEST_SIGNING_KEY` set in its environment:
```bash
# In the Railway/Fly deployment env vars:
INNGEST_SIGNING_KEY=signkey-prod-...
INNGEST_EVENT_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
RESEND_API_KEY=...
TELNYX_API_KEY=...
```

---

## TASK 12 — Add inngest/package.json for the serve server

Check if `inngest/package.json` exists. If not, create it:

```json
{
  "name": "@trades-saas/inngest-server",
  "version": "0.0.1",
  "private": true,
  "main": "serve.ts",
  "scripts": {
    "dev":   "tsx watch serve.ts",
    "start": "tsx serve.ts",
    "build": "tsc"
  },
  "dependencies": {
    "@anthropic-ai/sdk":    "^0.24.0",
    "@supabase/supabase-js": "^2.0.0",
    "express":              "^4.18.0",
    "inngest":              "^4.0.0",
    "resend":               "^3.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "tsx":            "^4.0.0",
    "typescript":     "^5.4.0"
  }
}
```

Also verify `inngest/tsconfig.json` exists:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["./**/*.ts"]
}
```

---

## TASK 13 — PWA icons

The `vite.config.ts` PWA manifest references `/icons/icon-192.png` and `/icons/icon-512.png`.
Create `apps/pwa/public/icons/` directory.

Generate two placeholder PNG icons programmatically — an orange square (`#FF6600`) with a white "TS" text. Use a canvas-based script or create simple colored PNG placeholders.

The simplest approach: create a Node script at `scripts/generate-icons.mjs`:
```javascript
import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';

function makeIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  // Background
  ctx.fillStyle = '#FF6600';
  ctx.fillRect(0, 0, size, size);
  // Text
  ctx.fillStyle = '#FFFFFF';
  ctx.font      = `bold ${Math.floor(size * 0.35)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TS', size / 2, size / 2);
  return canvas.toBuffer('image/png');
}

mkdirSync('apps/pwa/public/icons', { recursive: true });
writeFileSync('apps/pwa/public/icons/icon-192.png', makeIcon(192));
writeFileSync('apps/pwa/public/icons/icon-512.png', makeIcon(512));
console.log('Icons generated.');
```

Run:
```bash
pnpm add -w canvas
node scripts/generate-icons.mjs
```

If `canvas` is unavailable in the environment, create the smallest valid PNG files manually using a data URL approach or copy any 192×192 and 512×512 PNG placeholders into the directory. The icons must exist for the PWA manifest to validate.

---

## TASK 14 — Final checks

```bash
# Install all deps
pnpm install

# Type-check everything — fix all errors before finishing
pnpm turbo typecheck

# Verify new files exist:
ls -la supabase/functions/_shared/pdf.ts
ls -la supabase/functions/omnibid-send-invoice/index.ts
ls -la supabase/functions/trigger-repuguard/index.ts
ls -la apps/pwa/src/pages/settings/PriceBookPage.tsx
ls -la apps/pwa/public/icons/icon-192.png
ls -la apps/pwa/public/icons/icon-512.png
ls -la supabase/migrations/20260516_storage_documents.sql
ls -la inngest/package.json

# Verify PDF env var is documented:
grep -r "PDF_API_URL" supabase/functions/

# Verify review_requests in AppSchema:
grep -r "review_requests" packages/core-sync/src/schema.ts

# Deploy all new/updated Edge Functions:
supabase functions deploy omnibid-send-estimate
supabase functions deploy omnibid-send-invoice
supabase functions deploy trigger-repuguard

# Set required secrets:
supabase secrets set PDF_API_URL=https://demo.gotenberg.dev
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set INNGEST_EVENT_KEY=...
supabase secrets set INNGEST_EVENT_URL=https://inn.gs/e
```

---

## HARD RULES REMINDER

- Package prefix: `@trades-saas/` only
- Font: Inter only — no Sora, no DM Mono
- Colors: token classes only — no hex in components
- Reads: PowerSync `useQuery` only — never `supabase.from().select()` in components
- Money: cents in DB, dollar display via `toLocaleString`
- Edge Functions: Deno — `https://esm.sh/` imports only
- Touch targets: 48px minimum
- `set_updated_at()` already exists — never redefine it
