
# Show Contact Info Between Delivery Person and Buyer + Enable Messaging

## Overview
When a delivery person accepts an order, both parties need to see each other's name and contact details, and be able to message each other directly within the app.

## Changes

### 1. Modify `src/components/delivery/ActiveDelivery.tsx` (Delivery Person's View)
- After fetching the order, also fetch the **buyer's profile** from the `profiles` table using `order.buyer_id`
- Display a contact card showing the buyer's **name** and **phone number**
- Add a "Message Buyer" button using the existing `ContactSellerDialog` component (repurposed for general messaging) or a direct link to `/messages?with={buyer_id}`

### 2. Modify `src/pages/PurchaseHistory.tsx` (Buyer's View)
- When an order has `delivery_type === 'delivery'` and `delivery_person_id` is set (i.e., a delivery person has accepted), fetch the **delivery person's profile** from the `profiles` table
- Display a contact card showing the delivery person's **name** and **phone number**
- Add a "Message Delivery Person" button that links to `/messages?with={delivery_person_id}`
- Show this info for active delivery statuses (`accepted`, `picked_up`, `in_transit`, `delivered`)

### 3. Update data fetching

**In `ActiveDelivery.tsx`:**
- After fetching the order, make an additional query:
  ```
  profiles table -> where user_id = order.buyer_id -> select full_name, phone
  ```
- Render a card with the buyer's name, phone (clickable tel: link), and a "Message" button

**In `PurchaseHistory.tsx` (`fetchOrders`):**
- For orders with a `delivery_person_id`, fetch:
  ```
  profiles table -> where user_id = order.delivery_person_id -> select full_name, phone
  ```
- Add `delivery_person` profile data to the order object
- Render a contact card in the order display when delivery is active

### 4. No database changes needed
- The `profiles` table already has `full_name` and `phone` columns
- The `profiles` table has a public SELECT RLS policy (`true`), so both parties can read each other's profiles
- The `messages` table already supports direct messaging between any two users
- The messaging page (`/messages?with={userId}`) already handles opening a conversation with a specific user

## Technical Details

### Contact Card UI (shared pattern for both views)
A small card/section within the order showing:
- User avatar or icon
- Full name
- Phone number (as a clickable `tel:` link for mobile)
- "Message" button linking to `/messages?with={userId}`

### Files to modify
1. **`src/components/delivery/ActiveDelivery.tsx`** -- fetch buyer profile, show buyer contact card with message button
2. **`src/pages/PurchaseHistory.tsx`** -- fetch delivery person profile for each delivery order, show delivery person contact card with message button
