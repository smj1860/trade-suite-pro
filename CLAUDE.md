# CLAUDE.md — TradeSuite Phase 5 (Final Tweaking)
> Execution file. Read completely, then work top to bottom.
> The app builds clean and is feature-complete except for these three items.
> After Phase 5 the product is ready for real users.

---

## DO NOT TOUCH — CONFIRMED COMPLETE

Everything in the repo is working. Only modify files explicitly listed in a task below.

---

## HARD RULES

- Package prefix: `@trades-saas/` only
- Vite + React 18 — no Next.js
- Font: Inter only
- Colors: token classes only — `bg-brand`, `bg-surface`, `bg-surface-raised`, `bg-surface-sunken`, `text-content`, `text-content-secondary`, `text-content-muted`, `text-brand`, `text-success`, `text-warning`, `text-danger`
- Reads: PowerSync `useReactiveQuery` or `useQuery` — never `supabase.from().select()` in components
- Money: cents in DB — display with `(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})`
- Touch targets: 48px minimum (`h-touch`)

---

# TASK 1 — Customer filter in JobsPage (small fix)

`CustomersPage` navigates to `/jobs?customer=${customer.id}` when a customer row is tapped, but `JobsPage` ignores the query param and shows all jobs.

### 1a. Update `apps/pwa/src/pages/JobsPage.tsx`

Add `useSearchParams` import and read the customer filter:

```tsx
import { useNavigate, useSearchParams } from 'react-router-dom';

// Inside JobsPage(), add:
const [searchParams] = useSearchParams();
const customerFilter = searchParams.get('customer'); // uuid or null
```

Update the PowerSync query to add a customer clause when the param is present:

```tsx
const customerClause = customerFilter ? `AND j.customer_id = '${customerFilter}'` : '';

const { data: rows } = useReactiveQuery<JobRow>(`
  SELECT
    j.*,
    c.name AS customer_name,
    u.name AS assigned_to_name,
    e.total_cents AS estimate_total_cents
  FROM jobs j
  LEFT JOIN customers  c ON c.id = j.customer_id
  LEFT JOIN users      u ON u.id = j.assigned_to
  LEFT JOIN estimates  e ON e.job_id = j.id AND e.status NOT IN ('declined', 'rejected', 'expired', 'superseded')
  WHERE j.org_id = ?
    AND j.${whereStatus}
    ${customerClause}
  ORDER BY
    CASE j.status
      WHEN 'active'    THEN 1
      WHEN 'scheduled' THEN 2
      WHEN 'lead'      THEN 3
      WHEN 'complete'  THEN 4
      WHEN 'closed'    THEN 5
      ELSE 6
    END,
    j.scheduled_at ASC,
    j.created_at DESC
  LIMIT 100
`, [orgId]);
```

Show a customer name header when filtering, and add a clear button:

```tsx
// Fetch the customer name when filtering
const { data: customerRows } = useReactiveQuery<{ name: string }>(
  customerFilter
    ? `SELECT name FROM customers WHERE id = ? LIMIT 1`
    : `SELECT '' AS name WHERE 0`,
  customerFilter ? [customerFilter] : []
);
const customerName = customerRows?.[0]?.name;

// Add above the filter tabs when customerFilter is set:
{customerFilter && customerName && (
  <div className="flex items-center justify-between px-4 py-2 bg-surface-raised border-b border-surface-border">
    <p className="text-field-xs text-content-secondary">
      Jobs for <span className="font-semibold text-content">{customerName}</span>
    </p>
    <button
      onClick={() => navigate('/jobs')}
      className="text-field-xs text-brand font-semibold touch-manipulation"
    >
      Clear
    </button>
  </div>
)}
```

---

# TASK 2 — Invoice creation UI

The estimate → invoice flow is fully built in the backend (`omnibid-send-invoice` Edge Function) but there is no "Convert to Invoice" button in the UI. This task adds it.

## 2a. Add `createInvoice` to `modules/estimates/src/hooks/useEstimates.ts`

