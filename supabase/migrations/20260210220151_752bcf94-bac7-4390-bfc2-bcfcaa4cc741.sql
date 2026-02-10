
-- 1.1 Add 'delivery' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'delivery';

-- 1.2 Add coordinates to stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 1.3 Create delivery_zones table
CREATE TABLE public.delivery_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  min_distance_km NUMERIC NOT NULL DEFAULT 0,
  max_distance_km NUMERIC NOT NULL,
  fee NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read active delivery zones"
ON public.delivery_zones FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage delivery zones"
ON public.delivery_zones FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default zones
INSERT INTO public.delivery_zones (name, min_distance_km, max_distance_km, fee) VALUES
  ('Near', 0, 2, 5),
  ('Medium', 2, 5, 10),
  ('Far', 5, 10, 20);

-- 1.4 Add delivery columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT 'pickup';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_latitude DOUBLE PRECISION;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_longitude DOUBLE PRECISION;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_person_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_status TEXT;

-- Allow delivery persons to update delivery status on their accepted orders
CREATE POLICY "Delivery persons can update their orders"
ON public.orders FOR UPDATE
USING (auth.uid() = delivery_person_id);

-- 1.5 Create delivery_locations table
CREATE TABLE public.delivery_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_locations ENABLE ROW LEVEL SECURITY;

-- Delivery person can manage their own locations
CREATE POLICY "Delivery persons can manage their locations"
ON public.delivery_locations FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Buyer and seller of the order can read delivery locations
CREATE POLICY "Order participants can view delivery locations"
ON public.delivery_locations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = delivery_locations.order_id
    AND (
      o.buyer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = o.store_id AND s.user_id = auth.uid()
      )
    )
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_locations;
