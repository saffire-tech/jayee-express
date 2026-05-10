-- Locations table (admin managed)
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (zone, name)
);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active locations"
  ON public.locations FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage locations"
  ON public.locations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial locations from existing config
INSERT INTO public.locations (zone, name, display_order) VALUES
  ('Accra Central', 'Osu', 1), ('Accra Central', 'Labadi', 2), ('Accra Central', 'Cantonments', 3),
  ('Accra Central', 'Airport Residential', 4), ('Accra Central', 'Ridge', 5), ('Accra Central', 'Dzorwulu', 6),
  ('Accra Central', 'Abelemkpe', 7), ('Accra Central', 'Roman Ridge', 8), ('Accra Central', 'Circle', 9),
  ('Accra Central', 'Asylum Down', 10), ('Accra Central', 'Adabraka', 11),
  ('North Accra', 'Achimota', 1), ('North Accra', 'Lapaz', 2), ('North Accra', 'Dome', 3),
  ('North Accra', 'Haatso', 4), ('North Accra', 'Taifa', 5), ('North Accra', 'Agbogba', 6),
  ('North Accra', 'Kwabenya', 7), ('North Accra', 'Pokuase', 8), ('North Accra', 'Amasaman', 9),
  ('East Accra', 'East Legon', 1), ('East Accra', 'Madina', 2), ('East Accra', 'Adenta', 3),
  ('East Accra', 'Teshie', 4), ('East Accra', 'Nungua', 5), ('East Accra', 'Spintex', 6),
  ('East Accra', 'Baatsonaa', 7), ('East Accra', 'Adjiriganor', 8),
  ('West Accra', 'Dansoman', 1), ('West Accra', 'Darkuman', 2), ('West Accra', 'Odorkor', 3),
  ('West Accra', 'Kaneshie', 4), ('West Accra', 'Tesano', 5), ('West Accra', 'Ablekuma', 6),
  ('West Accra', 'Bubiashie', 7), ('West Accra', 'Abeka', 8),
  ('Tema & Surroundings', 'Tema', 1), ('Tema & Surroundings', 'Ashaiman', 2), ('Tema & Surroundings', 'Sakumono', 3),
  ('Tema & Surroundings', 'Kpone', 4), ('Tema & Surroundings', 'Prampram', 5), ('Tema & Surroundings', 'Dawhenya', 6),
  ('Tema & Surroundings', 'Afienya', 7),
  ('Kasoa & Surroundings', 'Kasoa', 1), ('Kasoa & Surroundings', 'Weija', 2), ('Kasoa & Surroundings', 'Gbawe', 3),
  ('Kasoa & Surroundings', 'Mallam', 4), ('Kasoa & Surroundings', 'McCarthy Hill', 5),
  ('Kasoa & Surroundings', 'Bortianor', 6), ('Kasoa & Surroundings', 'Kokrobite', 7)
ON CONFLICT (zone, name) DO NOTHING;

-- Add landmark column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_landmark text;