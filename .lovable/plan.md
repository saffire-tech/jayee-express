

# Optimize Storage, Cached Egress, and Performance

## Overview
Reduce bandwidth, storage usage, and improve caching across the app. The main wins come from: compressing uploaded images, extending cache headers, lazy-loading routes, reducing over-fetching from the database, and tightening the service worker precache scope.

## Changes

### 1. Compress Images on Upload (Biggest Storage/Egress Win)
**Files**: `ImageUpload.tsx`, `MultiImageUpload.tsx`, `StoreImageUpload.tsx`
- Add client-side image compression before uploading to storage using a canvas-based resize utility
- Resize images to max 1200px width, convert to WebP where supported, target ~80% quality
- This reduces stored file sizes by 60-80% and proportionally cuts egress on every image load
- Create a shared `src/lib/imageCompression.ts` utility

### 2. Extend Storage Cache Headers
**Files**: `ImageUpload.tsx`, `MultiImageUpload.tsx`, `StoreImageUpload.tsx`
- Change `cacheControl` from `'3600'` (1 hour) to `'31536000'` (1 year)
- Since filenames include timestamps, they are unique — long cache is safe and dramatically reduces repeated egress

### 3. Lazy-Load Routes (Reduce Initial Bundle)
**File**: `src/App.tsx`
- Use `React.lazy()` + `Suspense` for all routes except `Index` and `Auth`
- Splits the bundle so users only download code for pages they visit
- Reduces initial JS payload significantly (admin pages, seller dashboard, messages, etc.)

### 4. Narrow Database Selects (Reduce Egress)
**Key files**: `Products.tsx`, `Stores.tsx`, `HeroSection.tsx`, `Messages.tsx`, `NotificationCenter.tsx`, and others
- Replace `.select('*')` with explicit column lists where full rows aren't needed
- For count-only queries (HeroSection stats), already using `head: true` — those are fine
- Focus on the high-traffic pages: Products listing, Stores listing, Messages

### 5. Tighten Service Worker Precache
**File**: `vite.config.ts`
- Change glob pattern from `**/*.{js,css,html,ico,png,svg,woff2}` to `**/*.{js,css,html}`
- Exclude icons and images from precache — they are rarely needed offline and inflate the cache
- Reduce `maximumFileSizeToCacheInBytes` from 5MB to 3MB

### 6. Add `loading="lazy"` to Remaining Images
**Files**: `RecommendedProducts.tsx`, store/product cards across pages
- Some images already have `loading="lazy"` but several components are missing it
- Reduces initial page bandwidth

## Summary
| Optimization | Impact |
|---|---|
| Image compression on upload | ~70% less storage + egress per image |
| 1-year cache headers | Near-zero repeat egress for images |
| Route lazy-loading | ~40-60% smaller initial JS bundle |
| Narrow DB selects | Less data transferred per query |
| Tighter precache | Smaller SW cache, faster installs |
| Lazy image loading | Less bandwidth on page load |

