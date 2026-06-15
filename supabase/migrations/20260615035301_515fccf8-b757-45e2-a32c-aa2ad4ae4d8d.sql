
-- Add bank payout fields to profiles and stores
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_method text CHECK (payout_method IN ('momo','bank')),
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_account_name text;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS payout_method text CHECK (payout_method IN ('momo','bank')),
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_account_name text;

-- Lock payout fields once payout_method is set (admins may override)
CREATE OR REPLACE FUNCTION public.lock_payout_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.payout_method IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
  THEN
    IF NEW.payout_method IS DISTINCT FROM OLD.payout_method
       OR NEW.momo_number IS DISTINCT FROM OLD.momo_number
       OR NEW.momo_provider IS DISTINCT FROM OLD.momo_provider
       OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
       OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
       OR NEW.bank_account_name IS DISTINCT FROM OLD.bank_account_name
    THEN
      RAISE EXCEPTION 'Payout details are locked. Contact support to change.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_payout_fields_profiles ON public.profiles;
CREATE TRIGGER lock_payout_fields_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_payout_fields();

DROP TRIGGER IF EXISTS lock_payout_fields_stores ON public.stores;
CREATE TRIGGER lock_payout_fields_stores
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.lock_payout_fields();

-- Extend the secure RPC to also return bank fields
DROP FUNCTION IF EXISTS public.get_my_store_payout(uuid);
CREATE OR REPLACE FUNCTION public.get_my_store_payout(_store_id uuid)
RETURNS TABLE(
  payout_method text,
  momo_number text,
  momo_provider text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  paystack_subaccount_code text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.payout_method, s.momo_number, s.momo_provider,
         s.bank_name, s.bank_account_number, s.bank_account_name,
         s.paystack_subaccount_code
  FROM public.stores s
  WHERE s.id = _store_id
    AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
$$;

DROP FUNCTION IF EXISTS public.get_my_momo();
CREATE OR REPLACE FUNCTION public.get_my_momo()
RETURNS TABLE(
  payout_method text,
  momo_number text,
  momo_provider text,
  bank_name text,
  bank_account_number text,
  bank_account_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT payout_method, momo_number, momo_provider,
         bank_name, bank_account_number, bank_account_name
  FROM public.profiles
  WHERE user_id = auth.uid();
$$;
