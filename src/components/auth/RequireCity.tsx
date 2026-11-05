import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_CITY } from "@/config/locations";

/**
 * Jayee Express serves Accra only: any signed-in user without a city
 * (or with a retired city) is silently assigned Accra.
 */
export const RequireCity = () => {
  const { user, profile, loading, updateProfile } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (loading || !user || !profile || done.current) return;
    if (profile.city === DEFAULT_CITY) return;
    done.current = true;
    updateProfile({ city: DEFAULT_CITY } as any).catch(() => { done.current = false; });
  }, [user, profile, loading, updateProfile]);

  return null;
};

export default RequireCity;
