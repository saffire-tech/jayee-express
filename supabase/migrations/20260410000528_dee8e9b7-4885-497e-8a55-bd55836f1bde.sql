-- Create wallets table
CREATE TABLE public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

-- No insert/update/delete policies for regular users - only service role modifies wallets

-- Create wallet_transactions table
CREATE TABLE public.wallet_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL, -- 'credit' or 'debit'
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text NOT NULL,
  reference_id uuid, -- optional link to order_id
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Create withdrawal_requests table
CREATE TABLE public.withdrawal_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  momo_number text NOT NULL,
  momo_provider text NOT NULL,
  paystack_transfer_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create withdrawal requests"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add cancelled_at to orders
ALTER TABLE public.orders ADD COLUMN cancelled_at timestamp with time zone;

-- Create atomic wallet balance function
CREATE OR REPLACE FUNCTION public.update_wallet_balance(
  _user_id uuid,
  _amount numeric,
  _type text,
  _description text,
  _reference_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _new_balance numeric;
BEGIN
  -- Upsert wallet
  INSERT INTO wallets (user_id, balance) VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update balance
  UPDATE wallets SET balance = balance +
    CASE WHEN _type = 'credit' THEN _amount ELSE -_amount END,
    updated_at = now()
  WHERE user_id = _user_id
  RETURNING balance INTO _new_balance;

  -- Prevent negative balance for debits
  IF _new_balance < 0 AND _type = 'debit' THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  -- Log transaction
  INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, reference_id)
  VALUES (_user_id, _type, _amount, _new_balance, _description, _reference_id);

  RETURN _new_balance;
END;
$$;

-- Add updated_at trigger for wallets
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();