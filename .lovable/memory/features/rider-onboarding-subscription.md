---
name: Rider Onboarding & Subscription
description: Self-serve delivery rider applications, admin review, monthly subscription
type: feature
---
Users self-apply to become delivery riders from Profile (3-way mode: Buyer/Seller/Delivery).

- `rider_applications` table: full_name, ghana_card_number, ghana_card_url, photo_id_url, house_address, motor_registration, phone, status (pending/approved/rejected), monthly_fee, rejection_reason, reviewed_by, reviewed_at.
- Private storage bucket `rider-documents` with per-user folder RLS (`{user_id}/*`); admins can read all.
- Admin reviews in `/admin/riders`. On approve: sets `monthly_fee`, grants `user_roles.role='delivery'`, sends notification. On reject: stores reason, no role granted.
- `delivery_subscriptions` table mirrors store subs (user_id, monthly_fee, starts_at, expires_at, status, payment_reference).
- Edge function `initialize-delivery-subscription` starts Paystack checkout using rider's assigned `monthly_fee`.
- `paystack-webhook` branch `type=rider_subscription` inserts active sub.
- `useDeliveryRole` returns `{ isDeliveryPerson, hasActiveSubscription }`. AvailableOrders gated behind active subscription.
- Admin can no longer manually assign delivery role from UsersManagement — only via approving a rider application.
