# Lock completed orders

Once an order's status is "Completed", nobody (seller, buyer, rider or admin) can change it again. It can still be opened and viewed.

## What changes
- **Seller Orders tab:** for completed orders, the status dropdown is replaced by a read-only "Completed" badge. The order details window still opens as normal.
- **Admin Orders page:** the status-change buttons are hidden or disabled for completed orders, with a short "Completed orders are locked" note.
- **Safety net in the database:** any attempt to change the status of a completed order is rejected, even from outside the app. Other details (for example payout bookkeeping) can still be recorded by the system.

## Technical details
- `src/components/seller/OrdersTable.tsx`: render a badge instead of `<Select>` when `order.status === 'completed'`.
- `src/pages/admin/OrdersManagement.tsx`: disable the status actions when the order is completed.
- Migration: `BEFORE UPDATE` trigger on `public.orders` raising an exception when `OLD.status = 'completed'` and `NEW.status IS DISTINCT FROM OLD.status`.
- Add a small test checking that the seller status control is hidden for completed orders.
