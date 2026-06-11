
-- 1. Storage: enforce folder ownership on uploads
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload store images" ON storage.objects;

CREATE POLICY "Users can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload store images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'store-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 2. Hide sensitive payout columns on profiles from client roles
REVOKE SELECT (momo_number, momo_provider) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_momo()
RETURNS TABLE(momo_number text, momo_provider text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT momo_number, momo_provider
  FROM public.profiles
  WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_momo() TO authenticated;

-- 3. Hide sensitive payout columns on stores from client roles
-- (Owners and admins continue to read via the existing get_my_store_payout RPC.)
REVOKE SELECT (momo_number, momo_provider, paystack_subaccount_code)
  ON public.stores FROM anon, authenticated;

-- 4. Prevent delivery couriers from tampering with non-delivery columns
CREATE OR REPLACE FUNCTION public.enforce_delivery_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when the updater is a delivery courier and not an admin,
  -- the buyer, or the store owner.
  IF auth.uid() IS NOT NULL
     AND auth.uid() = NEW.delivery_person_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND auth.uid() <> COALESCE(OLD.buyer_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND NOT EXISTS (
       SELECT 1 FROM public.stores s
       WHERE s.id = OLD.store_id AND s.user_id = auth.uid()
     )
  THEN
    IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
       OR NEW.store_id IS DISTINCT FROM OLD.store_id
       OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
       OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.delivery_payout_status IS DISTINCT FROM OLD.delivery_payout_status
       OR NEW.delivery_type IS DISTINCT FROM OLD.delivery_type
       OR NEW.delivery_address IS DISTINCT FROM OLD.delivery_address
       OR NEW.delivery_landmark IS DISTINCT FROM OLD.delivery_landmark
       OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
       OR NEW.notes IS DISTINCT FROM OLD.notes
    THEN
      RAISE EXCEPTION 'Delivery couriers may only update delivery status fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_delivery_update_columns ON public.orders;
CREATE TRIGGER trg_enforce_delivery_update_columns
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_delivery_update_columns();

-- 5. Realtime: restrict channel access (allow only postgres_changes events; table-level RLS still applies)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive postgres_changes" ON realtime.messages;
CREATE POLICY "Authenticated can receive postgres_changes"
ON realtime.messages
FOR SELECT
TO authenticated
USING (extension = 'postgres_changes');
