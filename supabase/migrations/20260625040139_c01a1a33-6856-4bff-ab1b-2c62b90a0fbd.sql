
-- 1) Lock down trigger / internal SECURITY DEFINER functions: revoke from public, anon, authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_order_city() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_cart_city() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_delivery_update_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_order_money_immutable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_store_product_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stores_set_slug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_payout_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_order_payment(text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_wallet_balance(uuid, numeric, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- 2) Revoke anon EXECUTE on helper/RPC functions that should require auth
REVOKE EXECUTE ON FUNCTION public.bump_location_usage(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compute_delivery_fee(uuid[], double precision, double precision, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_city() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_momo() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_store_payout(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_rider_subscription(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.platform_revenue_summary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wallet_cleared_balance(uuid) FROM PUBLIC, anon;
-- increment_product_views / increment_store_views remain callable by anon (view tracking for public pages)

-- 3) Hide bank/payout fields on profiles from other users (per-user access via get_my_momo RPC remains)
REVOKE SELECT (bank_account_number, bank_account_name, bank_name, payout_method, momo_number, momo_provider)
  ON public.profiles FROM anon, authenticated;

-- 4) Restrict commission rates to admins
DROP POLICY IF EXISTS "Anyone can read commissions" ON public.category_commissions;
CREATE POLICY "Admins can read commissions"
  ON public.category_commissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5) Stop public listing of storage objects in public image buckets (direct URLs still work)
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Store images are publicly accessible" ON storage.objects;
