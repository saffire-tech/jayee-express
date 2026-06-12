## Goal

Subscription payments (store + rider monthly fees) land in the platform's main Paystack balance, not in user wallets. Right now there's no admin UI to see that balance or move it out. This plan adds a Finance page where admins can:

1. See total subscription revenue earned (all-time + this month).
2. See the current withdrawable Paystack balance.
3. Withdraw to an admin payout account (MoMo or bank) via Paystack Transfer.
4. See a history of admin withdrawals.

## What already exists

- `store_subscriptions` and `delivery_subscriptions` tables record each paid subscription with amount + paystack reference.
- `paystack-webhook` already credits these on `type: subscription / rider_subscription / store_subscription`.
- Paystack Transfer API is already used in `request-withdrawal` for user MoMo payouts — same pattern reused here.

## What to build

### 1. Database (one migration)

- `platform_payouts` table: id, admin_user_id, amount, recipient_type (momo/bank), recipient_details (jsonb), paystack_transfer_code, paystack_recipient_code, status (pending/success/failed/reversed), failure_reason, created_at, updated_at. RLS: admins only.
- `platform_payout_accounts` table: id, label, type (momo/bank), account_number, bank_code, account_name, paystack_recipient_code, is_default, created_by, created_at. RLS: admins only. Lets admin save one or more payout destinations.
- View / RPC `platform_revenue_summary()` (SECURITY DEFINER, admin-only) returning:
  - `total_subscription_revenue` = SUM(amount) from `store_subscriptions` + `delivery_subscriptions` where status='active' or paid
  - `revenue_this_month`
  - `total_withdrawn` = SUM(`platform_payouts`.amount where status='success')
  - `net_earned` = total_subscription_revenue − total_withdrawn

### 2. Edge functions

- `get-platform-balance` (admin-only): calls Paystack `GET /balance`, returns available + pending in NGN/GHS. Also returns the revenue summary from the RPC above.
- `create-platform-payout-recipient` (admin-only): given MoMo number/provider or bank account, calls Paystack `POST /transferrecipient`, stores the returned `recipient_code` in `platform_payout_accounts`.
- `admin-withdraw` (admin-only): input `{ amount, account_id }`. Validates admin role, checks amount ≤ Paystack available balance, calls Paystack `POST /transfer` with the saved recipient code, inserts a `platform_payouts` row (status=pending), returns transfer reference.
- Extend `paystack-webhook` to handle `transfer.success` / `transfer.failed` / `transfer.reversed` events targeting a `platform_payouts.paystack_transfer_code` and update status accordingly. (User withdrawals already use a different flow; we'll branch on whether the transfer code matches `withdrawal_requests` or `platform_payouts`.)

### 3. Admin UI

- New page `src/pages/admin/Finance.tsx` at route `/admin/finance` with three cards:
  - **Subscription Revenue** — all-time, this month, net after withdrawals.
  - **Paystack Available Balance** — live from `get-platform-balance`, with a "Withdraw" button.
  - **Payout Accounts** — list + "Add account" dialog (MoMo number+provider or bank+account).
- Withdraw dialog: pick saved account, enter amount (capped at available balance), confirm.
- **Withdrawal History** table: date, amount, account, status, Paystack reference.
- Add `Finance` entry to `AdminSidebar` (icon: `Wallet`).

### 4. Security

- All new functions check `has_role(auth.uid(), 'admin')` server-side (dual-client pattern).
- RLS on both new tables: only admins can select/insert; service_role full access.
- Amount validation: positive, ≤ Paystack available balance, ≤ remaining net revenue (defense-in-depth so admin can't withdraw user wallet float).

## Out of scope

- Automatic recurring payouts (admin triggers manually).
- Splitting revenue across multiple admins.
- Per-subscription commission reporting (already covered by existing tables; this just sums them).

## Files

- New: migration, `supabase/functions/get-platform-balance/`, `create-platform-payout-recipient/`, `admin-withdraw/`, `src/pages/admin/Finance.tsx`.
- Edited: `supabase/functions/paystack-webhook/index.ts`, `src/components/admin/AdminSidebar.tsx`, `src/App.tsx`.
