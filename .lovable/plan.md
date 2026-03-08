

# Paystack Payment Integration with Split Payments & MoMo Payouts

## Overview
Integrate Paystack to handle buyer payments at checkout, with instant split payments to shop owners via Paystack subaccounts. Delivery persons get paid after delivery confirmation. All payouts go to mobile money (MoMo) accounts.

## How It Works

1. **Buyer checks out** → Paystack payment popup collects payment (card, MoMo, etc.)
2. **Paystack splits payment instantly** → Shop owner's subaccount receives item amount minus platform commission
3. **Delivery fee is held** → After buyer confirms delivery, an edge function triggers payout to the delivery person's MoMo
4. **Platform commission** → Shodel keeps a configurable % (e.g. 5%) from each transaction

## Architecture

```text
Buyer pays via Paystack popup
        │
        ▼
Edge Function: initialize-payment
  - Creates Paystack transaction with split config
  - Shop owner subaccount gets item total minus commission
  - Delivery fee held on platform account
        │
        ▼
Edge Function: paystack-webhook
  - Verifies payment via Paystack signature
  - Creates order(s) in DB with payment_status = 'paid'
  - Clears cart
        │
        ▼
Buyer confirms delivery received
        │
        ▼
Edge Function: payout-delivery
  - Triggers Paystack Transfer to delivery person's MoMo
```

## Database Changes

### 1. Add columns to `profiles` table
- `momo_number` (text, nullable) — Mobile money phone number
- `momo_provider` (text, nullable) — Provider: MTN, Vodafone, AirtelTigo

### 2. Add columns to `stores` table
- `momo_number` (text, nullable) — Store owner's MoMo number
- `momo_provider` (text, nullable) — Provider
- `paystack_subaccount_code` (text, nullable) — Paystack subaccount ID for instant splits

### 3. Add columns to `orders` table
- `payment_status` (text, default 'unpaid') — Values: unpaid, paid, failed
- `payment_reference` (text, nullable) — Paystack transaction reference
- `delivery_payout_status` (text, nullable) — Values: pending, paid, failed

### 4. Create `platform_settings` table
- `id`, `key` (text, unique), `value` (text) — For storing commission percentage

## Edge Functions

### `initialize-payment`
- Receives cart items, delivery data, buyer info
- Groups items by store, looks up each store's `paystack_subaccount_code`
- Creates Paystack transaction with `split` config for instant payouts
- Returns Paystack authorization URL / access code

### `paystack-webhook`
- Receives Paystack webhook events (charge.success)
- Verifies signature with Paystack secret key
- Creates orders in DB, marks `payment_status = 'paid'`
- Clears buyer's cart
- Sends notifications to sellers

### `payout-delivery`
- Called when buyer confirms delivery
- Creates a Paystack Transfer to delivery person's MoMo via Paystack Transfer API
- Updates `delivery_payout_status` on the order

## Frontend Changes

### Profile Page (`src/pages/Profile.tsx`)
- Add MoMo number and provider fields (MTN, Vodafone, AirtelTigo dropdown)
- Both sellers and delivery persons set this here

### Store Setup (`src/components/seller/StoreSetupWizard.tsx`)
- Add optional MoMo step for receiving store payments
- On save, create/update Paystack subaccount via edge function

### Cart/Checkout (`src/pages/Cart.tsx`)
- Replace direct order creation with Paystack payment flow
- After payment notice acknowledgment, call `initialize-payment` edge function
- Open Paystack popup with returned access code
- On success callback, show success and redirect to purchases

### Purchase History (`src/pages/PurchaseHistory.tsx`)
- Show payment status badge on orders
- "Confirm Received" button now also triggers delivery person payout

## Secrets Needed
- `PAYSTACK_SECRET_KEY` — For server-side API calls and webhook verification
- `PAYSTACK_PUBLIC_KEY` — For client-side popup (this is public, stored in code)

## Implementation Order
1. Add Paystack secret key
2. Run database migration (new columns + platform_settings table)
3. Create `initialize-payment` edge function
4. Create `paystack-webhook` edge function
5. Create `payout-delivery` edge function
6. Update Profile page with MoMo fields
7. Update Store setup with MoMo + subaccount creation
8. Update Cart checkout flow with Paystack popup
9. Update delivery confirmation to trigger payout

