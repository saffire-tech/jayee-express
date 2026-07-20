import { ReactNode } from "react";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { useAdmin } from "@/contexts/AdminContext";
import MaintenancePage from "@/pages/Maintenance";
import { AlertTriangle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

// Routes that must remain reachable during maintenance so admins can
// sign in and turn the mode back off from any device/browser.
const ALLOWED_PATHS = new Set<string>([
  "/auth",
  "/reset-password",
  "/.lovable/oauth/consent",
  "/unsubscribe",
]);

export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { enabled, message, eta, imageUrl, loaded } = useMaintenanceMode();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const location = useLocation();

  if (!enabled || !loaded) return <>{children}</>;
  if (ALLOWED_PATHS.has(location.pathname)) return <>{children}</>;

  // Admins can still use the app to toggle it off
  if (!adminLoading && isAdmin) {
    return (
      <>
        <div className="sticky top-0 z-[200] bg-amber-500 text-black text-sm px-4 py-2 flex items-center justify-center gap-2 shadow">
          <AlertTriangle className="h-4 w-4" />
          <span>Maintenance mode is ON — only admins can access the app.</span>
          <Link to="/admin" className="underline font-medium ml-2">
            Manage
          </Link>
        </div>
        {children}
      </>
    );
  }

  return <MaintenancePage message={message} eta={eta} imageUrl={imageUrl} />;
}
