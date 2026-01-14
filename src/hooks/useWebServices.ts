import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WebService {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const useWebServices = (storeId: string | null) => {
  const { toast } = useToast();
  const [webServices, setWebServices] = useState<WebService[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWebServices = async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("store_web_services")
      .select("*")
      .eq("store_id", storeId)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching web services:", error);
    } else {
      setWebServices(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWebServices();
  }, [storeId]);

  const createWebService = async (
    data: Omit<WebService, "id" | "store_id" | "created_at" | "updated_at">
  ) => {
    if (!storeId) throw new Error("No store ID provided");

    const { data: newService, error } = await supabase
      .from("store_web_services")
      .insert({
        store_id: storeId,
        ...data,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add web service",
        variant: "destructive",
      });
      throw error;
    }

    setWebServices([...webServices, newService]);
    toast({ title: "Web service added!" });
    return newService;
  };

  const updateWebService = async (id: string, updates: Partial<WebService>) => {
    const { error } = await supabase
      .from("store_web_services")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update web service",
        variant: "destructive",
      });
      throw error;
    }

    setWebServices(webServices.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    toast({ title: "Web service updated!" });
  };

  const deleteWebService = async (id: string) => {
    const { error } = await supabase
      .from("store_web_services")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete web service",
        variant: "destructive",
      });
      throw error;
    }

    setWebServices(webServices.filter((s) => s.id !== id));
    toast({ title: "Web service deleted!" });
  };

  return {
    webServices,
    loading,
    createWebService,
    updateWebService,
    deleteWebService,
    refetch: fetchWebServices,
  };
};
