-- Create the documents storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can only read documents for their own org
CREATE POLICY "documents_org_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (
      SELECT org_id::text FROM public.users WHERE id = auth.uid() LIMIT 1
    )
  );

-- Service role can write (Edge Functions upload PDFs)
CREATE POLICY "documents_service_write" ON storage.objects
  FOR INSERT TO service_role WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents_service_update" ON storage.objects
  FOR UPDATE TO service_role USING (bucket_id = 'documents');
