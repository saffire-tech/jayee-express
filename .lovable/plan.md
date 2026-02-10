

## Maps, Delivery System, and Delivery Role Integration

This is a large feature that touches many parts of the app. Here's the full implementation plan broken into phases.

---

### Phase 1: Database Schema Changes

**1.1 Add `delivery` to the `app_role` enum**
- Add `'delivery'` as a new value in the existing `app_role` enum type
- Admins assign this role via the admin panel (invite only)

**1.2 Add coordinates to the `stores` table**
- Add `latitude` (DOUBLE PRECISION, nullable) and `longitude` (DOUBLE PRECISION, nullable) columns

**1.3 Create `delivery_zones` table**
- Configurable zone-based pricing (admin-managed)
- Columns: `id`, `name`, `min_distance_km`, `max_distance_km`, `fee`, `is_active`, `created_at`
- Seed default zones (e.g. 0-2km = 5, 2-5km = 10, 5-10km = 20)

**1.4 Add delivery columns to `orders` table**
- `delivery_type` (TEXT: 'pickup' or 'delivery', default 'pickup')
- `delivery_fee` (NUMERIC, default 0)
- `delivery_address` (TEXT, nullable)
- `delivery_latitude` (DOUBLE PRECISION, nullable)
- `delivery_longitude` (DOUBLE PRECISION, nullable)
- `delivery_person_id` (UUID, nullable, references auth.users)
- `delivery_status` (TEXT: 'pending', 'accepted', 'picked_up', 'in_transit', 'delivered', default null)

**1.5 Create `delivery_locations` table (for real-time tracking)**
- Columns: `id`, `user_id` (the delivery person), `order_id`, `latitude`, `longitude`, `updated_at`
- Enable realtime on this table
- RLS: delivery person can insert/update their own; buyer and seller of the related order can read

**1.6 RLS Policies**
- `delivery_zones`: Everyone can read active zones; admins can manage all
- `delivery_locations`: Delivery person can manage their own; order buyer/seller can read
- Update `orders` policies to allow delivery persons to update delivery status on their accepted orders

---

### Phase 2: Store Setup - Location Coordinates

**2.1 Update Store Setup Wizard**
- Add a new step (Step 5) with a Mapbox map for picking store location
- Seller taps on the map to place a pin, which saves latitude/longitude
- Show a search box to help find locations on the map

**2.2 Update Store Settings**
- Add a map picker in the Settings tab for existing stores to set/update coordinates
- Display current coordinates on the map

---

### Phase 3: Checkout Flow - Delivery Option

**3.1 Update Cart/Checkout page**
- Before checkout, show a delivery option selector: "Pick up" or "Deliver to me"
- If "Deliver to me" is selected:
  - Show a Mapbox map for the buyer to set their delivery location
  - Calculate distance from store to delivery location
  - Look up the matching delivery zone and display the fee
  - Add delivery fee to the order total
- Save delivery details (type, fee, address, coordinates) with the order

**3.2 Delivery Fee Calculation**
- Use the Haversine formula to calculate straight-line distance between store and buyer coordinates
- Match distance to the appropriate zone in `delivery_zones`
- Display the fee dynamically as the buyer moves the delivery pin

---

### Phase 4: Delivery Person Interface

**4.1 Create Delivery Dashboard page (`/delivery`)**
- Protected route: only users with `delivery` role can access
- Tabs: "Available Orders", "My Deliveries", "History"

**4.2 Available Orders tab**
- List orders with `delivery_type = 'delivery'` and `delivery_status = 'pending'`
- Show order details: items, store name, pickup location, destination, estimated distance
- "Accept" button to claim the delivery

**4.3 Active Delivery view**
- Full-screen Mapbox map in satellite view showing:
  - Delivery person's current GPS location (real-time)
  - Store location (pickup point)
  - Buyer's delivery location (destination)
  - Route line between the three points
- Status progression buttons: "Picked Up" then "In Transit" then "Delivered"
- Real-time location updates sent to `delivery_locations` table every few seconds

**4.4 Navigation integration**
- Add "My Deliveries" link in the navbar when user has delivery role

---

### Phase 5: Real-Time Tracking for Buyer and Seller

**5.1 Order tracking component**
- When an order has `delivery_type = 'delivery'` and a delivery person assigned:
  - Show a Mapbox satellite map on the order detail/purchase history
  - Subscribe to real-time changes on `delivery_locations` for that order
  - Show delivery person's live position, store location, and destination
  - Show delivery status progression

**5.2 Real-time subscriptions**
- Enable realtime on `delivery_locations` and `orders` tables
- Buyer sees live delivery person location on their purchase detail
- Seller sees live tracking on their order detail

---

### Phase 6: Admin Panel Updates

**6.1 Delivery role management**
- Add ability to assign/remove `delivery` role in Users Management page
- Show delivery person badge on user cards

**6.2 Delivery zones management**
- New section or tab in Admin Dashboard to manage delivery zones
- CRUD for zone-based pricing tiers

---

### Technical Details

**Mapbox Setup**
- The Mapbox public access token will be stored in the codebase (it's a publishable key)
- Use `mapbox-gl` npm package for maps
- Satellite style: `mapbox://styles/mapbox/satellite-streets-v12`

**Files to Create**
| File | Purpose |
|------|---------|
| `src/pages/DeliveryDashboard.tsx` | Main delivery person page |
| `src/components/delivery/AvailableOrders.tsx` | List of orders needing delivery |
| `src/components/delivery/ActiveDelivery.tsx` | Active delivery map and controls |
| `src/components/delivery/DeliveryTracker.tsx` | Tracking component for buyer/seller |
| `src/components/maps/MapPicker.tsx` | Reusable map picker (store setup, delivery address) |
| `src/components/maps/DeliveryMap.tsx` | Real-time delivery tracking map |
| `src/components/checkout/DeliveryOption.tsx` | Pickup vs delivery selector |
| `src/hooks/useDeliveryRole.ts` | Check if user has delivery role |
| `src/hooks/useDeliveryTracking.ts` | Real-time location tracking hook |
| `src/lib/distance.ts` | Haversine distance calculation |

**Files to Modify**
| File | Changes |
|------|---------|
| `src/App.tsx` | Add `/delivery` route |
| `src/pages/Cart.tsx` | Add delivery option before checkout |
| `src/components/seller/StoreSetupWizard.tsx` | Add map step for coordinates |
| `src/pages/SellerDashboard.tsx` | Add map to store settings |
| `src/components/seller/OrdersTable.tsx` | Show delivery info on orders |
| `src/components/layout/Navbar.tsx` | Add delivery nav link |
| `src/pages/PurchaseHistory.tsx` | Add tracking map for delivery orders |
| `src/pages/admin/UsersManagement.tsx` | Add delivery role assignment |
| Database migration | All schema changes above |

**Recommended Implementation Order**
1. Database migration (all schema changes at once)
2. Mapbox setup + MapPicker component
3. Store setup wizard update (coordinates)
4. Distance calculation + delivery zones
5. Checkout flow update (delivery option)
6. Delivery dashboard + available orders
7. Active delivery with real-time tracking
8. Buyer/seller tracking view
9. Admin panel updates

---

### What You'll Need

Before I start building, you'll need a **Mapbox access token**:
1. Go to [mapbox.com](https://www.mapbox.com/) and create a free account
2. Copy your **Default public token** from the dashboard
3. Share it here so I can add it to the code (it's a public/publishable key, safe to store in code)

