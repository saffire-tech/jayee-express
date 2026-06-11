import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Redirects signed-in users without a city to /select-city.
 * Allowlist routes are excluded so unauthenticated/onboarding flows still work.
 */
const ALLOWLIST = [
  "/auth",
  "/select-city",
  "/reset-password",
  "/privacy-policy",
  "/terms",
  "/download",
];

export const RequireCity = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (profile.city) return;
    const path = location.pathname;
    if (ALLOWLIST.some((p) => path === p || path.startsWith(p + "/"))) return;
    // Public product/store deep-links can still be browsed without a city
    if (path.startsWith("/product/") || path.startsWith("/store/")) return;
    navigate("/select-city", { replace: true });
  }, [user, profile, loading, location.pathname, navigate]);

  return null;
};

export default RequireCity;
