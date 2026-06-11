
# SEO & Searchability Plan for Jayee Express

Goal: make the app rank higher and look right when shared. The project already has `react-helmet-async` installed and a HelmetProvider in `App.tsx`, so we can add per-route SEO cleanly.

## 1. Fix sitewide metadata in `index.html`
- Shorten the `<title>` to under 60 chars (e.g. *"Jayee Express — Community Marketplace in Ghana"*).
- Remove the hardcoded `<link rel="canonical">` and the single `og:url`/`og:image` so per-route Helmet can take over without duplicates.
- Replace stale `uniplug.app` and `jayee-express.app` references with the real domain `https://jayeeexpress.com`.
- Add sitewide `Organization` + `WebSite` JSON-LD (with SearchAction) so Google can show a sitelinks search box.

## 2. Add per-route SEO with a reusable `<SEO />` component
Create `src/components/SEO.tsx` that wraps `<Helmet>` and accepts `title`, `description`, `canonical`, `image`, `type`, and optional `jsonLd`. Use it in:
- `Index.tsx` — homepage H1 + branded title/description.
- `Products.tsx`, `Stores.tsx`, `Cart.tsx`, `Auth.tsx`, `Download.tsx`, `Terms.tsx`, `PrivacyPolicy.tsx` — unique title, description, canonical.
- `ProductDetail.tsx` — dynamic title/description from the product, plus `Product` JSON-LD (name, image, price, currency GHS, availability, brand=store name).
- `StorePage.tsx` — dynamic title/description from the store, plus `LocalBusiness`/`Store` JSON-LD (name, image, address, location).

## 3. Add a real `<h1>` and accessible labels
- Add a visible (or visually-hidden) `<h1>` to the homepage identifying Jayee Express as a community marketplace in Tamale and Wa.
- Add `aria-label` to icon-only buttons in `Navbar.tsx`, `MobileTabBar.tsx`, `FeaturedProducts.tsx`, `RecommendedProducts.tsx`, `CategoriesSection.tsx`, `ProductDetail.tsx` (cart, heart, notifications, messages, profile, theme toggle, logout, carousel chevrons).

## 4. Sitemap and crawler files
- Replace static `public/sitemap.xml` with a generator at `scripts/generate-sitemap.ts` that:
  - Lists all public static routes with `BASE_URL = https://jayeeexpress.com`.
  - Fetches verified, non-suspended stores and active products from Supabase to emit `/store/:id` and `/product/:id` entries.
  - Excludes admin, auth, profile, cart, seller, delivery, messages, notifications.
- Wire it via `predev` and `prebuild` scripts in `package.json`.
- Update `public/robots.txt` so `Sitemap:` points to `https://jayeeexpress.com/sitemap.xml` and disallow `/admin`, `/profile`, `/cart`, `/messages`, `/notifications`, `/seller`, `/delivery`, `/auth`.
- Add `public/llms.txt` listing public marketing/content surfaces (home, products, stores, download, terms, privacy) so AI crawlers can index the site.

## 5. Open Graph image
Generate a branded 1200×630 OG image (orange Jayee Express brand, tagline "Shop. Delivered.") and reference it as the default `og:image` in the `<SEO />` component, with per-product/per-store images overriding.

## 6. Google Search Console
After deploy:
- Connect Google Search Console via the connector.
- Verify `https://jayeeexpress.com` using the META method (inject the verification meta tag into `index.html`).
- Submit `https://jayeeexpress.com/sitemap.xml`.

## Files touched
- `index.html` (title, JSON-LD, cleanup)
- `src/components/SEO.tsx` (new)
- `src/pages/Index.tsx`, `Products.tsx`, `Stores.tsx`, `ProductDetail.tsx`, `StorePage.tsx`, `Cart.tsx`, `Auth.tsx`, `Download.tsx`, `Terms.tsx`, `PrivacyPolicy.tsx`
- `src/components/layout/Navbar.tsx`, `MobileTabBar.tsx`, plus icon buttons in product sections
- `scripts/generate-sitemap.ts` (new), `package.json`, `public/robots.txt`, `public/llms.txt` (new)
- `src/assets/og-image.jpg` (new, generated)

## Out of scope (can do later)
- The Semrush-suggested "Student Selling Guide" content page.
- Per-route SSR (Helmet runs client-side, fine for Google but limited for Facebook/LinkedIn previews — your existing `og-redirect` edge function already handles product/store share previews server-side).

Want me to proceed, or trim/extend anything (e.g. skip the OG image generation, skip llms.txt, add the selling guide now)?
