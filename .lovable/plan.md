## Goal
Reintroduce a category-based commission system. The platform automatically deducts commission from each sale based on the product's category; sellers receive the net amount, riders still receive their delivery fee. Categories are replaced with the 7 you specified, and Tutoring is removed.

## 1. Category overhaul

Replace the category list everywhere with exactly these 7:

| Category | Commission |
|---|---|
| Food | 10% |
| Fashion | 10% |
| Electronics | 10% |
| Water | 5% |
| Stationary | 5% |
| Cosmetics | 10% |
| Photography | 10% |

Files updated:
- `src/components/seller/ProductForm.tsx` — category dropdown
- `src/components/sections/CategoriesSection.tsx` — homepage tiles + icons
- `src/components/home/HomeCategorySidebar.tsx` — sidebar list + icons (use `Droplet` for Water, `BookOpen` for Stationary, `Sparkles` for Cosmetics)

Existing products in retired categories (Books & Notes, Beauty & Care, Tutoring, Services, Sports, Other, Food & Snacks) get a one-time data migration:
- `Food & Snacks` → `Food`
- `Beauty & Care` → `Cosmetics`
- `Books & Notes` → `Stationary`
- Everything else → set `is_active = false` (seller must re-categorise before relisting). Sellers see a banner on their product list explaining why.

## 2. Backend commission engine (single source of truth)

New table `public.category_commissions`:
- `category text PRIMARY KEY`, `commission_pct numeric NOT NULL CHECK (>=0 AND <=100)`, timestamps.
- Seeded with the 7 rows above. Admin-editable later via SQL; not exposed to clients.
- RLS: only `service_role` writes; `authenticated` may read (so admin UI later is trivial).

New helper `public.platform_commission_wallet_user_id()` (returns the configured platform wallet owner uuid from `platform_settings`) — or reuse existing platform_payouts flow. We'll credit commission into a dedicated `platform_payouts`-style accumulator rather than a user wallet, to keep it out of seller-visible balances.

Add `platform_settings` row `commission_wallet_strategy = 'accumulator'` and a new table `public.platform_commission_ledger`:
- `id`, `order_id`, `product_id`, `category`, `gross_amount`, `commission_pct`, `commission_amount`, `created_at`.
- Service-role write only; admins read via `has_role('admin')`.

### Update `finalize_order_payment` RPC

Inside the per-store loop, when computing `_items_total`:
1. For each line item, look up product `category` and the matching `commission_pct` (fallback 0% if category missing).
2. Compute `line_commission = round(price * qty * pct / 100, 2)`.
3. Accumulate `_store_commission` and `_store_net = _items_total - _store_commission`.
4. Credit the seller wallet with `_store_net` (not `_items_total`).
5. Insert one `platform_commission_ledger` row per line item.
6. Seller notification still shows the credited (net) amount only — per your "net only" preference.

Delivery fee logic is untouched: rider still gets their share through the existing `payout-delivery` flow; commission is only on goods, never on the delivery fee.

### Refunds / cancellations

`cancel-order-refund` already debits the seller wallet on cancel. Extend it to also debit (reverse) the matching `platform_commission_ledger` rows so commission isn't kept on cancelled sales. Add a `reversed_at` column to the ledger for audit.

## 3. UI changes (minimal, per "net only")

- Seller wallet & order detail: keep showing the credited (net) amount with no breakdown. No commission column added.
- Admin: extend `/admin/payouts` (or add `/admin/commissions`) with a read-only table of `platform_commission_ledger` totals by day / category, plus a CSV export. This is the only place commission is visible.
- Product form: category dropdown shows the 7 categories only.

## 4. Data migration steps (one SQL migration)

1. Create `category_commissions` + seed.
2. Create `platform_commission_ledger`.
3. `UPDATE products SET category = 'Food' WHERE category = 'Food & Snacks';` etc.
4. `UPDATE products SET is_active = false WHERE category NOT IN (<7 list>);`
5. Replace `finalize_order_payment` with the commission-aware version.
6. Update `cancel-order-refund` edge function to reverse ledger entries.

## Out of scope
- Retroactive commission on already-paid orders (your choice: new orders only).
- Admin UI to edit commission %s (DB-only for now; UI can come later).
- Showing commission breakdown to sellers (your choice: net only).

## Technical notes
- All commission math runs inside the existing advisory-locked transaction in `finalize_order_payment`, so it's atomic with order creation and idempotent on webhook retries.
- `category_commissions` lookup happens server-side only — clients cannot influence the rate.
- Net credit goes through the existing `update_wallet_balance` helper, so balance immutability and audit trails are preserved.
