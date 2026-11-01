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
  _store_commission numeric;
  _store_net numeric;
  _order_total numeric;
  _order_fee numeric;
  _buyer_name text;
  _idx int := 0;
  _created_order_ids uuid[] := ARRAY[]::uuid[];
  _product_price numeric;
  _product_name text;
  _product_store uuid;
  _product_active boolean;
  _product_category text;
  _qty int;
  _line_gross numeric;
  _line_pct numeric;
  _line_commission numeric;
  _all_store_ids uuid[];
  _fee_res jsonb;
  _variant_id uuid;
  _variant_color text;
  _variant_size text;
  _variant_material text;
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
    _store_commission := 0;

    -- Compute items total + commission
    FOR _item IN SELECT * FROM jsonb_array_elements(_group->'items')
    LOOP
      SELECT price, name, store_id, is_active, category
        INTO _product_price, _product_name, _product_store, _product_active, _product_category
        FROM public.products WHERE id = (_item->>'product_id')::uuid;
      IF _product_price IS NULL OR _product_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Product % unavailable', _item->>'product_id';
      END IF;
      _qty := GREATEST(COALESCE((_item->>'quantity')::int, 1), 1);
      _line_gross := _product_price * _qty;
      _items_total := _items_total + _line_gross;

      SELECT COALESCE(commission_pct, 0) INTO _line_pct
        FROM public.category_commissions WHERE category = _product_category;
      _line_pct := COALESCE(_line_pct, 0);
      _line_commission := round(_line_gross * _line_pct / 100.0, 2);
      _store_commission := _store_commission + _line_commission;
    END LOOP;

    _store_net := GREATEST(_items_total - _store_commission, 0);
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

    -- Insert order_items (with the buyer's chosen variant) and ledger entries
    FOR _item IN SELECT * FROM jsonb_array_elements(_group->'items')
    LOOP
      SELECT price, category INTO _product_price, _product_category
        FROM public.products WHERE id = (_item->>'product_id')::uuid;
      _qty := GREATEST(COALESCE((_item->>'quantity')::int, 1), 1);
      _line_gross := _product_price * _qty;
      SELECT COALESCE(commission_pct, 0) INTO _line_pct
        FROM public.category_commissions WHERE category = _product_category;
      _line_pct := COALESCE(_line_pct, 0);
      _line_commission := round(_line_gross * _line_pct / 100.0, 2);

      -- Snapshot the variant from the database (never from client-typed text)
      _variant_id := NULL;
      _variant_color := NULL;
      _variant_size := NULL;
      _variant_material := NULL;
      IF NULLIF(_item->>'variant_id', '') IS NOT NULL THEN
        SELECT v.id, v.color, v.size, v.material
          INTO _variant_id, _variant_color, _variant_size, _variant_material
          FROM public.product_variants v
         WHERE v.id = (_item->>'variant_id')::uuid
           AND v.product_id = (_item->>'product_id')::uuid;
      END IF;

      INSERT INTO public.order_items (order_id, product_id, quantity, price, variant_id, color, size, material)
      VALUES (_order_id, (_item->>'product_id')::uuid, _qty, _product_price,
              _variant_id, _variant_color, _variant_size, _variant_material);

      INSERT INTO public.platform_commission_ledger
        (order_id, product_id, category, gross_amount, commission_pct, commission_amount)
      VALUES
        (_order_id, (_item->>'product_id')::uuid, _product_category,
         _line_gross, _line_pct, _line_commission);
    END LOOP;

    SELECT user_id, name INTO _store_user_id, _store_name FROM public.stores WHERE id = _store_id;
    IF _store_user_id IS NOT NULL AND _store_net > 0 THEN
      PERFORM public.update_wallet_balance(
        _store_user_id,
        _store_net,
        'credit',
        'Sale from order #' || substr(_order_id::text, 1, 8),
        _order_id
      );

      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        _store_user_id, 'order', 'New Order Received!',
        '₵' || _store_net::text || ' credited to your wallet from order #' || substr(_order_id::text, 1, 8)
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

REVOKE ALL ON FUNCTION public.finalize_order_payment(text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_order_payment(text, numeric) TO service_role;