import { column, Table } from '@powersync/web';

export const leadsTable = new Table(
  {
    org_id: column.text, phone: column.text, name: column.text,
    source: column.text, status: column.text, call_sid: column.text,
    called_number: column.text, missed_at: column.text, replied_at: column.text,
    created_at: column.text, updated_at: column.text,
  },
  { indexes: { by_status: ['status', 'missed_at'] } }
);

export const leadSequencesTable = new Table({
  org_id: column.text, lead_id: column.text, status: column.text,
  current_step: column.integer, inngest_run_id: column.text,
  created_at: column.text, updated_at: column.text,
});

export const leadMessagesTable = new Table(
  {
    org_id: column.text, lead_id: column.text, sequence_id: column.text,
    direction: column.text, body: column.text, status: column.text,
    telnyx_msg_id: column.text, sequence_step: column.integer,
    sent_at: column.text, created_at: column.text,
  },
  { indexes: { by_lead: ['lead_id', 'sent_at'] } }
);
