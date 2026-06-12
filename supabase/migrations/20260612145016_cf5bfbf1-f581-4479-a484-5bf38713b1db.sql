CREATE OR REPLACE FUNCTION public.enforce_store_product_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s RECORD;
BEGIN
  SELECT subscription_expires_at INTO s FROM stores WHERE id = NEW.store_id;
  IF s.subscription_expires_at IS NULL OR s.subscription_expires_at < now() THEN
    RAISE EXCEPTION 'No active subscription. Please subscribe to a plan to add products.';
  END IF;
  RETURN NEW;
END;
$function$;