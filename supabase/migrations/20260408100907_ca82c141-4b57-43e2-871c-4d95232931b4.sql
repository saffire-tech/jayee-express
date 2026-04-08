
-- Drop the existing insufficient policy
DROP POLICY IF EXISTS "Delivery persons can update their orders" ON orders;

-- Policy 1: Delivery persons can accept unclaimed delivery orders
CREATE POLICY "Delivery persons can accept delivery orders"
ON orders FOR UPDATE TO authenticated
USING (
  delivery_type = 'delivery'
  AND delivery_status = 'pending'
  AND delivery_person_id IS NULL
  AND has_role(auth.uid(), 'delivery'::app_role)
)
WITH CHECK (
  delivery_person_id = auth.uid()
);

-- Policy 2: Delivery persons can update orders they've already accepted
CREATE POLICY "Delivery persons can update their accepted orders"
ON orders FOR UPDATE TO authenticated
USING (auth.uid() = delivery_person_id)
WITH CHECK (auth.uid() = delivery_person_id);

-- Allow delivery persons to view order items for orders they're delivering
CREATE POLICY "Delivery persons can view order items for their deliveries"
ON order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (orders.delivery_person_id = auth.uid() OR (orders.delivery_type = 'delivery' AND orders.delivery_status = 'pending' AND orders.delivery_person_id IS NULL AND has_role(auth.uid(), 'delivery'::app_role)))
  )
);
