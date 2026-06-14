# Plan

## 1. Recommended products leak from unsubscribed stores

The "Recommended for You" section pulls products in two places, and neither enforces the store's subscription/verification gate that the public product RLS policy applies.

**Fix `supabase/functions/get-recommendations/index.ts`:**
- The `allProducts` query uses the service role (bypasses RLS), so we must add the filters manually.
- Change the join to `stores!inner(name, campus, is_verified, is_suspended, subscription_expires_at, city)` and after fetching, filter out products where the joined store is not verified, is suspended, or has `subscription_expires_at <= now()`.
- Also scope to the user's city when known (read `profiles.city` for `userId`) so recommendations match the rest of the home feed.

**Fix `src/components/sections/RecommendedProducts.tsx` fallback query:**
- The "Trending Now" fallback selects featured products with no store gating. Switch the join to `store:stores!inner(name, campus, is_verified, is_suspended, subscription_expires_at)`, add `.eq('store.is_verified', true)`, `.eq('store.is_suspended', false)`, and `.gt('store.subscription_expires_at', new Date().toISOString())`.

No DB or RLS changes — the public RLS policy already enforces this; we're only aligning the service-role edge function and the client fallback with it.

## 2. Announcement banner hidden under the navbar

`AnnouncementBanner` renders inside `Index` page content, but `Navbar` is `fixed top-0` (h-14 mobile / h-16 desktop), so the banner slides under it. The close button is also absolutely positioned over the text, causing long messages to clip into the corner.

**Fix `src/components/announcements/AnnouncementBanner.tsx`:**
- Make the banner itself `fixed top-14 md:top-16 left-0 right-0 z-40` so it sits flush below the navbar on every page.
- Replace `line-clamp-1` with normal wrapping (`whitespace-normal break-words`) and use a flex row with `items-start`, giving the text container `flex-1 min-w-0` and right padding (`pr-8`) so it never runs under the close button.
- Move the close button out of `absolute` positioning into the flex row (still right-aligned) so it doesn't overlay text.

**Fix `src/pages/Index.tsx` (and any other page that mounts the banner, if needed):**
- Because the banner is now fixed, add a spacer/offset so page content isn't covered. Simplest: render an invisible `h-10` placeholder where `<AnnouncementBanner />` is mounted when an announcement is active. Implementation detail: have `AnnouncementBanner` itself render a sibling spacer of matching height when visible, so no page-level changes are required.

No backend or data changes for #2 — purely presentation.

## Files touched
- `supabase/functions/get-recommendations/index.ts`
- `src/components/sections/RecommendedProducts.tsx`
- `src/components/announcements/AnnouncementBanner.tsx`
