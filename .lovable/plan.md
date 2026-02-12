
# Mobile Bottom Tab Bar Navigation

## Overview
Replace the mobile hamburger menu with a fixed bottom tab bar containing 5 tabs: Home, Products, Stores, Cart (with badge), and a "More" hamburger button. The "More" button opens a slide-up sheet/drawer with the remaining navigation items (notifications, messages, profile, deliveries, admin, seller store, sign out, etc.). Desktop navigation remains unchanged.

## Changes

### 1. Create new component: `src/components/layout/MobileTabBar.tsx`
A fixed bottom tab bar visible only on mobile (md:hidden):
- **Home** (House icon) -- links to `/`
- **Products** (ShoppingBag icon) -- links to `/products`
- **Stores** (Store icon) -- links to `/stores`
- **Cart** (ShoppingCart icon + badge) -- links to `/cart`
- **More** (Menu icon + notification badge) -- opens a drawer/sheet with remaining items

The active tab is highlighted based on current route using `useLocation()`.

The "More" drawer contains:
- Search bar
- Get App link
- Notifications (with badge)
- Messages (with badge)
- Profile
- My Deliveries (if delivery person)
- My Store (if seller, with pending orders badge)
- Admin Dashboard (if moderator)
- Purchase History
- Sign In / Open Store / Start Shopping (if not logged in)
- Sign Out (if logged in)

### 2. Modify `src/components/layout/Navbar.tsx`
- Remove the mobile hamburger button and mobile dropdown menu entirely
- Keep all desktop navigation as-is
- The top navbar on mobile will only show the logo and search bar (simplified)

### 3. Modify `src/pages/Index.tsx` and other pages
- Add bottom padding (`pb-16`) on mobile to prevent content from being hidden behind the tab bar
- Import and render `MobileTabBar` in the app layout (either in each page or globally)

### 4. Add `MobileTabBar` globally
Place the `MobileTabBar` component inside `App.tsx` (within the Router/Auth/Cart providers) so it appears on all pages on mobile without needing to add it to every page individually.

## Technical Details

### MobileTabBar Component Structure
- Uses `useLocation()` to determine active tab
- Uses `useIsMobile()` hook to only render on mobile
- Uses the Vaul `Drawer` component (already installed) for the "More" menu
- Fixed positioning: `fixed bottom-0 left-0 right-0 z-50`
- Height: `h-16` with `border-t` separator
- Each tab: flex column with icon + label, active state uses primary color
- Cart badge shows `totalItems` count
- More button badge shows `totalNotifications` count

### Navbar Changes
- Remove lines 158-293 (mobile hamburger button + mobile menu)
- On mobile, navbar becomes just logo + search (compact top bar)

### Global Padding
- Add `pb-16 md:pb-0` to main content areas or use a CSS class on the body for mobile bottom spacing
- This prevents the tab bar from covering content at the bottom of pages

### Files Summary
1. **Create** `src/components/layout/MobileTabBar.tsx` -- new bottom tab bar component
2. **Modify** `src/components/layout/Navbar.tsx` -- remove mobile hamburger, simplify mobile top bar
3. **Modify** `src/App.tsx` -- add `MobileTabBar` globally inside router
4. **Modify** `src/pages/Index.tsx` -- add bottom padding for mobile
