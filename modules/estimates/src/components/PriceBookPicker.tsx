import { useState } from 'react';
import { usePriceBook } from '../hooks/useEstimates';
import type { PriceBookItem } from '../types';

function fmt(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function PriceBookPicker({
  onSelect, onClose,
}: { onSelect: (item: PriceBookItem) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const { data: items } = usePriceBook(search || undefined);

  const grouped = items.reduce<Record<string, PriceBookItem[]>>((acc: Record<string, PriceBookItem[]>, item: PriceBookItem) => {
    const cat = item.category ?? 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
        <button onClick={onClose} className="text-content-secondary hover:text-content p-1 -ml-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-field-sm font-bold text-content flex-1">Price Book</h2>
      </div>

      <div className="px-4 py-3 border-b border-surface-border">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search items..."
          className="w-full bg-surface-raised text-content text-field-sm rounded-input px-3.5 py-2.5
                     outline-none border border-surface-border focus:border-brand
                     placeholder:text-content-muted"
          autoFocus
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-safe-bottom">
        {Object.keys(grouped).sort().map(category => (
          <div key={category}>
            <div className="px-4 py-2 bg-surface-sunken">
              <p className="text-[10px] font-bold text-content-muted uppercase tracking-widest">{category}</p>
            </div>
            {grouped[category]!.map((item: PriceBookItem) => (
              <button
                key={item.id}
                onClick={() => { onSelect(item); onClose(); }}
                className="w-full flex items-center justify-between px-4 py-3
                           border-b border-surface-border hover:bg-surface-raised transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-field-sm text-content">{item.name}</p>
                  {item.description && (
                    <p className="text-field-xs text-content-muted mt-0.5 line-clamp-1">{item.description}</p>
                  )}
                </div>
                <div className="shrink-0 ml-4 text-right">
                  <p className="text-field-sm font-semibold text-brand tabular-nums">
                    {fmt(Math.round(item.unit_price * 100))}
                  </p>
                  <p className="text-[10px] text-content-muted">per {item.unit}</p>
                </div>
              </button>
            ))}
          </div>
        ))}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 px-8 text-center">
            <p className="text-field-sm text-content-secondary">No items found</p>
            <p className="text-field-xs text-content-muted mt-1">Try a different search</p>
          </div>
        )}
      </div>
    </div>
  );
}
