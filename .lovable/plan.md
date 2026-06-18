## Goal

Make the backend the only source of truth for every money number in the app. The client may suggest inputs (cart contents, delivery destination, withdrawal amount, subscription months), but the server recomputes the price from the database before it is ever charged, credited, debited, or written. A modified client must not be able to change a fee, a balance, a payout, or a subscription length.

## What is already safe (keep as-is)

- **Order item prices** — `initialize-payment` already re-reads `products.price` and ignores client prices, and `finalize_order_payment` re-prices a second time inside the transaction.
- **Subscription pricing** — `initialize-store-subscription`, `initialize-delivery-subscription`, `initialize-subscription` already read `stores.monthly_fee` / `delivery_zones` / `subscription_plans` from the DB and ignore client-sent amounts.
- **Withdrawals** — `request-withdrawal` uses `wallet_cleared_balance` and the locked `payout_method` columns; client amount is only used as a request, never blindly credited.
- **Wallet movements** — only `update_wallet_balance` (SECURITY DEFINER) can change `wallets.balance`; RLS already blocks direct writes.

## Problems to fix

1. **Delivery fee is trusted from the client.** `initialize-payment` reads `deliveryData.deliveryFee` from the request body and uses it for both the Paystack charge and the order row. A modified client can send `deliveryFee: 0` (or negative) and pay nothing for delivery while still getting a courier dispatched.
2. **Delivery coordinates are trusted from the client.** Same payload carries `deliveryLatitude/Longitude`; the server never validates the destination is inside any served zone before charging.
3. **Subscription `monthly_fee` round-trips through Paystack metadata.** `verify-payment` / `paystack-webhook` read `monthly_fee` from the metadata Paystack echoes back instead of re-reading `stores.monthly_fee` at finalize time. The init function set it server-side so this is low risk, but it's not defense-in-depth — fix it.
4. **Order row mutability.** `orders` allows the buyer to update their own row (for cancellation/confirmation). We need to lock the money columns so only DB functions can change `total_amount`, `delivery_fee`, `payment_status`, `payment_reference`, `delivery_payout_status` — the existing `enforce_delivery_update_columns` trigger only covers couriers.
5. **Order insert path.** `orders` currently accepts client inserts under RLS (buyer can insert their own); with finalize-only order creation, direct inserts should be blocked so the only way to create a paid order is through `finalize_order_payment`.
6. **Withdrawal request mutability.** Buyer can insert/update their own `withdrawal_requests` row under RLS. Lock writes to service-role only — the edge function is the sole writer.
7. **Wallet read exposure.** Confirm `wallets` / `wallet_transactions` are read-only to their owner and not insertable/updatable by the client.
8. **Subscription tables.** Confirm `store_subscriptions` and `delivery_subscriptions` are insert-blocked for `authenticated` so only the webhook/verify functions (service role) can create them.

## Plan

### 1. Server-side delivery fee calculation (RPC + edge function update)

Create `public.compute_delivery_fee(_store_ids uuid[], _dest_lat double precision, _dest_lng double precision, _delivery_type text)` SECURITY DEFINER:

- For `pickup` → returns `{ fee: 0, distance_km: 0, ok: true }`.
- For `delivery` → loads the store coordinates, computes the chained route distance (last store → buyer) using Haversine in SQL (same formula the client uses, kept consistent), looks up the matching `delivery_zones` row, returns `{ fee, distance_km, zone_id, ok }`. Returns `ok: false` when distance is outside all zones.

`initialize-payment` is updated to:
- Ignore `deliveryData.deliveryFee` entirely.
- Take only `deliveryType`, `deliveryLatitude`, `deliveryLongitude`, `deliveryAddress`, `deliveryLandmark` from the client.
- Call `compute_delivery_fee` with the distinct store_ids from the cart and the destination coords.
- Reject the request with a clear error if `ok=false`.
- Use the returned `fee` for both the Paystack amount and the payload stored on `payment_attempts`.

