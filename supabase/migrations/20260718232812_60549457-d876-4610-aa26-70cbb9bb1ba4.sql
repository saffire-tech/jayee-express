
-- Allow public read of the maintenance_mode setting (so gate works even signed out)
CREATE POLICY "Public can read maintenance_mode"
ON public.platform_settings
FOR SELECT
TO anon, authenticated
USING (key = 'maintenance_mode');

GRANT SELECT ON public.platform_settings TO anon;
GRANT SELECT ON public.platform_settings TO authenticated;

-- Seed the row if missing
INSERT INTO public.platform_settings (key, value)
VALUES ('maintenance_mode', '{"enabled":false,"message":"We are performing scheduled maintenance. We''ll be back shortly.","eta":null}')
ON CONFLICT (key) DO NOTHING;

-- Enable realtime
ALTER TABLE public.platform_settings REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
