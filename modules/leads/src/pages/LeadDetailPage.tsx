import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { SequenceTimeline } from '../components/SequenceTimeline';
import { MessageThread }    from '../components/MessageThread';
import { useLead, useLeadMessages, useLeadSequence, useLeadActions } from '../hooks/useLeads';

const STATUS_TEXT: Record<string, string> = {
  new: 'text-warning', contacted: 'text-brand',
  replied: 'text-success', booked: 'text-success', lost: 'text-content-muted',
};

function fmt(e164: string) { return e164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3'); }

export function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate   = useNavigate();
  const { data: leads }     = useLead(leadId!);
  const { data: sequences } = useLeadSequence(leadId!);
  const { data: messages }  = useLeadMessages(leadId!);
  const { pauseSequence, resumeSequence, updateStatus, sendManualReply } = useLeadActions();

  const lead = leads?.[0] ?? null;
  const seq  = sequences?.[0] ?? null;

  if (!lead) return (
    <div className="flex items-center justify-center h-full bg-surface">
      <span className="w-6 h-6 border-2 border-surface-border border-t-brand rounded-full animate-spin" />
    </div>
  );

  async function handleSend(body: string) {
    if (!lead?.called_number) throw new Error('No outbound number');
    await sendManualReply(lead!.id, lead!.org_id, lead!.phone, lead!.called_number, body);
    if (seq?.status === 'active') await pauseSequence(seq.id);
    if (lead!.status === 'new' || lead!.status === 'contacted') await updateStatus(lead!.id, 'replied');
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
        <button onClick={() => navigate(-1)} className="text-content-secondary hover:text-content p-1 -ml-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-field-sm font-bold text-content truncate">{lead.name ?? fmt(lead.phone)}</p>
          {lead.name && <p className="text-field-xs text-content-secondary">{fmt(lead.phone)}</p>}
        </div>
        <span className={`text-field-xs font-bold capitalize ${STATUS_TEXT[lead.status] ?? 'text-content-secondary'}`}>
          {lead.status}
        </span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
        <div className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-surface-border overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="space-y-2 text-field-xs">
              <div className="flex justify-between">
                <span className="text-content-muted">Missed</span>
                <span className="text-content-secondary">{formatDistanceToNow(new Date(lead.missed_at), { addSuffix: true })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-muted">Source</span>
                <span className="text-content-secondary capitalize">{lead.source.replace('_', ' ')}</span>
              </div>
              {lead.replied_at && (
                <div className="flex justify-between">
                  <span className="text-content-muted">Replied</span>
                  <span className="text-success">{formatDistanceToNow(new Date(lead.replied_at), { addSuffix: true })}</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-bold text-content-muted uppercase tracking-widest mb-2">Mark as</p>
              <div className="flex flex-wrap gap-1.5">
                {(['replied', 'booked', 'lost'] as const).map(s => (
                  <button key={s} onClick={() => updateStatus(lead.id, s)} disabled={lead.status === s}
                    className={`text-field-xs font-bold px-2.5 py-1 rounded-full border transition-colors capitalize ${
                      lead.status === s ? 'border-brand text-brand cursor-default' :
                      'border-surface-border text-content-secondary hover:border-brand hover:text-brand'
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>

            <SequenceTimeline
              sequence={seq}
              onPause={() => seq && pauseSequence(seq.id)}
              onResume={() => seq && resumeSequence(seq.id)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <MessageThread messages={messages} leadPhone={fmt(lead.phone)} onSend={handleSend} />
        </div>
      </div>
    </div>
  );
}
