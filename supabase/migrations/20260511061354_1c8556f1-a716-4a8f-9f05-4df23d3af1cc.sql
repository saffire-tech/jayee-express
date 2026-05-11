
-- 1. Add coords to locations
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- 2. user_known_devices table
CREATE TABLE IF NOT EXISTS public.user_known_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_hash text NOT NULL,
  user_agent text,
  ip text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_hash)
);

ALTER TABLE public.user_known_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own devices"
  ON public.user_known_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own devices"
  ON public.user_known_devices FOR DELETE
  USING (auth.uid() = user_id);

-- Inserts/updates happen via edge function with service role, so no insert/update policy needed.

-- 3. Subscription gating on products
DROP POLICY IF EXISTS "Active products are viewable by everyone" ON public.products;

CREATE POLICY "Active products are viewable by everyone"
ON public.products FOR SELECT
USING (
  (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = products.store_id
        AND COALESCE(s.subscription_expires_at, 'epoch'::timestamptz) > now()
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id AND s.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Subscription gating on stores
DROP POLICY IF EXISTS "Stores are viewable by everyone" ON public.stores;

CREATE POLICY "Stores are viewable by everyone"
ON public.stores FOR SELECT
USING (
  COALESCE(subscription_expires_at, 'epoch'::timestamptz) > now()
  OR auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
);
