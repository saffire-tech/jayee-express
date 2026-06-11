# Google + Apple Sign-In and Password Reset

## What you'll get
- One-tap **Sign in with Google** and **Sign in with Apple** buttons on the Auth page (works on web + installed PWA).
- **Forgot password** link on the sign-in form that emails a reset link.
- A new **/reset-password** page where users set a new password and are then signed in.
- Existing email/password login stays exactly as-is.

## Steps

1. **Enable social providers (Lovable Cloud managed)**
   - Turn on Google and Apple via Cloud's managed OAuth — no Google/Apple developer keys required from you. Email/password stays enabled.
   - Apple Sign-In on iOS native shell can be added later; this plan covers the web/PWA flow which works on all devices including iPhone browsers.

2. **Update `src/pages/Auth.tsx`**
   - Add "Continue with Google" and "Continue with Apple" buttons above the email form, with a divider ("or continue with email").
   - Add a "Forgot password?" link under the password field (sign-in mode only) that opens a small inline form to enter the email and triggers a reset email.
   - Use the Lovable managed OAuth client (`lovable.auth.signInWithOAuth("google" | "apple")`) so it works on the custom domain `jayeeexpress.com` and the lovable.app preview.

3. **Create `src/pages/ResetPassword.tsx`** and route `/reset-password` in `src/App.tsx`
   - Public route (not behind auth).
   - Detects the recovery session from the URL, shows "New password" + "Confirm password" fields, calls `supabase.auth.updateUser({ password })`, then redirects to `/` with a success toast.
   - Handles expired/invalid links with a clear message and a button back to the forgot-password form.

4. **Service worker check**
   - Confirm `src/sw.ts` excludes `/~oauth` from navigation fallback so the OAuth redirect always hits the network (required for PWA). Add the exclusion if missing.

5. **Styling**
   - Buttons use existing design tokens (no hardcoded colors). Google button shows the Google "G" mark; Apple button shows the Apple logo — both rendered with brand-correct SVGs on a `bg-background` / `border` shell so they look good in light and dark mode.

## Technical notes
- Reset email link target: `${window.location.origin}/reset-password`.
- After OAuth, users land back on `/` with their session already set; the existing `AuthContext` `onAuthStateChange` listener will fetch their profile automatically (auto-creates via the `handle_new_user` trigger if it's their first sign-in).
- Suspension check in `AuthContext` continues to apply to OAuth users.
- No DB changes required.

## Out of scope (ask if you want these)
- Native Apple Sign-In inside the Capacitor Android/iOS build (different SDK).
- Customizing the password-reset email template/branding (separate auth-email-templates setup).
