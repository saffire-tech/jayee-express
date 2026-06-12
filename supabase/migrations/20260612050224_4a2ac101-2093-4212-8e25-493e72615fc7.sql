
CREATE POLICY "Riders upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rider-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Riders read own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rider-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text
         OR public.has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Riders update own documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'rider-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins delete rider documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'rider-documents'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
