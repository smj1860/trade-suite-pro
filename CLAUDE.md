# CLAUDE.md — TradeSuite Phase 4
> Execution file. Read completely then work top to bottom without pausing.
> Phases 1-3 are confirmed complete. Phase 4 finishes the three core workflow stubs
> and closes a handful of small bugs. After this the app is feature-complete.

---

## DO NOT RECREATE — CONFIRMED COMPLETE

Every file below is confirmed in the repo. Do not touch unless a task explicitly says to.

```
All core packages and migrations
All supabase/functions/ (stripe-portal, stripe-webhook, omnibid-*, repuguard-*, trigger-repuguard, telnyx-webhook)
supabase/functions/_shared/pdf.ts
inngest/ (serve.ts, client.ts, all 3 functions)
modules/leads/          ✓ complete
modules/estimates/      ✓ complete
modules/reviews/        ✓ complete
apps/pwa/src/pages/auth/LoginPage.tsx         ✓
apps/pwa/src/pages/CalendarPage.tsx           ✓ full implementation
apps/pwa/src/pages/DashboardPage.tsx          ✓
apps/pwa/src/pages/settings/SettingsPage.tsx  ✓ review links + price book link
apps/pwa/src/pages/settings/PriceBookPage.tsx ✓ full CRUD with edit + search
apps/pwa/src/pages/settings/BillingPage.tsx   ✓
apps/pwa/src/providers/index.tsx              ✓
apps/pwa/src/App.tsx                          ✓ all routes wired
```

---

## HARD RULES (never break)

- Package prefix: `@trades-saas/` only
- Vite + React 18 — no Next.js
- Font: Inter only
- Colors: token classes only — `bg-brand`, `bg-surface`, `bg-surface-raised`, `bg-surface-sunken`, `bg-surface-border`, `text-content`, `text-content-secondary`, `text-content-muted`, `text-brand`, `text-success`, `text-warning`, `text-danger`, `text-info`
- Reads: PowerSync `useReactiveQuery` or `useQuery` — never `supabase.from().select()` in components
- Money: cents in DB — display with `(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})`
- `set_updated_at()` already exists — never redefine
- Edge Functions: Deno — `https://esm.sh/` or `https://deno.land/` imports
- Touch targets: 48px minimum (`h-touch`)

---

# TASK LIST

---

## TASK 1 — Fix manifest.json green theme (2 min)

Delete `apps/pwa/public/manifest.json` entirely.

VitePWA generates the manifest automatically from `vite.config.ts` which already has the correct Safety Orange colors (`theme_color: '#FF6600'`, `background_color: '#1A1A1A'`). The static file was overriding it with the old green theme.

```bash
rm apps/pwa/public/manifest.json
```

---

## TASK 2 — Fix SettingsPage review delay default (1 min)

In `apps/pwa/src/pages/settings/SettingsPage.tsx`, find:
```typescript
const [delayHours, setDelayHours] = useState<number>((org as any)?.review_delay_hours ?? 2);
```

Change `?? 2` to `?? 24`:
```typescript
const [delayHours, setDelayHours] = useState<number>((org as any)?.review_delay_hours ?? 24);
```

---

## TASK 3 — Verify/fix Storage bucket migration

Check if `supabase/migrations/20260516_storage_documents.sql` exists:
```bash
ls supabase/migrations/20260516_storage_documents.sql
```

If it does NOT exist, create it:
```sql
-- Storage bucket for estimate and invoice PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 'documents', false, 10485760, ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documents_org_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (
      SELECT org_id::text FROM public.users WHERE id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "documents_service_write" ON storage.objects
  FOR INSERT TO service_role WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents_service_update" ON storage.objects
  FOR UPDATE TO service_role USING (bucket_id = 'documents');
```

---

## TASK 4 — Verify/fix review_requests in AppSchema and sync rules

### 4a. Check `packages/core-sync/src/schema.ts`

