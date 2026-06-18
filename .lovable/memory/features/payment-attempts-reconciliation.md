---
name: Payment Attempts & Reconciliation
description: Bullet-proof checkout — every Paystack reference is logged and finalized atomically; auto-reconciles missed webhooks
type: feature
---
Every checkout records a `payment_attempts` row (`reference` unique, `payload` jsonb, status: initialized|success|failed|abandoned|reconciled) BEFORE redirecting to Paystack.

Order creation is a single SECURITY DEFINER RPC `finalize_order_payment(_reference, _amount)` that takes a `pg_advisory_xact_lock(hashtext(reference))`, re-prices items from DB, inserts orders + order_items + seller wallet credits + notifications, clears the buyer's cart, and flips the attempt to `success` — all in one transaction. Both `paystack-webhook` (charge.success) and `verify-payment` (return-URL) call it; whichever wins, the other no-ops via `orders_created_at` check.

`verify-payment` retries with backoff (0/2/4s) from the client to absorb the webhook race. On `?payment=failed` shows "you were not charged" message. On failure events, webhook marks attempt failed/abandoned and inserts a buyer notification.

`reconcile-payments` edge function (admin-callable + cron every 5 min) scans `initialized` attempts >10 min old, verifies against Paystack, and finalizes or marks failed. Admin UI at `/admin/payments` with Initialized/Success/Failed/Abandoned tabs and per-row "Verify now".

Cart shows a "payment still confirming" banner and disables checkout while a recent `initialized` attempt exists for the buyer — prevents double-pay.
