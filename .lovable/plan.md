

# Rebrand "Uniplug" to "Shodel" Across the App

## Overview
Replace every occurrence of "Uniplug" / "UniPlug" / "uniplug" with "Shodel" / "shodel" across ~25 files. This includes UI text, meta tags, email templates, config files, and asset references.

## Files to Update

### Config & Build Files
| File | Changes |
|------|---------|
| `index.html` | All meta tags, title, OG tags, Twitter tags, canonical URL (`uniplug.app` → keep domain or update if changed), app name references |
| `public/manifest.json` | `name`, `short_name` → "Shodel" |
| `vite.config.ts` | PWA manifest `name`, `short_name` → "Shodel" |
| `capacitor.config.ts` | `appId` → `com.shodel.app`, `appName` → `shodel` |

### Core UI Components
| File | Changes |
|------|---------|
| `src/components/SplashScreen.tsx` | Logo import var name, alt text, `<h1>` text → "Shodel" |
| `src/components/layout/Navbar.tsx` | Logo alt text |
| `src/components/layout/Footer.tsx` | Logo alt text, copyright text |
| `src/components/sections/DownloadBanner.tsx` | "Get the Uniplug App" → "Get the Shodel App" |
| `src/App.tsx` | `sessionStorage` key `uniplug_visited` → `shodel_visited` |

### Pages
| File | Changes |
|------|---------|
| `src/pages/Download.tsx` | Helmet title, meta, all "Uniplug" text references |
| `src/pages/ProductDetail.tsx` | Helmet title suffix, OG/meta text, fallback image URLs |
| `src/pages/StorePage.tsx` | Helmet title suffix, OG/meta text, fallback image URLs |
| `src/pages/Products.tsx` | Empty state text "UniPlug" → "Shodel" |
| `src/pages/Cart.tsx` | Disclaimer text "UniPlug" → "Shodel" |
| `src/pages/Terms.tsx` | All legal copy — "Uniplug" → "Shodel" throughout |
| `src/pages/PrivacyPolicy.tsx` | All legal copy — "Uniplug" → "Shodel" |
| `src/pages/Profile.tsx` | Any "Uniplug" references |
| `src/pages/ReportIssue.tsx` | Any "Uniplug" references |
| `src/pages/NotFound.tsx` | Any "Uniplug" references |

### Edge Functions
| File | Changes |
|------|---------|
| `supabase/functions/send-email-notification/index.ts` | Email header "UniPlug" → "Shodel", footer, from name, all references |
| `supabase/functions/get-recommendations/index.ts` | "uniplug" / "UniPlug" → "Shodel" |
| `supabase/functions/og-redirect/index.ts` | Any "Uniplug" text |

### Other
| File | Changes |
|------|---------|
| `src/pages/Auth.tsx` | Any "Uniplug" text on login/signup |
| Logo import: `src/assets/uniplug-logo.png` | Keep file as-is (renaming assets is cosmetic), just update import variable names for clarity |

## Notes
- The logo **image file** (`src/assets/uniplug-logo.png`) will keep its filename to avoid broken references — only display text changes
- Domain URLs like `uniplug.app` in meta tags will be updated to reference "Shodel" in display text, but the actual domain URLs depend on whether you have a new domain. For now I'll keep `uniplug.app` as the domain but change all brand-name text to "Shodel"
- ~25 files modified, no database changes needed

