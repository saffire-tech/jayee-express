## Goal
When someone opens the app on a keypad/feature phone (KaiOS, Opera Mini extreme mode, old Nokia browsers) they currently see a blank white screen because the React SPA needs JavaScript they don't support. Instead, they should see a readable, navigable HTML page they can actually use.

## Approach
Add a `<noscript>` fallback directly inside `index.html`. This is the only reliable way to reach these browsers — an edge/UA-detection route won't help because Opera Mini downgrades pages after they load, and KaiOS often fails silently on modern JS bundles.

The fallback renders as plain HTML with inline CSS. No JS, no external fonts, no images beyond a small logo. Browsers that run JS never see it (React mounts and replaces the root); browsers that can't run JS see the fallback instead of a white screen.

## What the fallback page contains
1. Jayee Express header with tagline
2. Short message: "You're viewing the lite version because your browser doesn't support our full app. For the complete shopping experience, please open Jayee Express on a smartphone."
3. Contact / action links (each a plain `<a href>`):
   - Call support: `tel:` link (need the number from you)
   - WhatsApp order: `https://wa.me/<number>` (need the number)
   - Instagram: existing handle
   - Email: `mailto:support@jayeeexpress.com`
4. Short list of the cities served (Tamale, Wa) so users know if they're in range
5. Link to the full site URL, in case they can forward it to a smartphone

## Files to change
- `index.html` — add a `<noscript>` block inside `<body>` (before the `<div id="root">`) with the fallback markup and a scoped `<style>` block. Also add `<meta http-equiv="content-language">` and ensure the existing viewport meta stays. No changes to the React app, routes, or build config.

## What this does NOT include
- No cart, checkout, product browsing, or search in the fallback (per your choice of "static no-JS fallback page").
- No server-side rendering, no separate lite site, no USSD/SMS channel.
- No changes to Vite, Vercel config, or the SPA.

## Open question before implementing
What phone number should the "Call support" and "WhatsApp order" links use? If you'd rather I skip those and only show Instagram + email + a "open on a smartphone" message, say so and I'll proceed with that.
