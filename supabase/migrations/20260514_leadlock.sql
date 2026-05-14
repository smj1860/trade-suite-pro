ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS telnyx_number    text,
  ADD COLUMN IF NOT EXISTS owner_first_name text,
  ADD COLUMN IF NOT EXISTS trade            text DEFAULT 'home services';

CREATE UNIQUE INDEX IF NOT EXISTS orgs_telnyx_number_unique
  ON public.organizations (telnyx_number) WHERE telnyx_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone         text NOT NULL,
  name          text,
  source        text NOT NULL DEFAULT 'missed_call',
  status        text NOT NULL DEFAULT 'new',
  call_sid      text,
  called_number text,
  missed_at     timestamptz NOT NULL DEFAULT now(),
  replied_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_sequences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id        uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'active',
  current_step   int  NOT NULL DEFAULT 0,
  inngest_run_id text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);

CREATE TABLE IF NOT EXISTS public.lead_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id       uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sequence_id   uuid REFERENCES public.lead_sequences(id),
  direction     text NOT NULL,
  body          text NOT NULL,
  status        text NOT NULL DEFAULT 'sent',
  telnyx_msg_id text,
  sequence_step int,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER lead_sequences_updated_at
  BEFORE UPDATE ON public.lead_sequences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX ON public.leads         (org_id, status, missed_at DESC);
CREATE INDEX ON public.lead_messages (lead_id, sent_at DESC);

ALTER TABLE public.leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_messages  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_org"          ON public.leads
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1));
CREATE POLICY "lead_sequences_org" ON public.lead_sequences
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1));
CREATE POLICY "lead_messages_org"  ON public.lead_messages
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "leads_service"          ON public.leads          TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "lead_sequences_service" ON public.lead_sequences TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "lead_messages_service"  ON public.lead_messages  TO service_role USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_messages;