`finalize_order_payment` is updated to recompute the fee a second time the same way (defense in depth: even if a stored `payment_attempts.payload` were tampered with, finalize would re-derive the fee from the zones table at commit time).

The client `Cart.tsx` / `DeliveryOption.tsx` keep their preview calculation for UX, but the displayed total is informational only — the server total is what gets charged.

### 2. Re-read subscription fees at finalize time

Update `processSubscription`, `processStoreAdminSubscription`, `processRiderSubscription` in both `verify-payment` and `paystack-webhook` to:
- Re-read `monthly_fee` from `stores` / `delivery_zones` / `subscription_plans` using the `store_id` / `plan_id` from metadata.
- Use that DB value (not metadata) when writing `amount_paid`, `monthly_fee`, and expiry math.
- Keep `months` from metadata but clamp to `1..12` server-side (already done in init, repeat in finalize).

### 3. Lock the money columns on `orders` (DB trigger)

Add a trigger `enforce_order_money_immutable` that blocks `UPDATE` on `total_amount`, `delivery_fee`, `payment_status`, `payment_reference`, `delivery_payout_status`, `buyer_id`, `store_id` whenever the executor is not the service role. Buyers and sellers can still update `status`, `notes`, `cancelled_at`, delivery tracking fields as today.

### 4. Block direct INSERTs into `orders`

Drop the existing "buyers can insert own orders" policy (if present). After this, the only path to create a paid order is the SECURITY DEFINER `finalize_order_payment` RPC. Confirm `order_items` insert policy is similarly restricted (service role only).

### 5. Lock `withdrawal_requests` to service-role writes

Drop any buyer-side INSERT/UPDATE policies, keep buyer SELECT (so they can see their own requests). All mutations flow through `request-withdrawal` and admin payout edge functions, which use the service role.

### 6. Lock subscription tables to service-role writes

Confirm and (if missing) enforce that `store_subscriptions`, `delivery_subscriptions`, and `payment_attempts` reject client `INSERT/UPDATE/DELETE`. Buyers/sellers can SELECT their own rows; admins SELECT all; service role does everything.

### 7. Audit pass (read-only, then close findings)

After the migration runs:
- Run `supabase--linter` and resolve any new findings on the touched tables.
- Spot-check `wallets`, `wallet_transactions`, `platform_payouts`, `reconciliation_runs`, `reconciliation_issues` policies — these already look service-role-only, just confirm.
- Confirm no other edge function trusts a client-sent money field by grepping for the patterns `req.json()` + `amount`, `fee`, `price`.

## Out of scope

- Switching distance calc to a routing API (we keep Haversine for parity with the existing client preview; can revisit later).
- Refactoring the existing successful subscription / payment flows beyond the trust-the-DB fixes above.
- Frontend visual changes — the cart/checkout UI continues to show the same preview; only the trust boundary moves.

## Technical reference

- New RPC: `public.compute_delivery_fee(_store_ids uuid[], _dest_lat double precision, _dest_lng double precision, _delivery_type text) RETURNS jsonb` (SECURITY DEFINER, search_path=public).
- New trigger: `enforce_order_money_immutable` BEFORE UPDATE ON `public.orders` — raises when restricted columns change and `auth.role() <> 'service_role'`.
- Migration also: drop buyer INSERT policy on `orders` + `order_items`; drop buyer INSERT/UPDATE policies on `withdrawal_requests`; ensure `store_subscriptions` / `delivery_subscriptions` / `payment_attempts` only allow service-role writes.
- Edge function edits: `initialize-payment` (ignore client fee, call RPC), `verify-payment` + `paystack-webhook` (re-read subscription fees from DB), `finalize_order_payment` (recompute fee inside the transaction).
- No frontend logic changes required beyond removing the `deliveryFee` field from the body posted to `initialize-payment` (or just leave it — server ignores it).