Search for `review_requests` in the AppSchema export. If missing, add this table definition and include it in the AppSchema:

```typescript
const review_requests = new Table(
  {
    org_id:        column.text,
    job_id:        column.text,
    customer_id:   column.text,
    status:        column.text,
    sent_via:      column.text,
    platform:      column.text,
    review_url:    column.text,
    sent_at:       column.text,
    clicked_at:    column.text,
    reviewed_at:   column.text,
    star_rating:   column.integer,
    review_text:   column.text,
    inngest_run_id: column.text,
    created_at:    column.text,
    updated_at:    column.text,
  },
  { indexes: { by_status: ['status', 'created_at'] } }
);
// Add review_requests to the AppSchema export object
```

### 4b. Check `packages/core-sync/sync-rules.yaml`

If `review_requests` is not in the data section, add it:
```yaml
- SELECT * FROM review_requests WHERE org_id = bucket.org_id
```

---

## TASK 5 — Fix is_customer_facing column in estimate send function

Open `supabase/functions/omnibid-send-estimate/index.ts`. Find this line in `buildEstimateHtml`:
```typescript
.filter((i: any) => i.is_customer_facing)
```

Check `modules/estimates/supabase/migrations/0001_omnibid_schema.sql` to see if `is_customer_facing` column exists on `estimate_line_items`.

**If the column does NOT exist**, remove the filter so all line items are included:
```typescript
// Remove the .filter line — show all items
const rows = items
  .map((item: any) => `...`)
  .join('');
```

**If the column DOES exist**, keep the filter as-is.

---

## TASK 6 — Add ForgotPasswordPage stub

`LoginPage.tsx` navigates to `/auth/forgot-password` but this page doesn't exist, causing a crash if the user taps "Forgot your password?".

Create `apps/pwa/src/pages/auth/ForgotPasswordPage.tsx`:

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Field, Input } from '@trades-saas/core-ui';
import { getSupabaseClient } from '@trades-saas/core-auth';

