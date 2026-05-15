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

  const res = await fetch(`${apiUrl}/forms/chromium/convert/html`, {
    method: 'POST',
    body:   form,
    headers: { 'Gotenberg-Output-Filename': 'document.pdf' },
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
    .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

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
