
# Transition from Campus-Based to Community-Based Marketplace

## Overview
Transform UniPlug from a campus/student-focused marketplace to a community-based marketplace serving Accra neighborhoods and city locations. This involves replacing all campus selection logic with community/area selection, updating all student-oriented copy, and adjusting the database constraint.

## What Changes

### 1. Replace Location Data Configuration
**File: `src/config/campuses.ts` -> rename to `src/config/locations.ts`**
- Replace `CAMPUS_GROUPS` with `LOCATION_GROUPS` containing Accra communities and city areas
- Groups will be organized by zones (e.g., "Greater Accra North", "Greater Accra South", "Tema & Surroundings", "Accra Central", "West Accra", "East Accra")
- Locations will include neighborhoods like: East Legon, Madina, Adenta, Spintex, Tema, Ashaiman, Dansoman, Lapaz, Achimota, Kaneshie, Osu, Labadi, Teshie, Nungua, Kasoa, Weija, Ablekuma, Dome, Haatso, Taifa, Circle, Airport Residential, Cantonments, Ridge, Dzorwulu, Abelemkpe, Roman Ridge, Tesano, Darkuman, Odorkor, etc.
- Rename all exported functions accordingly (e.g., `getGroupByCampus` -> `getGroupByLocation`)

### 2. Rebuild the Location Selector Component
**File: `src/components/ui/CampusSelector.tsx` -> rename to `src/components/ui/LocationSelector.tsx`**
- Replace `GraduationCap` icon with `MapPin` icon
- Rename all props: `campus` -> `location`, labels say "Select area" / "All Areas"
- Same two-step grouped selection UX, but with community groups instead of institution types

### 3. Database Migration
- **Drop** the `stores_campus_check` constraint (it restricts campus values to the old university list)
- The `campus` column in `stores` and `profiles` tables will remain as-is (reusing the column for location/area) -- no column rename needed to avoid breaking existing data
- Existing store data with old campus values will still work; they just won't appear in the new selector until updated by store owners

### 4. Update All UI Text and References
Files with campus/student copy to update:

| File | What changes |
|------|-------------|
| `src/components/sections/HeroSection.tsx` | "Your Campus Marketplace" -> "Your Community Marketplace", "Happy Students" -> "Happy Users", "fellow students" -> "your community" |
| `src/components/sections/HowItWorks.tsx` | "campus email" -> "email", "campus business" -> "business" |
| `src/components/sections/CTASection.tsx` | "Campus Entrepreneurs" -> "Entrepreneurs", "Campus Business" -> "Business", "students on your campus" -> "people in your community" |
| `src/pages/Products.tsx` | Import LocationSelector, "All Campuses" -> "All Areas", "campus sellers" -> "local sellers" |
| `src/pages/Stores.tsx` | Same as Products - swap selector and labels |
| `src/pages/Profile.tsx` | "Campus" label -> "Area", use LocationSelector |
| `src/pages/SellerDashboard.tsx` | "Campus" -> "Area", "Location on Campus" -> "Address", use LocationSelector |
| `src/components/seller/StoreSetupWizard.tsx` | "Select Your Campus" -> "Select Your Area", GraduationCap -> MapPin, use LocationSelector |
| `src/pages/StorePage.tsx` | "campus marketplace" -> "community marketplace" in meta tags |
| `src/pages/ProductDetail.tsx` | "campus marketplace" -> "community marketplace", "Campus Store" -> "Local Store" |
| `src/pages/Download.tsx` | "on campus" -> "on the go" |
| `src/components/sections/FeaturedProducts.tsx` | No campus references (already clean) |
| `src/components/sections/RecommendedProducts.tsx` | `store.campus` display text unchanged (column still exists) |
| `src/pages/Stores.tsx` | GraduationCap icon -> MapPin for store area display |
| `supabase/functions/send-email-notification/index.ts` | "Campus Marketplace" -> "Community Marketplace" |
| `supabase/functions/get-recommendations/index.ts` | "campus marketplace" -> "community marketplace", "campus preferences" -> "area preferences" |

### 5. Accra Community Locations List
The new location groups:

- **Accra Central**: Osu, Labadi, Cantonments, Airport Residential, Ridge, Dzorwulu, Abelemkpe, Roman Ridge, Circle, Asylum Down, Adabraka
- **North Accra**: Achimota, Lapaz, Dome, Haatso, Taifa, Agbogba, Kwabenya, Pokuase, Amasaman
- **East Accra**: East Legon, Madina, Adenta, Teshie, Nungua, Spintex, Baatsonaa, Adjiriganor
- **West Accra**: Dansoman, Darkuman, Odorkor, Kaneshie, Tesano, Ablekuma, Bubiashie, Abeka
- **Tema & Surroundings**: Tema, Ashaiman, Sakumono, Kpone, Prampram, Dawhenya, Afienya
- **Kasoa & Surroundings**: Kasoa, Weija, Gbawe, Mallam, McCarthy Hill, Bortianor, Kokrobite

### 6. Summary of Scope
- ~15 files modified (UI components, pages, edge functions, config)
- 1 database migration (drop check constraint)
- 1 new config file (locations.ts replacing campuses.ts)
- 1 new component file (LocationSelector.tsx replacing CampusSelector.tsx)
- No breaking changes to database schema (reusing same `campus` column)
