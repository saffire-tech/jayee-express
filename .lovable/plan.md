

## Plan: Delivery System Improvements

### Summary
Seven enhancements to the delivery workflow: gate delivery availability behind seller confirmation, show available orders on a map, auto-payout on buyer confirmation, track completed deliveries in history, preview route before accepting, and show live delivery status updates in the buyer's tracker.

---

### Step 1: Gate delivery availability behind seller confirmation

**Current**: Available orders query filters `delivery_status = 'pending'`. Orders are created with `delivery_status = 'pending'` for delivery-type orders.

**Change**: In both `verify-payment` and `paystack-webhook` edge functions, set `delivery_status` to `NULL` (not `'pending'`) for delivery orders on creation. When the seller changes order status to `'confirmed'`, a client-side handler in `OrdersTable` or the `onUpdateStatus` function will also set `delivery_status = 'pending'` for delivery-type orders.

**Files**: `supabase/functions/verify-payment/index.ts`, `supabase/functions/paystack-webhook/index.ts`, `src/hooks/useStore.ts` (or wherever `onUpdateStatus` is implemented), `src/components/seller/OrdersTable.tsx`.

Also update the RLS SELECT policy for delivery persons to continue working: orders only become visible when `delivery_status = 'pending'`.

---

### Step 2: Show available deliveries on a map (not a list)

**Current**: `AvailableOrders` renders a card list.

**Change**: Replace the list with a full Mapbox map centered on the delivery person's location. Each available order is a marker on the map (store location). Clicking a marker opens a popup/bottom sheet with order details (store name, delivery fee, distance, order items) and Accept/Reject buttons. Order items will be fetched from `order_items` joined with `products` when the popup opens.

**Files**: `src/components/delivery/AvailableOrders.tsx` (major rewrite to map-based UI).

---

### Step 3: Auto-payout on buyer confirmation

**Current**: `ConfirmReceivedButton` already calls `payout-delivery` edge function. This is working.

**Verification**: Confirm this flow is solid. No changes needed — the payout is already triggered right after buyer confirms receipt.

---

### Step 4: Move completed deliveries to history

**Current**: `DeliveryDashboard` already fetches history where `delivery_status = 'confirmed'`. When the buyer confirms, the `ActiveDelivery` component detects it via realtime and calls `onComplete()`, which clears `activeOrderId` and triggers a history re-fetch.

**Verification**: This should already work. Ensure the `useEffect` dependency on `activeOrderId` triggers a re-fetch of history. No changes needed.

---

### Step 5: Preview route and order items before accepting

**Change**: When a delivery person clicks an order marker on the map (Step 2), the detail popup will include:
- A route preview (delivery person → store → buyer) using Mapbox Directions API, showing distance and ETA
- Order items list (fetched from `order_items` + `products`)
- Accept and Close buttons

This is built into the map popup/bottom sheet from Step 2.

**Files**: `src/components/delivery/AvailableOrders.tsx` (part of the map rewrite).

---

### Step 6: Seller confirms before delivery availability

Same as Step 1 — already covered.

---

### Step 7: Live delivery status updates in buyer's tracker

**Current**: `DeliveryTracker` already subscribes to realtime changes on the `orders` table for `delivery_status`. The status badge shows the current status label. This is already implemented.

**Enhancement**: Make the tracker visible for ALL active delivery statuses (not hidden when `delivered`). Currently the `PurchaseHistory` hides the tracker when status is `delivered` — but the buyer needs to see the "Delivered" status before confirming. Update the filter condition.

**Files**: `src/pages/PurchaseHistory.tsx` — change the condition to show tracker for all statuses except `confirmed`.

---

### Technical Details

**Edge function changes** (verify-payment & paystack-webhook):
- For delivery orders: set `delivery_status: null` instead of `'pending'`

**Seller status update handler**:
- When seller sets order status to `'confirmed'` and `delivery_type === 'delivery'`, also set `delivery_status = 'pending'`

**AvailableOrders map rewrite**:
- Full-screen Mapbox map with markers for each available order's store location
- Delivery person's location shown as a distinct marker
- Click marker → bottom sheet with: store name, delivery address, fee, distance/ETA (via Mapbox Directions), order items list, Accept button
- Route preview drawn on map when an order is selected

**PurchaseHistory tracker visibility**:
- Change filter from `!== 'confirmed' && !== 'delivered'` to just `!== 'confirmed'`

