
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT trim(both '-' from regexp_replace(
    regexp_replace(lower(coalesce(_input, '')), '[^a-z0-9]+', '-', 'g'),
    '-+', '-', 'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.stores_set_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base text;
  candidate text;
  i int := 0;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name AND NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  base := public.slugify(NEW.name);
  IF base IS NULL OR base = '' THEN
    base := 'store';
  END IF;

  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.stores WHERE slug = candidate AND id <> NEW.id) LOOP
    i := i + 1;
    candidate := base || '-' || i;
    IF i > 500 THEN
      candidate := base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
      EXIT;
    END IF;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stores_set_slug_trigger ON public.stores;
CREATE TRIGGER stores_set_slug_trigger
BEFORE INSERT OR UPDATE OF name ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.stores_set_slug();

-- Backfill existing rows
DO $$
DECLARE
  r RECORD;
  base text;
  candidate text;
  i int;
BEGIN
  FOR r IN SELECT id, name FROM public.stores WHERE slug IS NULL OR slug = '' ORDER BY created_at LOOP
    base := public.slugify(r.name);
    IF base IS NULL OR base = '' THEN base := 'store'; END IF;
    candidate := base;
    i := 0;
    WHILE EXISTS (SELECT 1 FROM public.stores WHERE slug = candidate AND id <> r.id) LOOP
      i := i + 1;
      candidate := base || '-' || i;
    END LOOP;
    UPDATE public.stores SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.stores ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stores_slug_unique ON public.stores (slug);
