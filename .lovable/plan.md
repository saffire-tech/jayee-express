

## Plan: Replace Hero Section with Featured Products Carousel

### Summary
Remove the current hero section (stats, search bar, CTA buttons) and replace it with an auto-playing, infinite-loop carousel that showcases featured products as an advertisement board directly below the navbar.

### What Changes

**1. Create new `AdvertisementCarousel` component**
- New file: `src/components/sections/AdvertisementCarousel.tsx`
- Fetches featured products (`is_featured = true`) from the database
- Uses Embla Carousel with the `autoplay` plugin (10-second interval) and `loop: true` for endless swiping
- Each slide shows a full-width card with the product image as background, product name, price, store name, and a "Shop Now" link to `/product/:id`
- Includes dot indicators at the bottom for current position
- Responsive: ~300px height on mobile, ~400px on desktop
- Manual swipe supported alongside auto-play; auto-play pauses on interaction and resumes after

**2. Update `Index.tsx`**
- Replace `<HeroSection />` with `<AdvertisementCarousel />`
- Remove the `HeroSection` import

**3. Fix the 401 runtime error**
- The `get-recommendations` edge function is still returning 401 for unauthenticated users. Will add a fallback in the `RecommendedProducts` component to skip the call when not logged in, or handle the error gracefully.

### Technical Details

- **Embla plugins**: Install `embla-carousel-autoplay` (check if already available). Configure with `delay: 10000, stopOnInteraction: false, stopOnMouseEnter: true`.
- **Carousel options**: `{ loop: true, align: 'center' }` for infinite scroll behavior.
- **Data query**: Reuse the same `is_featured = true` query pattern from `FeaturedProducts`, but without category filtering.
- **Slide design**: Large image with gradient overlay, product info overlaid at the bottom — styled like a promotional banner/ad board.

