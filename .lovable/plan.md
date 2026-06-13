# Centralized Payments & Manual Payouts

All money (purchases + store subs + rider subs) is collected in one Paystack account. Sellers and riders earn into in-app wallets. Withdrawals are reviewed and marked paid manually by an admin from a new **Payouts** tab.

## 1. Payment collection (simplify)

- `initialize-payment`, `initialize-store-subscription`, `initialize-delivery-subscription` keep using Paystack checkout, but **stop sending `subaccount` / `split` data**. Everything lands in the platform's Paystack balance.
- `paystack-webhook` and `verify-payment` no longer touch subaccount routing. They only:
  - Mark orders as `paid` / activate subscriptions.
  - On purchase: credit the seller's wallet with `(item subtotal of that store)` and credit the assigned rider's wallet (if any) with `delivery_fee` once delivery is `confirmed` (existing `payout-delivery` logic stays — still wallet-credit, no Paystack transfer).
- Drop subaccount-on-store requirement: `stores.paystack_subaccount_code` becomes unused (kept in DB for now, just ignored).

## 2. Manual withdrawal flow

- `request-withdrawal` (rewritten): validates wallet balance ≥ amount, inserts a row into `withdrawal_requests` with status `pending`, debits the wallet immediately (held), notifies admins. No Paystack transfer call.
- `withdrawal_requests`: extend with `admin_note`, `reviewed_by`, `paid_at`, `rejection_reason`, `payment_method` (admin can record "MoMo manual"), `payment_reference` (admin-entered confirmation code). Statuses: `pending`, `approved`, `paid`, `rejected`.
- On `rejected`: refund the held amount back to the user's wallet and notify them.
- On `paid`: keep wallet debit, mark `paid_at`, notify user "Payout sent".
- RLS: admins can `SELECT`/`UPDATE` all; user can `SELECT` own + `INSERT` own.

## 3. Admin "Payouts" tab

- New sidebar item `/admin/payouts` (replaces current Finance/Reconciliation payout bits where overlapping). Tabs: **Pending / Approved / Paid / Rejected**.
- Each row shows: requester (name, role badge seller/rider), amount, MoMo number + provider, requested date, current wallet balance.
- Actions per row: **Approve**, **Mark as Paid** (opens dialog for `payment_reference` + note), **Reject** (reason required).
- Bulk export to CSV for a payout batch.

## 4. Remove unused payment pieces

Delete or strip these so only the new flow remains:
- Edge functions: `create-subaccount`, `create-platform-payout-recipient`, `admin-withdraw`, `get-platform-balance`, `reconcile-wallet` (no longer needed — single account, single source of truth).
- Frontend: subaccount setup UI on the store wizard / seller dashboard, "Platform balance" widgets, current Reconciliation page.
- Keep: `WalletCard`, `TransactionHistory`, `WithdrawDialog` (just calls new request flow).

## 5. Technical details

- Migration:
  - `ALTER TABLE withdrawal_requests` add `admin_note`, `reviewed_by uuid`, `paid_at timestamptz`, `rejection_reason text`, `payment_method text`, `payment_reference text`; widen status check to include `approved`, `paid`, `rejected`.
  - Add admin RLS policies on `withdrawal_requests` (select all, update all).
  - Optional: drop `platform_payouts` + `platform_payout_accounts` policies/usages from UI (table can stay).
- Wallet credit on purchase: handled inside `paystack-webhook` + `verify-payment` (idempotent per `order_id` via existing `wallet_transactions.reference_id` check).
- All wallet mutations continue through `update_wallet_balance()` RPC for atomicity.

## 6. Out of scope

- Automatic Paystack transfers (intentionally removed — payouts are manual).
- Currency conversion, multi-currency.
- Changes to commission % (current 5% platform cut on store earnings stays unless you say otherwise).

## Open questions

1. Confirm: keep the **5% platform commission** on seller wallet credits, or move to 0% / different rate?
2. Should riders' delivery fee credit happen at **buyer-confirmed-receipt** (current) or **admin-marked-paid**? Recommended: keep current.
3. Minimum withdrawal amount? (e.g. ₵20)
