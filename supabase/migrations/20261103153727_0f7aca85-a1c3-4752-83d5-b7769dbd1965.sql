CREATE OR REPLACE FUNCTION public.prevent_completed_order_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Completed orders are locked and cannot change status';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS lock_completed_order_status ON public.orders;
CREATE TRIGGER lock_completed_order_status BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.prevent_completed_order_status_change();