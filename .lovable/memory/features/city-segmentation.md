---
name: City Segmentation (Tamale/Wa/Accra)
description: Marketplace is split by city — users only see data from their own city
type: feature
---
The app operates in three isolated cities: Tamale, Wa and Accra.

- `profiles.city`, `stores.city`, `orders.city` (text, CHECK in 'Tamale','Wa','Accra').
- `locations.city` scopes admin-managed areas/zones to a city; `LocationSelector` accepts a `city` prop and filters both static (`src/config/locations.ts`) and DB-backed groups.
- New signed-in users are routed to `/select-city` before they can use the app (RequireCity guard in App.tsx).
- City editable later from Profile page; not exposed as a quick header toggle.
- Store creation requires city (defaults to seller's profile.city in StoreSetupWizard).
- RLS: `public.current_user_city()` security-definer helper. `stores` SELECT and `products` SELECT both filter by city; admins (`has_role 'admin'`) bypass. Trigger `set_order_city` stamps orders.city from store; trigger `enforce_cart_city` blocks cross-city cart inserts.
- Couriers in AvailableOrders only see orders matching their profile.city.
- Accra zones seeded: Accra Central/East/West/North and Tema & Outskirts.
