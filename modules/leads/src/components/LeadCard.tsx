import { formatDistanceToNow } from 'date-fns';
import type { LeadWithContext } from '../types';

const STATUS_CONFIG = {
  new:       { label: 'New',       dot: 'bg-warning',        text: 'text-warning'        },
  contacted: { label: 'Contacted', dot: 'bg-brand',          text: 'text-brand'          },
  replied:   { label: 'Replied',   dot: 'bg-success',        text: 'text-success'        },
  booked:    { label: 'Booked',    dot: 'bg-success',        text: 'text-success'        },
  lost:      { label: 'Lost',      dot: 'bg-surface-border', text: 'text-content-muted'  },
} as const;

export function LeadCard({ lead, onClick }: { lead: LeadWithContext; onClick: (id: string) => void }) {
  const status = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.new;
  const missedAgo = formatDistanceToNow(new Date(lead.missed_at), { addSuffix: true });
  const phone = lead.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');

  return (
    <button
      onClick={() => onClick(lead.id)}
      className="w-full text-left bg-surface-raised border border-surface-border rounded-card p-4
                 hover:border-content-muted active:scale-[0.99] transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-field-sm text-content truncate">{lead.name ?? phone}</p>
          {lead.name && <p className="font-mono text-field-xs text-content-secondary mt-0.5">{phone}</p>}
        </div>
        <span className={`flex items-center gap-1.5 text-field-xs font-semibold ${status.text} shrink-0`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${lead.status === 'new' ? 'animate-pulse' : ''}`} />
          {status.label}
        </span>
      </div>

      {lead.last_message_body && (
        <p className="mt-2 text-field-xs text-content-secondary line-clamp-1">
          {lead.last_message_direction === 'inbound' ? '← ' : '→ '}{lead.last_message_body}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-field-xs text-content-muted">{missedAgo}</span>
        <div className="flex items-center gap-3">
          {lead.message_count > 0 && (
            <span className="text-field-xs text-content-muted">
              {lead.message_count} msg{lead.message_count !== 1 ? 's' : ''}
            </span>
          )}
          {(lead.seq_status === 'active' || lead.seq_status === 'paused') && (
            <div className="flex items-center gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i < (lead.seq_current_step ?? 0) ? 'bg-brand' :
                  i === (lead.seq_current_step ?? 0) ? 'bg-brand opacity-60 animate-pulse' :
                  'bg-surface-border'
                }`} />
              ))}
              {lead.seq_status === 'paused' && <span className="ml-1 text-field-xs text-warning">paused</span>}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
