## Goal
Make sure that for every checkout one of two outcomes is guaranteed:
- Payment succeeds → buyer gets their order(s), seller's wallet is credited, cart is cleared (exactly once).
- Payment fails/abandoned → buyer is NOT charged for an order they don't receive, cart stays intact, and they can safely retry without double-paying.

No silent failures, no double orders, no "money taken but no order".

## Problems in the current flow
1. `initialize-payment` calls Paystack but never records the attempt locally — if the user pays and the webhook is missed and they don't return to `/purchases?payment=success`, the order is never created even though money was taken.
2. Order creation happens in two places (`paystack-webhook` and `verify-payment`) with only a "row-exists" idempotency check. A race between webhook + return-redirect can briefly create duplicate per-store orders because the existence check isn't atomic.
3. Cart is cleared inside the order loop after first successful insert — a partial failure leaves orders for some stores but an emptied cart with no way to retry the rest.
4. No persisted record of failed/abandoned Paystack attempts, so support has nothing to reconcile against.
5. Buyer-side: on payment failure the user gets a generic toast but no clear "you were not charged" message; on success the page only verifies once and never retries if the network blip hits.
6. Wallet credit and order insert are sequential network calls — if the wallet RPC errors after the order row exists, the seller never gets credited and there's no retry.

## Plan

### 1. New `payment_attempts` table (audit + idempotency anchor)
Single source of truth for every Paystack reference we generate.

Columns: `id`, `reference` (unique), `buyer_id`, `amount`, `currency`, `metadata` (jsonb — the same payload we send to Paystack so we can rebuild orders from it), `status` (`initialized` | `success` | `failed` | `abandoned` | `reconciled`), `paystack_status`, `verified_at`, `orders_created_at`, `last_error`, `created_at`, `updated_at`.

RLS: buyer can read their own rows; admins read all; only service role writes.

This is what lets us reconcile: every Paystack reference we ever created is in this table, regardless of whether the user came back.

### 2. `initialize-payment` — record before redirect
Insert a `payment_attempts` row with `status='initialized'` and the full cart/delivery payload BEFORE returning the Paystack URL. If Paystack init fails, mark it `failed`. The metadata stored here is the authoritative input for order creation (we already re-price from DB, keep doing that on verify).

### 3. Unify order creation in one idempotent function
Extract the shared order-creation logic into one helper used by both `paystack-webhook` and `verify-payment`. Make it atomic per reference:

- Acquire a Postgres advisory lock keyed on the reference (`pg_advisory_xact_lock(hashtext(reference))`) inside a SECURITY DEFINER RPC `finalize_order_payment(_reference, _metadata, _amount)` that:
  1. Locks on reference.
  2. Re-checks `payment_attempts.orders_created_at` — if set, return early.
  3. Re-prices items from DB (no client-trust).
  4. Inserts orders + order_items + wallet credit + seller notifications.
  5. Sets `payment_attempts.status='success'`, `orders_created_at=now()`.
  6. Clears `cart_items` for the buyer ONLY after every store's order row + wallet credit succeeded.
  All in one transaction → either everything commits or nothing does. No partial states, no race between webhook and verify.

Both `paystack-webhook` (server-to-server, signed) and `verify-payment` (called from buyer return URL) call this same RPC after verifying the Paystack transaction status is `success`. Whichever fires first wins, the other is a no-op.

### 4. Robust client return flow (`/purchases?payment=success`/`?payment=failed`)
- On `?payment=success&reference=...`, call `verify-payment` with **retry + backoff** (e.g. 3 attempts: 0s, 2s, 5s) since the webhook race can briefly say "not yet". Show a "Confirming your payment…" state.
- On `?payment=failed` (or Paystack returns a non-success status), show a clear panel: "Payment was not completed. You were not charged. Your cart is still here — try again or use a different method." Link back to cart. Mark the attempt `failed` via `verify-payment`.
- On unknown/timeout after retries, show: "Payment is still processing. We'll email you when it confirms — your cart is preserved." (don't clear cart on the client; only the server clears it on real success).

### 5. Cart safety
- Remove the client-side `clearCart()` we'd be tempted to call after redirect — server-only via the RPC above.
- If the user lands back on the cart with items intact and a recent `initialized` attempt exists, show a small banner: "We're still confirming your last payment. Please wait a moment before retrying."

### 6. Reconciliation tools
- New edge function `reconcile-payments` (admin-triggered, also runnable via cron): scans `payment_attempts` where `status='initialized'` and `created_at < now() - 10 min`, calls Paystack `/transaction/verify` for each, and either finalizes (calls the same RPC) or marks `failed`/`abandoned`. This catches every webhook miss automatically.
- New admin page `/admin/payments` (Pending / Failed / Reconciled tabs): list of stuck attempts, per-row "Verify now" button, link to Paystack reference, ability to mark `reconciled` after manual handling. Buyer name, amount, age, last error.

### 7. Wallet credit hardening
Move the seller wallet credit inside the `finalize_order_payment` transaction so it's atomic with the order insert. Keep the existing `wallet_transactions (user_id, reference_id, type, description)` idempotency guard as a belt-and-suspenders.

### 8. User-facing notifications on failure
When `payment_attempts` transitions to `failed`/`abandoned` via reconciliation, insert a notification for the buyer ("Your payment for cart attempt #xxxx did not go through. You were not charged.") so they know it's safe to retry.

## Out of scope
- Splitting payouts (manual payouts stay as-is per project memory).
- Refund automation for already-paid orders (existing cancel flow stays).
- Switching payment provider.

## Technical details (engineering reference)
- Table: `public.payment_attempts` + GRANTs + RLS (buyer self-read, admin read, service role write).
- RPC: `public.finalize_order_payment(_reference text, _payload jsonb)` SECURITY DEFINER, advisory lock, returns `jsonb { orders_created boolean, order_ids uuid[] }`.
- Edge functions touched: `initialize-payment` (insert attempt row), `verify-payment` (retry-safe call to RPC, update attempt status), `paystack-webhook` (call RPC on `charge.success`, also handle `charge.failed` → mark attempt failed), new `reconcile-payments`.
- Frontend touched: `src/pages/Cart.tsx` (pending-attempt banner), `src/pages/PurchaseHistory.tsx` (success-confirming + failure panel + retry-with-backoff), new `src/pages/admin/PaymentsReconciliation.tsx` + sidebar link.
- Config: `supabase/config.toml` adds `[functions.reconcile-payments] verify_jwt = false` (admin check inside).
