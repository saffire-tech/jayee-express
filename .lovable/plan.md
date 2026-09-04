# Switch payments from Paystack to Moolre

Replace Paystack with Moolre across checkout, store subscriptions and rider subscriptions. Paystack is removed completely; reconciliation becomes Moolre-only.

## What stays exactly the same

The money logic does not change. Orders are still created by the `finalize_order_payment` database routine with its advisory lock, so a payment can never create duplicate orders. Prices, delivery fees and commissions are still recalculated on the server. Wallets, payouts and withdrawals are untouched.

Only the layer that *collects* the money changes.

## Step 1 — Confirm which Moolre flow your account supports

Moolre offers two ways to collect money and your account may only have one enabled:

- **Hosted checkout / payment link** — Moolre returns a URL, buyer pays there, we get a webhook. Closest to the current experience.
- **Direct MoMo (Payin) API** — buyer enters their MoMo number in the app, Moolre pushes an approval prompt to their phone, we poll/receive a webhook. No external page, but no card option.

First implementation step is a small probe against your Moolre account with your keys to see which endpoints respond. The checkout UI is then built for whichever is available, defaulting to hosted checkout if both are.

## Step 2 — Store the Moolre credentials

Your public key, private key and Moolre account/wallet number get saved as backend secrets (`MOOLRE_PUBLIC_KEY`, `MOOLRE_PRIVATE_KEY`, `MOOLRE_ACCOUNT_NUMBER`). They are never exposed to the browser. The old `PAYSTACK_SECRET_KEY` is deleted at the end.

## Step 3 — Backend functions

- `initialize-payment`, `initialize-store-subscription`, `initialize-delivery-subscription` — keep all existing server-side pricing and the `payment_attempts` record, but call Moolre instead of Paystack. We generate our own unique reference (Moolre expects the merchant to supply one) and pass it as the external reference.
- New `moolre-webhook` replaces `paystack-webhook`, verifying Moolre's signature/credential header and running the identical order, store-subscription and rider-subscription handlers.
- `verify-payment` queries Moolre's transaction status endpoint instead of Paystack's; retry/backoff and ownership checks are kept.
- `reconcile-payments` queries Moolre for stale `initialized` attempts.
- `cancel-order-refund` is repointed at Moolre's refund/disbursement path.
- `paystack-webhook` is deleted.

## Step 4 — Frontend checkout

- `src/lib/paystackInline.ts` is replaced by `src/lib/moolreCheckout.ts`.
- **If hosted checkout:** buyer is sent to the Moolre payment page and returns to the same success URLs already used (`/purchases?payment=success`, `/seller?subscription=success`, `/delivery?subscription=success`). Verification on return stays as-is.
- **If direct MoMo:** a payment dialog collects the MoMo number and network, shows "Check your phone and approve the prompt", and polls payment status until success, failure or timeout. Same dialog is reused in Cart, store subscription and rider subscription.
- Callers updated: `src/pages/Cart.tsx`, `src/components/seller/SubscribeDialog.tsx`, `src/components/seller/SubscriptionCard.tsx`, `src/components/delivery/RiderSubscriptionCard.tsx`.
- Copy that says "Paystack" is updated — including the homepage trust strip ("100% secure payments").

## Step 5 — Admin and database

- `payment_attempts.paystack_status` is renamed to `provider_status` (with a `provider` column defaulting to `moolre`); the admin Payments page at `/admin/payments` is updated to match.
- Existing Paystack rows stay in the table for history, but reconciliation no longer tries to verify them. Any Paystack payment still in flight at cutover has to be settled manually.

## Step 6 — Go live

You add the webhook URL for `moolre-webhook` in your Moolre dashboard, then we run a small live test payment end to end (order + subscription) before removing the Paystack secret.

## Technical notes

- Moolre amounts are sent in GHS units, not pesewas — the pesewa conversion in the init functions is removed and the reference/amount comparison in verification adjusted accordingly.
- References become app-generated (`jx_<uuid>`), inserted into `payment_attempts` before the Moolre call, preserving the "record before charge" guarantee.
- Webhook handler stays idempotent via the `orders_created_at` check, so a duplicate webhook delivery is a no-op.
- Currency stays GHS; no changes to commission rates or delivery zones.

## One thing to be aware of

Moolre's MoMo-first flow means card payments may not be available depending on your account tier. If card support matters for buyers, confirm it with Moolre before cutover.
