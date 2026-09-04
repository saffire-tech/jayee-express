ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'moolre',
  ADD COLUMN IF NOT EXISTS payer_number text,
  ADD COLUMN IF NOT EXISTS payer_channel integer;

UPDATE public.payment_attempts SET provider = 'paystack' WHERE created_at < now();

ALTER TABLE public.payment_attempts RENAME COLUMN paystack_status TO provider_status;