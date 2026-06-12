
-- 1) New columns on stores
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS monthly_fee numeric,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 2) New stores must be approved
ALTER TABLE public.stores ALTER COLUMN is_verified SET DEFAULT false;

-- 3) Allow admin-issued store subscriptions without a self-serve plan
ALTER TABLE public.store_subscriptions ALTER COLUMN plan_id DROP NOT NULL;
ALTER TABLE public.store_subscriptions ADD COLUMN IF NOT EXISTS monthly_fee numeric;

-- 4) Tighten visibility: require active subscription for public viewing
DROP POLICY IF EXISTS "Stores visible by city" ON public.stores;
CREATE POLICY "Stores visible by city" ON public.stores FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (user_id = auth.uid())
  OR (
    is_verified = true
    AND COALESCE(is_suspended, false) = false
    AND subscription_expires_at IS NOT NULL
    AND subscription_expires_at > now()
    AND (current_user_city() IS NULL OR city = current_user_city())
  )
);

DROP POLICY IF EXISTS "Products visible by store city" ON public.products;
CREATE POLICY "Products visible by store city" ON public.products FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id
      AND (
        s.user_id = auth.uid()
        OR (
          s.is_verified = true
          AND COALESCE(s.is_suspended, false) = false
          AND s.subscription_expires_at IS NOT NULL
          AND s.subscription_expires_at > now()
          AND (current_user_city() IS NULL OR s.city = current_user_city())
        )
      )
  )
);

-- 5) Backfill grace window for existing verified stores without expiry
UPDATE public.stores
SET subscription_expires_at = now() + interval '30 days'
WHERE is_verified = true
  AND subscription_expires_at IS NULL;
