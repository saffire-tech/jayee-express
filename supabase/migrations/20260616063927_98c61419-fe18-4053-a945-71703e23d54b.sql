
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_name text,
  ADD COLUMN IF NOT EXISTS media_size bigint,
  ADD COLUMN IF NOT EXISTS media_mime text;

ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_or_media_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_or_media_check
  CHECK (
    (content IS NOT NULL AND length(btrim(content)) > 0)
    OR media_url IS NOT NULL
  );

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_media_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_media_type_check
  CHECK (media_type IS NULL OR media_type IN ('image','video','audio','file'));

-- Storage policies for message-media bucket
DROP POLICY IF EXISTS "Message media upload own folder" ON storage.objects;
CREATE POLICY "Message media upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Message media read own uploads" ON storage.objects;
CREATE POLICY "Message media read own uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.media_url = storage.objects.name
        AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Message media delete own" ON storage.objects;
CREATE POLICY "Message media delete own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'message-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
