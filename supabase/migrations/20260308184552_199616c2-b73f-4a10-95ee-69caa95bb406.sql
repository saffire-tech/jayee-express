-- Add MoMo fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS momo_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS momo_provider text;

-- Add MoMo and Paystack fields to stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS momo_number text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS momo_provider text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS paystack_subaccount_code text;

-- Add payment fields to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_payout_status text;

-- Create platform_settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage platform settings
CREATE POLICY "Admins can manage platform settings" ON public.platform_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can read platform settings
CREATE POLICY "Everyone can read platform settings" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (true);

-- Insert default commission
INSERT INTO public.platform_settings (key, value) VALUES ('commission_percentage', '5') ON CONFLICT (key) DO NOTHING;