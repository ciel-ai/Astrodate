INSERT INTO storage.buckets (id, name, public)
VALUES ('user-photos', 'user-photos', false),
       ('messages', 'messages', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "user-photos-authenticated-select"
  ON storage.objects
  FOR SELECT
  USING ( bucket_id = 'user-photos' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "user-photos-authenticated-insert"
  ON storage.objects
  FOR INSERT
  WITH CHECK ( bucket_id = 'user-photos' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "user-photos-authenticated-update"
  ON storage.objects
  FOR UPDATE
  USING ( bucket_id = 'user-photos' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "user-photos-authenticated-delete"
  ON storage.objects
  FOR DELETE
  USING ( bucket_id = 'user-photos' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "messages-authenticated-select"
  ON storage.objects
  FOR SELECT
  USING ( bucket_id = 'messages' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "messages-authenticated-insert"
  ON storage.objects
  FOR INSERT
  WITH CHECK ( bucket_id = 'messages' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text );
