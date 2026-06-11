---
name: City Segmentation (Tamale/Wa)
description: Marketplace is split by city — Tamale users never see Wa data and vice versa
type: feature
---
The app operates in two isolated cities: Tamale and Wa.

- `profiles.city`, `stores.city`, `orders.city` (text, CHECK in 'Tamale','Wa').
- New signed-in users are routed to `/select-city` before they can use the app (RequireCity guard in App.tsx).
- City editable later from Profile page; not exposed as a quick header toggle.
- Store creation requires city (defaults to seller's profile.city in StoreSetupWizard).
- RLS: `public.current_user_city()` security-definer helper. `stores` SELECT and `products` SELECT both filter by city; admins (`has_role 'admin'`) bypass. Trigger `set_order_city` stamps orders.city from store; trigger `enforce_cart_city` blocks cross-city cart inserts.
- Couriers in AvailableOrders only see orders matching their profile.city.
- Backfill: existing rows defaulted to 'Tamale'.
