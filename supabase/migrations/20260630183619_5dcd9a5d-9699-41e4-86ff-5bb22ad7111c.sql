
-- 1) Protect sensitive financial columns on stores
REVOKE SELECT (bank_account_number, bank_account_name, bank_name, momo_number, momo_provider, paystack_subaccount_code, payout_method)
  ON public.stores FROM anon, authenticated;

-- (service_role retains full access; owners/admins read via get_my_store_payout RPC.)

-- 2) Tighten EXECUTE on SECURITY DEFINER functions
-- Revoke from public/anon/authenticated, then re-grant only the ones the client legitimately calls.
REVOKE EXECUTE ON FUNCTION public.finalize_order_payment(text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_wallet_balance(uuid, numeric, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.platform_revenue_summary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compute_delivery_fee(uuid[], double precision, double precision, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bump_location_usage(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_rider_subscription(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wallet_cleared_balance(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_momo() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_store_payout(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_city() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_product_views(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_store_views(uuid) FROM PUBLIC;

-- Re-grant only the ones safely callable by signed-in users:
GRANT EXECUTE ON FUNCTION public.compute_delivery_fee(uuid[], double precision, double precision, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_location_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_rider_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_cleared_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_momo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_store_payout(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_revenue_summary() TO authenticated;
-- has_role / current_user_city are used inside RLS policies (run as definer regardless);
-- no direct RPC use is required, so they stay revoked from anon/authenticated.

-- View counters are intentionally callable by anon (public catalog tracking)
GRANT EXECUTE ON FUNCTION public.increment_product_views(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_store_views(uuid) TO anon, authenticated;
