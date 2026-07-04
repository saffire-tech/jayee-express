
-- Remove duplicate reviews, keep the most recent per (user_id, product_id)
DELETE FROM public.reviews r
USING public.reviews r2
WHERE r.user_id = r2.user_id
  AND r.product_id = r2.product_id
  AND r.created_at < r2.created_at;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_user_product_unique UNIQUE (user_id, product_id);
