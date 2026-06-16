## Problem

The store-settings area dropdown and the Products page area filter both use `LocationSelector`, which loads options from the `locations` table when populated. That table currently holds 50 Accra-area rows (Accra Central, East/North/West/Tema/Kasoa, etc.), so users see Accra zones instead of Tamale/Wa — even though `src/config/locations.ts` already defines the correct Tamale/Wa groups as the static fallback.

## Fix

Single database migration that reseeds `public.locations` to match the project's Tamale/Wa segmentation (no frontend changes needed — `LocationSelector` will pick up the new rows automatically).

1. `DELETE FROM public.locations` (clears all 50 Accra rows).
2. `INSERT` the Tamale and Wa zones/communities from `src/config/locations.ts`:
   - Tamale Central, Tamale East, Tamale West & North, Tamale Outskirts
   - Wa Central, Wa Outskirts
   - Each community as a row with `zone`, `name`, `is_active = true`, and an incrementing `display_order` within its zone.

## Out of scope

- No changes to `LocationSelector.tsx`, `StoreSetupWizard.tsx`, or the Products page filter — they already render whatever `locations` returns.
- No changes to `src/config/locations.ts` (already correct; used as fallback when the DB is empty).
- Existing stores/products with Accra-area values keep their old `campus` text; admins can edit them individually if desired. (Let me know if you want a bulk reset of those too.)
