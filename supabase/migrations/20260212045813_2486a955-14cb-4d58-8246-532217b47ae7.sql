-- Update the RLS policy to use 'completed' instead of 'delivered' for status
DROP POLICY IF EXISTS "Buyers can confirm delivery receipt" ON public.orders;

CREATE POLICY "Buyers can confirm delivery receipt"
ON public.orders
FOR UPDATE
USING (
  auth.uid() = buyer_id
  AND delivery_status = 'delivered'
)
WITH CHECK (
  auth.uid() = buyer_id
  AND delivery_status = 'confirmed'
  AND status = 'completed'
);