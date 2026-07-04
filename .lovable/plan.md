## 1. Paystack: open inline modal instead of redirecting away

Load Paystack's inline script (`https://js.paystack.co/v1/inline.js`) once, then replace the four `window.location.href = data.authorization_url` redirects with `PaystackPop.resumeTransaction(access_code)` so payment opens as an overlay inside the app.

- Add a small helper `src/lib/paystackInline.ts` that lazy-loads the script and exposes `openPaystackCheckout({ accessCode, onSuccess, onClose })`.
- Update `initialize-subscription`, `initialize-store-subscription`, `initialize-delivery-subscription` edge functions to also return `access_code` (already returned by `initialize-payment`).
- Update the 4 call sites to use the helper, falling back to the current redirect only if the inline script fails to load:
  - `src/pages/Cart.tsx`
  - `src/components/seller/SubscribeDialog.tsx`
  - `src/components/seller/SubscriptionCard.tsx`
  - `src/pages/DeliveryDashboard.tsx` (subscribe flow)
- On modal `onSuccess`, run the existing verify-payment flow (same reference the code already tracks).

## 2. Product images: preserve fullness (no crop, no zoom)

Stop force-cropping uploads to 16:9 and stop using `object-cover` on product displays. Show whole image with letterboxing where needed.

- `src/lib/imageCompression.ts` — keep the new `contain` support, but change product uploads to preserve original aspect ratio (no `targetAspectRatio`). Revert `ImageUpload.tsx` and `MultiImageUpload.tsx` to call `compressImage(file, { maxWidth: 1600, maxHeight: 1600 })`.
- Replace `object-cover` with `object-contain` on product image renders (with a neutral `bg-muted` behind the image) in:
  - `src/components/sections/AdvertisementCarousel.tsx`
  - `src/components/sections/FeaturedProducts.tsx`
  - `src/pages/Products.tsx`
  - `src/pages/ProductDetail.tsx` (main + thumbnails)
- Keep the carousel's `aspect-video max-h-[520px]` frame so layout stays stable across screens; the image now fits fully inside it.

## 3. Message media: upload progress indicator

Add a visible progress state while a message attachment uploads.

- `src/lib/messageMedia.ts` — extend `uploadMessageMedia` to accept an `onProgress?: (pct: number) => void` callback. Since `supabase.storage.upload` doesn't stream progress, implement progress via `fetch` + `XMLHttpRequest` to the storage REST endpoint (or use `xhr` upload event) and fall back to indeterminate 0→90% animation if xhr progress isn't available.
- `src/pages/Messages.tsx` — track `uploadProgress` state, pass callback into `uploadMessageMedia`, and render a `Progress` bar (existing `@/components/ui/progress`) on the pending file chip. Disable the send button while uploading and show a spinner + percentage.

## 4. Reviews: one per user per product

Enforce at DB level and improve UX.

- Migration: `ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_product_unique UNIQUE (user_id, product_id);` (after deleting any existing duplicates, keeping the most recent per pair).
- `src/pages/ProductDetail.tsx`:
  - Before showing the review form, check if the current user already has a review for this product; if yes, hide the "write a review" form and show their existing review with an "Edit" action that updates instead of inserts.
  - Handle unique-violation error from insert gracefully with a toast: "You've already reviewed this product."

## Technical notes

- Paystack inline script is script-tag loaded (no npm dep needed) and works with the `access_code` returned by `transaction/initialize`. The existing `callback_url` still fires on inline success as `onSuccess`.
- `object-contain` + `bg-muted` gives a clean letterbox look and stops the "zoomed / cropped" complaint without breaking the fixed card heights already in use.
- The reviews unique constraint is the source of truth; the UI check is just a nicer flow.
