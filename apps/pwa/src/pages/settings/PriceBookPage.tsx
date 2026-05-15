import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Button } from '@trades-saas/core-ui';
import { getSupabaseClient } from '@trades-saas/core-auth';
import { useAuth } from '../../providers';
import { usePriceBook } from '@trades-saas/estimates';
import type { PriceBookItem } from '@trades-saas/estimates';

const supabase = getSupabaseClient();

const UNITS = ['each', 'hour', 'sqft', 'lnft', 'ton', 'lb', 'ft'] as const;

const EMPTY_FORM = {
  name:        '',
  description: '',
  category:    '',
  unit:        'each' as PriceBookItem['unit'],
  unit_price:  0,
  taxable:     true,
};

export default function PriceBookPage() {
  const navigate        = useNavigate();
  const { org }         = useAuth();
  const [search, setSearch] = useState('');
  const { data: items }     = usePriceBook(search || undefined);

  const [editing,  setEditing]  = useState<PriceBookItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setCreating(true);
  }

  function openEdit(item: PriceBookItem) {
    setCreating(false);
    setForm({
      name:        item.name,
      description: item.description ?? '',
      category:    item.category ?? '',
      unit:        item.unit,
      unit_price:  item.unit_price,
      taxable:     item.taxable,
    });
    setError(null);
    setEditing(item);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!org?.id) return;
    setSaving(true);
    setError(null);
    try {
      if (creating) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: err } = await (supabase.from('price_book') as any).insert({
          org_id:      org.id,
          name:        form.name.trim(),
          description: form.description.trim() || null,
          category:    form.category.trim()    || null,
          unit:        form.unit,
          unit_price:  form.unit_price,
          taxable:     form.taxable,
          active:      true,
        });
        if (err) throw err;
      } else if (editing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: err } = await (supabase.from('price_book') as any).update({
          name:        form.name.trim(),
          description: form.description.trim() || null,
          category:    form.category.trim()    || null,
          unit:        form.unit,
          unit_price:  form.unit_price,
          taxable:     form.taxable,
        }).eq('id', editing.id);
        if (err) throw err;
      }
      closeForm();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: PriceBookItem) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('price_book') as any).update({ active: !item.active }).eq('id', item.id);
  }

  const showForm = creating || editing !== null;

  const grouped = items.reduce<Record<string, PriceBookItem[]>>((acc, item) => {
    const cat = item.category ?? 'Uncategorized';
    (acc[cat] ??= []).push(item);
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
        <h1 className="flex-1 text-field-base font-bold text-content">Price Book</h1>
        <Button variant="primary" size="sm" onClick={openCreate}>+ Add Item</Button>
      </div>

      <div className="px-4 py-3 border-b border-surface-border">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search items…"
          className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                     border border-surface-border focus:border-brand outline-none placeholder:text-content-muted"
        />
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="px-4 py-4 border-b border-surface-border bg-surface-raised space-y-3">
          <p className="text-field-xs font-bold text-content-secondary uppercase tracking-widest">
            {creating ? 'New Item' : 'Edit Item'}
          </p>

          {error && <p className="text-field-xs text-danger">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-field-xs font-semibold text-content-secondary mb-1">Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Outlet installation"
                className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                           border border-surface-border focus:border-brand outline-none placeholder:text-content-muted"
              />
            </div>
            <div>
              <label className="block text-field-xs font-semibold text-content-secondary mb-1">Category</label>
              <input
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="Electrical"
                className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                           border border-surface-border focus:border-brand outline-none placeholder:text-content-muted"
              />
            </div>
            <div>
              <label className="block text-field-xs font-semibold text-content-secondary mb-1">Unit</label>
              <select
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value as PriceBookItem['unit'] }))}
                className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                           border border-surface-border focus:border-brand outline-none"
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-field-xs font-semibold text-content-secondary mb-1">Unit Price ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.unit_price}
                onChange={e => setForm(f => ({ ...f, unit_price: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                           border border-surface-border focus:border-brand outline-none"
              />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                id="taxable"
                checked={form.taxable}
                onChange={e => setForm(f => ({ ...f, taxable: e.target.checked }))}
                className="w-4 h-4 accent-brand"
              />
              <label htmlFor="taxable" className="text-field-xs text-content-secondary">Taxable</label>
            </div>
            <div className="col-span-2">
              <label className="block text-field-xs font-semibold text-content-secondary mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Optional description shown on estimates"
                className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                           border border-surface-border focus:border-brand outline-none placeholder:text-content-muted resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={closeForm}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Item list */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-8 text-center">
            <p className="text-field-sm font-bold text-content-secondary">No items yet</p>
            <p className="text-field-xs text-content-muted mt-1">Add your first price book item above</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catItems]) => (
              <div key={cat}>
                <div className="px-4 py-2 bg-surface-raised">
                  <p className="text-field-xs font-bold text-content-secondary uppercase tracking-widest">{cat}</p>
                </div>
                {catItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-3 ${!item.active ? 'opacity-40' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-field-sm font-semibold text-content truncate">{item.name}</p>
                      <p className="text-field-xs text-content-muted">
                        ${item.unit_price.toFixed(2)} / {item.unit}
                        {item.taxable ? '' : ' · no tax'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(item)}
                        className="text-field-xs text-content-secondary hover:text-content px-2 py-1 rounded hover:bg-surface-raised transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(item)}
                        className={`text-field-xs font-semibold px-2 py-1 rounded transition-colors ${
                          item.active
                            ? 'text-danger hover:bg-danger/10'
                            : 'text-success hover:bg-success/10'
                        }`}
                      >
                        {item.active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
