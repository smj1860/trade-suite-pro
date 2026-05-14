import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEstimates, useEstimateStats } from '../hooks/useEstimates';
import type { Estimate, EstimateStatus } from '../types';

type Filter = 'all' | EstimateStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'draft',    label: 'Draft'    },
  { key: 'sent',     label: 'Sent'     },
  { key: 'viewed',   label: 'Viewed'   },
  { key: 'accepted', label: 'Accepted' },
];

const STATUS_STYLE: Record<EstimateStatus, { text: string; dot: string }> = {
  draft:      { text: 'text-content-muted',  dot: 'bg-content-muted'  },
  sent:       { text: 'text-info',           dot: 'bg-info'           },
  viewed:     { text: 'text-warning',        dot: 'bg-warning animate-pulse' },
  accepted:   { text: 'text-success',        dot: 'bg-success'        },
  declined:   { text: 'text-danger',         dot: 'bg-danger'         },
  invoiced:   { text: 'text-brand',          dot: 'bg-brand'          },
  paid:       { text: 'text-success',        dot: 'bg-success'        },
};

function fmt(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function EstimatesPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const { data: estimates, isLoading } = useEstimates(filter === 'all' ? undefined : filter);
  const stats = useEstimateStats();

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-4 pt-6 pb-4 border-b border-surface-border">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h1 className="text-field-2xl font-extrabold text-content tracking-tight">OmniBid</h1>
            <p className="text-field-xs text-content-secondary mt-0.5">Estimates & invoicing</p>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-money-base font-bold text-warning">{stats.sent}</p>
              <p className="text-[10px] text-content-muted">pending</p>
            </div>
            <div>
              <p className="text-money-base font-bold text-success">{stats.accepted}</p>
              <p className="text-[10px] text-content-muted">accepted</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-surface-raised rounded-card p-3">
            <p className="text-[10px] text-content-muted uppercase tracking-widest">Draft</p>
            <p className="text-money-lg font-bold text-content tabular-nums">{stats.draft}</p>
          </div>
          <div className="bg-surface-raised rounded-card p-3">
            <p className="text-[10px] text-content-muted uppercase tracking-widest">Pipeline</p>
            <p className="text-money-lg font-bold text-brand tabular-nums">{fmt(stats.total_value_cents)}</p>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          {FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`shrink-0 text-field-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                filter === key ? 'bg-brand text-white' : 'text-content-secondary hover:text-content hover:bg-surface-raised'
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <span className="w-6 h-6 border-2 border-surface-border border-t-brand rounded-full animate-spin" />
          </div>
        ) : estimates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
            <p className="text-field-sm font-bold text-content-secondary">No estimates yet</p>
            <p className="text-field-xs text-content-muted mt-1">Start from a job to create one</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {estimates.map((est: Estimate) => {
              const style = STATUS_STYLE[est.status as EstimateStatus] ?? STATUS_STYLE.draft;
              return (
                <button
                  key={est.id}
                  onClick={() => navigate(`/estimates/${est.id}`)}
                  className="w-full text-left bg-surface-raised border border-surface-border rounded-card p-4
                             hover:border-content-muted active:scale-[0.99] transition-all duration-150"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-field-sm text-content truncate">
                        {est.estimate_number}
                      </p>
                      <p className="text-field-xs text-content-secondary mt-0.5">
                        {new Date(est.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-money-sm font-bold text-content tabular-nums">
                        {fmt(est.total_cents)}
                      </p>
                      <span className={`flex items-center gap-1 justify-end text-field-xs font-semibold mt-0.5 ${style.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {est.status}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-surface-border">
        <button
          onClick={() => navigate('/jobs')}
          className="w-full h-touch bg-brand text-white font-bold text-field-sm rounded-button
                     hover:bg-brand-mid active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Estimate (from Job)
        </button>
      </div>
    </div>
  );
}
