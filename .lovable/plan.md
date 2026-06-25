# Move jayeeexpress.com from Lovable hosting to Vercel

Backend (database, edge functions, auth, storage) stays on Lovable Cloud — only the React frontend moves. The Vercel app will keep talking to the same Lovable Cloud project via `VITE_SUPABASE_*` env vars.

## What I'll change in the project (build mode)

The project is already mostly Vercel-ready (`vercel.json` has SPA rewrites, build is `vite build` → `dist`). Small hardening to do before cutover:

1. **`vercel.json`** — keep the SPA rewrite, add long-cache headers for `/assets/*` and a no-cache header for `/sw.js` + `/manifest.webmanifest` so the PWA updates correctly.
2. **`.env.example`** — add a committed example file listing the three required Vite vars so future contributors know what to set in Vercel.
3. **No code edits to** `src/integrations/supabase/client.ts`, `.env`, or `supabase/config.toml` (auto-generated / Lovable-managed).

Nothing else in the app needs changing — Edge Functions stay deployed on Lovable Cloud at `https://brqzedcxzjqwzpkwrmow.supabase.co/functions/v1/*` and the frontend already calls them via the Supabase client.

## Step-by-step migration (you do this in your dashboards)

### 1. Push code to GitHub
- In Lovable: top-right **GitHub → Connect to GitHub → Create Repository**.
- This creates a repo with the full project. Two-way sync stays on, so you can keep editing in Lovable and Vercel auto-redeploys.

### 2. Import into Vercel
- vercel.com → **Add New → Project → Import** the GitHub repo.
- Framework preset: **Vite** (auto-detected).
- Build command: `bun run build` (or leave the auto-detected `vite build`).
- Output directory: `dist`.
- Install command: `bun install` (auto).

### 3. Set environment variables in Vercel
Under **Project Settings → Environment Variables**, add for **Production, Preview, Development**:

```
VITE_SUPABASE_PROJECT_ID    = brqzedcxzjqwzpkwrmow
VITE_SUPABASE_URL           = https://brqzedcxzjqwzpkwrmow.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = (copy from your Lovable .env — the long eyJ... anon key)
VITE_VAPID_PUBLIC_KEY       = (copy from your Lovable .env)
```

These are all publishable / public keys — safe to put in Vercel. Click **Deploy**. You'll get a `*.vercel.app` URL. Open it and confirm login, products, checkout, and push notifications work end-to-end against Lovable Cloud.

### 4. Add the domain in Vercel (BEFORE removing it from Lovable)
- Vercel project → **Settings → Domains → Add** `jayeeexpress.com` and again `www.jayeeexpress.com`.
- Vercel will show "Invalid Configuration" and the records it expects. Note them:
  - **Apex** `jayeeexpress.com` → A record `76.76.21.21`
  - **www** `www.jayeeexpress.com` → CNAME `cname.vercel-dns.com`
- Pick which one is **Primary** in Vercel (usually apex), the other auto-redirects.

### 5. Remove the domain from Lovable
- Lovable → **Project Settings → Project → Domains** → three-dot menu next to `jayeeexpress.com` (and the `www` entry) → **Remove**. Do the same for `www.jayeeexpress.com`.
- This releases the domain so Vercel can claim it. Your Lovable `jayee-express.lovable.app` URL keeps working.

### 6. Update DNS at your registrar
Log in to wherever you bought `jayeeexpress.com` and replace the existing records:

| Type  | Name | Value                        | TTL  |
|-------|------|------------------------------|------|
| A     | `@`  | `76.76.21.21`                | 3600 |
| CNAME | `www`| `cname.vercel-dns.com`       | 3600 |

Delete:
- The old A record `185.158.133.1` (Lovable's IP) on both `@` and `www`.
- The old `_lovable` TXT verification record (no longer needed).

If your registrar is Cloudflare, set the proxy to **DNS only** (grey cloud) initially so Vercel can verify and issue SSL, then you can re-enable proxy if you want.

### 7. Wait for verification + SSL
- In Vercel → Domains, both entries flip to **Valid Configuration** → SSL issues automatically (usually minutes, up to ~24h depending on DNS propagation).
- Visit `https://jayeeexpress.com` and `https://www.jayeeexpress.com` to confirm.

### 8. Post-cutover checks
- Test deep links (e.g. `/cart`, `/admin`) refresh without 404 — covered by `vercel.json` rewrites.
- Test Paystack callback URL still resolves to `jayeeexpress.com` (no change needed since the domain is the same).
- Test PWA install + push notifications.
- Test Google OAuth (the redirect URL is `window.location.origin` so it'll just work on the same domain).

## Technical details

- **Why backend doesn't move:** Edge Functions, DB, auth, storage live in the Lovable Cloud Supabase project. Vercel just hosts the static Vite build that calls them via HTTPS. Nothing in `supabase/functions/*` is bundled into the frontend.
- **GitHub two-way sync stays:** edits in Lovable push to GitHub → Vercel auto-deploys on push. You don't have to leave Lovable.
- **Rollback plan:** if anything goes wrong, switch DNS back to A `185.158.133.1` and re-add the domain in Lovable Project Settings → Domains. The `jayee-express.lovable.app` deploy is never deleted.
- **PWA service worker caching:** the cache-control headers I'll add to `vercel.json` prevent stale `sw.js` so users get updates on next visit.

## Out of scope

- Migrating Edge Functions or DB off Lovable Cloud.
- Custom domain on the Lovable preview URL.
- Changing the Capacitor Android app (it points at the same Supabase URL — no change).