Inside `useEstimateActions`, add:

```typescript
const createInvoice = useCallback(async (estimateId: string): Promise<{ id: string }> => {
  const { data: { session } } = await supabase.auth.getSession();

  // Fetch the estimate to copy its values
  const { data: est, error: estErr } = await supabase
    .from('estimates')
    .select('org_id, job_id, customer_id, subtotal_cents, tax_cents, tax_rate, total_cents, customer_note, created_by')
    .eq('id', estimateId)
    .single();
  if (estErr || !est) throw new Error('Estimate not found');

  // Create invoice record — status starts as 'draft'
  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .insert({
      org_id:         est.org_id,
      job_id:         est.job_id,
      customer_id:    est.customer_id,
      created_by:     est.created_by,
      estimate_id:    estimateId,
      subtotal_cents: est.subtotal_cents,
      tax_cents:      est.tax_cents,
      tax_rate:       est.tax_rate,
      total_cents:    est.total_cents,
      balance_cents:  est.total_cents,
      customer_note:  est.customer_note,
      status:         'draft',
    })
    .select('id')
    .single();
  if (invErr || !inv) throw new Error(invErr?.message ?? 'Failed to create invoice');

  // Mark estimate as invoiced
  await supabase.from('estimates').update({ status: 'superseded' }).eq('id', estimateId);

  return { id: inv.id };
}, []);

const sendInvoice = useCallback(async (invoiceId: string): Promise<{ pdf_url: string; payment_link_url: string }> => {
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

Return both from `useEstimateActions`.

## 2b. Add hooks to read invoices

In `modules/estimates/src/hooks/useEstimates.ts`, add:

```typescript
export function useInvoice(invoiceId: string) {
  return useQuery<Invoice>(
    'SELECT * FROM invoices WHERE id = ? LIMIT 1',
    [invoiceId]
  );
}

export function useJobInvoices(jobId: string) {
  return useQuery<Invoice>(
    'SELECT * FROM invoices WHERE job_id = ? ORDER BY created_at DESC',
    [jobId]
  );
}
```

Add the `Invoice` type to `modules/estimates/src/types.ts` if it doesn't exist:

```typescript
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'void';

export interface Invoice {
  id: string;
  org_id: string;
  job_id: string;
  customer_id: string;
  created_by: string;
  estimate_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal_cents: number;
  tax_cents: number;
  tax_rate: number;
  total_cents: number;
  balance_cents: number;
  due_date: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  payment_link_url: string | null;
  view_token: string | null;
  customer_note: string | null;
  created_at: string;
  updated_at: string;
}
```

Export the new types and hooks from `modules/estimates/src/index.ts`.

## 2c. Add "Convert to Invoice" button to EstimateDetailPage

Open `modules/estimates/src/pages/EstimateDetailPage.tsx`.

Add state and the `createInvoice`/`sendInvoice` actions to the existing destructuring from `useEstimateActions`.

After the existing `sending` state, add:
```typescript
const [converting, setConverting] = useState(false);
const [invoiceId,  setInvoiceId]  = useState<string | null>(null);
const [sendingInv, setSendingInv] = useState(false);
const { createInvoice, sendInvoice } = useEstimateActions();
```

Add a handler:
```typescript
async function handleConvertToInvoice() {
  if (!estimate || converting) return;
  setConverting(true);
  try {
    const { id } = await createInvoice(estimate.id);
    setInvoiceId(id);
  } catch (err) {
    console.error('Convert to invoice failed:', err);
  } finally {
    setConverting(false);
  }
}

async function handleSendInvoice() {
  if (!invoiceId || sendingInv) return;
  setSendingInv(true);
  try {
    await sendInvoice(invoiceId);
  } finally {
    setSendingInv(false);
  }
}
```

In the render, find where the "Send Estimate" button is shown (`isDraft` check).
Add a second action area for accepted estimates — show this when `estimate.status === 'accepted'`:

```tsx
{estimate.status === 'accepted' && !invoiceId && (
  <div className="p-4 border-t border-surface-border">
    <button
      onClick={handleConvertToInvoice}
      disabled={converting}
      className="w-full h-touch bg-brand text-white font-bold text-field-sm rounded-button
                 hover:bg-brand-mid active:scale-[0.99] transition-all disabled:opacity-40
                 flex items-center justify-center gap-2"
    >
      {converting ? (
        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Convert to Invoice
        </>
      )}
    </button>
  </div>
)}

