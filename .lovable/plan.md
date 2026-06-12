# Pretty store URLs (slug-based)

Goal: shared store links look like `https://jayeeexpress.com/store/jayees-gadgets` instead of a UUID.

## Approach

1. **Add a `slug` column to `stores`**
   - `slug text unique` (URL-safe, lowercase, hyphenated — e.g. `jayees-gadgets`).
   - Backfill existing rows from `name` (deduplicate collisions by appending a short suffix).
   - Add a trigger so every new store and every name change auto-generates/updates the slug, keeping it unique.

2. **Route changes**
   - Keep the existing `/store/:id` route working (so already-shared UUID links never break).
   - Make `StorePage` accept either a slug or a UUID: look up by `slug` first, fall back to `id`. If a user lands on the UUID URL, redirect to the slug URL.
   - Update internal `<Link to={`/store/...`}>` usages across the app (StorePage, Stores list, FeaturedStores, search results, seller dashboard, etc.) to use the slug.

3. **Sharing**
   - `ShareButton` builds the share URL from a `slug` (falls back to `id` if missing).
   - The `og-redirect` edge function accepts `slug` in addition to `id` and resolves accordingly, so WhatsApp/Twitter/Facebook previews still work.
   - `sitemap.xml` generator emits slug URLs.

4. **Out of scope** (can do later if you want): pretty URLs for products and services. Just ask and I'll extend the same pattern.

## Why slugs (not raw names)

Browsers/social apps mangle spaces and apostrophes ("Jayee's Gadgets" becomes `Jayee%27s%20Gadgets`), which looks worse than the UUID. The standard fix is a slug: lowercased, hyphenated, ASCII. Same result you wanted, just clean.

## Questions before I build

- Slug format preference: `jayees-gadgets` (recommended) vs `Jayees-Gadgets` (preserve case)?
- When a seller renames their store, should the slug update too (old slug stops working), or stay frozen at first creation?
