
-- 1. Create user_payout_details
CREATE TABLE public.user_payout_details (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_method text,
  momo_number text,
  momo_provider text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_payout_details TO authenticated;
GRANT ALL ON public.user_payout_details TO service_role;
ALTER TABLE public.user_payout_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or admin can view own payout details"
  ON public.user_payout_details FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owner can insert own payout details"
  ON public.user_payout_details FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner or admin can update payout details"
  ON public.user_payout_details FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_payout_details_updated_at
  BEFORE UPDATE ON public.user_payout_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create store_payout_details
CREATE TABLE public.store_payout_details (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  payout_method text,
  momo_number text,
  momo_provider text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  paystack_subaccount_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.store_payout_details TO authenticated;
GRANT ALL ON public.store_payout_details TO service_role;
ALTER TABLE public.store_payout_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owner or admin can view store payout details"
  ON public.store_payout_details FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "Store owner can insert store payout details"
  ON public.store_payout_details FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.user_id = auth.uid()));
CREATE POLICY "Store owner or admin can update store payout details"
  ON public.store_payout_details FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER update_store_payout_details_updated_at
  BEFORE UPDATE ON public.store_payout_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Copy existing data
INSERT INTO public.user_payout_details (user_id, payout_method, momo_number, momo_provider, bank_name, bank_account_number, bank_account_name)
SELECT user_id, payout_method, momo_number, momo_provider, bank_name, bank_account_number, bank_account_name
FROM public.profiles
WHERE payout_method IS NOT NULL OR momo_number IS NOT NULL OR bank_account_number IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.store_payout_details (store_id, payout_method, momo_number, momo_provider, bank_name, bank_account_number, bank_account_name, paystack_subaccount_code)
SELECT id, payout_method, momo_number, momo_provider, bank_name, bank_account_number, bank_account_name, paystack_subaccount_code
FROM public.stores
WHERE payout_method IS NOT NULL OR momo_number IS NOT NULL OR bank_account_number IS NOT NULL OR paystack_subaccount_code IS NOT NULL
ON CONFLICT (store_id) DO NOTHING;

-- 4. Drop old lock trigger + drop columns from profiles and stores
DROP TRIGGER IF EXISTS lock_payout_fields_profiles ON public.profiles;
DROP TRIGGER IF EXISTS lock_payout_fields_stores ON public.stores;
DROP TRIGGER IF EXISTS lock_profiles_payout ON public.profiles;
DROP TRIGGER IF EXISTS lock_stores_payout ON public.stores;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS payout_method,
  DROP COLUMN IF EXISTS momo_number,
  DROP COLUMN IF EXISTS momo_provider,
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS bank_account_number,
  DROP COLUMN IF EXISTS bank_account_name;

ALTER TABLE public.stores
  DROP COLUMN IF EXISTS payout_method,
  DROP COLUMN IF EXISTS momo_number,
  DROP COLUMN IF EXISTS momo_provider,
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS bank_account_number,
  DROP COLUMN IF EXISTS bank_account_name,
  DROP COLUMN IF EXISTS paystack_subaccount_code;

-- 5. Update RPCs to read from new tables
CREATE OR REPLACE FUNCTION public.get_my_momo()
 RETURNS TABLE(payout_method text, momo_number text, momo_provider text, bank_name text, bank_account_number text, bank_account_name text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT payout_method, momo_number, momo_provider,
         bank_name, bank_account_number, bank_account_name
  FROM public.user_payout_details
  WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_my_store_payout(_store_id uuid)
 RETURNS TABLE(payout_method text, momo_number text, momo_provider text, bank_name text, bank_account_number text, bank_account_name text, paystack_subaccount_code text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.payout_method, p.momo_number, p.momo_provider,
         p.bank_name, p.bank_account_number, p.bank_account_name,
         p.paystack_subaccount_code
  FROM public.store_payout_details p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.store_id = _store_id
    AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
$function$;

-- 6. New lock trigger for payout tables
CREATE OR REPLACE FUNCTION public.lock_payout_details_row()
 RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
$function$;

CREATE TRIGGER lock_user_payout_details
  BEFORE UPDATE ON public.user_payout_details
  FOR EACH ROW EXECUTE FUNCTION public.lock_payout_details_row();

CREATE TRIGGER lock_store_payout_details
  BEFORE UPDATE ON public.store_payout_details
  FOR EACH ROW EXECUTE FUNCTION public.lock_payout_details_row();

-- 7. Tighten profiles cross-user SELECT: drop broad policy, expose public-safe view
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = off) AS
SELECT user_id, full_name, avatar_url, is_online
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 8. Add RPC for order participants to fetch each other's contact info
CREATE OR REPLACE FUNCTION public.get_order_contact(_order_id uuid)
 RETURNS TABLE(buyer_name text, buyer_phone text, courier_name text, courier_phone text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _buyer uuid;
  _store uuid;
  _courier uuid;
BEGIN
  SELECT o.buyer_id, o.store_id, o.delivery_person_id
    INTO _buyer, _store, _courier
    FROM public.orders o WHERE o.id = _order_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF NOT (auth.uid() = _buyer
          OR auth.uid() = _courier
          OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store AND s.user_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role))
  THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    (SELECT full_name FROM public.profiles WHERE user_id = _buyer),
    (SELECT phone     FROM public.profiles WHERE user_id = _buyer),
    (SELECT full_name FROM public.profiles WHERE user_id = _courier),
    (SELECT phone     FROM public.profiles WHERE user_id = _courier);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_order_contact(uuid) TO authenticated;
