---
name: Store Approval & Admin Subscription
description: Stores require admin approval and pay admin-assigned monthly subscription to be visible
type: feature
---
New stores are submitted for admin review (is_verified=false) and only appear publicly after approval + active subscription.

- Store wizard collects a cover photo (step 2 of 6) and submits with `is_verified=false`.
- Admin reviews in `/admin/stores` (Pending/Approved/Rejected tabs):
  - Approve dialog sets `stores.monthly_fee` (₵, admin-assigned) and `is_verified=true`, but leaves `subscription_expires_at = now()` so products stay hidden until owner pays.
  - Reject stores `rejection_reason`, keeps `is_verified=false`.
  - Edit-fee on approved stores updates `stores.monthly_fee`.
- Seller dashboard SubscriptionCard:
  - Pending → "Awaiting Admin Review" banner.
  - Approved + has admin fee → shows ₵fee/month with "Pay & Activate"/"Renew Now" button that calls `initialize-store-subscription`.
- Edge function `initialize-store-subscription` starts Paystack checkout using `stores.monthly_fee`. Metadata `type='store_subscription'`.
- `paystack-webhook` and `verify-payment` both handle `store_subscription`: insert active `store_subscriptions` row and bump `stores.subscription_expires_at`.
- RLS: `Stores visible by city` and `Products visible by store city` policies now also require `subscription_expires_at > now()` for public viewing. Owner and admin branches unchanged.
- Backfill on migration: existing verified stores with null expiry got `now() + 30 days` grace.
