
## Goal
Make product images display consistently everywhere (especially the homepage carousel) regardless of the original photo's size or shape.

## Problem
Today, `compressImage` only scales images down to fit within 1200×1200 but **keeps the original aspect ratio**. A tall portrait phone photo and a wide landscape photo end up with very different shapes. The homepage carousel then uses `object-cover` on a fixed 300–400px height frame, which crops these inconsistently — subjects get cut off, and on narrow mobile screens tall images look zoomed while wide images leave awkward gaps.

## Fix

### 1. Normalize product images at upload time to a fixed aspect ratio
Update `src/lib/imageCompression.ts` to (optionally) output a **canvas of a target aspect ratio**, painting the source image centered with `object-fit: cover` semantics (scale to fill, crop overflow). Background fill for any letterbox edge cases: white.

- Add options: `targetAspectRatio?: number` (e.g. `16/9`) and `fit?: 'cover' | 'contain'` (default `contain` = current behavior, backward compatible).
- When `targetAspectRatio` is set with `fit: 'cover'`, the output canvas dimensions become exactly `targetWidth × targetWidth / ratio`, and the source is drawn centered/cropped to fill.

### 2. Apply the normalized ratio to product uploads only
- `src/components/seller/ImageUpload.tsx` and `src/components/seller/MultiImageUpload.tsx`: pass `{ targetAspectRatio: 16/9, fit: 'cover', maxWidth: 1600 }` to `compressImage`. This gives every uploaded product image the same shape (1600×900) — good for carousel, cards, and detail pages.
- Leave `StoreImageUpload`, `messageMedia`, and other uploaders untouched (they aren't the source of the carousel inconsistency).

### 3. Tighten the carousel frame so it looks right on every device
`src/components/sections/AdvertisementCarousel.tsx`:
- Replace fixed pixel heights (`h-[300px] md:h-[400px]`) with a responsive `aspect-video` (16:9) wrapper so the frame matches the normalized image ratio exactly — no cropping surprises, no letterboxing.
- Cap max height on very large screens (e.g. `max-h-[520px]`) and center the image.
- Keep `object-cover` as a safety net for any legacy (pre-fix) product images already in the database.

### 4. (No migration needed)
Existing images stay as-is; the carousel's `object-cover` + capped frame keeps them displayable. All **new** uploads will be uniform.

## Files to change
- `src/lib/imageCompression.ts` — add `targetAspectRatio` + `fit: 'cover'` support.
- `src/components/seller/ImageUpload.tsx` — pass 16:9 cover options.
- `src/components/seller/MultiImageUpload.tsx` — pass 16:9 cover options.
- `src/components/sections/AdvertisementCarousel.tsx` — switch to `aspect-video` responsive frame.

## Open question
I'm proposing **16:9 (landscape)** because that's the natural shape for the homepage carousel and hero-style displays. The alternative is **1:1 (square)**, which looks better in product grid cards but leaves large empty bars in the carousel on wide screens. Confirm 16:9, or say "square" and I'll use 1:1 instead.
