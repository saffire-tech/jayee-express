-- Allow buyers to confirm delivery receipt
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
  AND status = 'delivered'
);