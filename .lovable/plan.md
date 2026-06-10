## Why Google login is broken on jayeeexpress.com

Your site is hosted on **Vercel**, not on Lovable hosting. The current Google sign‑in code uses Lovable's managed OAuth flow:

```ts
const { lovable } = await import("@/integrations/lovable/index");
await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
```

That flow redirects the browser to `https://jayeeexpress.com/~oauth/initiate`. The `/~oauth/*` paths only exist on Lovable's hosting proxy — Vercel knows nothing about them, so it returns the **404 NOT_FOUND (cdg1)** error you saw (cdg1 = Vercel Paris edge).

Managed Lovable OAuth cannot work on a Vercel-hosted domain. Since you already have your own Google Cloud OAuth credentials, the fix is to switch sign‑in to Supabase's native OAuth flow (which works on any host) and point Google + Supabase at jayeeexpress.com.

---

## Plan

### 1. Switch Google sign-in to Supabase native OAuth
- In `src/pages/Auth.tsx`, replace the `lovable.auth.signInWithOAuth("google", ...)` block with:
  ```ts
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/` },
  });
  ```
- Leave the `src/integrations/lovable/` folder in place (auto‑generated) but stop calling it.

### 2. Configure your own Google credentials in the backend
Tell you (manual step in Cloud → Users → Auth Settings → Sign In Methods → Google):
- Turn **off** "Use Lovable‑managed Google" (so your own client ID/secret are used).
- Paste your Google **Client ID** and **Client Secret**.
- Copy the **Callback URL** shown there — it will look like  
  `https://brqzedcxzjqwzpkwrmow.supabase.co/auth/v1/callback`.

### 3. Update Google Cloud Console (you do this in console.cloud.google.com)
On your OAuth 2.0 Web Client:

**Authorized JavaScript origins**
- `https://jayeeexpress.com`
- `https://www.jayeeexpress.com`
- `https://jayee-express.lovable.app` (keep Lovable preview working)

**Authorized redirect URIs**
- `https://brqzedcxzjqwzpkwrmow.supabase.co/auth/v1/callback` ← the only one Google actually redirects to

**OAuth consent screen → Authorised domains**
- `jayeeexpress.com`
- `supabase.co`

### 4. Add jayeeexpress.com to Supabase Auth URL allow‑list
In Cloud → Users → Auth Settings → URL Configuration:
- **Site URL:** `https://jayeeexpress.com`
- **Additional Redirect URLs:** add
  - `https://jayeeexpress.com/**`
  - `https://www.jayeeexpress.com/**`
  - `https://jayee-express.lovable.app/**` (preview)
  - `http://localhost:8080/**` (dev)

Without these, Supabase will reject the post‑login redirect back to your domain.

### 5. Move Resend to jayeeexpress.com
Two Edge Functions currently send from `onboarding@resend.dev`:
- `supabase/functions/notify-new-device/index.ts`
- `supabase/functions/send-email-notification/index.ts`

Change every `from` to:
```
Jayee Express <noreply@jayeeexpress.com>
```
(or another mailbox on your verified domain — confirm which mailbox you want, default `noreply@`.)

Then redeploy both functions.

Things you must verify in Resend yourself:
- `jayeeexpress.com` shows **Verified** in Resend → Domains (SPF/DKIM/DMARC green).
- The `RESEND_API_KEY` secret already stored in this project belongs to the Resend account that owns the verified domain. If you rotated the key when you switched domains, I'll prompt you to update it via the secrets tool.

### 6. Make the new domain serve the app smoothly
- Add `www.jayeeexpress.com` in Vercel and set one as primary with a 308 redirect to the other (recommend apex `jayeeexpress.com` as primary, `www` → apex).
- Confirm Vercel project has SPA rewrite (`/* → /index.html`) so deep links don't 404. (Vite/React Router needs this on Vercel; Lovable hosting did it automatically.) If missing, I'll add a `vercel.json` with:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
- The Mapbox public token is already domain‑agnostic, no change needed.
- The Lovable preview at `jayee-express.lovable.app` keeps working because we keep it in both Google's origins and Supabase's redirect list.

---

## What I will change in code (build mode)

1. `src/pages/Auth.tsx` — swap the Google button handler to `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: ... } })`.
2. `supabase/functions/notify-new-device/index.ts` — `from` → `Jayee Express <noreply@jayeeexpress.com>`.
3. `supabase/functions/send-email-notification/index.ts` — same `from` change.
4. (If you confirm Vercel is missing SPA rewrite) add `vercel.json` at project root.

## What you do manually (I can't reach these)
- Google Cloud Console: origins + redirect URI + consent screen domains (Section 3).
- Cloud → Users → Auth Settings: paste Google Client ID/Secret, set Site URL + redirect allow‑list (Sections 2 + 4).
- Resend dashboard: confirm `jayeeexpress.com` is verified.
- Vercel: confirm both apex + www are attached and pointing to the right project.

## Questions before I build
- Confirm the sender mailbox: `noreply@jayeeexpress.com` OK, or do you prefer `hello@`, `support@`, `notifications@`?
- Do you already have a `vercel.json` in your repo? If unsure I'll add the SPA rewrite defensively.
