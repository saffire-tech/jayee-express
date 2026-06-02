CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.community_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_lower text GENERATED ALWAYS AS (lower(name)) STORED,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  contributed_by uuid,
  usage_count integer NOT NULL DEFAULT 1,
  is_flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.community_locations TO anon;
GRANT SELECT, INSERT, UPDATE ON public.community_locations TO authenticated;
GRANT ALL ON public.community_locations TO service_role;

ALTER TABLE public.community_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-flagged locations"
ON public.community_locations FOR SELECT
USING (is_flagged = false OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can contribute"
ON public.community_locations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = contributed_by);

CREATE POLICY "Contributors and admins can update"
ON public.community_locations FOR UPDATE
TO authenticated
USING (auth.uid() = contributed_by OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete"
ON public.community_locations FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_community_locations_name_trgm
ON public.community_locations USING GIN (name_lower gin_trgm_ops);

CREATE INDEX idx_community_locations_usage
ON public.community_locations (usage_count DESC);

CREATE TRIGGER update_community_locations_updated_at
BEFORE UPDATE ON public.community_locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.bump_location_usage(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.community_locations
  SET usage_count = usage_count + 1
  WHERE id = _id AND is_flagged = false;
$$;

GRANT EXECUTE ON FUNCTION public.bump_location_usage(uuid) TO authenticated, anon;