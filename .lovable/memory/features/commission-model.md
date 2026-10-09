---
name: Commission Model
description: No commission on purchases; platform earns from store subscriptions and 10% of each delivery fee
type: feature
---
- Purchases: 0% commission. Sellers receive the full item subtotal (category_commissions all set to 0).
- Store owners pay the platform via monthly subscription only.
- Riders: platform keeps 10% of each delivery fee; rider wallet gets 90% on buyer-confirmed receipt (payout-delivery). Logged in platform_commission_ledger with category 'Delivery'.
- Example: item ₵30 + delivery ₵20 → buyer pays ₵50, store gets ₵30, rider gets ₵18, platform ₵2.
