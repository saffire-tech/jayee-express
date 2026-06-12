
CREATE OR REPLACE FUNCTION public.wallet_cleared_balance(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH w AS (
    SELECT COALESCE(balance, 0) AS bal FROM public.wallets WHERE user_id = _user_id
  ),
  pending AS (
    SELECT COALESCE(SUM(wt.amount), 0) AS held
    FROM public.wallet_transactions wt
    JOIN public.orders o ON o.id = wt.reference_id
    WHERE wt.user_id = _user_id
      AND wt.type = 'credit'
      AND o.status <> 'completed'
      AND o.status <> 'cancelled'
  )
  SELECT GREATEST(COALESCE((SELECT bal FROM w), 0) - COALESCE((SELECT held FROM pending), 0), 0);
$$;

GRANT EXECUTE ON FUNCTION public.wallet_cleared_balance(uuid) TO authenticated, service_role;
