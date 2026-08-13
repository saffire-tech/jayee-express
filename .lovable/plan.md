# Expand Jayee Express to Accra

Add Accra as a third city alongside Tamale and Wa, everywhere city or area appears.

## What changes for users

- New signups (and the Profile city switcher) can pick **Accra — Greater Accra Region** on top of Tamale and Wa.
- Sellers can create stores in Accra; buyers in Accra see only Accra stores, products and delivery jobs (same isolation rule as today).
- The area/community dropdown gets Accra neighbourhoods grouped by zone, and the list is filtered to the city you're in so Tamale users no longer scroll past other cities' areas.
- Marketing copy, SEO text, the lite (keypad-phone) site and the AI/agent tools all mention Accra.

## Proposed Accra areas (admin-editable later)

- **Accra Central**: Osu, Adabraka, Asylum Down, Ridge, Kokomlemle, North Ridge, Tudu, Jamestown, Korle Gonno
- **Accra East**: East Legon, Adenta, Madina, Ashaley Botwe, Teshie, Nungua, Spintex, Baatsona, Airport Residential, Cantonments, Labone
- **Accra West**: Dansoman, Kaneshie, Odorkor, Mallam, Weija, Gbawe, Darkuman, Lapaz, Achimota
- **Accra North**: Tesano, Dome, Kwabenya, Haatso, Agbogba, Ashongman, Legon, Abelemkpe, Dzorwulu
- **Tema & Outskirts**: Tema Community 1-25, Ashaiman, Sakumono, Kasoa, Amasaman, Pokuase, Oyibi, Katamanso

## Technical changes

**Database (migration)**
- Widen `profiles_city_check`, `stores_city_check`, `orders_city_check` to include `'Accra'`.
- Add `city text` to `public.locations` (default `'Tamale'`), backfill from the existing zone prefixes (`Tamale *` → Tamale, `Wa *` → Wa), then seed the Accra zones/areas above with `display_order`.
- No RLS/grant changes needed: `current_user_city()` and the store/product/order city policies are value-driven and already handle any city string.
- Delivery pricing is distance-tier based (`delivery_zones`), so it applies to Accra unchanged.

**Frontend**
- `src/config/locations.ts`: add `city` to `LocationGroup`, add the Accra groups, add a `getGroupsByCity(city)` helper.
- `src/components/ui/LocationSelector.tsx`: accept an optional `city` prop, select `city` from `locations`, and filter groups by it (fall back to all when no city is given).
- Pass the relevant city into `LocationSelector` from the store settings/wizard (`StoreSetupWizard`), Products page filter, and checkout delivery option — using the store's city or the signed-in profile's city.
- `src/pages/SelectCity.tsx`: add the Accra card.
- `src/pages/Profile.tsx`: add `"Accra"` to the city switcher list.
- `src/components/admin/LocationsManager.tsx`: expose the new `city` field when creating/editing areas.

**Copy, SEO, lite site, agents**
- `index.html` (title/description/keywords/OG/Twitter + the served-cities list), `src/pages/Index.tsx` SEO description, `public/llms.txt`.
- `supabase/functions/lite/index.ts` and the static `public/lite/*` pages: add Accra to the copy and the city links.
- `src/lib/mcp/index.ts` server description and the city examples in `src/lib/mcp/tools/search-products.ts` / `list-stores.ts`.

## Notes

- Existing rows stay on their current city; nothing is migrated to Accra.
- Accra areas are seeded into the `locations` table so admins can rename, deactivate or extend them from the admin Locations manager without a code change.
