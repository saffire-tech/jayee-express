# Custom Maintenance Image

Let admins upload an image to display on the maintenance page. If none is set, keep the current animated wrench icon as fallback.

## Storage
- Create a new public storage bucket `maintenance-assets` (admin write, public read via RLS on `storage.objects`).

## Data model
- Extend the existing `platform_settings.maintenance_mode` JSON value with a new optional `image_url` field. No schema change needed — it's already a JSON blob (`{ enabled, message, eta }`).

## Admin UI — `src/components/admin/MaintenanceModeCard.tsx`
- Add an image upload control (reuse the same pattern as `src/components/seller/ImageUpload.tsx`: file input, compress via `compressImage`, upload to `maintenance-assets/<uuid>.webp`, get public URL).
- Show current image preview with a "Remove" button that clears `image_url`.
- Persist `image_url` inside the same `platform_settings` update the card already performs.

## Hook — `src/hooks/useMaintenanceMode.ts`
- Parse and expose `imageUrl: string | null` alongside existing fields.

## Maintenance page — `src/pages/Maintenance.tsx`
- Accept a new `imageUrl?: string | null` prop.
- If provided: render the image (rounded, shadowed, `object-cover`, capped height) in place of the animated wrench badge.
- If not provided: keep the current animated wrench exactly as-is.

## Gate — `src/components/MaintenanceGate.tsx`
- Pass `imageUrl` from the hook down to `<MaintenancePage />`.

## Out of scope
- No changes to who can toggle maintenance, no schema migration, no changes to the message/ETA fields.
