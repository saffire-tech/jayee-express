
-- Allow delivery persons to view delivery orders that are pending (available) or assigned to them
CREATE POLICY "Delivery persons can view delivery orders"
ON public.orders
FOR SELECT
USING (
  (
    delivery_type = 'delivery'
    AND delivery_status = 'pending'
    AND delivery_person_id IS NULL
    AND has_role(auth.uid(), 'delivery'::app_role)
  )
  OR
  (
    delivery_person_id = auth.uid()
  )
);
