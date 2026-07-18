
CREATE POLICY "maintenance_assets_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'maintenance-assets');

CREATE POLICY "maintenance_assets_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'maintenance-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "maintenance_assets_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'maintenance-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "maintenance_assets_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'maintenance-assets' AND public.has_role(auth.uid(), 'admin'::app_role));
