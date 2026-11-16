-- Only buyers with a paid order containing this product may create or update its review.
-- These policies enforce eligibility even when requests bypass the app UI.
DROP POLICY IF EXISTS "Users can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;

CREATE POLICY "Paid buyers can create reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id = reviews.product_id
      AND o.buyer_id = auth.uid()
      AND o.payment_status = 'paid'
  )
);

CREATE POLICY "Paid buyers can update their own reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id = reviews.product_id
      AND o.buyer_id = auth.uid()
      AND o.payment_status = 'paid'
  )
);
