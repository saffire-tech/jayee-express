
-- ============================================================
-- 1. Server-side delivery fee calculator
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_delivery_fee(
  _store_ids uuid[],
  _dest_lat double precision,
  _dest_lng double precision,
  _delivery_type text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _store RECORD;
  _stores RECORD;
  _coords double precision[][];
  _ordered double precision[][];
  _i int;
  _j int;
  _nearest_idx int;
  _nearest_dist double precision;
  _d double precision;
  _total_dist double precision := 0;
  _curr_lat double precision;
  _curr_lng double precision;
  _zone RECORD;
  _fee numeric;
BEGIN
  IF _delivery_type IS DISTINCT FROM 'delivery' THEN
    RETURN jsonb_build_object('ok', true, 'fee', 0, 'distance_km', 0);
  END IF;

  IF _dest_lat IS NULL OR _dest_lng IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_destination');
  END IF;

  IF _store_ids IS NULL OR array_length(_store_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_stores');
  END IF;

  -- Collect store coordinates (must all have valid coords)
  _coords := ARRAY[]::double precision[][];
  FOR _store IN
    SELECT id, latitude, longitude FROM public.stores WHERE id = ANY(_store_ids)
  LOOP
    IF _store.latitude IS NULL OR _store.longitude IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'store_missing_coords');
    END IF;
    _coords := _coords || ARRAY[ARRAY[_store.latitude, _store.longitude]];
  END LOOP;

  IF array_length(_coords, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_stores');
  END IF;

  -- Nearest-neighbour ordering from first store, mirroring client logic
  _ordered := ARRAY[_coords[1:1]]::double precision[][];
  -- Re-implement using a working array
  DECLARE
    _work double precision[][];
    _picked boolean[];
    _n int;
  BEGIN
    _n := array_length(_coords, 1);
    _work := _coords;
    _picked := array_fill(false, ARRAY[_n]);
    _picked[1] := true;
    _curr_lat := _work[1][1];
    _curr_lng := _work[1][2];

    FOR _i IN 2.._n LOOP
      _nearest_idx := 0;
      _nearest_dist := 'infinity'::double precision;
      FOR _j IN 1.._n LOOP
        IF NOT _picked[_j] THEN
          -- Haversine
          _d := 2 * 6371 * asin(sqrt(
            power(sin(radians((_work[_j][1] - _curr_lat) / 2)), 2)
            + cos(radians(_curr_lat)) * cos(radians(_work[_j][1]))
              * power(sin(radians((_work[_j][2] - _curr_lng) / 2)), 2)
          ));
          IF _d < _nearest_dist THEN
            _nearest_dist := _d;
            _nearest_idx := _j;
          END IF;
        END IF;
      END LOOP;
      _picked[_nearest_idx] := true;
      _total_dist := _total_dist + _nearest_dist;
      _curr_lat := _work[_nearest_idx][1];
      _curr_lng := _work[_nearest_idx][2];
    END LOOP;

    -- Last store -> buyer
    _d := 2 * 6371 * asin(sqrt(
      power(sin(radians((_dest_lat - _curr_lat) / 2)), 2)
      + cos(radians(_curr_lat)) * cos(radians(_dest_lat))
        * power(sin(radians((_dest_lng - _curr_lng) / 2)), 2)
    ));
    _total_dist := _total_dist + _d;
  END;

  SELECT * INTO _zone
  FROM public.delivery_zones
  WHERE _total_dist >= min_distance_km
    AND _total_dist < max_distance_km
  ORDER BY min_distance_km ASC
  LIMIT 1;

  IF _zone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'out_of_zone', 'distance_km', _total_dist);
  END IF;

  _fee := _zone.fee;
  RETURN jsonb_build_object(
    'ok', true,
    'fee', _fee,
    'distance_km', _total_dist,
    'zone_id', _zone.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_delivery_fee(uuid[], double precision, double precision, text) TO authenticated, service_role;

-- ============================================================
-- 2. Lock money columns on orders (BEFORE UPDATE trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_order_money_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role (edge functions / RPCs) may rewrite anything.
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
     OR NEW.delivery_payout_status IS DISTINCT FROM OLD.delivery_payout_status
     OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.store_id IS DISTINCT FROM OLD.store_id
  THEN
    RAISE EXCEPTION 'Money/identity columns on orders are read-only from the client';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_money_immutable ON public.orders;
CREATE TRIGGER trg_enforce_order_money_immutable
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_money_immutable();

-- ============================================================
-- 3. Remove client-side INSERT paths
--    Orders + order_items now created only by finalize_order_payment (service role)
-- ============================================================
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create order items" ON public.order_items;

-- ============================================================
-- 4. Lock withdrawal_requests writes to service role
-- ============================================================
DROP POLICY IF EXISTS "Users can create withdrawal requests" ON public.withdrawal_requests;
-- (No buyer UPDATE policy existed; admin policies retained.)

-- ============================================================
-- 5. Lock subscription tables (no client INSERT/UPDATE/DELETE; SELECT preserved)
-- ============================================================
-- store_subscriptions and delivery_subscriptions only have admin manage + owner SELECT
-- already, so no extra changes required. Confirm payment_attempts has no write policy
-- for clients (it only has the buyer SELECT). Leave as-is.

-- Ensure service_role retains full access on all touched tables.
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;
GRANT ALL ON public.withdrawal_requests TO service_role;
GRANT ALL ON public.store_subscriptions TO service_role;
GRANT ALL ON public.delivery_subscriptions TO service_role;
GRANT ALL ON public.payment_attempts TO service_role;

-- ============================================================
-- 6. Update finalize_order_payment to recompute delivery fee server-side
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_order_payment(_reference text, _amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  _all_store_ids uuid[];
  _fee_res jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_reference));

  SELECT * INTO _attempt FROM public.payment_attempts WHERE reference = _reference FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown payment reference %', _reference;
  END IF;

  IF _attempt.orders_created_at IS NOT NULL THEN
    RETURN jsonb_build_object('orders_created', false, 'already', true);
  END IF;

  _payload := _attempt.payload;
  _buyer_id := _attempt.buyer_id;
  _store_groups := _payload->'store_groups';
  _delivery_type := COALESCE(_payload->>'delivery_type', 'pickup');
  _delivery_lat := NULLIF(_payload->>'delivery_latitude','')::double precision;
  _delivery_lng := NULLIF(_payload->>'delivery_longitude','')::double precision;
  _delivery_address := _payload->>'delivery_address';
  _delivery_landmark := _payload->>'delivery_landmark';

  IF _store_groups IS NULL OR jsonb_array_length(_store_groups) = 0 THEN
    RAISE EXCEPTION 'No store_groups in payload for %', _reference;
  END IF;

  -- Recompute delivery fee from DB (defense in depth)
  SELECT array_agg((g->>'store_id')::uuid)
    INTO _all_store_ids
    FROM jsonb_array_elements(_store_groups) g;

  _fee_res := public.compute_delivery_fee(_all_store_ids, _delivery_lat, _delivery_lng, _delivery_type);
  IF NOT COALESCE((_fee_res->>'ok')::boolean, false) THEN
    RAISE EXCEPTION 'Delivery fee could not be computed at finalize time: %', _fee_res->>'reason';
  END IF;
  _delivery_fee := COALESCE((_fee_res->>'fee')::numeric, 0);

  SELECT full_name INTO _buyer_name FROM public.profiles WHERE user_id = _buyer_id;

  FOR _group IN SELECT * FROM jsonb_array_elements(_store_groups)
  LOOP
    _store_id := (_group->>'store_id')::uuid;
    _order_fee := CASE WHEN _idx = 0 THEN _delivery_fee ELSE 0 END;
    _items_total := 0;

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

    FOR _item IN SELECT * FROM jsonb_array_elements(_group->'items')
    LOOP
      SELECT price INTO _product_price FROM public.products WHERE id = (_item->>'product_id')::uuid;
      _qty := GREATEST(COALESCE((_item->>'quantity')::int, 1), 1);
      INSERT INTO public.order_items (order_id, product_id, quantity, price)
      VALUES (_order_id, (_item->>'product_id')::uuid, _qty, _product_price);
    END LOOP;

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

  DELETE FROM public.cart_items WHERE user_id = _buyer_id;

  UPDATE public.payment_attempts
     SET status = 'success',
         paystack_status = 'success',
         verified_at = now(),
         orders_created_at = now(),
         last_error = NULL
   WHERE reference = _reference;

  RETURN jsonb_build_object('orders_created', true, 'order_ids', to_jsonb(_created_order_ids));
END;
$function$;
