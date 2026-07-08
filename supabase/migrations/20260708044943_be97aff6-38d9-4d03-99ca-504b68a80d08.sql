
-- 1. Replace security-definer view with a synced table
DROP VIEW IF EXISTS public.public_profiles;

CREATE TABLE IF NOT EXISTS public.public_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  is_online boolean DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT ALL ON public.public_profiles TO service_role;

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.public_profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.public_profiles FOR SELECT
TO anon, authenticated
USING (true);

-- Backfill
INSERT INTO public.public_profiles (user_id, full_name, avatar_url, is_online, updated_at)
SELECT user_id, full_name, avatar_url, COALESCE(is_online,false), now()
FROM public.profiles
ON CONFLICT (user_id) DO UPDATE
SET full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    is_online = EXCLUDED.is_online,
    updated_at = now();

-- Trigger to keep in sync
CREATE OR REPLACE FUNCTION public.sync_public_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.public_profiles WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  INSERT INTO public.public_profiles (user_id, full_name, avatar_url, is_online, updated_at)
  VALUES (NEW.user_id, NEW.full_name, NEW.avatar_url, COALESCE(NEW.is_online,false), now())
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      is_online = EXCLUDED.is_online,
      updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_public_profile_ins ON public.profiles;
CREATE TRIGGER trg_sync_public_profile_ins
AFTER INSERT OR UPDATE OF full_name, avatar_url, is_online ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_public_profile();

DROP TRIGGER IF EXISTS trg_sync_public_profile_del ON public.profiles;
CREATE TRIGGER trg_sync_public_profile_del
AFTER DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_public_profile();

-- 2. Scope realtime broadcast/presence to the signed-in user's own topic.
-- Keep existing postgres_changes SELECT policy; add topic-scoped policies for
-- broadcast and presence so they can only ever target 'user:<uid>' topics.

DROP POLICY IF EXISTS "User-scoped broadcast read" ON realtime.messages;
CREATE POLICY "User-scoped broadcast read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension IN ('broadcast','presence')
  AND auth.uid() IS NOT NULL
  AND realtime.topic() = 'user:' || auth.uid()::text
);

DROP POLICY IF EXISTS "User-scoped broadcast write" ON realtime.messages;
CREATE POLICY "User-scoped broadcast write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension IN ('broadcast','presence')
  AND auth.uid() IS NOT NULL
  AND realtime.topic() = 'user:' || auth.uid()::text
);
