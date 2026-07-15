## Goal
Let users browse cached homepage products, stores, and their purchase history while offline, then require a live connection only to complete a purchase.

## Approach
Reuse the existing service worker (`src/sw.ts`) for shell/asset caching and add a data-layer offline cache on top of React Query using IndexedDB. Supabase API responses will also get a runtime SW cache as a network fallback for direct fetches.

## Changes

### 1. React Query persistence (IndexedDB)
- Add `@tanstack/react-query-persist-client` + `idb-keyval` based persister.
- Wrap the app's `QueryClientProvider` with `PersistQueryClientProvider` (in `src/App.tsx`).
- Config: `maxAge` 7 days, `gcTime` 7 days, persist only whitelisted query keys:
  - `featured-products`, `recommendations`, `featured-stores`, `stores-list`, `products-list`, `product-detail`, `store-detail`, `purchase-history`, `orders-mine`.
- Skip persistence for auth-sensitive/mutation queries (cart, messages, notifications, admin, wallet balances).

### 2. Runtime SW cache for Supabase reads
In `src/sw.ts` add a `NetworkFirst` route for `GET` requests to the Supabase REST endpoint (`*.supabase.co/rest/v1/*`) with a 5s timeout and a small `supabase-reads` cache (50 entries, 1 day). Excludes non-GET and realtime/auth endpoints.

### 3. Offline UX
- Add a lightweight `useOnlineStatus` hook.
- Small persistent "You're offline — showing saved data" banner (top of page) when offline.
- On product detail / cart / checkout: if offline and user taps Buy/Add to Cart to checkout, show toast "You need internet to complete a purchase" and disable the pay button. Browsing and adding to cart locally stays allowed; only the Paystack/checkout submit is gated.

### 4. Purchase history offline
`PurchaseHistory.tsx` already uses React Query — once its query key is whitelisted for persistence, the last-seen orders render offline automatically. Add an "Offline — last synced <time>" note using `dataUpdatedAt`.

### 5. Homepage & stores offline
No component rewrites needed. `FeaturedProducts`, `RecommendedProducts`, `FeaturedStores`, `Stores`, `Products`, `StorePage`, `ProductDetail` all use React Query; whitelisting their keys makes them hydrate from IndexedDB on cold offline loads. Images are already handled by the SW's `CacheFirst` static-asset route; extend it to also cache same-origin and Supabase Storage image responses (`image` destination) with an `ExpirationPlugin` (100 entries, 30 days).

### 6. Guardrails
- Never persist queries containing PII beyond what the user already sees (orders scoped to the user; profiles limited to `public_profiles`).
- Bump a `PERSIST_VERSION` string so a future schema change invalidates old caches.
- Preview/dev guard from the existing PWA skill still applies — no SW in Lovable preview.

## Files touched
- `src/App.tsx` — swap provider to `PersistQueryClientProvider`.
- `src/lib/queryPersister.ts` (new) — IndexedDB persister + whitelist.
- `src/hooks/useOnlineStatus.ts` (new).
- `src/components/OfflineBanner.tsx` (new), mounted in `App.tsx`.
- `src/pages/Cart.tsx`, `src/pages/ProductDetail.tsx` — gate purchase actions when offline.
- `src/pages/PurchaseHistory.tsx` — "last synced" note.
- `src/sw.ts` — add Supabase REST NetworkFirst route + image CacheFirst.
- `package.json` — add `@tanstack/react-query-persist-client`, `idb-keyval`.

## Out of scope
- Offline order placement / queued purchases (explicitly not supported — internet required to pay).
- Offline messaging, notifications, admin dashboards.
