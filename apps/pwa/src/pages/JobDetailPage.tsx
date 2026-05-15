import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Button, Field, Input, Section, Card, useReactiveQuery, STATUS_COLORS } from '@trades-saas/core-ui';
import type { JobStatus, TradeType } from '@trades-saas/core-types';
import { JOB_STATUS_LABELS, JOB_STATUS_ORDER, canAdvanceStatus } from '@trades-saas/core-types';
import { getSupabaseClient } from '@trades-saas/core-auth';
import { useAuth } from '../providers';

const supabase = getSupabaseClient();

// ─── Status badge ─────────────────────────────────────────────────────────────

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

const TRADE_TYPES: { value: TradeType | ''; label: string }[] = [
  { value: '',                   label: 'Select trade...'      },
  { value: 'hvac',               label: 'HVAC'                 },
  { value: 'plumbing',           label: 'Plumbing'             },
  { value: 'electrical',         label: 'Electrical'           },
  { value: 'roofing',            label: 'Roofing'              },
  { value: 'general_contractor', label: 'General Contractor'   },
  { value: 'landscaping',        label: 'Landscaping'          },
  { value: 'painting',           label: 'Painting'             },
  { value: 'flooring',           label: 'Flooring'             },
  { value: 'pest_control',       label: 'Pest Control'         },
  { value: 'other',              label: 'Other'                },
];

export default function JobDetailPage({ mode }: { mode?: 'new' | 'edit' }) {
  const navigate    = useNavigate();
  const { id }      = useParams<{ id: string }>();
  const { user, org } = useAuth();
  const orgId       = org?.id ?? '';
  const isNew       = mode === 'new' || !id;

  const { data: jobRows } = useReactiveQuery<JobRow>(
    `SELECT j.*, c.name AS customer_name
     FROM jobs j
     LEFT JOIN customers c ON c.id = j.customer_id
     WHERE j.id = ? AND j.org_id = ? LIMIT 1`,
    [id ?? '', orgId]
  );
  const existingJob = isNew ? null : (jobRows?.[0] ?? null);

  const [title,        setTitle]        = useState('');
  const [customerId,   setCustomerId]   = useState('');
  const [description,  setDescription]  = useState('');
  const [location,     setLocation]     = useState('');
  const [tradeType,    setTradeType]    = useState<TradeType | ''>('');
  const [scheduledAt,  setScheduledAt]  = useState('');
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    if (!existingJob) return;
    setTitle(existingJob.title);
    setCustomerId(existingJob.customer_id);
    setDescription(existingJob.description ?? '');
    setLocation(existingJob.location ?? '');
    setTradeType((existingJob.trade_type as TradeType | null) ?? '');
    setScheduledAt(existingJob.scheduled_at ? existingJob.scheduled_at.slice(0, 16) : '');
  }, [existingJob?.id]);

  async function handleSave() {
    if (!title.trim()) { setError('Job title is required'); return; }
    if (!customerId)   { setError('Please select a customer'); return; }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newJob, error: err } = await (supabase.from('jobs') as any).insert({
          org_id:       orgId,
          customer_id:  customerId,
          title:        title.trim(),
          description:  description.trim() || null,
          location:     location.trim() || null,
          trade_type:   tradeType || null,
          scheduled_at: scheduledAt || null,
          status:       'lead',
          source:       'manual',
          assigned_to:  user?.id ?? null,
        }).select().single();
        if (err) throw err;
        navigate(`/jobs/${newJob.id}`, { replace: true });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: err } = await (supabase.from('jobs') as any).update({
          title:        title.trim(),
          description:  description.trim() || null,
          location:     location.trim() || null,
          trade_type:   tradeType || null,
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: err } = await (supabase.from('jobs') as any)
        .update(updates)
        .eq('id', existingJob.id)
        .eq('org_id', orgId);

      if (err) throw err;

      if (nextStatus === 'complete' && existingJob.customer_id) {
        const { data: { session } } = await supabase.auth.getSession();
        fetch(
          `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/trigger-repuguard`,
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
        ).catch(console.error);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('jobs') as any).update({ status: 'cancelled' }).eq('id', existingJob.id);
    navigate('/jobs');
  }

  const currentStatus = (existingJob?.status as JobStatus | undefined) ?? 'lead';
  const nextStatus    = canAdvanceStatus(currentStatus);

  return (
    <div className="flex flex-col min-h-full bg-surface pb-8">
      <PageHeader
        title={isNew ? 'New Job' : (existingJob?.job_number ?? 'Job')}
        {...(existingJob?.title ? { subtitle: existingJob.title } : {})}
        onBack={() => navigate(-1)}
        actions={existingJob ? <StatusBadge status={currentStatus} /> : undefined}
      />

      {error && (
        <div className="mx-4 mt-3 p-3 bg-surface-raised border border-danger/20 rounded-card">
          <p className="text-field-xs text-danger">{error}</p>
        </div>
      )}

      {existingJob && nextStatus && (
        <div className="px-4 pt-4">
          <Button variant="primary" fullWidth loading={saving} onClick={handleAdvanceStatus}>
            Mark as {JOB_STATUS_LABELS[nextStatus]} →
          </Button>
        </div>
      )}

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
                onChange={(cid) => setCustomerId(cid)}
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
