import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MaintenanceState = {
  enabled: boolean;
  message: string;
  eta: string | null;
  imageUrl: string | null;
  updatedAt: string | null;
  loaded: boolean;
};

const DEFAULT: MaintenanceState = {
  enabled: false,
  message: "We are performing scheduled maintenance. We'll be back shortly.",
  eta: null,
  imageUrl: null,
  updatedAt: null,
  loaded: false,
};

function parse(value: string | null, updatedAt: string | null): MaintenanceState {
  try {
    const v = value ? JSON.parse(value) : {};
    return {
      enabled: !!v.enabled,
      message: v.message || DEFAULT.message,
      eta: v.eta ?? null,
      imageUrl: v.image_url ?? null,
      updatedAt,
      loaded: true,
    };
  } catch {
    return { ...DEFAULT, loaded: true };
  }
}

export function useMaintenanceMode(): MaintenanceState {
  const [state, setState] = useState<MaintenanceState>(DEFAULT);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value, updated_at")
        .eq("key", "maintenance_mode")
        .maybeSingle();
      if (cancelled) return;
      setState(parse((data?.value as string) ?? null, (data?.updated_at as string) ?? null));
    };
    load();

    const channel = supabase
      .channel("maintenance_mode")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings", filter: "key=eq.maintenance_mode" },
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (!row) return;
          setState(parse(row.value ?? null, row.updated_at ?? null));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return state;
}
