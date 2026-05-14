import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineItemRow }       from '../components/LineItemRow';
import { PriceBookPicker }   from '../components/PriceBookPicker';
import { VoiceButton }       from '../components/VoiceButton';
import { useEstimate, useEstimateItems, useEstimateActions } from '../hooks/useEstimates';
import type { EstimateItem, PriceBookItem, VoiceParseResult } from '../types';

function fmt(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function EstimateDetailPage() {
  const { estimateId } = useParams<{ estimateId: string }>();
  const navigate       = useNavigate();
  const [showPicker, setShowPicker] = useState(false);
  const [sending, setSending]       = useState(false);

  const { data: estimates }         = useEstimate(estimateId!);
  const { data: items }             = useEstimateItems(estimateId!);
  const { addLineItem, updateLineItem, removeLineItem, sendEstimate } = useEstimateActions();

  const estimate = estimates?.[0] ?? null;
  const isDraft  = estimate?.status === 'draft';

  if (!estimate) return (
    <div className="flex items-center justify-center h-full bg-surface">
      <span className="w-6 h-6 border-2 border-surface-border border-t-brand rounded-full animate-spin" />
    </div>
  );

  function handleSelectPriceBookItem(item: PriceBookItem) {
    addLineItem({
      org_id: estimate!.org_id,
      estimate_id: estimate!.id,
      tier: 'single',
      sort_order: items.length,
      description: item.name,
      category: item.category ?? undefined,
      quantity: 1,
      unit: item.unit,
      unit_price_cents: Math.round(item.unit_price * 100),
      total_cents: Math.round(item.unit_price * 100),
      is_customer_facing: 1,
    } as any);
  }

  function handleVoiceResult(result: unknown) {
    const parsed = result as VoiceParseResult;
    parsed.items.forEach((item, i) => {
      addLineItem({
        org_id: estimate!.org_id,
        estimate_id: estimate!.id,
        tier: 'single',
        sort_order: items.length + i,
        description: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price_cents: Math.round(item.unit_price * 100),
        total_cents: Math.round(item.quantity * item.unit_price * 100),
        is_customer_facing: 1,
      } as any);
    });
  }

  async function handleSend() {
    if (sending) return;
    setSending(true);
    try {
      await sendEstimate(estimate!.id);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {showPicker && (
        <PriceBookPicker onSelect={handleSelectPriceBookItem} onClose={() => setShowPicker(false)} />
      )}

      <div className="flex flex-col h-full bg-surface">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <button onClick={() => navigate(-1)} className="text-content-secondary hover:text-content p-1 -ml-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-field-sm font-bold text-content">{estimate.estimate_number}</p>
            <p className="text-field-xs text-content-secondary capitalize">{estimate.status}</p>
          </div>
          <p className="text-money-base font-bold text-content tabular-nums">{fmt(estimate.total_cents)}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {isDraft && (
              <div className="mb-4 flex items-center justify-between">
                <VoiceButton onResult={handleVoiceResult} orgId={estimate.org_id} />
                <button
                  onClick={() => setShowPicker(true)}
                  className="flex items-center gap-2 text-field-xs font-bold text-brand
                             border border-brand rounded-button px-3 py-2 hover:bg-brand/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add from Price Book
                </button>
              </div>
            )}

            <div className="bg-surface-raised rounded-card border border-surface-border p-4 mb-4">
              {items.length === 0 ? (
                <p className="text-field-xs text-content-muted text-center py-6">
                  {isDraft ? 'Add items using voice or the price book' : 'No line items'}
                </p>
              ) : (
                items.map((item: EstimateItem) => (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    editable={isDraft}
                    onUpdate={updateLineItem}
                    onRemove={removeLineItem}
                  />
                ))
              )}
            </div>

            <div className="bg-surface-raised rounded-card border border-surface-border p-4 space-y-2">
              <div className="flex justify-between text-field-xs">
                <span className="text-content-secondary">Subtotal</span>
                <span className="text-content tabular-nums">{fmt(estimate.subtotal_cents)}</span>
              </div>
              <div className="flex justify-between text-field-xs">
                <span className="text-content-secondary">Tax ({((estimate.tax_rate ?? 0) * 100).toFixed(2)}%)</span>
                <span className="text-content tabular-nums">{fmt(estimate.tax_cents)}</span>
              </div>
              <div className="flex justify-between text-field-sm font-bold border-t border-surface-border pt-2 mt-2">
                <span className="text-content">Total</span>
                <span className="text-content tabular-nums">{fmt(estimate.total_cents)}</span>
              </div>
            </div>
          </div>
        </div>

        {isDraft && (
          <div className="p-4 border-t border-surface-border">
            <button
              onClick={handleSend}
              disabled={sending || items.length === 0}
              className="w-full h-touch bg-brand text-white font-bold text-field-sm rounded-button
                         hover:bg-brand-mid active:scale-[0.99] transition-all disabled:opacity-40
                         flex items-center justify-center gap-2"
            >
              {sending ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send Estimate
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
