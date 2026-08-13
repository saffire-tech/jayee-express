-- 1. Widen city checks to include Accra
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_city_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_city_check
  CHECK (city IS NULL OR city = ANY (ARRAY['Tamale'::text, 'Wa'::text, 'Accra'::text]));

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_city_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_city_check
  CHECK (city = ANY (ARRAY['Tamale'::text, 'Wa'::text, 'Accra'::text]));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_city_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_city_check
  CHECK (city = ANY (ARRAY['Tamale'::text, 'Wa'::text, 'Accra'::text]));

-- 2. Add city to locations and backfill
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT 'Tamale';
UPDATE public.locations SET city = 'Wa' WHERE zone ILIKE 'Wa%';
UPDATE public.locations SET city = 'Tamale' WHERE zone ILIKE 'Tamale%';
ALTER TABLE public.locations DROP CONSTRAINT IF EXISTS locations_city_check;
ALTER TABLE public.locations ADD CONSTRAINT locations_city_check
  CHECK (city = ANY (ARRAY['Tamale'::text, 'Wa'::text, 'Accra'::text]));

-- 3. Seed Accra zones/areas
INSERT INTO public.locations (city, zone, name, display_order, is_active)
SELECT 'Accra', z.zone, a.name, a.ord, true
FROM (VALUES
  ('Accra Central', ARRAY['Osu','Adabraka','Asylum Down','Ridge','Kokomlemle','North Ridge','Tudu','Jamestown','Korle Gonno']),
  ('Accra East', ARRAY['East Legon','Adenta','Madina','Ashaley Botwe','Teshie','Nungua','Spintex','Baatsona','Airport Residential','Cantonments','Labone']),
  ('Accra West', ARRAY['Dansoman','Kaneshie','Odorkor','Mallam','Weija','Gbawe','Darkuman','Lapaz','Achimota']),
  ('Accra North', ARRAY['Tesano','Dome','Kwabenya','Haatso','Agbogba','Ashongman','Legon','Abelemkpe','Dzorwulu']),
  ('Tema & Outskirts', ARRAY['Tema Community 1','Tema Community 25','Ashaiman','Sakumono','Kasoa','Amasaman','Pokuase','Oyibi','Katamanso'])
) AS z(zone, names)
CROSS JOIN LATERAL unnest(z.names) WITH ORDINALITY AS a(name, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.locations l WHERE l.city = 'Accra' AND l.zone = z.zone AND l.name = a.name
);