
-- Subscription plans
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_products INTEGER NOT NULL,
  price_per_month NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage plans" ON public.subscription_plans
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tg_subscription_plans_updated
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Store subscriptions
CREATE TABLE public.store_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  months INTEGER NOT NULL CHECK (months >= 1),
  amount_paid NUMERIC NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their subscriptions" ON public.store_subscriptions
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage subscriptions" ON public.store_subscriptions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_store_subscriptions_store ON public.store_subscriptions(store_id);

-- Stores additions
ALTER TABLE public.stores
  ADD COLUMN current_plan_id UUID REFERENCES public.subscription_plans(id),
  ADD COLUMN product_limit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN subscription_expires_at TIMESTAMPTZ;

-- Enforce subscription on product insert
CREATE OR REPLACE FUNCTION public.enforce_store_product_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  active_count INTEGER;
BEGIN
  SELECT product_limit, subscription_expires_at INTO s FROM stores WHERE id = NEW.store_id;
  IF s.subscription_expires_at IS NULL OR s.subscription_expires_at < now() THEN
    RAISE EXCEPTION 'No active subscription. Please subscribe to a plan to add products.';
  END IF;
  SELECT count(*) INTO active_count FROM products WHERE store_id = NEW.store_id;
  IF active_count >= s.product_limit THEN
    RAISE EXCEPTION 'Product limit reached (%). Upgrade your plan to list more products.', s.product_limit;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_enforce_store_product_limit
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_store_product_limit();

-- Seed plans
INSERT INTO public.subscription_plans (name, max_products, price_per_month, display_order) VALUES
  ('Starter', 10, 100, 1),
  ('Growth', 30, 250, 2),
  ('Pro', 100, 500, 3);
