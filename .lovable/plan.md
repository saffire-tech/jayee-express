

# Wallet System & Payment Architecture Overhaul

## Summary
Replace the current instant-payout model with a platform-held wallet system. All payments stay on the platform until users request withdrawals. Add wallets for sellers and delivery persons, order cancellation with 15-minute refund window, and transaction logs.

---

## What Changes

### 1. Database: New Tables & Columns

**New `wallets` table**
- `id`, `user_id` (unique), `balance` (numeric, default 0), `created_at`, `updated_at`
- RLS: users can read their own wallet; service role handles balance changes

**New `wallet_transactions` table**
- `id`, `user_id`, `type` (credit/debit), `amount`, `balance_after`, `description`, `reference_id` (nullable, links to order_id), `created_at`
- RLS: users can read their own transactions

**New `withdrawal_requests` table**
- `id`, `user_id`, `amount`, `status` (pending/processing/completed/failed), `momo_number`, `momo_provider`, `paystack_transfer_code` (nullable), `created_at`, `processed_at`
- RLS: users can create and read their own requests

**Modify `orders` table**
- Add `cancelled_at` (timestamptz, nullable) — records when cancellation happened for refund eligibility

### 2. Remove Instant Payouts — Rework Payment Flow

**`initialize-payment`**: Remove the Paystack split/subaccount logic entirely. All money goes to the platform account. No subaccounts needed at checkout.

**`paystack-webhook` & `verify-payment`**: After creating orders, credit the seller's wallet with their share (total minus commission). If delivery order, the delivery fee stays in a "pending" state until delivery is confirmed. Also create wallet_transaction records.

**`payout-delivery`**: Instead of sending MoMo transfer immediately, credit the delivery person's wallet balance and log a wallet transaction. Remove the Paystack Transfer API call from this function.

**`create-subaccount`**: Repurpose to just save MoMo details to the user's profile/store for withdrawal purposes. Remove Paystack subaccount creation (or keep it optional for future use but don't use it at checkout).

### 3. New Edge Function: `request-withdrawal`
- Authenticated user requests withdrawal of amount from their wallet
- Validates balance >= amount
- Creates a `withdrawal_requests` record with status "pending"
- Reads MoMo details from `profiles` (delivery) or `stores` (seller)
- Initiates Paystack Transfer API to send money
- On success: debit wallet, log transaction, update withdrawal status
- On failure: mark withdrawal as failed, don't debit

### 4. New Edge Function: `cancel-order-refund`
- Buyer calls this to cancel an order
- Validates: order is "pending", created_at is within 15 minutes
- Cancels the order (status = "cancelled", cancelled_at = now)
- Reverses the seller's wallet credit (debit seller wallet, log transaction)
- Initiates Paystack refund via `POST /refund` API for the buyer's payment
- Notifies seller and buyer

### 5. Delivery Person MoMo Setup
- Add MoMo fields to `profiles` table (already exists: `momo_number`, `momo_provider`)
- No Paystack subaccount needed — just save MoMo details for withdrawals

### 6. UI: Wallet Components

**Seller Dashboard — new "Wallet" tab**
- Shows current balance (from `wallets` table)
- "Request Withdrawal" button with amount input
- Transaction history table (credits from sales, debits from withdrawals, debits from refunds)

**Delivery Dashboard — new "Wallet" tab**
- Same as seller: balance display, withdrawal button, transaction log

**Both dashboards**: MoMo setup section remains for withdrawal destination

### 7. Buyer Cancellation UI Update
- In PurchaseHistory, the cancel button should only appear for orders within 15 minutes of creation
- Show countdown timer: "Cancel within X minutes for a full refund"
- After 15 minutes, cancel button disappears or shows "Contact support"
- On cancel, call `cancel-order-refund` edge function

---

## Technical Details

**Wallet balance integrity**: All wallet balance changes happen in edge functions using service role. A database function `update_wallet_balance(user_id, amount, type, description, reference_id)` will atomically update the balance and insert a transaction log in a single SQL transaction to prevent race conditions.

**Database function for atomic wallet ops**:
```sql
CREATE FUNCTION update_wallet_balance(
  _user_id uuid, _amount numeric, _type text, 
  _description text, _reference_id uuid DEFAULT NULL
) RETURNS numeric AS $$
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
  
  -- Log transaction
  INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, reference_id)
  VALUES (_user_id, _type, _amount, _new_balance, _description, _reference_id);
  
  RETURN _new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Files to create**:
- `src/components/wallet/WalletCard.tsx` — balance display + withdraw button
- `src/components/wallet/TransactionHistory.tsx` — credit/debit log table
- `src/components/wallet/WithdrawDialog.tsx` — withdrawal amount form
- `supabase/functions/request-withdrawal/index.ts`
- `supabase/functions/cancel-order-refund/index.ts`

**Files to modify**:
- `supabase/functions/initialize-payment/index.ts` — remove split/subaccount logic
- `supabase/functions/paystack-webhook/index.ts` — add wallet crediting
- `supabase/functions/verify-payment/index.ts` — add wallet crediting
- `supabase/functions/payout-delivery/index.ts` — credit wallet instead of MoMo transfer
- `src/pages/SellerDashboard.tsx` — add Wallet tab
- `src/pages/DeliveryDashboard.tsx` — add Wallet tab
- `src/pages/PurchaseHistory.tsx` — 15-minute cancel window + refund logic
- `supabase/config.toml` — register new edge functions

**Migration**: 1 migration for wallets, wallet_transactions, withdrawal_requests tables, cancelled_at column, and the atomic wallet function.

