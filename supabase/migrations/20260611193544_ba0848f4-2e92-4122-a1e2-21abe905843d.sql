
-- 1. Add city columns (nullable first for backfill)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS city text;

-- 2. Backfill existing rows to Tamale
UPDATE public.profiles SET city = 'Tamale' WHERE city IS NULL;
UPDATE public.stores SET city = 'Tamale' WHERE city IS NULL;
UPDATE public.orders SET city = 'Tamale' WHERE city IS NULL;

-- 3. Add CHECK constraints (Tamale, Wa)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_city_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_city_check CHECK (city IS NULL OR city IN ('Tamale','Wa'));

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_city_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_city_check CHECK (city IN ('Tamale','Wa'));
ALTER TABLE public.stores ALTER COLUMN city SET NOT NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_city_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_city_check CHECK (city IN ('Tamale','Wa'));
ALTER TABLE public.orders ALTER COLUMN city SET NOT NULL;

-- Note: profiles.city stays nullable so we can detect first-time users who need to pick a city.

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_stores_city ON public.stores(city);
CREATE INDEX IF NOT EXISTS idx_orders_city ON public.orders(city);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);

-- 5. Helper: get current user's city
CREATE OR REPLACE FUNCTION public.current_user_city()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT city FROM public.profiles WHERE user_id = auth.uid();
$$;

-- 6. Trigger: auto-stamp orders.city from store.city
CREATE OR REPLACE FUNCTION public.set_order_city()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.city IS NULL AND NEW.store_id IS NOT NULL THEN
    SELECT city INTO NEW.city FROM public.stores WHERE id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_city ON public.orders;
CREATE TRIGGER trg_set_order_city
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_city();

-- 7. Trigger: block cart items from a different city than the buyer's
CREATE OR REPLACE FUNCTION public.enforce_cart_city()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  store_city text;
  user_city text;
BEGIN
  SELECT s.city INTO store_city
  FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.id = NEW.product_id;

  SELECT city INTO user_city FROM public.profiles WHERE user_id = NEW.user_id;

  IF user_city IS NOT NULL AND store_city IS NOT NULL AND store_city <> user_city THEN
    RAISE EXCEPTION 'Cannot add product from % to a % cart', store_city, user_city;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_cart_city ON public.cart_items;
CREATE TRIGGER trg_enforce_cart_city
BEFORE INSERT OR UPDATE ON public.cart_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_cart_city();

-- 8. Update RLS policies for city-based visibility
-- STORES: add city filter to public SELECT policies
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='stores' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.stores', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Stores visible by city"
ON public.stores FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR user_id = auth.uid()
  OR (
    is_verified = true
    AND COALESCE(is_suspended, false) = false
    AND (
      public.current_user_city() IS NULL
      OR city = public.current_user_city()
    )
  )
);

-- PRODUCTS: drop existing SELECT policies and re-create with city filter
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='products' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.products', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Products visible by store city"
ON public.products FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id
      AND (
        s.user_id = auth.uid()
        OR (
          s.is_verified = true
          AND COALESCE(s.is_suspended, false) = false
          AND (
            public.current_user_city() IS NULL
            OR s.city = public.current_user_city()
          )
        )
      )
  )
);
