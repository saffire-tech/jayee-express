
## Goal
When users tap "Continue with Google" or "Continue with Apple" on the Auth page:
1. The provider sign-in should run **inside the app** (in-app popup / webview) rather than opening an external browser tab.
2. The consent screen shown by the provider should display **Jayee Express** branding (business name + logo) — not "Lovable".

## What's happening today
`src/pages/Auth.tsx` calls `lovable.auth.signInWithOAuth("google" | "apple", { redirect_uri: window.location.origin })`. The Lovable-managed OAuth client is used, so the Google/Apple consent screen shows "Lovable" as the requesting app. On web, the helper opens a popup; on the installed Android build (Capacitor), it currently escapes to the system browser.

## Plan

### 1. Rebrand the consent screen (business name + logo)
Provider consent screens are controlled by the OAuth client registered with Google / Apple, not by app code. To show "Jayee Express" and our logo we must switch from the managed Lovable OAuth credentials to **Bring-Your-Own-Credentials (BYOC)** for each provider:

- **Google**: Create an OAuth Client ID in Google Cloud Console under a project whose OAuth consent screen is configured with:
  - App name: `Jayee Express`
  - App logo: Jayee Express logo (uploaded, verified)
  - Support email + authorized domain: `jayeeexpress.com`
  - Authorized redirect URI: the callback URL shown in Lovable Cloud → Auth Settings → Google
  - Paste Client ID + Secret into Lovable Cloud → Auth Settings → Google (BYOC).
- **Apple**: Create a Services ID + Sign in with Apple key in Apple Developer Console under the "Jayee Express" App ID (the app name shown on Apple's sheet comes from the Services ID's primary App ID). Generate the client secret JWT in Lovable Cloud → Auth Settings → Apple and paste Team ID, Key ID, Services ID, and the `.p8` contents.

Both steps require credentials only the account owner has, so this part is a **guided manual setup** — no code change on our side. I'll produce a step-by-step checklist with the exact redirect URIs to paste.

### 2. Keep OAuth inside the app (web)
On the web the `lovable.auth.signInWithOAuth` helper already opens a popup and posts the tokens back — no external tab. The current call is correct. I'll verify no code path is forcing a full-page redirect and remove the `redirect_uri: window.location.origin` fallback path only if it's redundant. No visible change expected for web users.

### 3. Keep OAuth inside the Android app (Capacitor)
On the installed Android app the popup helper can't render, so today it hands off to the system browser. To keep it in-app we'll:
- Add `@capacitor/browser` and open the provider authorize URL in an **in-app browser tab** (Chrome Custom Tab) instead of the external browser.
- Register a deep-link scheme (`com.shodel.app://oauth-callback`) in `capacitor.config.ts` and Android `AndroidManifest.xml`.
- Add an app-side listener (`App.addListener('appUrlOpen', ...)`) that closes the in-app tab and calls `supabase.auth.setSession` / `exchangeCodeForSession` with the returned tokens.
- Register the deep-link callback URL in the Google/Apple OAuth client from step 1.

The web `Auth.tsx` flow is untouched; a small `signInWithProvider()` wrapper picks the Capacitor path only when `Capacitor.isNativePlatform()` is true.

### 4. Verify
- Web: click Google → popup shows "Jayee Express" logo + name, closes, user lands signed-in on `/`.
- Android: click Google → Chrome Custom Tab overlays the app showing "Jayee Express", closes automatically after consent, app receives the deep link and completes sign-in.
- Apple: repeat both checks; Apple sheet shows "Jayee Express".

## Files touched (build phase)
- `src/pages/Auth.tsx` — route through new wrapper.
- `src/lib/nativeOAuth.ts` *(new)* — Capacitor Browser + deep-link handler.
- `capacitor.config.ts` and `android/app/src/main/AndroidManifest.xml` — deep-link intent filter + custom scheme.
- No changes to `src/integrations/lovable/index.ts` (auto-generated).

## What I need from you
1. Confirm you want to proceed with BYOC for both Google and Apple (required for custom branding — there is no other way to change the name/logo on the provider sheet).
2. Confirm the business name to display is exactly **Jayee Express** and share (or point me at) the logo file to upload to Google's consent screen.
3. Confirm you're OK adding `@capacitor/browser` for the in-app Android flow.
