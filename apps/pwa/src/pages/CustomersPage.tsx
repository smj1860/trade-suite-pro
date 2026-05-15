import React, { useState } from 'react';
import { PageHeader, Button, useReactiveQuery } from '@trades-saas/core-ui';
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
  const { org }  = useAuth();
  const orgId    = org?.id ?? '';
  const [search,  setSearch]  = useState('');
  const [showNew, setShowNew] = useState(false);

  const [form,   setForm]   = useState({ name: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const searchClause = search
    ? `AND (LOWER(c.name) LIKE LOWER('%${search}%') OR c.phone LIKE '%${search}%' OR LOWER(c.email) LIKE LOWER('%${search}%'))`
    : '';

  const { data: customers } = useReactiveQuery<CustomerRow>(`
    SELECT
      c.*,
      COUNT(j.id)                                                        AS job_count,
      COUNT(CASE WHEN j.status NOT IN ('closed','cancelled') THEN 1 END) AS open_job_count
    FROM customers c
    LEFT JOIN jobs j ON j.customer_id = c.id
    WHERE c.org_id = ? ${searchClause}
    GROUP BY c.id
    ORDER BY c.name ASC
    LIMIT 100
  `, [orgId]);

  async function handleCreate() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: err } = await (supabase.from('customers') as any).insert({
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

      {showNew && (
        <div className="px-4 py-4 border-b border-surface-border bg-surface-raised space-y-3">
          <p className="text-field-xs font-bold text-content-secondary uppercase tracking-widest">
            New Customer
          </p>
          {error && <p className="text-field-xs text-danger">{error}</p>}
          {[
            { key: 'name',    label: 'Name *',  type: 'text',  placeholder: 'John Smith'       },
            { key: 'phone',   label: 'Phone',   type: 'tel',   placeholder: '+15551234567'      },
            { key: 'email',   label: 'Email',   type: 'email', placeholder: 'john@example.com' },
            { key: 'address', label: 'Address', type: 'text',  placeholder: '123 Main St'      },
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
            <div
              key={customer.id}
              className="flex items-start justify-between gap-3 px-4 py-3.5"
            >
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
          ))
        )}
      </div>
    </div>
  );
}
