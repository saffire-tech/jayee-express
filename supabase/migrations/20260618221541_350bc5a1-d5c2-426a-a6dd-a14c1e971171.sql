
-- 1. payment_attempts table
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  buyer_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'GHS',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  kind text NOT NULL DEFAULT 'order', -- order | subscription | rider_subscription | store_subscription
  status text NOT NULL DEFAULT 'initialized', -- initialized | success | failed | abandoned | reconciled
  paystack_status text,
  verified_at timestamptz,
  orders_created_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_attempts TO authenticated;
GRANT ALL ON public.payment_attempts TO service_role;

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers view own payment attempts"
  ON public.payment_attempts FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_payment_attempts_updated
  BEFORE UPDATE ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payment_attempts_status_created
  ON public.payment_attempts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_buyer
  ON public.payment_attempts (buyer_id, created_at DESC);

-- 2. finalize_order_payment RPC: atomic order creation + wallet credit + cart clear
CREATE OR REPLACE FUNCTION public.finalize_order_payment(
  _reference text,
  _amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _attempt RECORD;
  _payload jsonb;
  _buyer_id uuid;
  _store_groups jsonb;
  _delivery_fee numeric;
  _delivery_type text;
  _delivery_lat double precision;
  _delivery_lng double precision;
  _delivery_address text;
  _delivery_landmark text;
  _group jsonb;
  _item jsonb;
  _store_id uuid;
  _store_user_id uuid;
  _store_name text;
  _order_id uuid;
  _items_total numeric;
  _order_total numeric;
  _order_fee numeric;
  _buyer_name text;
  _idx int := 0;
  _created_order_ids uuid[] := ARRAY[]::uuid[];
  _product_price numeric;
  _product_name text;
  _product_store uuid;
  _product_active boolean;
  _qty int;
BEGIN
  -- Serialize concurrent finalizers for the same reference
  PERFORM pg_advisory_xact_lock(hashtext(_reference));

  SELECT * INTO _attempt FROM public.payment_attempts WHERE reference = _reference FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown payment reference %', _reference;
  END IF;

  -- Already finalized? Return success no-op.
  IF _attempt.orders_created_at IS NOT NULL THEN
    RETURN jsonb_build_object('orders_created', false, 'already', true);
  END IF;

  _payload := _attempt.payload;
  _buyer_id := _attempt.buyer_id;
  _store_groups := _payload->'store_groups';
  _delivery_fee := COALESCE((_payload->>'delivery_fee')::numeric, 0);
  _delivery_type := COALESCE(_payload->>'delivery_type', 'pickup');
  _delivery_lat := NULLIF(_payload->>'delivery_latitude','')::double precision;
  _delivery_lng := NULLIF(_payload->>'delivery_longitude','')::double precision;
  _delivery_address := _payload->>'delivery_address';
  _delivery_landmark := _payload->>'delivery_landmark';

  IF _store_groups IS NULL OR jsonb_array_length(_store_groups) = 0 THEN
    RAISE EXCEPTION 'No store_groups in payload for %', _reference;
  END IF;

  SELECT full_name INTO _buyer_name FROM public.profiles WHERE user_id = _buyer_id;

  FOR _group IN SELECT * FROM jsonb_array_elements(_store_groups)
  LOOP
    _store_id := (_group->>'store_id')::uuid;
    _order_fee := CASE WHEN _idx = 0 THEN _delivery_fee ELSE 0 END;
    _items_total := 0;

    -- Re-price items from DB (never trust payload prices)
    FOR _item IN SELECT * FROM jsonb_array_elements(_group->'items')
    LOOP
      SELECT price, name, store_id, is_active
        INTO _product_price, _product_name, _product_store, _product_active
        FROM public.products WHERE id = (_item->>'product_id')::uuid;
      IF _product_price IS NULL OR _product_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Product % unavailable', _item->>'product_id';
      END IF;
      _qty := GREATEST(COALESCE((_item->>'quantity')::int, 1), 1);
      _items_total := _items_total + (_product_price * _qty);
    END LOOP;

    _order_total := _items_total + _order_fee;

    INSERT INTO public.orders (
      buyer_id, store_id, total_amount, status, payment_status, payment_reference,
      delivery_type, delivery_fee, delivery_latitude, delivery_longitude,
      delivery_address, delivery_landmark, delivery_status, delivery_payout_status
    ) VALUES (
      _buyer_id, _store_id, _order_total, 'pending', 'paid', _reference,
      _delivery_type, _order_fee, _delivery_lat, _delivery_lng,
      _delivery_address, _delivery_landmark, NULL,
      CASE WHEN _delivery_type = 'delivery' THEN 'pending' ELSE NULL END
    ) RETURNING id INTO _order_id;

    _created_order_ids := _created_order_ids || _order_id;

    -- Insert order_items
    FOR _item IN SELECT * FROM jsonb_array_elements(_group->'items')
    LOOP
      SELECT price INTO _product_price FROM public.products WHERE id = (_item->>'product_id')::uuid;
      _qty := GREATEST(COALESCE((_item->>'quantity')::int, 1), 1);
      INSERT INTO public.order_items (order_id, product_id, quantity, price)
      VALUES (_order_id, (_item->>'product_id')::uuid, _qty, _product_price);
    END LOOP;

    -- Credit seller wallet
    SELECT user_id, name INTO _store_user_id, _store_name FROM public.stores WHERE id = _store_id;
    IF _store_user_id IS NOT NULL AND _items_total > 0 THEN
      PERFORM public.update_wallet_balance(
        _store_user_id,
        _items_total,
        'credit',
        'Sale from order #' || substr(_order_id::text, 1, 8),
        _order_id
      );

      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        _store_user_id, 'order', 'New Order Received!',
        '₵' || _items_total::text || ' credited to your wallet from order #' || substr(_order_id::text, 1, 8)
          || ' (' || COALESCE(_buyer_name, 'a buyer') || ').',
        jsonb_build_object('order_id', _order_id)
      );
    END IF;

    _idx := _idx + 1;
  END LOOP;

  -- Clear cart only after everything succeeded
  DELETE FROM public.cart_items WHERE user_id = _buyer_id;

  -- Mark attempt complete
  UPDATE public.payment_attempts
     SET status = 'success',
         paystack_status = 'success',
         verified_at = now(),
         orders_created_at = now(),
         last_error = NULL
   WHERE reference = _reference;

  RETURN jsonb_build_object('orders_created', true, 'order_ids', to_jsonb(_created_order_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_order_payment(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_order_payment(text, numeric) TO service_role;
