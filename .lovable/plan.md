## Maintenance Mode

Add an admin-controlled maintenance mode that blocks all non-admin access with a branded "Under Maintenance" screen.

### Backend
- Add row to `platform_settings` table (key = `maintenance_mode`) with `{ enabled, message, eta }` JSON value. Public read (so gate works pre-auth), admin-only write via RLS using `has_role`.
- Enable realtime on `platform_settings` so toggling propagates instantly to all live sessions.

### Frontend gate
- New hook `useMaintenanceMode()` — subscribes to the setting via Supabase realtime + initial fetch, cached in React Query.
- New component `MaintenanceGate` wrapping `<Routes>` in `src/App.tsx`. When `enabled === true`:
  - If current user is an admin (`useAdmin`) → render children normally + show a small "Maintenance mode ON" banner at top so they can still access `/admin` to toggle it off.
  - Otherwise → render `MaintenancePage` for every route (including `/auth`).
- `MaintenancePage` (`src/pages/Maintenance.tsx`) — modern branded screen: Jayee Express logo, animated illustration, headline "We'll be right back", admin-defined message, optional ETA, social links, "Retry" button. Uses existing design tokens (orange primary, glass-morphism, framer-motion), dark-mode aware, mobile-first.

### Admin control
- New card in `AdminDashboard` (or `platform_settings` section): toggle switch + message textarea + optional ETA datetime + Save button. Shows current status and last-updated timestamp.

### Notes
- Keep `/admin/*` routes reachable for admins so they can turn it back off.
- Lite fallback (`public/lite/`) is static HTML served by an edge function — out of scope for this toggle unless you want it covered too.
- Service worker: no changes; the gate re-evaluates on every mount and via realtime.

### Files touched
- Migration: seed `platform_settings` row + policies + realtime publication.
- `src/hooks/useMaintenanceMode.ts` (new)
- `src/components/MaintenanceGate.tsx` (new)
- `src/pages/Maintenance.tsx` (new)
- `src/components/admin/MaintenanceModeCard.tsx` (new) + mount in `AdminDashboard.tsx`
- `src/App.tsx` (wrap routes)
