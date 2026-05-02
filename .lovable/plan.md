## Rename app from "Shodel" to "Jayee Express"

The user typed "Jayee Expree" — I'm assuming they meant **"Jayee Express"** (which already appears in `manifest.json` and the footer as "Jayee-express"). If they meant a different spelling, they can correct it before approving.

### Scope

Rename every user-visible "Shodel" string to "Jayee Express". Existing "Uniplug" references in meta tags will also be normalized to "Jayee Express" for consistency. Domain URLs (`uniplug.app`) will be left alone since changing them requires a real domain — I'll flag them but not edit unless requested.

### Files to update (text replacements only)

User-facing UI / copy:
- `index.html` — `<title>`, description, OG/Twitter tags, app-title meta, "Uniplug" → "Jayee Express"
- `src/components/SplashScreen.tsx` — heading "Shodel" → "Jayee Express", alt text
- `src/components/layout/Footer.tsx` — copyright "Jayee-express" → "Jayee Express"
- `src/components/layout/Navbar.tsx` — alt text
- `src/components/sections/DownloadBanner.tsx` — "Get the Shodel App"
- `src/components/sections/FeaturedProducts.tsx`, `FeaturedStores.tsx` — copy
- `src/pages/Auth.tsx`, `Download.tsx`, `Index.tsx`, `Messages.tsx`, `PrivacyPolicy.tsx`, `Products.tsx`, `Stores.tsx`, `Terms.tsx`, `ProductDetail.tsx`, `StorePage.tsx` — page copy, share text, headings, document titles
- `src/contexts/AuthContext.tsx` — any toast/email copy mentioning "Shodel"

Config / infra strings:
- `capacitor.config.ts` — `appName`
- `vite.config.ts` — PWA name/short_name if present
- `src/sw.ts` — notification title fallbacks
- `public/manifest.json` — already "Jayee Express", will verify `short_name` is consistent
- `supabase/functions/og-redirect/index.ts` — site name in OG output
- `supabase/functions/send-email-notification/index.ts` — email "from" name and templates
- `supabase/functions/send-push-notification/index.ts` — default notification title

`src/App.tsx` — document.title or any hardcoded brand string

### What I will NOT change (unless you say so)

- **Logo image files** (`shodel-logo.png`, `shodel-icon.png`, `shodel-logo-white.png`) — file paths stay the same; only the imported component's display text changes. Replacing the actual logo artwork needs new image assets from you.
- **Domain URLs** like `https://uniplug.app` — these are real URLs and changing the string won't change where they point. Tell me the new domain and I'll update them.
- **Capacitor App ID** `com.shodel.app` — changing this breaks installed apps and store listings. Leaving as-is unless you confirm.
- Database/table names and existing data.

### Verification step

After edits, I'll re-run `grep -i shodel` across the repo to confirm zero remaining occurrences in user-visible code.

### Confirm before I proceed

1. Spelling: **"Jayee Express"** — correct? (You typed "Jayee Expree".)
2. Should I also replace **"Uniplug"** in meta tags with "Jayee Express"? (Recommended yes.)
3. Update the Capacitor `appName`/App ID and the `uniplug.app` domain strings, or leave them?