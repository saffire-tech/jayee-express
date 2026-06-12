## Problem

When a seller fills the Store Setup wizard and clicks "Submit for Review", nothing visible happens. The store insert in `createStore` (in `src/hooks/useStore.ts`) is failing silently:

- `createStore` has no `try/catch` around the Supabase insert and no error toast — it just re-throws.
- The wizard's `handleSubmit` wraps the call in `try / finally` with no `catch`, so the rejected promise becomes an unhandled rejection and the user sees no feedback and no navigation.
- The most likely root cause of the failed insert is the `city` value being sent. `formData.city` defaults to `profile?.city || "Tamale"`, but at the moment the wizard mounts `profile` may still be loading (`null`), so the saved city can mismatch the user's actual profile city. The `stores.city` column is `NOT NULL`, and downstream RLS / city-segmentation logic expects it to equal the profile's city.

The pending-store admin flow (`/admin/stores` → Pending tab filtering `!is_verified && !rejection_reason`) is already wired correctly — once a row lands in `stores` with `is_verified=false`, it will appear for admin review, fee assignment, and approval, exactly like riders.

## Fix

1. `src/hooks/useStore.ts` — `createStore`:
   - Wrap the insert in `try / catch`. On error, show a `toast({ variant: "destructive", title: "Could not submit store", description: error.message })` and re-throw.
   - Before inserting, if `data.city` is falsy, read the latest `profiles.city` for `user.id` and use that; if still null, surface a friendly error asking the user to pick a city (link to `/select-city`) instead of inserting an invalid row.
   - Log the Supabase error to the console so future failures are debuggable.

2. `src/components/seller/StoreSetupWizard.tsx` — `handleSubmit`:
   - Add a `catch` that simply swallows the rethrow (toast is already shown by the hook) so loading resets cleanly and there is no unhandled rejection.
   - Keep `setLoading(false)` in `finally`.

3. `src/pages/SellerDashboard.tsx`:
   - After a successful `createStore`, the hook already calls `setStore(newStore)`, which unmounts the wizard and shows the dashboard with the existing `SubscriptionCard` "Awaiting Admin Review" banner. No further change required, but verify by reading the file after the hook change.

No database migration, no edge function changes, no admin-side changes — the existing pending → approve → assign fee → pay → activate flow already mirrors the rider flow.

## Files touched

- `src/hooks/useStore.ts`
- `src/components/seller/StoreSetupWizard.tsx`

## Out of scope

- Changing the admin review UI (already exists at `/admin/stores`).
- Changes to subscription/payment flow.
- Notifications to admins on new pending stores (can be added later if requested).
