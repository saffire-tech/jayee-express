
# Show Orders to Nearest Delivery People

## Overview
Update the Available Orders view so delivery people see orders sorted by how close they are to the store. Each order card will show the distance from the delivery person's current location to the store, making it natural for the nearest delivery person to see and accept orders first.

## How It Works
1. When a delivery person opens the Available Orders tab, the app requests their current GPS location
2. For each available order, the distance from the delivery person to the order's store is calculated
3. Orders are sorted nearest-first, so the closest orders appear at the top
4. Each order card shows "X km from you" so delivery people can judge proximity at a glance

This way, delivery people naturally see the orders closest to them first and can accept them before others further away even scroll to them.

## Changes

### Modify `src/components/delivery/AvailableOrders.tsx`
- Add a `navigator.geolocation.watchPosition` call to continuously track the delivery person's current location
- After fetching orders and store details, calculate the distance from the delivery person's location to each store using the existing `haversineDistance` function
- Sort the orders array by this distance (ascending -- nearest first)
- Update the order card UI to show:
  - **"X km from you"** (distance from delivery person to the store) prominently
  - Keep the existing store-to-buyer distance as secondary info
- Show a location permission prompt/status if geolocation is denied

### No database or backend changes needed
- The delivery person's GPS is obtained via the browser's Geolocation API (already used elsewhere in the app)
- Store coordinates are already stored in the `stores` table and fetched with each order
- The `haversineDistance` utility in `src/lib/distance.ts` handles the calculation

## Technical Details

### Location Tracking in AvailableOrders
```
- useState for deliveryPersonPosition { latitude, longitude }
- useEffect with navigator.geolocation.watchPosition to keep it updated
- After orders are fetched, compute distance from deliveryPersonPosition to each order.store
- Sort orders by that distance ascending
- Display distance on card as "X.X km from you"
```

### Updated Order Card Layout
Each card will show:
- Store name and location (existing)
- **"X.X km from you"** with a navigation icon (new -- distance to store from delivery person)
- Store-to-buyer distance (existing, relabeled as "Delivery distance")
- Order amount and delivery fee badges (existing)
- Accept button (existing)

### Files to modify
1. `src/components/delivery/AvailableOrders.tsx` -- add geolocation tracking, sort by proximity, update card UI
