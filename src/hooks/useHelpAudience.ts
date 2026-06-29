import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type HelpAudience = "buyer" | "seller" | "delivery";

export function useHelpAudience() {
  const { user, loading: authLoading } = useAuth();
  const [audience, setAudience] = useState<HelpAudience>("buyer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (authLoading) return;
      if (!user) {
        if (!cancelled) {
          setAudience("buyer");
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        // Seller: owns an approved/verified store
        const { data: store } = await supabase
          .from("stores")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_verified", true)
          .maybeSingle();
        if (store) {
          if (!cancelled) setAudience("seller");
          return;
        }
        // Delivery: has active rider subscription
        const { data: rider } = await supabase.rpc(
          "has_active_rider_subscription",
          { _user_id: user.id }
        );
        if (rider === true) {
          if (!cancelled) setAudience("delivery");
          return;
        }
        if (!cancelled) setAudience("buyer");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { audience, loading };
}
