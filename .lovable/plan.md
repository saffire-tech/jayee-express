
# Payment Flow — Confirm & Harden Existing Wallet Model

Based on your answers, **the system already does what you described.** No Paystack subaccounts are needed. The work below is small hardening + clearer notifications so there are no unpaid clients or disputes.

## What already works (no change needed)

1. **Subscriptions (store + rider)** → buyer pays Paystack → full amount lands in your main Paystack balance. ✓ (`initialize-store-subscription`, `initialize-delivery-subscription`, `paystack-webhook`)
2. **Product purchases** → buyer pays Paystack → `paystack-webhook` (and `verify-payment` fallback) credits the **seller's in-app wallet** with the full items total and inserts a `notifications` row: *"New Order Received! ₵X from <buyer>."* Seller sees balance in dashboard wallet.
3. **Delivery fee** → held by platform until buyer confirms receipt → then credited to rider's in-app wallet (see `Delivery Fulfillment Lifecycle` memory).
4. **Withdrawals** → seller or rider taps Withdraw in their wallet → `request-withdrawal` debits wallet and uses **Paystack Transfer API** to push MoMo to their saved number. ✓

## Gaps to fix (this is the actual work)

### 1. Refund seller wallet when an order is cancelled after payment
Today: if an order is cancelled in `cancel-order-refund`, the buyer is refunded but the seller's wallet stays credited — creates a phantom balance the seller could withdraw. Fix: when cancelling a paid order, debit the seller's wallet by the items total (and the rider's wallet by the delivery fee if already credited), with a `wallet_transactions` entry "Refund reversal — order #xxx".

### 2. Idempotency on seller wallet credit
Today: webhook and `verify-payment` both credit the seller wallet on the same reference. If both fire (webhook + client fallback) the seller is paid twice. Fix: gate the `update_wallet_balance` call on whether a `wallet_transactions` row with `reference_id = order.id` and `description LIKE 'Sale from order%'` already exists. Same for rider crediting on delivery confirmation.

### 3. Wallet notification clarity
Add the credited amount and order id to the seller notification body so they can reconcile: *"₵X credited to your wallet from order #abcd1234."* Same for rider: *"₵Y delivery fee credited from order #abcd1234."*

### 4. Block withdrawal of un-cleared funds
Optional safety net: only count wallet balance from orders that are `completed` (buyer-confirmed) toward the withdrawable amount. Pending orders stay in wallet but are not withdrawable. This eliminates the biggest dispute risk (seller withdraws, then order is cancelled). Two ways:
- **Strict (recommended):** add `cleared_balance` computed view = credits where `reference_id` joins to a `completed` order, minus debits. `request-withdrawal` checks `cleared_balance` instead of `wallets.balance`.
- **Loose:** keep current behavior, just rely on fix #1 to claw back.

I'll go with **strict** unless you prefer loose.

### 5. Remove the misleading `create-subaccount` name
That edge function only saves MoMo number/provider — it doesn't create a Paystack subaccount. Rename to `save-payout-method` and clean up the wording so it's clear there's no Paystack subaccount being created.

## Files

**Edited:**
- `supabase/functions/paystack-webhook/index.ts` — idempotent seller credit, clearer notification body
- `supabase/functions/verify-payment/index.ts` — same idempotency + notification copy
- `supabase/functions/cancel-order-refund/index.ts` — debit seller (and rider if applicable) on refund
- `supabase/functions/request-withdrawal/index.ts` — check `cleared_balance` (strict option)
- `src/components/wallet/WalletCard.tsx` — show "Available" vs "Pending" balance
- Rename `supabase/functions/create-subaccount/` → `save-payout-method/` (update callers)

**Migration:**
- View `public.wallet_cleared_balance(user_id)` returning numeric, security definer.
- (No table changes.)

## Out of scope
- Real Paystack subaccounts / split payments — explicitly rejected.
- Per-sale platform commission — you confirmed only the monthly subscription is revenue.
- Auto-transfers to rider MoMo on completion — staying with manual wallet withdrawal.
