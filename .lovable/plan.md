# City Segmentation: Tamale vs Wa

Split the marketplace into two isolated regions. A user picks Tamale or Wa right after signup; their city determines every store, product, order, and delivery job they can see or interact with. Tamale users will never see Wa data, and vice versa — enforced both in the UI and at the database level (RLS).

## Data model changes (migration)

1. Add `city` column (text, check `city in ('Tamale','Wa')`) to:
   - `profiles` — the user's chosen city
   - `stores` — the store's operating city
   - `orders` — snapshot of the order's city (denormalized from store for RLS speed)
2. Backfill: set every existing row's `city = 'Tamale'`.
3. Make `city` NOT NULL after backfill.
4. Trigger on `orders` insert: auto-set `orders.city` from `stores.city`.
5. Trigger on `products` insert/update: reject if `store.city <> buyer's city` is not needed — products inherit visibility from store via RLS.

## RLS updates

Add a security-definer helper `public.current_user_city()` that returns `profiles.city` for `auth.uid()`. Then update existing policies (combine with existing conditions, do not replace verification/suspension logic):

- `stores` SELECT: existing visibility AND `city = current_user_city()` (admins bypass).
- `products` SELECT: store's city must match (`EXISTS (SELECT 1 FROM stores s WHERE s.id = products.store_id AND s.city = current_user_city())`).
- `orders` SELECT/UPDATE for delivery couriers: existing acceptance/management policies AND `orders.city = current_user_city()`.
- `cart_items` INSERT: block adding a product whose store city ≠ user's city (trigger or policy check).
- Admins (has_role 'admin') see all cities.

## Frontend changes

**New onboarding screen** (`src/pages/SelectCity.tsx`, route `/select-city`):
- Two big cards: Tamale, Wa. On select → `UPDATE profiles SET city = ...` → navigate to `/`.
- `AuthContext` gains `profile.city`. After sign-in, if `profile.city` is null → redirect to `/select-city` (guard in `App.tsx` / a `RequireCity` wrapper around app routes; exclude `/auth`, `/select-city`, public product/store pages).

**Profile page** (`src/pages/Profile.tsx`):
- Add "City" section with a Tamale/Wa radio group, saved via `updateProfile({ city })`. Show a brief warning that switching changes which stores/products are visible.

**Store creation / seller setup** (`StoreSetupWizard.tsx`, any "create store" flow):
- Add required city field (Tamale/Wa). Default to the seller's `profile.city`. Lock or warn if changed.

**Listing pages** (Home, `Products.tsx`, `Stores.tsx`, search, recommendations, featured sections):
- Add `.eq('city', profile.city)` to queries. (RLS already enforces this; the explicit filter keeps queries efficient and indexable.)

**Delivery dashboard** (`DeliveryDashboard.tsx`, `AvailableOrders.tsx`):
- Filter available orders by `city = courier's profile.city`. Distance sorting still applies within the city.

**Edge functions** (`get-recommendations`, `cart-reminder`, `send-push-notification` audience queries): filter by city using the requester's profile.

## Out of scope

- Cross-city checkout, multi-city stores, automatic location detection (no IP/geolocation), adding more cities beyond Tamale/Wa, UI redesign, payments, auth flows.

## Files touched

- New: `supabase/migrations/<ts>_city_segmentation.sql`, `src/pages/SelectCity.tsx`, `src/components/auth/RequireCity.tsx`
- Edited: `src/contexts/AuthContext.tsx` (expose `city`), `src/App.tsx` (route + guard), `src/pages/Profile.tsx`, `src/components/seller/StoreSetupWizard.tsx`, `src/pages/Index.tsx`, `src/pages/Products.tsx`, `src/pages/Stores.tsx`, `src/components/sections/FeaturedProducts.tsx`, `FeaturedStores.tsx`, `RecommendedProducts.tsx`, `SimilarProducts.tsx`, `src/components/search/GlobalSearch.tsx`, `src/pages/DeliveryDashboard.tsx`, `src/components/delivery/AvailableOrders.tsx`, edge functions listed above.
- Memory: add `mem://features/city-segmentation` and update index Core line.

## Verification

After build: sign up new user → city screen appears → pick Tamale → home shows only Tamale stores. Switch city in Profile → list updates. As a Wa courier, available orders shows only Wa orders. Direct API call from a Tamale user for a Wa product id returns empty (RLS).
