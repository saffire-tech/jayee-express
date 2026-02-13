
# Multi-Store Delivery: Route Planning, Map Labels, and Fair Pricing

## The Problem
When a buyer has items from multiple stores in their cart:
1. Only the first store's coordinates are used for delivery -- the other stores are ignored
2. The delivery fee is calculated based on a single store-to-buyer distance, which underpays the delivery person who must visit multiple stops
3. The delivery person's map only shows one store, with no guidance for multi-stop routes

## How It Will Work After This Change

**For the buyer (Cart / Checkout):**
- The DeliveryOption component will accept ALL store locations from the cart, not just one
- The map will show labeled markers for each store (by store name) so the buyer can see the pickup points
- The delivery fee will be calculated as the **total route distance** (optimized path visiting all stores then the buyer), not just one store-to-buyer distance
- The fee breakdown will show: "Total route: X.X km across N stores"

**For the delivery person (ActiveDelivery map):**
- The map will show labeled markers for ALL stores involved in the buyer's order group
- The route will guide the delivery person store-by-store, then to the buyer
- Each store marker will display the store's name in a popup for easy identification

**Pricing logic:**
- Calculate the optimal route distance: delivery person location (or first store) -> store 1 -> store 2 -> ... -> buyer
- Sum total route distance and look up the delivery zone fee for that total distance
- This means the buyer pays a fair fee for the full multi-stop trip, and the delivery person earns accordingly

## Technical Changes

### 1. Update `src/pages/Cart.tsx`
- Instead of fetching coordinates for only `items[0].product.store_id`, collect ALL unique store IDs from the cart
- Fetch coordinates + names for every store
- Pass an array of store locations to the DeliveryOption component

### 2. Rewrite `src/components/checkout/DeliveryOption.tsx`
- Change props from single `storeLatitude/storeLongitude` to an array of stores: `stores: Array<{ id: string; name: string; latitude: number | null; longitude: number | null }>`
- Enable the "Deliver to Me" option if **at least one** store has coordinates
- When the buyer selects their location on the map:
  - Also display labeled markers for each store on the MapPicker
  - Calculate the total route distance: sum of distances along the chain (store 1 -> store 2 -> ... -> buyer), using a nearest-neighbor ordering to optimize the path
  - Look up the delivery zone fee for the total route distance
  - Show breakdown: "Route: Store A -> Store B -> You = X.X km total"
- Pass the total fee back via `onDeliveryChange`

### 3. Update `src/components/maps/MapPicker.tsx`
- Add an optional `storeMarkers` prop: `Array<{ name: string; latitude: number; longitude: number }>`
- When provided, render a labeled marker (with store name popup) for each store on the map
- These are display-only markers (not draggable) -- the buyer still clicks to set their own location

### 4. Update `src/components/delivery/ActiveDelivery.tsx`
- When the delivery person accepts an order, also fetch all related orders from the same buyer's checkout session (orders created at the same time with the same buyer)
- Show all store markers on the DeliveryMap with store name labels
- The route will sequence through all stores then to the buyer

### 5. Update `src/components/maps/DeliveryMap.tsx`
- Change `storeLocation` prop from a single location to an array: `storeLocations: Array<{ name: string; latitude: number; longitude: number }>`
- Render a labeled marker for each store (blue markers with name popups)
- Update the route-fetching logic to build a multi-waypoint route through all stores then to the buyer using Mapbox Directions API waypoints
- Update the bounds fitting to include all store points

### 6. Update checkout logic in `Cart.tsx` (`handleConfirmCheckout`)
- When creating orders for each store group, distribute the delivery fee proportionally across stores (or apply total fee to first order and 0 to others -- simpler approach)
- Store the total route fee on each order so the delivery person sees the full earning

## Route Distance Calculation (Pricing)
The pricing will use a simple nearest-neighbor approach:
1. Start from the first store
2. Go to the nearest unvisited store
3. Repeat until all stores are visited
4. Finally go to the buyer's location
5. Sum all leg distances to get the total route distance
6. Look up the delivery zone fee for that total distance

This ensures the delivery person is compensated for the full multi-stop trip.

## Files to modify
1. `src/pages/Cart.tsx` -- fetch all store coords, pass array to DeliveryOption, adjust fee distribution at checkout
2. `src/components/checkout/DeliveryOption.tsx` -- accept multiple stores, calculate multi-stop route distance, show labeled stores on map
3. `src/components/maps/MapPicker.tsx` -- add optional store markers with name labels
4. `src/components/maps/DeliveryMap.tsx` -- support multiple store locations with name labels, multi-waypoint routing
5. `src/components/delivery/ActiveDelivery.tsx` -- fetch related orders' stores for multi-stop map display
