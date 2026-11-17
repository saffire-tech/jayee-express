ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_stores_delivery_enabled
  ON public.stores(delivery_enabled);