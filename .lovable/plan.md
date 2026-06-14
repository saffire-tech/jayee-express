# Fix "link has expired" on password reset

## Root cause

Supabase JS v2 defaults to the **PKCE auth flow**. When a user requests a password reset, the email link points to our `/reset-password` page with a `?code=...` query parameter (not the older hash-based `#access_token=...` recovery token).

Our current `src/pages/ResetPassword.tsx` only waits for `onAuthStateChange('PASSWORD_RECOVERY')` and an existing session — it never calls `supabase.auth.exchangeCodeForSession(code)`. Result:

- The `?code` is never redeemed.
- The page falls through to the "invalid/expired" branch after the 1.5s timeout.
- If the user clicks again, the code is now actually consumed/expired → same error forever.

This matches the symptom: email arrives fine, link opens the page, page says "expired".

A secondary contributor: PKCE binds the code to the browser that requested the reset (via `code_verifier` in `localStorage`). Opening the link on a different browser/device (or after clearing storage) will also fail with "expired".

## Fix

Update `src/pages/ResetPassword.tsx` to:

1. On mount, read `?code` from `window.location.search`.
2. If present, call `await supabase.auth.exchangeCodeForSession(code)`.
   - On success → `setReady(true)` and clean the `code` param out of the URL.
   - On failure → show the existing "invalid or expired" UI with a clearer message ("Open the link in the same browser you requested it from, or request a new link").
3. Keep the existing `onAuthStateChange` + `getSession` fallback for legacy hash-based links so older outstanding emails still work.
4. Remove the brittle 1.5s `setTimeout` race; only mark `invalid` after the exchange attempt resolves (or, with no `code`/hash and no session, immediately).

No other files need to change. Supabase redirect URLs are already configured (`${window.location.origin}/reset-password` is passed in `resetPasswordForEmail` from `Auth.tsx`), and `/reset-password` is already a public route.

## Technical details

- File touched: `src/pages/ResetPassword.tsx` only.
- New logic sketch:
  ```ts
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) setInvalid(true);
    else {
      url.searchParams.delete("code");
      window.history.replaceState({}, "", url.pathname + url.hash);
      setReady(true);
    }
    return;
  }
  // fall back to hash/session detection (existing behavior)
  ```
- No DB, edge function, or Supabase config changes required.

## Out of scope

- Switching auth to the implicit flow (PKCE is the secure default; we just need to handle it).
- Customizing the auth email template — link format stays the same.
