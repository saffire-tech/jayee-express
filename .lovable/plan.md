

## Problem Analysis

**Issue 1: Orders not created after payment**
The `paystack-webhook` edge function has zero logs, meaning Paystack is never calling it. The webhook URL must be configured in the Paystack dashboard (pointing to `https://brqzedcxzjqwzpkwrmow.supabase.co/functions/v1/paystack-webhook`). However, since you may not have dashboard access or the webhook may fail silently, the robust fix is to add a **client-side payment verification fallback**: when the user returns from Paystack to the callback URL, verify the payment via Paystack's API and create orders if the webhook hasn't already done so.

**Issue 2: Remove "do not pay" notices**
The app now handles payments natively via Paystack, so the old fraud-prevention notices are no longer needed. These appear in:
- Cart.tsx: The `AlertDialog` payment notice shown before checkout
- PurchaseHistory.tsx: The yellow "Important Payment Notice" alert banner

---

## Plan

### Step 1: Create a `verify-payment` edge function
A new edge function that:
- Accepts a Paystack `reference` from the client
- Calls Paystack's `/transaction/verify/:reference` API
- If payment is verified as successful AND no orders exist for that reference, creates the orders + order items (same logic as the webhook)
- If orders already exist (webhook already ran), just returns success
- Clears the cart

### Step 2: Add payment verification on callback
In the Purchase History page (the callback URL target `/purchases?payment=success`):
- Detect the `payment=success` query param (note: Paystack also appends `?reference=xxx` to the callback URL)
- Extract the `reference` param from the URL
- Call the `verify-payment` edge function with the reference
- Show a toast on success/failure
- Clear the query params from the URL

### Step 3: Remove payment notices
- **Cart.tsx**: Remove the `AlertDialog` for the payment notice. Change `handleCheckoutClick` to call `handleConfirmCheckout` directly (skip the notice dialog). Remove `showPaymentNotice` state, the `AlertTriangle` import, and the `AlertDialog` component imports.
- **PurchaseHistory.tsx**: Remove the yellow "Important Payment Notice" `Alert` block (lines 380-388). Remove unused `AlertTriangle` if no longer needed.

### Step 4: Update callback URL in initialize-payment
Change the callback URL from `/purchases?payment=success` to include the reference:
```
callback_url: `${origin}/purchases?payment=success&reference=${reference}`
```
However, since Paystack appends `?reference=xxx` automatically, we just need to keep the base callback as `/purchases` and handle the params.

---

### Technical Details

**New file**: `supabase/functions/verify-payment/index.ts`
- Uses `PAYSTACK_SECRET_KEY` to call `https://api.paystack.co/transaction/verify/:reference`
- Uses service role client to check if orders with that `payment_reference` already exist
- If not, creates orders from the transaction metadata (same logic as webhook)
- Returns `{ verified: true, orders_created: boolean }`

**Modified files**:
- `src/pages/PurchaseHistory.tsx` — Add `useEffect` to detect `reference` query param, call `verify-payment`, show toast, remove payment notice alert
- `src/pages/Cart.tsx` — Remove payment notice dialog, go straight to checkout on button click
- `supabase/config.toml` — Add `verify-payment` function config

