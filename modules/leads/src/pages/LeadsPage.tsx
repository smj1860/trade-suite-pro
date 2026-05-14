import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeadCard } from '../components/LeadCard';
import { useLeads, useLeadStats } from '../hooks/useLeads';
import type { LeadStatus } from '../types';

type Filter = 'all' | LeadStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' }, { key: 'replied', label: 'Replied' },
  { key: 'booked', label: 'Booked' }, { key: 'lost', label: 'Lost' },
];

export function LeadsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const { data: leads, isLoading } = useLeads(filter === 'all' ? undefined : filter);
  const stats = useLeadStats();

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-4 pt-6 pb-4 border-b border-surface-border">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h1 className="text-field-2xl font-extrabold text-content tracking-tight">LeadLock</h1>
            <p className="text-field-xs text-content-secondary mt-0.5">Missed-call follow-up</p>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-money-base font-bold text-warning">{stats.new_today}</p>
              <p className="text-[10px] text-content-muted">today</p>
            </div>
            <div>
              <p className="text-money-base font-bold text-success">{stats.replied}</p>
              <p className="text-[10px] text-content-muted">replied</p>
            </div>
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
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
            <p className="text-field-sm font-bold text-content-secondary">
              {filter === 'all' ? 'No leads yet' : `No ${filter} leads`}
            </p>
            <p className="text-field-xs text-content-muted mt-1">
              {filter === 'all' ? 'Leads appear when you miss a call' : 'Try a different filter'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {leads.map(lead => (
              <LeadCard key={lead.id} lead={lead} onClick={() => navigate(`/leads/${lead.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
