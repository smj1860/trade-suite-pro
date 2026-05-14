import type { LeadSequence } from '../types';

const STEPS = [
  { step: 0, label: 'Immediate',     sublabel: 'Text sent on missed call' },
  { step: 1, label: '24h follow-up', sublabel: 'If no reply after 1 day'  },
  { step: 2, label: 'Final touch',   sublabel: 'If no reply after 3 days' },
];

export function SequenceTimeline({
  sequence, onPause, onResume,
}: { sequence: LeadSequence | null; onPause: () => void; onResume: () => void }) {
  if (!sequence) return (
    <div className="rounded-card border border-surface-border bg-surface-raised p-4">
      <p className="text-field-xs text-content-muted">No active sequence</p>
    </div>
  );

  const isActive = sequence.status === 'active';
  const isPaused = sequence.status === 'paused';
  const isDone   = sequence.status === 'completed' || sequence.status === 'cancelled';
  const step     = sequence.current_step;

  return (
    <div className="rounded-card border border-surface-border bg-surface-raised p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-field-xs font-bold text-content-secondary uppercase tracking-widest">
          Follow-up Sequence
        </h3>
        {(isActive || isPaused) && (
          <button
            onClick={isActive ? onPause : onResume}
            className={`text-field-xs font-bold px-2.5 py-1 rounded transition-colors ${
              isActive ? 'text-warning hover:bg-warning/10' : 'text-success hover:bg-success/10'
            }`}
          >
            {isActive ? 'Pause' : 'Resume'}
          </button>
        )}
        {isDone && <span className="text-field-xs text-content-muted capitalize">{sequence.status}</span>}
      </div>

      <div className="relative">
        <div className="absolute left-[9px] top-3 bottom-3 w-px bg-surface-border" />
        <div className="space-y-4">
          {STEPS.map(({ step: s, label, sublabel }) => {
            const sent    = s < step || isDone;
            const current = s === step && (isActive || isPaused);
            return (
              <div key={s} className="flex items-start gap-3 relative">
                <div className={`mt-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                  sent ? 'bg-brand border-brand' : current ? 'bg-surface-raised border-brand' : 'bg-surface-raised border-surface-border'
                }`}>
                  {sent && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {current && <span className={`w-2 h-2 rounded-full bg-brand ${isActive ? 'animate-pulse' : ''}`} />}
                </div>
                <div>
                  <p className={`text-field-sm font-semibold ${sent ? 'text-content-secondary' : current ? 'text-content' : 'text-content-muted'}`}>
                    {label}
                  </p>
                  <p className="text-field-xs text-content-muted mt-0.5">{sublabel}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
