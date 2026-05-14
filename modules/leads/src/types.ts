export type LeadStatus     = 'new' | 'contacted' | 'replied' | 'booked' | 'lost';
export type LeadSource     = 'missed_call' | 'web_form' | 'manual';
export type SequenceStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type MessageDirection = 'outbound' | 'inbound';
export type MessageStatus  = 'queued' | 'sent' | 'delivered' | 'failed';

export interface Lead {
  id: string; org_id: string; phone: string; name: string | null;
  source: LeadSource; status: LeadStatus; call_sid: string | null;
  called_number: string | null; missed_at: string; replied_at: string | null;
  created_at: string; updated_at: string;
}

export interface LeadSequence {
  id: string; org_id: string; lead_id: string; status: SequenceStatus;
  current_step: number; inngest_run_id: string | null;
  created_at: string; updated_at: string;
}

export interface LeadMessage {
  id: string; org_id: string; lead_id: string; sequence_id: string | null;
  direction: MessageDirection; body: string; status: MessageStatus;
  telnyx_msg_id: string | null; sequence_step: number | null;
  sent_at: string; created_at: string;
}

export interface LeadWithContext extends Lead {
  seq_id: string | null; seq_status: SequenceStatus | null;
  seq_current_step: number | null; last_message_body: string | null;
  last_message_direction: MessageDirection | null; last_message_sent_at: string | null;
  message_count: number;
}

export const SEQUENCE_STEPS = [
  { step: 0, label: 'Immediate text-back',  delay_ms: 0 },
  { step: 1, label: '24-hour follow-up',    delay_ms: 86400000 },
  { step: 2, label: '48-hour final touch',  delay_ms: 172800000 },
] as const;
