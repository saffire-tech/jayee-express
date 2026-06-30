## Goal
Fix Google sign-in on `jayeeexpress.com` while keeping the app hosted on Vercel and using Lovable-managed Google auth.

## Root cause
The Google button sends the browser to:

```text
https://jayeeexpress.com/~oauth/initiate?provider=google&redirect_uri=...
```

That `~oauth` path is not an app page. It must be handled by Lovable's auth broker. On Vercel, the current catch-all rewrite sends every unknown path to `index.html`, so `/~oauth/initiate` falls into the React app and shows the 404 page.

## Plan
1. Update `vercel.json` so `~oauth` routes are forwarded before the SPA fallback:

```json
{
  "rewrites": [
    {
      "source": "/~oauth/:path*",
      "destination": "https://jayee-express.lovable.app/~oauth/:path*"
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

2. Keep the existing auth code unchanged:
   - `src/pages/Auth.tsx` already uses `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` correctly.
   - `src/integrations/lovable/index.ts` is auto-generated and should not be edited.

3. After deployment to Vercel, test:
   - Open `https://jayeeexpress.com/auth`.
   - Click **Continue with Google**.
   - Confirm `/~oauth/initiate` no longer displays the app 404 and proceeds to Google/Lovable auth.

## Important note
If Vercel external rewrites do not preserve this auth broker flow for your domain, the reliable fallback is to connect `jayeeexpress.com` directly in Lovable Project Settings → Domains and use Lovable hosting for the custom domain. Managed OAuth is designed to work natively there.