const supabase = getSupabaseClient();

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-surface">
      <div className="bg-brand px-6 pt-16 pb-10">
        <h1 className="font-bold text-field-2xl text-white">Reset Password</h1>
        <p className="text-field-sm text-white/70 mt-1">We'll send you a reset link</p>
      </div>

      <div className="flex-1 px-6 py-8">
        {sent ? (
          <div className="max-w-sm">
            <div className="bg-surface-raised border border-success/20 rounded-card p-4 mb-6">
              <p className="text-field-sm text-success font-semibold">Check your email</p>
              <p className="text-field-xs text-content-secondary mt-1">
                We sent a password reset link to {email}
              </p>
            </div>
            <Button variant="secondary" fullWidth onClick={() => navigate('/auth/login')}>
              Back to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-sm">
            <Field label="Email">
              <Input
                type="email"
                placeholder="you@yourbusiness.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>

            {error && (
              <div className="bg-surface-raised border border-danger/20 rounded-card px-4 py-3">
                <p className="text-field-sm text-danger">{error}</p>
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              Send Reset Link
            </Button>

            <button
              type="button"
              className="text-field-sm text-brand font-medium text-center py-2 touch-manipulation"
              onClick={() => navigate('/auth/login')}
            >
              Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

Add to `apps/pwa/src/App.tsx` in the public routes section:
```tsx
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
// Add route alongside LoginPage:
<Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
```

---

## TASK 7 — Build JobsPage

Replace `apps/pwa/src/pages/JobsPage.tsx` entirely:

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Section, Button, useReactiveQuery } from '@trades-saas/core-ui';
import { JobCard } from '@trades-saas/core-ui';
import type { JobCardData } from '@trades-saas/core-ui';
import type { JobStatus } from '@trades-saas/core-types';
import { JOB_STATUS_LABELS } from '@trades-saas/core-types';
import { useAuth } from '../providers';

type Filter = 'all' | JobStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',       label: 'All'         },
  { key: 'lead',      label: 'Lead'        },
  { key: 'scheduled', label: 'Scheduled'   },
  { key: 'active',    label: 'In Progress' },
  { key: 'complete',  label: 'Complete'    },
  { key: 'closed',    label: 'Closed'      },
];

interface JobRow {
  id: string; org_id: string; customer_id: string;
  title: string; description: string | null; status: string; source: string;
  assigned_to: string | null; location: string | null; trade_type: string | null;
  scheduled_at: string | null; completed_at: string | null;
  estimated_value_cents: number | null; final_value_cents: number | null;
  job_number: string; created_at: string; updated_at: string;
  customer_name: string; assigned_to_name: string | null;
  estimate_total_cents: number | null;
}

export default function JobsPage() {
  const navigate = useNavigate();
  const { org }  = useAuth();
  const orgId    = org?.id ?? '';
  const [filter, setFilter] = useState<Filter>('all');

  const whereStatus = filter === 'all'
    ? `status NOT IN ('cancelled')`
    : `status = '${filter}'`;

  const { data: rows } = useReactiveQuery<JobRow>(`
    SELECT
      j.*,
      c.name AS customer_name,
      u.name AS assigned_to_name,
      e.total_cents AS estimate_total_cents
    FROM jobs j
    LEFT JOIN customers  c ON c.id = j.customer_id
    LEFT JOIN users      u ON u.id = j.assigned_to
    LEFT JOIN estimates  e ON e.job_id = j.id AND e.status NOT IN ('declined')
    WHERE j.org_id = ?
      AND j.${whereStatus}
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

  const jobs: JobCardData[] = rows.map(r => ({
    job: {
      id: r.id, org_id: r.org_id, customer_id: r.customer_id,
      title: r.title, description: r.description,
      status: r.status as JobStatus, source: r.source as any,
      assigned_to: r.assigned_to, location: r.location, trade_type: r.trade_type as any,
      scheduled_at: r.scheduled_at, completed_at: r.completed_at,
      estimated_value_cents: r.estimated_value_cents, final_value_cents: r.final_value_cents,
      job_number: r.job_number, created_at: r.created_at, updated_at: r.updated_at,
    },
    customer_name:    r.customer_name,
    assigned_to_name: r.assigned_to_name,
    ...(r.estimate_total_cents != null ? { estimate_total_cents: r.estimate_total_cents } : {}),
  }));

  return (
    <div className="flex flex-col h-full bg-surface">
      <PageHeader
        title="Jobs"
        actions={
          <Button variant="primary" size="sm" onClick={() => navigate('/jobs/new')}>
            + New
          </Button>
        }
      />

      {/* Status filter tabs */}
      <div className="flex gap-1 overflow-x-auto px-4 py-3 border-b border-surface-border scrollbar-none">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`shrink-0 text-field-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
              filter === key
                ? 'bg-brand text-white'
                : 'text-content-secondary hover:text-content hover:bg-surface-raised'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-8">
            <p className="text-field-sm font-bold text-content-secondary">No jobs</p>
            <p className="text-field-xs text-content-muted mt-1">
              {filter === 'all' ? 'Tap "+ New" to create your first job' : `No ${JOB_STATUS_LABELS[filter as JobStatus] ?? filter} jobs`}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {jobs.map(j => (
              <JobCard
                key={j.job.id}
                {...j}
                onPress={() => navigate(`/jobs/${j.job.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## TASK 8 — Build JobDetailPage (most important task)

This page handles both creating new jobs (`mode="new"`) and editing existing ones (`mode="edit"`).
It also triggers RepuGuard when a job is marked complete.

Replace `apps/pwa/src/pages/JobDetailPage.tsx` entirely:

```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Button, Field, Input, Section, Card, useReactiveQuery } from '@trades-saas/core-ui';
import type { JobStatus, TradeType } from '@trades-saas/core-types';
import { JOB_STATUS_LABELS, JOB_STATUS_ORDER, canAdvanceStatus } from '@trades-saas/core-types';
import { STATUS_COLORS } from '@trades-saas/core-ui';
import { getSupabaseClient } from '@trades-saas/core-auth';
import { useAuth } from '../providers';

const supabase = getSupabaseClient();

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JobStatus }) {
  const colors = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.lead;
  return (
    <span
      className="text-field-xs font-bold px-2.5 py-1 rounded-badge capitalize"
      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      {JOB_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Customer picker ──────────────────────────────────────────────────────────

interface CustomerRow { id: string; name: string; phone: string | null; }

function CustomerPicker({
  value, orgId, onChange,
}: { value: string; orgId: string; onChange: (id: string, name: string) => void }) {
  const [search, setSearch] = useState('');
  const [open,   setOpen]   = useState(false);

  const { data: customers } = useReactiveQuery<CustomerRow>(
    `SELECT id, name, phone FROM customers WHERE org_id = ?
     AND (LOWER(name) LIKE LOWER(?) OR phone LIKE ?)
     ORDER BY name LIMIT 20`,
    [orgId, `%${search}%`, `%${search}%`]
  );

  const { data: selected } = useReactiveQuery<CustomerRow>(
    `SELECT id, name, phone FROM customers WHERE id = ? LIMIT 1`,
    [value]
  );
  const selectedCustomer = selected?.[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                   border border-surface-border focus:border-brand outline-none h-touch"
      >
        {selectedCustomer ? (
          <span className="text-content">{selectedCustomer.name}</span>
        ) : (
          <span className="text-content-muted">Select customer...</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-surface-raised border border-surface-border rounded-card shadow-raised mt-1 max-h-60 overflow-y-auto">
          <div className="p-2 border-b border-surface-border">
            <input
              autoFocus
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="w-full bg-surface-sunken text-content text-field-sm rounded px-3 py-2
                         border border-surface-border focus:border-brand outline-none placeholder:text-content-muted"
            />
          </div>
          {customers.length === 0 ? (
            <p className="text-field-xs text-content-muted text-center py-4">No customers found</p>
          ) : (
            customers.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange(c.id, c.name); setOpen(false); setSearch(''); }}
                className="w-full text-left px-3 py-2.5 hover:bg-surface-raised transition-colors border-b border-surface-border/50 last:border-0"
              >
                <p className="text-field-sm text-content">{c.name}</p>
                {c.phone && <p className="text-field-xs text-content-muted">{c.phone}</p>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface JobRow {
  id: string; org_id: string; customer_id: string; title: string;
  description: string | null; status: string; source: string;
  assigned_to: string | null; location: string | null; trade_type: string | null;
  scheduled_at: string | null; completed_at: string | null;
  estimated_value_cents: number | null; final_value_cents: number | null;
  job_number: string; created_at: string; updated_at: string;
  customer_name: string | null;
}

export default function JobDetailPage({ mode }: { mode?: 'new' | 'edit' }) {
  const navigate    = useNavigate();
  const { id }      = useParams<{ id: string }>();
  const { user, org } = useAuth();
  const orgId       = org?.id ?? '';
  const isNew       = mode === 'new' || !id;

  // Load existing job if editing
  const { data: jobRows } = useReactiveQuery<JobRow>(
    `SELECT j.*, c.name AS customer_name
     FROM jobs j
     LEFT JOIN customers c ON c.id = j.customer_id
     WHERE j.id = ? AND j.org_id = ? LIMIT 1`,
    [id ?? '', orgId]
  );
  const existingJob = isNew ? null : (jobRows?.[0] ?? null);

  // Form state
  const [title,       setTitle]       = useState('');
  const [customerId,  setCustomerId]  = useState('');
  const [customerName, setCustomerName] = useState('');
  const [description, setDescription] = useState('');
  const [location,    setLocation]    = useState('');
  const [tradeType,   setTradeType]   = useState<TradeType | ''>('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (!existingJob) return;
    setTitle(existingJob.title);
    setCustomerId(existingJob.customer_id);
    setCustomerName(existingJob.customer_name ?? '');
    setDescription(existingJob.description ?? '');
    setLocation(existingJob.location ?? '');
    setTradeType((existingJob.trade_type as TradeType | null) ?? '');
    setScheduledAt(existingJob.scheduled_at ? existingJob.scheduled_at.slice(0, 16) : '');
  }, [existingJob?.id]);

  const TRADE_TYPES: { value: TradeType | ''; label: string }[] = [
    { value: '',                  label: 'Select trade...' },
    { value: 'hvac',              label: 'HVAC'            },
    { value: 'plumbing',          label: 'Plumbing'        },
    { value: 'electrical',        label: 'Electrical'      },
    { value: 'roofing',           label: 'Roofing'         },
    { value: 'general_contractor',label: 'General Contractor' },
    { value: 'landscaping',       label: 'Landscaping'     },
    { value: 'painting',          label: 'Painting'        },
    { value: 'flooring',          label: 'Flooring'        },
    { value: 'pest_control',      label: 'Pest Control'    },
    { value: 'other',             label: 'Other'           },
  ];

  async function handleSave() {
    if (!title.trim()) { setError('Job title is required'); return; }
    if (!customerId)   { setError('Please select a customer'); return; }
    setSaving(true);
    setError(null);

    try {
      if (isNew) {
        const { data: newJob, error: err } = await supabase.from('jobs').insert({
          org_id:      orgId,
          customer_id: customerId,
          title:       title.trim(),
          description: description.trim() || null,
          location:    location.trim() || null,
          trade_type:  tradeType || null,
          scheduled_at: scheduledAt || null,
          status:      'lead',
          source:      'manual',
          assigned_to: user?.id ?? null,
        }).select().single();

        if (err) throw err;
        navigate(`/jobs/${newJob.id}`, { replace: true });
      } else {
        const { error: err } = await supabase.from('jobs').update({
          title:       title.trim(),
          description: description.trim() || null,
          location:    location.trim() || null,
          trade_type:  tradeType || null,
          scheduled_at: scheduledAt || null,
        }).eq('id', id!).eq('org_id', orgId);

        if (err) throw err;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save job');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdvanceStatus() {
    if (!existingJob) return;
    const currentStatus = existingJob.status as JobStatus;
    const nextStatus    = canAdvanceStatus(currentStatus);
    if (!nextStatus) return;

    setSaving(true);
    try {
      const updates: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === 'complete') updates.completed_at = new Date().toISOString();

      const { error: err } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', existingJob.id)
        .eq('org_id', orgId);

      if (err) throw err;

      // Fire RepuGuard when job reaches 'complete'
      if (nextStatus === 'complete' && existingJob.customer_id) {
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
              job_id:      existingJob.id,
              customer_id: existingJob.customer_id,
              org_id:      orgId,
            }),
          }
        ).catch(console.error); // fire-and-forget
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!existingJob) return;
    if (!confirm('Cancel this job?')) return;
    await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', existingJob.id);
    navigate('/jobs');
  }

  const currentStatus = (existingJob?.status as JobStatus | undefined) ?? 'lead';
  const nextStatus    = canAdvanceStatus(currentStatus);

  return (
    <div className="flex flex-col min-h-full bg-surface pb-8">
      <PageHeader
        title={isNew ? 'New Job' : (existingJob?.job_number ?? 'Job')}
        subtitle={isNew ? undefined : existingJob?.title}
        onBack={() => navigate(-1)}
        actions={
          existingJob ? <StatusBadge status={currentStatus} /> : undefined
        }
      />

      {error && (
        <div className="mx-4 mt-3 p-3 bg-surface-raised border border-danger/20 rounded-card">
          <p className="text-field-xs text-danger">{error}</p>
        </div>
      )}

      {/* Status advance — only on existing jobs */}
      {existingJob && nextStatus && (
        <div className="px-4 pt-4">
          <Button
            variant="primary"
            fullWidth
            loading={saving}
            onClick={handleAdvanceStatus}
          >
            Mark as {JOB_STATUS_LABELS[nextStatus]} →
          </Button>
        </div>
      )}

      {/* Job form */}
      <Section title="Job Details" className="pt-4">
        <Card elevation="raised" padding="md">
          <div className="space-y-4">
            <Field label="Job Title *">
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. AC replacement + tune-up"
              />
            </Field>

            <Field label="Customer *">
              <CustomerPicker
                value={customerId}
                orgId={orgId}
                onChange={(id, name) => { setCustomerId(id); setCustomerName(name); }}
              />
            </Field>

            <Field label="Trade Type">
              <select
                value={tradeType}
                onChange={e => setTradeType(e.target.value as TradeType | '')}
                className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                           border border-surface-border focus:border-brand outline-none h-touch"
              >
                {TRADE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Scheduled Date & Time">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                           border border-surface-border focus:border-brand outline-none h-touch"
              />
            </Field>

            <Field label="Location / Address">
              <Input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="123 Main St, City, ST"
              />
            </Field>

            <Field label="Description">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Details about the job..."
                rows={3}
                className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                           border border-surface-border focus:border-brand outline-none resize-none
                           placeholder:text-content-muted"
              />
            </Field>
          </div>
        </Card>
      </Section>

      {/* Save button */}
      <div className="px-4 pt-2">
        <Button
          variant={isNew ? 'primary' : 'secondary'}
          fullWidth
          loading={saving}
          onClick={handleSave}
        >
          {isNew ? 'Create Job' : 'Save Changes'}
        </Button>
      </div>

      {/* Cancel job — only for non-terminal existing jobs */}
      {existingJob && !['closed', 'cancelled'].includes(currentStatus) && (
        <div className="px-4 pt-2">
          <Button variant="ghost" fullWidth onClick={handleCancel}>
            Cancel Job
          </Button>
        </div>
      )}
    </div>
  );
}
```

---

## TASK 9 — Build CustomersPage

Replace `apps/pwa/src/pages/CustomersPage.tsx` entirely:

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Button, Section, Card, useReactiveQuery } from '@trades-saas/core-ui';
import { getSupabaseClient } from '@trades-saas/core-auth';
import { useAuth } from '../providers';

const supabase = getSupabaseClient();

interface CustomerRow {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; notes: string | null; created_at: string;
  job_count: number; open_job_count: number;
}

function formatPhone(phone: string | null) {
  if (!phone) return null;
  return phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3') ?? phone;
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const { org }  = useAuth();
  const orgId    = org?.id ?? '';
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);

  // New customer form
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const { data: customers } = useReactiveQuery<CustomerRow>(`
    SELECT
      c.*,
      COUNT(j.id)                                                     AS job_count,
      COUNT(CASE WHEN j.status NOT IN ('closed','cancelled') THEN 1 END) AS open_job_count
    FROM customers c
    LEFT JOIN jobs j ON j.customer_id = c.id
    WHERE c.org_id = ?
      ${search ? `AND (LOWER(c.name) LIKE LOWER('%${search}%') OR c.phone LIKE '%${search}%' OR LOWER(c.email) LIKE LOWER('%${search}%'))` : ''}
    GROUP BY c.id
    ORDER BY c.name ASC
    LIMIT 100
  `, [orgId]);

  async function handleCreate() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('customers').insert({
        org_id:  orgId,
        name:    form.name.trim(),
        phone:   form.phone.trim() || null,
        email:   form.email.trim() || null,
        address: form.address.trim() || null,
      });
      if (err) throw err;
      setForm({ name: '', phone: '', email: '', address: '' });
      setShowNew(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <PageHeader
        title="Customers"
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowNew(n => !n)}>
            {showNew ? 'Cancel' : '+ New'}
          </Button>
        }
      />

      {/* New customer form */}
      {showNew && (
        <div className="px-4 py-4 border-b border-surface-border bg-surface-raised space-y-3">
          <p className="text-field-xs font-bold text-content-secondary uppercase tracking-widest">
            New Customer
          </p>
          {error && <p className="text-field-xs text-danger">{error}</p>}
          {[
            { key: 'name',    label: 'Name *',    type: 'text',  placeholder: 'John Smith'           },
            { key: 'phone',   label: 'Phone',     type: 'tel',   placeholder: '+15551234567'          },
            { key: 'email',   label: 'Email',     type: 'email', placeholder: 'john@example.com'     },
            { key: 'address', label: 'Address',   type: 'text',  placeholder: '123 Main St'          },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-field-xs font-semibold text-content-secondary mb-1">{label}</label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                           border border-surface-border focus:border-brand outline-none placeholder:text-content-muted"
              />
            </div>
          ))}
          <Button variant="primary" fullWidth loading={saving} onClick={handleCreate}>
            Create Customer
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="px-4 py-3 border-b border-surface-border">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, email…"
          className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                     border border-surface-border focus:border-brand outline-none placeholder:text-content-muted"
        />
      </div>

      {/* Customer list */}
      <div className="flex-1 overflow-y-auto divide-y divide-surface-border">
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-8">
            <p className="text-field-sm font-bold text-content-secondary">
              {search ? 'No customers match your search' : 'No customers yet'}
            </p>
            <p className="text-field-xs text-content-muted mt-1">
              {!search && 'Tap "+ New" to add your first customer'}
            </p>
          </div>
        ) : (
          customers.map(customer => (
            <button
              key={customer.id}
              onClick={() => navigate(`/jobs?customer=${customer.id}`)}
              className="w-full text-left px-4 py-3.5 hover:bg-surface-raised active:bg-surface-raised/80 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-field-sm font-semibold text-content truncate">{customer.name}</p>
                  {customer.phone && (
                    <p className="text-field-xs text-content-secondary mt-0.5">
                      {formatPhone(customer.phone)}
                    </p>
                  )}
                  {customer.email && (
                    <p className="text-field-xs text-content-muted truncate">{customer.email}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {customer.open_job_count > 0 ? (
                    <span className="text-field-xs font-bold text-brand">
                      {customer.open_job_count} open job{customer.open_job_count !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-field-xs text-content-muted">
                      {customer.job_count} job{customer.job_count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

---

## TASK 10 — Final checks

```bash
# Clean install
pnpm install

# Type-check everything — fix every error
pnpm turbo typecheck

# Verify stubs are gone — these should NOT contain "Coming in module build session":
grep -l "Coming in module build session" apps/pwa/src/pages/*.tsx
# Should return empty

# Verify manifest.json is deleted:
ls apps/pwa/public/manifest.json 2>/dev/null && echo "DELETE THIS FILE" || echo "OK — file removed"

# Verify review delay default is 24, not 2:
grep "review_delay_hours ?? " apps/pwa/src/pages/settings/SettingsPage.tsx

# Verify trigger-repuguard is called in JobDetailPage:
grep "trigger-repuguard" apps/pwa/src/pages/JobDetailPage.tsx

# Build to catch any bundle errors:
pnpm --filter @trades-saas/pwa build
```

---

## HARD RULES REMINDER

- `@trades-saas/` prefix only
- Inter font only
- Token classes only — no hex in components
- PowerSync reads — never Supabase in components
- Cents in DB, dollars in display
- `set_updated_at()` exists — never redefine
- Edge Functions: Deno with `https://esm.sh/` imports
- 48px minimum touch targets
