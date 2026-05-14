CREATE TABLE IF NOT EXISTS public.price_book (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  category    text,
  unit        text NOT NULL DEFAULT 'each',
  unit_price  numeric(10,2) NOT NULL DEFAULT 0,
  taxable     boolean NOT NULL DEFAULT true,
  aliases     text[],
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_book_org_id_idx ON public.price_book (org_id);
CREATE INDEX IF NOT EXISTS price_book_category_idx ON public.price_book (org_id, category);

CREATE TRIGGER price_book_updated_at
  BEFORE UPDATE ON public.price_book FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.price_book ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_book_org" ON public.price_book
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "price_book_service" ON public.price_book
  TO service_role USING (true) WITH CHECK (true);
