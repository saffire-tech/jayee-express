## Root cause

Your live site is still using Lovable Cloud OAuth, which sends users to `https://www.jayeeexpress.com/~oauth/initiate...`. That route only works on Lovable hosting, not on your Vercel-hosted custom domain, so Vercel returns 404.

The app must use direct backend Google OAuth on Vercel, which should redirect through the backend `/auth/v1/authorize` flow instead of `~oauth`.

## Plan

1. **Lock the auth page to direct Google OAuth**
   - Update the Google button in `src/pages/Auth.tsx` so it only uses `supabase.auth.signInWithOAuth({ provider: "google" })`.
   - Use a stable production redirect target based on the current site origin, normalizing `www.jayeeexpress.com` to `jayeeexpress.com` so Google/backend redirects are consistent.
   - Add loading/error handling for the Google button so failed OAuth setup shows a useful message instead of silently failing.

2. **Remove the stale Lovable OAuth path from the deployed app flow**
   - Ensure the auth page has no dependency on `@/integrations/lovable` or `lovable.auth.signInWithOAuth`.
   - Search the codebase for any remaining `~oauth` or Lovable OAuth sign-in usage and remove/avoid it if it affects sign-in.

3. **Keep Vercel SPA routing intact**
   - Keep the existing Vercel rewrite for normal React routes.
   - Do not try to make `~oauth/initiate` work in Vercel, because that path belongs to Lovable hosting and is not the correct solution for your current deployment.

4. **Required external settings to verify after the code fix**
   - In Google Cloud OAuth, authorized JavaScript origins should include:
     - `https://jayeeexpress.com`
     - `https://www.jayeeexpress.com`
   - The authorized redirect URI should be the backend callback URL:
     - `https://brqzedcxzjqwzpkwrmow.supabase.co/auth/v1/callback`
   - In backend auth settings, the site URL should be your primary domain, preferably:
     - `https://jayeeexpress.com`
   - Additional redirect URLs should include:
     - `https://jayeeexpress.com/**`
     - `https://www.jayeeexpress.com/**`

5. **Verify**
   - After GitHub/Vercel redeploys, clicking “Continue with Google” should no longer open `/~oauth/initiate`.
   - It should redirect to the backend Google OAuth authorize URL, then return to `jayeeexpress.com` after successful sign-in.