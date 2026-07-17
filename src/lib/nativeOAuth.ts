import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";

/**
 * OAuth for native (Capacitor) builds.
 *
 * Opens the provider consent screen inside an in-app Chrome Custom Tab / SFSafariViewController
 * (via @capacitor/browser) instead of the external system browser, then listens for the
 * deep-link callback (com.shodel.app://oauth-callback#access_token=...) to complete sign-in.
 *
 * Requires (native side):
 *  1. Deep-link intent filter in android/app/src/main/AndroidManifest.xml for
 *     scheme "com.shodel.app" host "oauth-callback".
 *  2. iOS URL Type in Info.plist with the same scheme.
 *  3. The Supabase Auth provider (Google / Apple) must have this redirect URL
 *     added to its "Additional Redirect URLs":
 *       com.shodel.app://oauth-callback
 */

const NATIVE_REDIRECT = "com.shodel.app://oauth-callback";

export const isNativeApp = () => Capacitor.isNativePlatform();

export async function nativeSignInWithOAuth(provider: "google" | "apple") {
  // Ask Supabase to build the provider authorize URL but do not let the browser navigate.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: NATIVE_REDIRECT,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    throw error ?? new Error("Could not start sign-in");
  }

  // Promise that resolves when the deep link fires back into the app.
  const waitForCallback = new Promise<void>(async (resolve, reject) => {
    const urlListener = await App.addListener("appUrlOpen", async (event) => {
      if (!event.url || !event.url.startsWith(NATIVE_REDIRECT)) return;
      try {
        const url = new URL(event.url);
        const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
        const fragment = new URLSearchParams(hash);
        const query = url.searchParams;

        const access_token = fragment.get("access_token");
        const refresh_token = fragment.get("refresh_token");
        const code = query.get("code");

        if (access_token && refresh_token) {
          const { error: sessErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessErr) throw sessErr;
        } else if (code) {
          const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchErr) throw exchErr;
        } else {
          throw new Error("No tokens returned from provider");
        }

        await urlListener.remove();
        try { await Browser.close(); } catch { /* noop */ }
        resolve();
      } catch (e) {
        await urlListener.remove();
        try { await Browser.close(); } catch { /* noop */ }
        reject(e);
      }
    });

    // If user backs out of the in-app browser without completing.
    const closeListener = await Browser.addListener("browserFinished", async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        await urlListener.remove();
        await closeListener.remove();
        reject(new Error("Sign-in was cancelled"));
      }
    });
  });

  await Browser.open({
    url: data.url,
    presentationStyle: "popover",
    windowName: "_self",
  });

  await waitForCallback;
}
