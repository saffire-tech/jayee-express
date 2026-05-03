# Switch to Monthly Subscription Model for Stores

Replace the (now removed) commission model with a monthly subscription where shop owners pay a fixed fee based on the number of items they're allowed to list. Admins configure the plans; sellers subscribe (1+ months) via Paystack; "My Store" shows a live countdown.

## 1. Database changes (migration)

**New table: `subscription_plans`** (admin-managed)
- `id uuid pk`, `name text` (e.g. "Starter")
- `max_products int` (e.g. 10)
- `price_per_month numeric` (e.g. 100.00, in GHS)
- `is_active bool default true`
- `display_order int`, timestamps
- RLS: everyone reads active plans; only admins manage.

**New table: `store_subscriptions`**
- `id`, `store_id uuid`, `plan_id uuid`, `user_id uuid`
- `months int`, `amount_paid numeric`
- `starts_at timestamptz`, `expires_at timestamptz`
- `status text` ('active' | 'expired' | 'cancelled')
- `payment_reference text` (Paystack ref)
- `created_at`
- RLS: store owner can read their own; admins manage all; insert via edge function (service role).

**Stores table:** add `current_plan_id uuid`, `subscription_expires_at timestamptz`, `product_limit int default 0` (cached from plan for fast checks).

**Trigger / helper function:** when an order is created or product is inserted, enforce `product_limit` against `count(products where store_id=…)`. Implemented as a Postgres `BEFORE INSERT` trigger on `products` that raises if active count >= store.product_limit OR subscription expired.

**Seed data:** 3 starter plans (Starter ₵100/10 items, Growth ₵250/30 items, Pro ₵500/100 items) — admin can edit later.

## 2. Edge functions

- **`initialize-subscription`** (new): input `{ plan_id, months }`. Looks up plan, calculates `amount = price_per_month * months`, creates a Paystack transaction with metadata `{ type: 'subscription', store_id, plan_id, months }`, returns `authorization_url`.
- **`paystack-webhook`** (edit): on `charge.success`, branch on `metadata.type`. If `subscription`, insert `store_subscriptions` row, update `stores.current_plan_id`, `product_limit`, and `subscription_expires_at` (extend from current expiry if still active, else from `now()`).
- **`verify-payment`** (edit): mirror the same subscription branch as a fallback path.

## 3. Frontend

**Admin: `src/components/admin/SubscriptionPlansManager.tsx`** — CRUD for plans (name, max_products, price_per_month, active). Add tab/section to `AdminDashboard.tsx`.

**Seller: `src/pages/SellerDashboard.tsx` ("My Store")**
- Add a `SubscriptionCard` at the top showing:
  - Current plan name + product limit (e.g. "Starter — 7 / 10 products used")
  - Live countdown to `subscription_expires_at` (days, hours, minutes — updates every second via `setInterval`)
  - "Renew / Upgrade" button → opens `SubscribeDialog`
  - If expired or none: prominent "Subscribe to start selling" CTA; product creation disabled.
- `SubscribeDialog`: pick a plan, pick months (1–12 stepper), see total = `price_per_month × months`, confirm → calls `initialize-subscription` → redirects to Paystack.

**Product form guard:** in `ProductForm.tsx` and `useStore.createProduct`, before submit check `products.length < store.product_limit` and `subscription_expires_at > now()`. Show toast if blocked.

## 4. Remove leftover commission references

Search for `commission` in code/UI (settings page, wallet labels) and clean up any remaining text. No DB column to drop (it was a `platform_settings` row).

## 5. Files to add / edit

```text
NEW  supabase/migrations/<ts>_subscriptions.sql
NEW  supabase/functions/initialize-subscription/index.ts
EDIT supabase/functions/paystack-webhook/index.ts
EDIT supabase/functions/verify-payment/index.ts
EDIT supabase/config.toml  (verify_jwt=false for new fn)
NEW  src/components/admin/SubscriptionPlansManager.tsx
NEW  src/components/seller/SubscriptionCard.tsx
NEW  src/components/seller/SubscribeDialog.tsx
EDIT src/pages/admin/AdminDashboard.tsx
EDIT src/pages/SellerDashboard.tsx
EDIT src/hooks/useStore.ts            (limit guard + expose subscription)
EDIT src/components/seller/ProductForm.tsx
```

## Notes / decisions to confirm

- Currency: GHS (₵), matches existing Paystack flow.
- Multi-month subscriptions just multiply price; no discount tier (can add later).
- Expiry behaviour: when expired, store stays visible but seller cannot add new products and existing products stay listed (less disruptive). Confirm if you'd rather hide products too.
- Admin can edit plan price/limit at any time; existing active subscriptions keep the limit they paid for until expiry.
