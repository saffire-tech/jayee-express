import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import UpdateAvailableBanner from "./components/UpdateAvailableBanner.tsx";
import "./index.css";

// One-hour cap between forced update checks while the app is open
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;
// If auto-reload hasn't happened within this window, surface the banner
const BANNER_FALLBACK_MS = 3000;

let triggerUpdate: (() => void) | null = null;
let showBanner: (() => void) | null = null;

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log("[PWA] New version available — applying update");
    // Try to auto-apply immediately
    try {
      updateSW(true);
    } catch (e) {
      console.warn("[PWA] Auto-update failed, showing banner", e);
    }
    // Fallback: if we're still here a few seconds later, show the banner
    setTimeout(() => {
      if (showBanner) showBanner();
    }, BANNER_FALLBACK_MS);
  },
  onOfflineReady() {
    console.log("[PWA] App ready to work offline");
  },
  onRegisteredSW(swUrl, registration) {
    console.log("[PWA] Service worker registered:", swUrl);
    if (!registration) return;

    // Periodically check for updates while the app is open
    const check = () => registration.update().catch(() => {});
    setInterval(check, UPDATE_CHECK_INTERVAL_MS);

    // Check on visibility change (covers installed apps reopened later)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });

    // Check on network restore
    window.addEventListener("online", check);
  },
  onRegisterError(error) {
    console.error("[PWA] SW registration error:", error);
  },
});

triggerUpdate = () => updateSW(true);

const Root = () => {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("modern-app-loaded");
    showBanner = () => setUpdateReady(true);
    return () => {
      showBanner = null;
    };
  }, []);

  return (
    <>
      <App />
      {updateReady && (
        <UpdateAvailableBanner onUpdate={() => triggerUpdate && triggerUpdate()} />
      )}
    </>
  );
};

createRoot(document.getElementById("root")!).render(<Root />);
