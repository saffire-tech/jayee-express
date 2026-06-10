
-- 1. PROFILES: restrict public access to authenticated users
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- 2. STORES: hide payment fields from non-owners via column grants
REVOKE SELECT ON public.stores FROM anon, authenticated;
GRANT SELECT (
  id, user_id, name, description, logo_url, cover_url, location, phone,
  is_verified, is_active, total_views, total_sales, created_at, updated_at,
  is_featured, is_suspended, campus, latitude, longitude,
  current_plan_id, product_limit, subscription_expires_at
) ON public.stores TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;

-- Owner-only RPC to fetch store payout details
CREATE OR REPLACE FUNCTION public.get_my_store_payout(_store_id uuid)
RETURNS TABLE(momo_number text, momo_provider text, paystack_subaccount_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.momo_number, s.momo_provider, s.paystack_subaccount_code
  FROM public.stores s
  WHERE s.id = _store_id
    AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_store_payout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_store_payout(uuid) TO authenticated;

-- 3. PUSH SUBSCRIPTIONS: remove over-broad SELECT (service role bypasses RLS)
DROP POLICY IF EXISTS "Service role can read all subscriptions" ON public.push_subscriptions;

-- 4. DEVICE TOKENS: remove over-broad SELECT
DROP POLICY IF EXISTS "Service role can read all device tokens" ON public.device_tokens;

-- 5. NOTIFICATIONS: restrict INSERT to owner; service role bypasses RLS
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert their own notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 6. PLATFORM SETTINGS: admins-only read
DROP POLICY IF EXISTS "Everyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Admins can read platform settings"
ON public.platform_settings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. STORE WEB SERVICES: enforce subscription on public view
DROP POLICY IF EXISTS "Active web services are viewable by everyone" ON public.store_web_services;
CREATE POLICY "Active web services are viewable when store is subscribed"
ON public.store_web_services FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_web_services.store_id
      AND (
        s.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR (
          is_active = true
          AND COALESCE(s.subscription_expires_at, '1970-01-01'::timestamptz) > now()
        )
      )
  )
);

-- 8. Lock down sensitive SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.update_wallet_balance(uuid, numeric, text, text, uuid) FROM PUBLIC, anon, authenticated;
