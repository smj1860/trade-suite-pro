INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  false,
  52428800,   -- 50MB per photo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "photos_org_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = (
      SELECT org_id::text FROM public.users WHERE id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "photos_org_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = (
      SELECT org_id::text FROM public.users WHERE id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "photos_org_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = (
      SELECT org_id::text FROM public.users WHERE id = auth.uid() LIMIT 1
    )
  );
