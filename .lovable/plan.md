# Tamale/Wa Localization + Store Approval & Admin Subscriptions

## 1. Replace all preloaded location data with Tamale & Wa communities

**File:** `src/config/locations.ts`

Replace the Accra-centric `LOCATION_GROUPS` with real Tamale and Wa zones/communities. Keep the same interface so every consumer (LocationSelector, StoreSetupWizard step 3, MapPicker fallback, admin LocationsManager) keeps working unchanged.

Proposed groups:

- **Tamale Central** — Aboabo, Sakasaka, Lamashegu, Choggu, Vittin, Nyohini, Gumbihini, Zogbeli, Tishigu, Kalpohin
- **Tamale East** — Kanvili, Gurugu, Gumani, Kpalsi, Kakpagyili, Sognaayili
- **Tamale West / North** — Bulpiela, Changli, Kpene, Tugu, Nyanshegu, Jisonayili, Kpalga
- **Tamale Outskirts** — Savelugu, Tolon, Yendi-road communities (Kasalgu, Datoyili, Sangani)
- **Wa Central** — Wa Zongo, Dondoli, Kabanye, Kpaguri, Mangu, Nakori, SSNIT Flats
- **Wa Outskirts** — Bamahu, Sing, Charia, Busa, Loho, Kperisi, Jujeyiri

Also remove the `CampusGroup` data (`src/config/campuses.ts`) Accra dependency where used by stores, but keep university campus data as-is since it serves a different purpose (campus identifier). The store wizard step 3 (`LocationSelector`) is what changes.

Note: `delivery_locations` is admin-managed data; we only replace the static config. Existing user-typed addresses in DB are untouched.

## 2. Store Setup Wizard — add store photo upload + submit for admin review

**Files:** `src/components/seller/StoreSetupWizard.tsx`, `src/hooks/useStore.ts`

- Insert a new step (between current step 1 "Name" and step 2 "Description"): **Store Photo**. Reuses existing `StoreImageUpload` component, writes to existing `store-images` bucket, returns the public URL into `formData.cover_url` (and optionally `logo_url`). Total steps becomes 6.
- `createStore` in `useStore.ts`: accept `cover_url`, insert with `is_verified: false`. After submit, the wizard shows a "Submitted for review" success screen instead of redirecting straight to dashboard.
- Seller Dashboard already gates UI by `is_verified` indirectly through RLS; add an explicit "Pending admin review" banner when `store.is_verified === false`.

## 3. Subscription gating — block products of un-subscribed stores

Visibility rule: a product is public **only if** the store is `is_verified = true` AND `is_suspended = false` AND `subscription_expires_at > now()`.

**Migration:** update `Stores visible by city` and `Products visible by store city` RLS policies to add `s.subscription_expires_at > now()` to the public branch. Owner/admin branches are unchanged so the seller still sees their own store in their dashboard while expired.

Frontend list queries (`Stores.tsx`, `FeaturedStores.tsx`, `FeaturedProducts.tsx`, etc.) keep their existing `is_verified` filter; RLS now also enforces the sub check, so no client change is strictly required, but `Stores.tsx` will add `.gt('subscription_expires_at', new Date().toISOString())` for clarity.

## 4. Admin store approval + admin-assigned monthly subscription

**File:** `src/pages/admin/StoresManagement.tsx`

- Add a **Pending** tab listing stores with `is_verified = false`. Each row shows store details, photos, owner, city.
- **Approve dialog**: numeric input for monthly fee (₵), defaults to 50. On confirm:
  - sets `is_verified = true`
  - inserts `store_subscriptions` row with `monthly_fee`, `status = 'pending_payment'`, `starts_at = now()`, `expires_at = now()` (so products stay hidden until they pay) — same shape as `delivery_subscriptions`.
  - updates `stores.subscription_expires_at = now()` (kept expired until payment).
  - sends notification to owner: "Store approved. Please pay your monthly subscription to go live."
- **Reject dialog**: reason text → notification to owner; store stays `is_verified=false`.
- **Edit fee** (on already-approved stores): updates the latest `store_subscriptions.monthly_fee` and any pending row, mirroring rider `Edit Fee` flow.

Existing self-serve subscription plan UI (`SubscribeDialog.tsx`, `SubscriptionCard.tsx`) keeps working for sellers who want to upgrade beyond their admin-assigned fee; admin assignment is the new baseline.

## 5. Seller-side: pay the admin-assigned subscription

**Files:** `src/components/seller/SubscriptionCard.tsx` (or new `StoreSubscriptionCard.tsx`)

Show the admin-assigned `monthly_fee` and a Renew/Activate button that calls a new edge function `initialize-store-subscription` (clone of `initialize-delivery-subscription`, reads the store's pending `store_subscriptions` row to determine the amount). `paystack-webhook` extended with a `type=store_subscription` branch that activates the sub and sets `stores.subscription_expires_at = expires_at`. `verify-payment` gets the matching client-side fallback branch.

## Database changes (one migration)

```sql
-- 1) Tighten store visibility: require active subscription for public viewing
DROP POLICY "Stores visible by city" ON public.stores;
CREATE POLICY "Stores visible by city" ON public.stores FOR SELECT
USING (
  has_role(auth.uid(),'admin') OR user_id = auth.uid()
  OR (is_verified = true
      AND COALESCE(is_suspended,false) = false
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at > now()
      AND (current_user_city() IS NULL OR city = current_user_city()))
);

-- 2) Same for products via store check
DROP POLICY "Products visible by store city" ON public.products;
CREATE POLICY "Products visible by store city" ON public.products FOR SELECT
USING (
  has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM stores s WHERE s.id = products.store_id AND (
    s.user_id = auth.uid()
    OR (s.is_verified = true
        AND COALESCE(s.is_suspended,false) = false
        AND s.subscription_expires_at IS NOT NULL
        AND s.subscription_expires_at > now()
        AND (current_user_city() IS NULL OR s.city = current_user_city()))
  ))
);

-- 3) New stores start unverified
ALTER TABLE public.stores ALTER COLUMN is_verified SET DEFAULT false;
```

`store_subscriptions` table already exists, so we don't recreate it.

## Files

**New:** `supabase/functions/initialize-store-subscription/index.ts`, migration.

**Edited:** `src/config/locations.ts`, `src/components/seller/StoreSetupWizard.tsx`, `src/hooks/useStore.ts`, `src/pages/SellerDashboard.tsx` (pending banner + new SubscriptionCard wiring), `src/pages/admin/StoresManagement.tsx` (Pending tab, Approve/Reject/Edit-fee dialogs), `src/components/seller/SubscriptionCard.tsx`, `supabase/functions/paystack-webhook/index.ts`, `supabase/functions/verify-payment/index.ts`.

## Out of scope

- Migrating existing live stores to the new approval flow (existing `is_verified=true` stores stay live; if their `subscription_expires_at` is null, RLS will hide them — I'll backfill those to `now() + 30 days` as a grace window in the migration).
- Re-locating existing user addresses that mention Accra communities (DB data left alone).
- Refunds for partial months.
