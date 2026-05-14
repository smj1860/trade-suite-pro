import type { EstimateItem } from '../types';

function fmt(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function LineItemRow({
  item, editable, onUpdate, onRemove,
}: {
  item: EstimateItem;
  editable: boolean;
  onUpdate: (id: string, updates: Partial<EstimateItem>) => void;
  onRemove: (id: string) => void;
}) {
  if (!editable) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-surface-border last:border-0">
        <div className="flex-1 min-w-0">
          <p className="text-field-sm text-content">{item.description}</p>
          {item.category && <p className="text-field-xs text-content-muted">{item.category}</p>}
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-4">
          <span className="text-field-xs text-content-secondary tabular-nums">
            {item.quantity} {item.unit ?? 'ea'}
          </span>
          <span className="text-field-xs text-content-secondary tabular-nums w-20 text-right">
            {fmt(item.unit_price_cents)} / {item.unit ?? 'ea'}
          </span>
          <span className="text-field-sm font-semibold text-content tabular-nums w-24 text-right">
            {fmt(item.total_cents)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2.5 border-b border-surface-border last:border-0">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={item.description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(item.id, { description: e.target.value })}
            className="w-full bg-transparent text-field-sm text-content outline-none
                       border-b border-transparent focus:border-brand pb-0.5"
            placeholder="Description"
          />
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              value={item.quantity}
              min={0}
              step={0.01}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const q = parseFloat(e.target.value) || 0;
                onUpdate(item.id, {
                  quantity: q,
                  total_cents: Math.round(q * item.unit_price_cents),
                });
              }}
              className="w-16 bg-surface-sunken text-field-xs text-content rounded px-1.5 py-0.5
                         outline-none border border-surface-border focus:border-brand tabular-nums"
            />
            <span className="text-field-xs text-content-muted">{item.unit ?? 'ea'}</span>
            <span className="text-field-xs text-content-muted mx-1">@</span>
            <input
              type="number"
              value={item.unit_price_cents / 100}
              min={0}
              step={0.01}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const p = Math.round((parseFloat(e.target.value) || 0) * 100);
                onUpdate(item.id, {
                  unit_price_cents: p,
                  total_cents: Math.round(item.quantity * p),
                });
              }}
              className="w-20 bg-surface-sunken text-field-xs text-content rounded px-1.5 py-0.5
                         outline-none border border-surface-border focus:border-brand tabular-nums"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-field-sm font-semibold text-content tabular-nums w-20 text-right">
            {fmt(item.total_cents)}
          </span>
          <button
            onClick={() => onRemove(item.id)}
            className="text-content-muted hover:text-danger transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
