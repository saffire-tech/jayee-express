# Payout method overhaul + Auth legal links

## 1. Payout details (MoMo OR Bank), locked after first save

### Database (migration)
Add to both `public.profiles` and `public.stores`:
- `payout_method text` — `'momo'` or `'bank'`
- `bank_name text`
- `bank_account_number text`
- `bank_account_name text`

Add a `BEFORE UPDATE` trigger on each table: once `payout_method` is set (not null), block changes to any of the payout columns (`payout_method`, `momo_number`, `momo_provider`, `bank_name`, `bank_account_number`, `bank_account_name`). Admins (`has_role(auth.uid(),'admin')`) bypass the lock so support can correct mistakes.

Regenerate types after migration.

### Seller dashboard (`src/pages/SellerDashboard.tsx`)
Replace the MoMo-only block with a "Payout method" section:
- Radio/Tabs: **Mobile Money** vs **Bank Account**.
- MoMo fields shown when `payout_method='momo'`; bank fields (bank name, account number, account holder name) when `'bank'`.
- If `payout_method` already set, render all fields read-only with a "Locked — contact support to change" note. Save button hidden.
- On save: write `payout_method` + the chosen-side fields in one update.

### Delivery dashboard (`src/pages/DeliveryDashboard.tsx`)
Same UI swap against `profiles`. Same lock behavior after first save.

### Withdrawal flow (`src/components/wallet/WithdrawDialog.tsx`, `supabase/functions/request-withdrawal/index.ts`, `supabase/functions/process-payout/index.ts`)
- Dialog shows destination as either MoMo (number + provider) or Bank (bank + account #).
- `request-withdrawal` reads `payout_method` and validates that the relevant side is filled; rejects if none set. Stores `payment_method` on the withdrawal row accordingly so admins see the right destination at `/admin/payouts`.

## 2. Buyer profile cleanup (`src/pages/Profile.tsx`)
Remove the MoMo card and any payout-info UI from the buyer Profile page entirely (the helper text "Set up your MoMo details to receive delivery payouts and seller payments" goes too). Payout setup lives only in the seller dashboard and the rider/delivery dashboard. Drop the related state and save logic from this file.

## 3. Auth page legal links (`src/pages/Auth.tsx`)
Below the submit button (both sign-in and sign-up views), add a small muted line:

> By continuing, you agree to our [Terms of Service](/terms) and [Privacy Policy](/privacy).

Use `react-router-dom` `Link` components pointing to existing `/terms` and `/privacy` routes. Also include the same line on the "Reset your password" view footer.

## Out of scope
- No change to admin payout UI beyond it now displaying bank vs MoMo from the existing `payment_method` field.
- No change to commission / fee logic.
