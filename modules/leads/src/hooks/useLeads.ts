import { useQuery } from '@powersync/react';
import { useCallback } from 'react';
import { getSupabaseClient } from '@trades-saas/core-auth';
import type { Lead, LeadMessage, LeadSequence, LeadStatus, LeadWithContext } from '../types';

const supabase = getSupabaseClient();

export function useLeads(filter?: LeadStatus) {
  const where = filter ? `WHERE l.status = '${filter}'` : '';
  return useQuery<LeadWithContext>(`
    SELECT l.*,
      s.id AS seq_id, s.status AS seq_status, s.current_step AS seq_current_step,
      m.body AS last_message_body, m.direction AS last_message_direction,
      m.sent_at AS last_message_sent_at,
      (SELECT COUNT(*) FROM lead_messages WHERE lead_id = l.id) AS message_count
    FROM leads l
    LEFT JOIN lead_sequences s ON s.lead_id = l.id
    LEFT JOIN lead_messages m ON m.id = (
      SELECT id FROM lead_messages WHERE lead_id = l.id ORDER BY sent_at DESC LIMIT 1
    )
    ${where}
    ORDER BY l.missed_at DESC
  `);
}

export function useLead(leadId: string) {
  return useQuery<Lead>('SELECT * FROM leads WHERE id = ? LIMIT 1', [leadId]);
}

export function useLeadSequence(leadId: string) {
  return useQuery<LeadSequence>('SELECT * FROM lead_sequences WHERE lead_id = ? LIMIT 1', [leadId]);
}

export function useLeadMessages(leadId: string) {
  return useQuery<LeadMessage>(
    'SELECT * FROM lead_messages WHERE lead_id = ? ORDER BY sent_at ASC', [leadId]
  );
}

export function useLeadStats() {
  const { data } = useQuery<{ total: number; new_today: number; replied: number; booked: number }>(`
    SELECT COUNT(*) AS total,
      COUNT(CASE WHEN date(missed_at) = date('now') THEN 1 END) AS new_today,
      COUNT(CASE WHEN status = 'replied' THEN 1 END) AS replied,
      COUNT(CASE WHEN status = 'booked'  THEN 1 END) AS booked
    FROM leads WHERE status != 'lost'
  `);
  return data?.[0] ?? { total: 0, new_today: 0, replied: 0, booked: 0 };
}

export function useLeadActions() {
  const updateStatus = useCallback(async (leadId: string, status: LeadStatus) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('leads') as any).update({ status }).eq('id', leadId);
    if (error) throw error;
  }, []);

  const pauseSequence = useCallback(async (sequenceId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('lead_sequences') as any).update({ status: 'paused' }).eq('id', sequenceId);
    if (error) throw error;
  }, []);

  const resumeSequence = useCallback(async (sequenceId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('lead_sequences') as any).update({ status: 'active' }).eq('id', sequenceId);
    if (error) throw error;
  }, []);

  const sendManualReply = useCallback(async (
    leadId: string, orgId: string, toPhone: string, fromPhone: string, body: string
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/leadlock-send-sms`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, org_id: orgId, to: toPhone, from: fromPhone, body }),
      }
    );
    if (!res.ok) throw new Error(await res.text());
  }, []);

  return { updateStatus, pauseSequence, resumeSequence, sendManualReply };
}
