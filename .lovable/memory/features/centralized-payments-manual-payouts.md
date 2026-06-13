---
name: Centralized Payments & Manual Payouts
description: All Paystack revenue lands in one platform account; sellers/riders earn into wallets and admins manually approve/mark-paid withdrawals
type: feature
---
All purchases and subscriptions (store + rider) are collected via Paystack into a single platform account — no subaccounts, no splits.

- `initialize-payment`, `initialize-store-subscription`, `initialize-delivery-subscription` initialize Paystack checkout without `subaccount`/`split` params.
- `paystack-webhook` + `verify-payment` create orders, activate subscriptions, and credit the seller's wallet with the item subtotal (idempotent per `order_id`). Delivery fee is credited to the rider's wallet on buyer-confirmed receipt via `payout-delivery`.
- Withdrawals are MANUAL:
  - `request-withdrawal` validates cleared balance, debits (holds) the wallet, inserts a `withdrawal_requests` row with `status='pending'`, and notifies all admins. Minimum: ₵20.
  - `process-payout` edge function exposes admin actions: `approve`, `mark_paid` (requires `payment_method` + `admin_payment_reference`), `reject` (refunds held amount).
  - `withdrawal_requests` columns added: `admin_note`, `reviewed_by`, `paid_at`, `rejection_reason`, `payment_method`, `admin_payment_reference`. Statuses: pending/approved/paid/rejected (legacy: processing/completed/failed still allowed).
- Admin UI: `/admin/payouts` with Pending/Approved/Paid/Rejected tabs, per-row Approve / Mark Paid / Reject actions, CSV export. Replaces the old Finance + Reconciliation pages.
- Removed edge functions: `create-subaccount`, `create-platform-payout-recipient`, `admin-withdraw`, `get-platform-balance`, `reconcile-wallet`.
- `stores.paystack_subaccount_code` is unused but kept in the schema. Seller/rider MoMo details are saved directly on `stores`/`profiles` and used only as the manual-payout destination.
