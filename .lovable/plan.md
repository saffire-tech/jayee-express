# Auto-Update for Installed App

## Problem
Users who installed Jayee Express to their home screen keep seeing old versions even after refreshing. This happens because the service worker (`src/sw.ts`) serves cached HTML and assets, and the current registration in `src/main.tsx` uses `confirm()` (which is blocked or ignored inside installed PWAs on many phones), so the new version never activates.

## Fix
Make updates apply automatically, with a small in-app banner as a visible fallback when an update is ready.

### 1. Service worker (`src/sw.ts`)
- Keep `skipWaiting()` + `clientsClaim()` so a new worker takes over immediately.
- Add a **NetworkFirst** runtime route for HTML navigations so the app shell is re-fetched from the network when online and only falls back to cache when offline. This is the core fix — right now precached HTML can be served indefinitely.
- Keep `CacheFirst` only for hashed JS/CSS assets (they already bust on every build).
- Exclude `/~oauth` and `/reset-password` from navigation caching so auth flows always hit the network.

### 2. Registration (`src/main.tsx`)
Replace the `confirm()` prompt with automatic update behavior:
- On `onNeedRefresh`, immediately call `updateSW(true)` to activate the new worker and reload — no user prompt needed in 95% of cases.
- Also poll `registration.update()` every 60 seconds while the app is open, and on `visibilitychange` when the tab/app becomes visible again (covers users who reopen the installed app days later).

### 3. Visible fallback: update banner
Create `src/components/UpdateAvailableBanner.tsx` — a small bottom-of-screen toast (above the mobile tab bar, using existing design tokens) that appears only if the auto-reload hasn't completed within ~3 seconds (edge case: user is mid-form so we delay the reload). It shows "A new version is available" with an **Update now** button that calls `updateSW(true)`. Dismissable; reappears on next update.

### 4. Version surface (small)
Add a `__APP_VERSION__` define in `vite.config.ts` (from `package.json` version + build timestamp) and show it faintly in the More drawer footer. Helps you and users confirm they're on the latest build.

## What users will experience
- Open the installed app → it silently fetches the latest shell in the background → reloads to the new version within a second or two of detecting an update.
- If they're typing in a form when an update arrives, the banner appears instead, and they tap **Update now** when ready.
- No more stuck-on-old-version reports.

## Out of scope
- Native Android/iOS Capacitor build updates (those ship through Play Store / app stores, not the service worker).
- Forcing logout or clearing user data on update.

## Files to change
- `src/sw.ts` — add NetworkFirst navigation route, OAuth/reset exclusions
- `src/main.tsx` — auto-apply updates, periodic + visibility-based update checks, mount banner
- `src/components/UpdateAvailableBanner.tsx` *(new)* — fallback UI
- `vite.config.ts` — inject `__APP_VERSION__` define
- `src/components/layout/MobileTabBar.tsx` — show version in More drawer (tiny text)
