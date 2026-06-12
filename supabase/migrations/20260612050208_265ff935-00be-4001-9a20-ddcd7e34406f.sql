
-- Rider applications
CREATE TABLE public.rider_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city text,
  full_name text NOT NULL,
  ghana_card_number text NOT NULL,
  ghana_card_url text NOT NULL,
  photo_id_url text NOT NULL,
  house_address text NOT NULL,
  motor_registration text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  monthly_fee numeric,
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rider_apps_user ON public.rider_applications(user_id);
CREATE INDEX idx_rider_apps_status ON public.rider_applications(status);

GRANT SELECT, INSERT, UPDATE ON public.rider_applications TO authenticated;
GRANT ALL ON public.rider_applications TO service_role;

ALTER TABLE public.rider_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants view own applications" ON public.rider_applications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Applicants create own application" ON public.rider_applications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Applicants update own pending application" ON public.rider_applications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins manage applications" ON public.rider_applications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_rider_apps_updated
  BEFORE UPDATE ON public.rider_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Delivery subscriptions
CREATE TABLE public.delivery_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_fee numeric NOT NULL,
  months integer NOT NULL DEFAULT 1 CHECK (months >= 1),
  amount_paid numeric NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','pending_payment')),
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_subs_user ON public.delivery_subscriptions(user_id);
CREATE INDEX idx_delivery_subs_expires ON public.delivery_subscriptions(expires_at);

GRANT SELECT ON public.delivery_subscriptions TO authenticated;
GRANT ALL ON public.delivery_subscriptions TO service_role;

ALTER TABLE public.delivery_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders view own subscriptions" ON public.delivery_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage delivery subscriptions" ON public.delivery_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Helper: active rider subscription
CREATE OR REPLACE FUNCTION public.has_active_rider_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND expires_at > now()
  );
$$;
