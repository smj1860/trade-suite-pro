import React, { useState } from 'react';
import { useReactiveQuery } from '@trades-saas/core-ui';
import { getSupabaseClient } from '@trades-saas/core-auth';
import { formatDistanceToNow } from 'date-fns';

const supabase = getSupabaseClient();

interface NoteRow {
  id: string;
  body: string;
  is_customer_facing: number;
  is_pinned: number;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
}

interface JobNotesProps {
  jobId: string;
  orgId: string;
  userId: string;
}

export function JobNotes({ jobId, orgId, userId }: JobNotesProps) {
  const [body,   setBody]   = useState('');
  const [facing, setFacing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: notes } = useReactiveQuery<NoteRow>(`
    SELECT
      n.*,
      u.name AS created_by_name
    FROM job_notes n
    LEFT JOIN users u ON u.id = n.created_by
    WHERE n.job_id = ?
    ORDER BY n.is_pinned DESC, n.created_at DESC
  `, [jobId]);

  async function handleAdd() {
    const trimmed = body.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('job_notes') as any).insert({
        org_id:             orgId,
        job_id:             jobId,
        created_by:         userId,
        body:               trimmed,
        is_customer_facing: facing ? 1 : 0,
        is_pinned:          0,
      });
      setBody('');
      setFacing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('job_notes') as any).delete().eq('id', noteId);
  }

  return (
    <div className="space-y-3">
      {notes.map(note => (
        <div key={note.id} className={`rounded-card border p-3 ${
          note.is_pinned ? 'border-warning/30 bg-surface-raised' : 'border-surface-border bg-surface-raised'
        }`}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-field-sm text-content whitespace-pre-wrap">{note.body}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] text-content-muted">
                  {note.created_by_name ?? 'Unknown'} ·{' '}
                  {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                </span>
                {note.is_customer_facing ? (
                  <span className="text-[10px] font-semibold text-info bg-info/10 px-1.5 py-0.5 rounded">
                    Customer-facing
                  </span>
                ) : (
                  <span className="text-[10px] text-content-muted">Internal</span>
                )}
                {!!note.is_pinned && <span className="text-[10px] text-warning">Pinned</span>}
              </div>
            </div>
            {note.created_by === userId && (
              <button
                onClick={() => handleDelete(note.id)}
                className="text-content-muted hover:text-danger transition-colors p-1 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}

      {notes.length === 0 && (
        <p className="text-field-xs text-content-muted text-center py-4">No notes yet</p>
      )}

      {/* Composer */}
      <div className="space-y-2 pt-1">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                     border border-surface-border focus:border-brand outline-none resize-none
                     placeholder:text-content-muted"
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={facing}
              onChange={e => setFacing(e.target.checked)}
              className="w-4 h-4 accent-brand"
            />
            <span className="text-field-xs text-content-secondary">Customer-facing</span>
          </label>
          <button
            onClick={handleAdd}
            disabled={!body.trim() || saving}
            className="h-9 px-4 bg-brand text-white text-field-xs font-bold rounded-button
                       hover:bg-brand-mid transition-colors disabled:opacity-30"
          >
            {saving ? 'Saving…' : 'Add Note'}
          </button>
        </div>
      </div>
    </div>
  );
}