{invoiceId && (
  <div className="p-4 border-t border-surface-border space-y-2">
    <div className="bg-surface-raised border border-success/20 rounded-card px-4 py-3">
      <p className="text-field-xs text-success font-semibold">Invoice created</p>
      <p className="text-field-xs text-content-muted mt-0.5">Send it to the customer to collect payment</p>
    </div>
    <button
      onClick={handleSendInvoice}
      disabled={sendingInv}
      className="w-full h-touch bg-brand text-white font-bold text-field-sm rounded-button
                 hover:bg-brand-mid active:scale-[0.99] transition-all disabled:opacity-40
                 flex items-center justify-center gap-2"
    >
      {sendingInv ? (
        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : 'Send Invoice & Payment Link'}
    </button>
  </div>
)}
```

---

# TASK 3 — Job notes and photos in JobDetailPage

The schema, PowerSync sync, and all types are already in place. This task adds the UI.

## 3a. Add a Supabase Storage bucket for job photos

Create `supabase/migrations/20260517_storage_photos.sql`:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  false,
  52428800,   -- 50MB per photo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "photos_org_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = (
      SELECT org_id::text FROM public.users WHERE id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "photos_org_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = (
      SELECT org_id::text FROM public.users WHERE id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "photos_org_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = (
      SELECT org_id::text FROM public.users WHERE id = auth.uid() LIMIT 1
    )
  );
```

## 3b. Create `apps/pwa/src/components/JobNotes.tsx`

```tsx
import React, { useRef, useState } from 'react';
import { useReactiveQuery } from '@trades-saas/core-ui';
import { getSupabaseClient } from '@trades-saas/core-auth';
import { formatDistanceToNow } from 'date-fns';

const supabase = getSupabaseClient();

interface NoteRow {
  id: string;
  body: string;
  is_customer_facing: number;
  is_pinned: number;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
}

interface JobNotesProps {
  jobId: string;
  orgId: string;
  userId: string;
}

export function JobNotes({ jobId, orgId, userId }: JobNotesProps) {
  const [body,    setBody]    = useState('');
  const [facing,  setFacing]  = useState(false);   // is_customer_facing
  const [saving,  setSaving]  = useState(false);

  const { data: notes } = useReactiveQuery<NoteRow>(`
    SELECT
      n.*,
      u.name AS created_by_name
    FROM job_notes n
    LEFT JOIN users u ON u.id = n.created_by
    WHERE n.job_id = ?
    ORDER BY n.is_pinned DESC, n.created_at DESC
  `, [jobId]);

  async function handleAdd() {
    const trimmed = body.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await supabase.from('job_notes').insert({
        org_id:             orgId,
        job_id:             jobId,
        created_by:         userId,
        body:               trimmed,
        is_customer_facing: facing ? 1 : 0,
        is_pinned:          0,
      });
      setBody('');
      setFacing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    await supabase.from('job_notes').delete().eq('id', noteId);
  }

  return (
    <div className="space-y-3">
      {/* Note list */}
      {notes.map(note => (
        <div key={note.id} className={`rounded-card border p-3 ${
          note.is_pinned ? 'border-warning/30 bg-surface-raised' : 'border-surface-border bg-surface-raised'
        }`}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-field-sm text-content whitespace-pre-wrap">{note.body}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] text-content-muted">
                  {note.created_by_name ?? 'Unknown'} ·{' '}
                  {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                </span>
                {note.is_customer_facing ? (
                  <span className="text-[10px] font-semibold text-info bg-info/10 px-1.5 py-0.5 rounded">
                    Customer-facing
                  </span>
                ) : (
                  <span className="text-[10px] text-content-muted">Internal</span>
                )}
                {note.is_pinned ? <span className="text-[10px] text-warning">📌 Pinned</span> : null}
              </div>
            </div>
            {note.created_by === userId && (
              <button
                onClick={() => handleDelete(note.id)}
                className="text-content-muted hover:text-danger transition-colors p-1 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}

      {notes.length === 0 && (
        <p className="text-field-xs text-content-muted text-center py-4">No notes yet</p>
      )}

      {/* Composer */}
      <div className="space-y-2 pt-1">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                     border border-surface-border focus:border-brand outline-none resize-none
                     placeholder:text-content-muted"
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={facing}
              onChange={e => setFacing(e.target.checked)}
              className="w-4 h-4 accent-brand"
            />
            <span className="text-field-xs text-content-secondary">Customer-facing</span>
          </label>
          <button
            onClick={handleAdd}
            disabled={!body.trim() || saving}
            className="h-9 px-4 bg-brand text-white text-field-xs font-bold rounded-button
                       hover:bg-brand-mid transition-colors disabled:opacity-30"
          >
            {saving ? 'Saving…' : 'Add Note'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

## 3c. Create `apps/pwa/src/components/JobPhotos.tsx`

```tsx
import React, { useRef, useState } from 'react';
import { useReactiveQuery } from '@trades-saas/core-ui';
import { getSupabaseClient } from '@trades-saas/core-auth';
import type { PhotoType } from '@trades-saas/core-types';
import { PHOTO_TYPE_LABELS } from '@trades-saas/core-types';

const supabase = getSupabaseClient();

interface PhotoRow {
  id: string;
  photo_type: string;
  storage_url: string;
  filename: string;
  caption: string | null;
  created_at: string;
}

interface JobPhotosProps {
  jobId: string;
  orgId: string;
  userId: string;
}

const PHOTO_TYPES: PhotoType[] = ['before', 'during', 'after', 'equipment', 'general'];

export function JobPhotos({ jobId, orgId, userId }: JobPhotosProps) {
  const [uploading, setUploading] = useState<PhotoType | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeType, setActiveType] = useState<PhotoType>('before');

  const { data: photos } = useReactiveQuery<PhotoRow>(
    'SELECT * FROM job_photos WHERE job_id = ? ORDER BY created_at DESC',
    [jobId]
  );

  // Group photos by type
  const byType = PHOTO_TYPES.reduce<Record<PhotoType, PhotoRow[]>>((acc, t) => {
    acc[t] = photos.filter(p => p.photo_type === t);
    return acc;
  }, {} as Record<PhotoType, PhotoRow[]>);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(activeType);
    setError(null);

    try {
      const ext      = file.name.split('.').pop() ?? 'jpg';
      const filename = `${orgId}/${jobId}/${activeType}-${Date.now()}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from('job-photos')
        .upload(filename, file, { contentType: file.type, upsert: false });

      if (uploadErr) throw new Error(uploadErr.message);

      // Get public-accessible signed URL (valid 1 year for inline display)
      const { data: urlData } = await supabase.storage
        .from('job-photos')
        .createSignedUrl(filename, 31536000);

      if (!urlData?.signedUrl) throw new Error('Could not get photo URL');

      // Insert metadata record
      await supabase.from('job_photos').insert({
        org_id:            orgId,
        job_id:            jobId,
        uploaded_by:       userId,
        photo_type:        activeType,
        storage_path:      filename,
        storage_url:       urlData.signedUrl,
        filename:          file.name,
        mime_type:         file.type,
        size_bytes:        file.size,
        include_in_report: activeType === 'before' || activeType === 'after' ? 1 : 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(null);
      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(photo: PhotoRow) {
    // Delete from storage
    await supabase.storage.from('job-photos').remove([photo.storage_url]);
    // Delete metadata
    await supabase.from('job_photos').delete().eq('id', photo.id);
  }

  return (
    <div className="space-y-4">
      {/* Hidden file input — camera on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Type tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none">
        {PHOTO_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`shrink-0 text-field-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
              activeType === t
                ? 'bg-brand text-white'
                : 'text-content-secondary hover:text-content hover:bg-surface-raised'
            }`}
          >
            {PHOTO_TYPE_LABELS[t]} ({byType[t].length})
          </button>
        ))}
      </div>

      {/* Photo grid for active type */}
      <div className="grid grid-cols-3 gap-2">
        {byType[activeType].map(photo => (
          <div key={photo.id} className="relative aspect-square rounded-card overflow-hidden bg-surface-raised">
            <img
              src={photo.storage_url}
              alt={photo.caption ?? photo.photo_type}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <button
              onClick={() => handleDelete(photo)}
              className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center
                         justify-center text-white hover:bg-danger transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {/* Add photo button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading !== null}
          className="aspect-square rounded-card border-2 border-dashed border-surface-border
                     flex flex-col items-center justify-center gap-1 bg-surface-raised
                     hover:border-brand hover:bg-surface transition-colors disabled:opacity-40"
        >
          {uploading === activeType ? (
            <span className="w-5 h-5 border-2 border-surface-border border-t-brand rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-6 h-6 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              <span className="text-[10px] text-content-muted font-medium">Photo</span>
            </>
          )}
        </button>
      </div>

      {error && <p className="text-field-xs text-danger">{error}</p>}
    </div>
  );
}
```

## 3d. Add Notes and Photos sections to JobDetailPage

Open `apps/pwa/src/pages/JobDetailPage.tsx`.

Add imports at the top:
```tsx
import { JobNotes }  from '../components/JobNotes';
import { JobPhotos } from '../components/JobPhotos';
```

Inside the return, after the "Save Changes" and "Cancel Job" buttons, add a new section — but only render it when editing an existing job (not when creating new):

```tsx
{/* Notes & Photos — only on existing jobs */}
{!isNew && existingJob && (
  <>
    {/* Divider */}
    <div className="mx-4 border-t border-surface-border pt-6">
      <h2 className="text-field-xs font-bold text-content-secondary uppercase tracking-widest mb-4">
        Field Notes
      </h2>
      <JobNotes
        jobId={existingJob.id}
        orgId={orgId}
        userId={user?.id ?? ''}
      />
    </div>

    <div className="mx-4 border-t border-surface-border pt-6">
      <h2 className="text-field-xs font-bold text-content-secondary uppercase tracking-widest mb-4">
        Photos
      </h2>
      <JobPhotos
        jobId={existingJob.id}
        orgId={orgId}
        userId={user?.id ?? ''}
      />
    </div>
  </>
)}
```

---

# TASK 4 — Final checks

```bash
# Clean install
pnpm install

# Type-check everything
pnpm turbo typecheck

# Build
pnpm --filter @trades-saas/pwa build

# Spot-checks:

# 1. Customer filter works
grep "useSearchParams" apps/pwa/src/pages/JobsPage.tsx

# 2. createInvoice hook exists
grep "createInvoice" modules/estimates/src/hooks/useEstimates.ts

# 3. Convert to Invoice button exists
grep "Convert to Invoice" modules/estimates/src/pages/EstimateDetailPage.tsx

# 4. JobNotes component exists
ls apps/pwa/src/components/JobNotes.tsx

# 5. JobPhotos component exists
ls apps/pwa/src/components/JobPhotos.tsx

# 6. Photo storage bucket migration exists
ls supabase/migrations/20260517_storage_photos.sql

# 7. Notes and Photos sections wired into JobDetailPage
grep "JobNotes" apps/pwa/src/pages/JobDetailPage.tsx
grep "JobPhotos" apps/pwa/src/pages/JobDetailPage.tsx
```

---

## HARD RULES REMINDER

- `@trades-saas/` prefix only
- Inter font only — no other fonts
- Token classes only — no hex in components
- PowerSync reads in components — never Supabase
- Cents in DB — dollars in display
- 48px touch targets
