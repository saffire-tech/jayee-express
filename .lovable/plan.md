# Home Page Restyle Plan

Restyle only `/` (mobile and desktop) to match the two reference images. Keep orange as primary, keep all data, routes, components, and features as-is — only the visual composition changes.

## Mobile home (Agrizel reference)

Reorder and restyle `src/pages/Index.tsx` for mobile so it reads top-to-bottom as:

1. **Compact top bar** (replacing the dense navbar on mobile home): small circular logo + "Delivering to {location}" line with map pin, and a cart icon on the right with badge.
2. **Rounded pill search bar** — full-width, soft gray fill, leading search icon, placeholder "Search products, stores, categories" (reuses `GlobalSearch`).
3. **Categories row** — horizontal scroll of pill chips with small colored icon bubbles (uses existing categories data). Active chip filled orange.
4. **Promo banner card** — large rounded card reusing `AdvertisementCarousel`, styled with soft background, bold headline, small subtext, and a filled orange CTA button bottom-left.
5. **"Freshly in Stocked" style section header** — bold title left, "VIEW ALL ›" link right. Used for both `RecommendedProducts` and `FeaturedProducts`.
6. **Product cards** — square image top with rounded corners, store chip overlay (avatar + name + ★ rating) on the image, title + price below, full-width orange "Buy Now" / outlined "Add to Cart" buttons stacked.
7. **Featured stores** — restyled as horizontally scrollable cards with cover image + floating store info chip (matches the third reference screen).
8. Keep `HowItWorks`, `DownloadBanner`, `CTASection`, `Footer`, and the bottom `MobileTabBar` unchanged in behavior; only spacing/typography refreshed for consistency.

## Desktop home (Snapcart reference)

Restyle desktop `/` into a three-zone shell below the existing `Navbar`:

1. **Utility strip** under navbar — thin row with "Free shipping over ₵___ · Money-back guarantee · 100% secure payment" badges, full-width, soft background.
2. **Category sidebar (left, ~220px)** — sticky vertical list of product categories (from existing categories data), each row hover-highlighted in orange. Collapsible via shadcn `Sidebar` with `SidebarProvider` so users can hide it; trigger lives in the utility strip.
3. **Hero collage (center + right)** — a 3-column grid:
   - Large left card: current `AdvertisementCarousel` styled as a big rounded hero with headline + "Buy Now" pill.
   - Two stacked right cards: featured store + featured product teasers pulled from existing featured queries.
4. **Featured brands / stores strip** — horizontal row of logo chips sourced from `FeaturedStores` (logo + name, monochrome on hover -> color).
5. **"Best Sellers" tabbed row** — `FeaturedProducts` rendered with category pill tabs above (reusing `CategoriesSection` selection state already in `Index.tsx`); products shown as 5-up card grid with corner "Best Selling" / installment badges, ★ rating, price.
6. **Promo band** — dark full-width banner reusing `DownloadBanner` styled like the "A healthy leap ahead" strip.
7. **"Top picks" section** — `RecommendedProducts` rendered as left feature card (large) + right 3x2 mini category grid (Vegetables, Fruits, etc.) using existing categories data.
8. Keep `HowItWorks`, `CTASection`, and `Footer` at the bottom with refreshed spacing.

The desktop and mobile compositions are gated by `useIsMobile()` in `Index.tsx` — desktop renders the new shell, mobile renders the Agrizel-style stack.

## Out of scope
- Other pages (`/products`, `/stores`, `/product/:id`, etc.) — unchanged.
- Auth, cart, checkout, seller, admin, delivery flows — unchanged.
- Data model, routes, business logic — unchanged.
- Brand colors stay: primary orange, white, black. No green swap.

## Technical details
- Files edited:
  - `src/pages/Index.tsx` — branch desktop vs mobile compositions.
  - `src/components/sections/AdvertisementCarousel.tsx` — hero card variant prop (`compact` mobile / `hero` desktop).
  - `src/components/sections/CategoriesSection.tsx` — add `variant="pills"` (mobile chips) and `variant="sidebar"` (desktop left rail).
  - `src/components/sections/FeaturedProducts.tsx` — new product card layout (image-top, store chip overlay, dual CTA buttons on mobile; 5-up grid on desktop).
  - `src/components/sections/FeaturedStores.tsx` — horizontally scrollable image-forward cards on mobile; logo strip on desktop.
  - `src/components/sections/RecommendedProducts.tsx` — section header restyle; reuse same product card.
  - `src/components/layout/Navbar.tsx` — minor mobile variant: on `/` only, render the slim "Delivering to …" top bar instead of the full navbar (desktop unchanged).
- New files:
  - `src/components/home/HomeCategorySidebar.tsx` — desktop left sidebar via shadcn `Sidebar` (collapsible="icon").
  - `src/components/home/HomeUtilityStrip.tsx` — desktop trust-badges strip.
  - `src/components/home/SectionHeader.tsx` — shared "Title … VIEW ALL ›" header.
  - `src/components/home/ProductCard.tsx` — reference-style product card used by Featured + Recommended sections.
- All colors via existing semantic tokens (`--primary`, `--background`, `--muted`, `--card`, `--border`). No hardcoded hex.
- Dark mode preserved by relying on tokens.
- No new dependencies.
