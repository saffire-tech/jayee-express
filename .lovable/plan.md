# Delivery Rider Onboarding & Subscription

Riders self-apply from their Profile. Admin reviews the application, and on approval assigns a monthly fee. Riders renew monthly like store owners. Admin can no longer assign the `delivery` role directly — it's earned through this flow.

## 1. Profile: Mode = Buyer / Seller / Delivery

In `src/pages/Profile.tsx`, expand the Current Mode card from 2 buttons to 3: **Buyer**, **Seller**, **Delivery**.

When the user picks **Delivery**:
- If they have no `rider_applications` row → open the application form (below).
- If application is `pending` → show "Application under review".
- If `rejected` → show reason + allow re-apply.
- If `approved` but no active subscription → show "Pay monthly fee to activate" CTA.
- If `approved` AND active subscription → switch `current_mode = 'delivery'` (unlocks Delivery Dashboard tab).

## 2. Rider Application Form

New component `src/components/delivery/RiderApplicationForm.tsx` collects:
- Full name (prefilled from profile)
- Ghana Card number (text, validated GHA-XXXXXXXXX-X format)
- Ghana Card photo upload (front)
- Photo ID / selfie upload
- House address (text)
- Motorbike registration number (text)
- Phone number (prefilled)

Files upload to a new private `rider-documents` storage bucket. On submit, insert a `rider_applications` row with `status='pending'`.

## 3. Admin Review

New admin page `src/pages/admin/RiderApplications.tsx` (linked in `AdminSidebar`):
- Lists pending / approved / rejected applications with applicant info, document previews (signed URLs), and city.
- **Approve**: opens dialog to set `monthly_fee` (₵), then sets `status='approved'`, grants `user_roles.role = 'delivery'`, and creates the user's first `delivery_subscriptions` row (1 month from approval, status `pending_payment` — rider pays to activate).
- **Reject**: requires reason; stores it; does NOT grant role.
- **Revoke**: removes role + cancels subscription.

Remove any existing admin UI that assigns the delivery role manually (audit `UsersManagement.tsx` and strip the option if present).

## 4. Monthly Subscription (mirrors store subs)

New table `delivery_subscriptions` (user_id, monthly_fee, starts_at, expires_at, status, payment_reference). New edge function `initialize-delivery-subscription` (clone of `initialize-subscription` but for riders, using their assigned `monthly_fee`). Paystack webhook extended to credit rider subs on success.

Add `RiderSubscriptionCard` to the Delivery Dashboard showing days remaining + "Renew" button.

## 5. Enforcement

- `useDeliveryRole` hook extended to also require an active `delivery_subscriptions.expires_at > now()`. Expired riders lose access to `AvailableOrders`.
- RLS on `orders` for couriers: existing policies already gate by `delivery_person_id`; we add an `EXISTS` check that the rider has an active subscription before allowing `UPDATE` for delivery actions.
- City filter (already implemented) continues to scope available orders.

## Database changes (one migration)

```sql
CREATE TABLE public.rider_applications (
  id uuid PK, user_id uuid → auth.users, city text,
  full_name, ghana_card_number, ghana_card_url, photo_id_url,
  house_address, motor_registration, phone,
  status text CHECK (pending|approved|rejected) DEFAULT 'pending',
  monthly_fee numeric, rejection_reason text,
  reviewed_by uuid, reviewed_at timestamptz,
  created_at, updated_at
);
-- GRANTs, RLS: applicant can SELECT/INSERT own; admin full access.

CREATE TABLE public.delivery_subscriptions (
  id uuid PK, user_id uuid, monthly_fee numeric,
  starts_at, expires_at, status text, payment_reference text, created_at
);
-- GRANTs, RLS: owner SELECT, admin full, service_role full.

-- Storage bucket 'rider-documents' (private) + RLS allowing
-- applicant to upload to {user_id}/* and admin to read all.
```

## Files

**New:** `RiderApplicationForm.tsx`, `RiderSubscriptionCard.tsx`, `pages/admin/RiderApplications.tsx`, `supabase/functions/initialize-delivery-subscription/index.ts`, migration, storage bucket.

**Edited:** `Profile.tsx` (3-way mode + delivery flow), `AdminSidebar.tsx` (new link), `useDeliveryRole.ts` (sub check), `DeliveryDashboard.tsx` (sub card + gate), `paystack-webhook/index.ts` (handle rider sub).

## Out of scope

- Refunds for partial months, automated reminders (can reuse existing notifications later), KYC verification beyond admin eyeballing docs, multi-city rider transfers.
