CREATE TABLE IF NOT EXISTS public.review_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id         uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  customer_id    uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'pending',
  -- 'pending' | 'sent' | 'clicked' | 'reviewed' | 'failed'
  sent_via       text,        -- 'sms' | 'email'
  platform       text,        -- 'google' | 'yelp' | 'facebook'
  review_url     text,
  sent_at        timestamptz,
  clicked_at     timestamptz,
  reviewed_at    timestamptz,
  star_rating    int,
  review_text    text,
  inngest_run_id text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER review_requests_updated_at
  BEFORE UPDATE ON public.review_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX ON public.review_requests (org_id, status, created_at DESC);
CREATE INDEX ON public.review_requests (customer_id);

ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_requests_org" ON public.review_requests
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "review_requests_service" ON public.review_requests
  TO service_role USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.review_requests;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS google_review_url   text,
  ADD COLUMN IF NOT EXISTS yelp_review_url     text,
  ADD COLUMN IF NOT EXISTS facebook_review_url text,
  ADD COLUMN IF NOT EXISTS review_delay_hours  int NOT NULL DEFAULT 24;
