
CREATE TABLE public.platform_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  type text NOT NULL CHECK (type IN ('momo','bank')),
  account_number text NOT NULL,
  bank_code text NOT NULL,
  account_name text NOT NULL,
  paystack_recipient_code text,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_payout_accounts TO authenticated;
GRANT ALL ON public.platform_payout_accounts TO service_role;
ALTER TABLE public.platform_payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payout accounts" ON public.platform_payout_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.platform_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  account_id uuid REFERENCES public.platform_payout_accounts(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  recipient_snapshot jsonb,
  paystack_transfer_code text,
  paystack_recipient_code text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','reversed')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_platform_payouts_transfer_code ON public.platform_payouts(paystack_transfer_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_payouts TO authenticated;
GRANT ALL ON public.platform_payouts TO service_role;
ALTER TABLE public.platform_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view payouts" ON public.platform_payouts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert payouts" ON public.platform_payouts
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_platform_payout_accounts_updated
  BEFORE UPDATE ON public.platform_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_platform_payouts_updated
  BEFORE UPDATE ON public.platform_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.platform_revenue_summary()
RETURNS TABLE(
  total_subscription_revenue numeric,
  revenue_this_month numeric,
  store_revenue numeric,
  rider_revenue numeric,
  total_withdrawn numeric,
  pending_withdrawals numeric,
  net_earned numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _store_total numeric;
  _rider_total numeric;
  _store_month numeric;
  _rider_month numeric;
  _withdrawn numeric;
  _pending numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(SUM(amount_paid),0) INTO _store_total FROM public.store_subscriptions WHERE amount_paid IS NOT NULL;
  SELECT COALESCE(SUM(amount_paid),0) INTO _rider_total FROM public.delivery_subscriptions WHERE amount_paid IS NOT NULL;
  SELECT COALESCE(SUM(amount_paid),0) INTO _store_month FROM public.store_subscriptions
    WHERE amount_paid IS NOT NULL AND created_at >= date_trunc('month', now());
  SELECT COALESCE(SUM(amount_paid),0) INTO _rider_month FROM public.delivery_subscriptions
    WHERE amount_paid IS NOT NULL AND created_at >= date_trunc('month', now());
  SELECT COALESCE(SUM(amount),0) INTO _withdrawn FROM public.platform_payouts WHERE status = 'success';
  SELECT COALESCE(SUM(amount),0) INTO _pending FROM public.platform_payouts WHERE status = 'pending';

  total_subscription_revenue := _store_total + _rider_total;
  revenue_this_month := _store_month + _rider_month;
  store_revenue := _store_total;
  rider_revenue := _rider_total;
  total_withdrawn := _withdrawn;
  pending_withdrawals := _pending;
  net_earned := (_store_total + _rider_total) - _withdrawn - _pending;
  RETURN NEXT;
END;
$$;
