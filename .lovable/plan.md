
# Delivery Directions + Buyer Confirmation Flow

## Overview
Two features: (1) Show turn-by-turn route directions on the delivery map using the Mapbox Directions API, and (2) Add a buyer confirmation step where the buyer must click "Received" after the delivery person marks the order as delivered. Only after buyer confirmation does the delivery move to history and disappear from available deliveries.

## Flow Changes

**Current flow:**
Delivery marks "Delivered" -> order immediately moves to history

**New flow:**
Delivery marks "Delivered" -> delivery_status becomes `delivered` -> buyer sees "Confirm Received" button -> buyer clicks it -> delivery_status becomes `confirmed` -> order moves to delivery history and tracking ends

## 1. Database Migration

Add support for the new `confirmed` delivery status value. Currently `delivery_status` is a text column, so no enum change is needed -- we just need to use `confirmed` as a new status value in the code.

No schema changes required since `delivery_status` is a plain text column.

## 2. DeliveryMap -- Add Route Directions

**File: `src/components/maps/DeliveryMap.tsx`**

- After the map loads, use the Mapbox Directions API (`https://api.mapbox.com/directions/v5/mapbox/driving/...`) to fetch a route between the delivery person's current location and the next destination (store if status is `accepted`, buyer location if `picked_up` or `in_transit`).
- Add a new prop `routeFrom` and `routeTo` (or derive from delivery status) to determine the route endpoints.
- Draw the route as a GeoJSON line layer on the map using `map.addSource` and `map.addLayer`.
- Update the route whenever the delivery person's location changes.
- Show route distance and estimated time on the map.

New props added to `DeliveryMapProps`:
- `showRoute?: boolean` -- whether to fetch and display a route
- `deliveryStatus?: string` -- to determine route destination (store vs buyer)

## 3. ActiveDelivery -- Pass Route Info to Map

**File: `src/components/delivery/ActiveDelivery.tsx`**

- Pass `showRoute={true}` and `deliveryStatus={order.delivery_status}` to `DeliveryMap`.
- When delivery person marks as "Delivered", set `delivery_status` to `delivered` but do NOT set `status` to `delivered` yet. The main order `status` should only change to `delivered` when the buyer confirms.
- After marking delivered, show a "Waiting for buyer confirmation" message instead of immediately calling `onComplete()`.
- Subscribe to real-time updates on the order so that when the buyer confirms (setting `delivery_status` to `confirmed`), the delivery person sees the completion and `onComplete()` is called.

## 4. DeliveryDashboard -- Update History Query

**File: `src/pages/DeliveryDashboard.tsx`**

- Update the history fetch to include orders with `delivery_status = 'confirmed'` (instead of just `delivered`).
- Update the active delivery check: keep showing `ActiveDelivery` for `delivered` status (waiting for buyer confirmation), only complete when `confirmed`.

## 5. Buyer Confirmation -- "Received" Button

**File: `src/pages/PurchaseHistory.tsx`**

- When `delivery_status === 'delivered'`, show a prominent "Confirm Received" button on the order card.
- Clicking it updates the order: `delivery_status = 'confirmed'` and `status = 'delivered'`.
- Show appropriate UI states (loading, success).

## 6. DeliveryTracker -- Show Confirmed Status

**File: `src/components/delivery/DeliveryTracker.tsx`**

- Add `confirmed` to the status labels: "Buyer confirmed receipt".
- Hide the live tracking map once status is `confirmed`.

## 7. AvailableOrders -- No Changes Needed

The query already filters by `delivery_status = 'pending'` and `delivery_person_id IS NULL`, so confirmed/delivered orders won't appear.

## Technical Details

### Mapbox Directions API Call
```
GET https://api.mapbox.com/directions/v5/mapbox/driving/{lng1},{lat1};{lng2},{lat2}?geometries=geojson&overview=full&access_token={token}
```
The response contains a `routes[0].geometry` GeoJSON LineString to draw on the map, plus `duration` and `distance`.

### Route Layer Drawing
- Add a GeoJSON source `route` to the map
- Add a line layer with a colored stroke (e.g., blue dashed line)
- Update the source data when the delivery person moves or status changes

### Status Flow Summary
```
pending -> accepted -> picked_up -> in_transit -> delivered -> confirmed
                                                    ^              ^
                                          delivery person     buyer confirms
                                          marks delivered     receipt
```

### Files to Create/Modify
1. **Modify** `src/components/maps/DeliveryMap.tsx` -- Add route directions layer
2. **Modify** `src/components/delivery/ActiveDelivery.tsx` -- Pass route props, handle "waiting for confirmation" state
3. **Modify** `src/pages/DeliveryDashboard.tsx` -- Update history query to use `confirmed`
4. **Modify** `src/pages/PurchaseHistory.tsx` -- Add "Confirm Received" button
5. **Modify** `src/components/delivery/DeliveryTracker.tsx` -- Add `confirmed` status label
6. **Modify** `src/components/delivery/AvailableOrders.tsx` -- No changes needed (already correct)
