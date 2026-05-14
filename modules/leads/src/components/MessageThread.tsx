import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import type { LeadMessage } from '../types';

const STEP_LABELS: Record<number, string> = { 0: 'Auto — immediate', 1: 'Auto — 24h', 2: 'Auto — final' };

export function MessageThread({
  messages, leadPhone, onSend,
}: { messages: LeadMessage[]; leadPhone: string; onSend: (body: string) => Promise<void> }) {
  const [draft, setDraft]     = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  async function handleSend() {
    const t = draft.trim();
    if (!t || sending) return;
    setSending(true);
    try { await onSend(t); setDraft(''); } finally { setSending(false); }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-field-xs text-content-muted text-center py-8">No messages yet</p>
        )}
        {messages.map(msg => {
          const out = msg.direction === 'outbound';
          return (
            <div key={msg.id} className={`flex flex-col ${out ? 'items-end' : 'items-start'}`}>
              {out && msg.sequence_step !== null && (
                <span className="text-[10px] text-content-muted mb-1 mr-1">
                  {STEP_LABELS[msg.sequence_step] ?? 'Auto'}
                </span>
              )}
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                out ? 'bg-brand text-white rounded-br-sm' : 'bg-surface-raised text-content rounded-bl-sm'
              }`}>
                <p className="text-field-sm leading-snug whitespace-pre-wrap break-words">{msg.body}</p>
              </div>
              <span className="text-[10px] text-content-muted mt-1">
                {format(new Date(msg.sent_at), 'MMM d, h:mm a')}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-surface-border p-3 flex gap-2 items-end">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={`Reply to ${leadPhone}`}
          disabled={sending}
          rows={1}
          className="flex-1 bg-surface-sunken text-content text-field-sm rounded-xl px-3.5 py-2.5
                     resize-none outline-none border border-surface-border focus:border-brand
                     placeholder:text-content-muted disabled:opacity-50 min-h-[40px] max-h-[120px]"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="shrink-0 w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center
                     hover:bg-brand-mid active:scale-95 transition-all disabled:opacity-30"
        >
          {sending
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
          }
        </button>
      </div>
    </div>
  );
}
