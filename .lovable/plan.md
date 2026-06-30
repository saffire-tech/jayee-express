# Fix Google sign-in error on jayeeexpress.com

## What's happening

You're on managed Google OAuth (good — no Google Cloud Console setup needed). The failing URL is:

```
https://www.jayeeexpress.com/~oauth/initiate?provider=google&redirect_uri=https%3A%2F%2Fwww.jayeeexpress.com&...
```

Managed OAuth works by Lovable's hosting proxy intercepting `/~oauth/initiate` and `/~oauth/callback` and routing them through `oauth.lovable.app`. That interception only happens on domains that are fully **Active** in Lovable's domain system.

The request is hitting the `www.` host. If only the apex `jayeeexpress.com` was connected in Project Settings → Domains (and not `www.jayeeexpress.com` as a separate entry), then `www` is being served by something else (or by a partial config) and `/~oauth/initiate` isn't being proxied — so it falls through to the SPA, which shows your "return to home" error page.

This is a hosting/domain configuration issue, not a code bug. `src/pages/Auth.tsx` is calling `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` correctly — no code change is needed there.

## Steps to fix

1. **Open Project Settings → Domains.** Confirm BOTH of these are listed with status **Active**:
   - `jayeeexpress.com`
   - `www.jayeeexpress.com`

   If `www.jayeeexpress.com` is missing, click **Connect Domain**, enter `www.jayeeexpress.com`, and complete the DNS step (add the A record `www → 185.158.133.1` at your registrar, plus the `_lovable` TXT record if prompted). Wait for it to go Active (can take minutes to a few hours; up to 72h worst case).

2. **Set one as Primary.** In the same Domains panel, mark one (typically `jayeeexpress.com`) as **Primary**. The other will redirect to it. This ensures OAuth always initiates from the Primary host with a consistent `redirect_uri`.

3. **Hard-refresh and retry.** Open the site in a private window, go to `/auth`, click **Continue with Google**. The `/~oauth/initiate` request should now be intercepted by Lovable's proxy and forward you to Google's consent screen.

## If both domains are already Active

Then the proxy interception itself is failing for this domain. In that case:
- Tell me what status each domain shows (Active / Verifying / Setting up / Offline / Failed).
- Try signing in with Google from the Lovable preview URL (`https://id-preview--…lovable.app/auth`). If that works, it confirms the code is fine and the issue is domain-side.
- I'll then open a support path rather than changing code — managed OAuth on custom domains is supposed to work without any code changes.

## Out of scope

- No edits to `src/pages/Auth.tsx`, `src/integrations/lovable/index.ts`, or auth config. Managed Google OAuth is already set up correctly; the failure is at the hosting/domain layer.
- No need to add your own Google Cloud OAuth credentials.

<presentation-actions>
<presentation-open-publish>Open Project settings → Domains</presentation-open-publish>
</presentation-actions>
