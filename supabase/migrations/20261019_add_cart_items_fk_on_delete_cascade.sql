-- Migration: add ON DELETE CASCADE FK from cart_items.product_id -> products.id
-- Purpose: when a product row is deleted, any cart_items referencing it will be removed automatically
-- Run in Supabase SQL editor or apply via your migration runner.

BEGIN;

-- Drop any existing constraint with the chosen name to make this migration idempotent
ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS fk_cart_product;

-- Add foreign key with ON DELETE CASCADE
ALTER TABLE public.cart_items
  ADD CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- Optional: ensure there is an index on product_id for performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'cart_items' AND indexname = 'idx_cart_items_product_id'
  ) THEN
    CREATE INDEX idx_cart_items_product_id ON public.cart_items(product_id);
  END IF;
END$$;

COMMIT;
