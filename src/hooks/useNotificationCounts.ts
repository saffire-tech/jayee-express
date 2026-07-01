import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationCounts {
  unreadMessages: number;
  pendingOrders: number;
  unreadNotifications: number;
  totalNotifications: number;
}

export const useNotificationCounts = () => {
  const { user } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({
    unreadMessages: 0,
    pendingOrders: 0,
    unreadNotifications: 0,
    totalNotifications: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCounts({ unreadMessages: 0, pendingOrders: 0, unreadNotifications: 0, totalNotifications: 0 });
      setLoading(false);
      return;
    }

    const fetchCounts = async () => {
      try {
        // Fetch unread messages count
        const { count: unreadMessages, error: messagesError } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("receiver_id", user.id)
          .eq("is_read", false);

        if (messagesError) {
          console.error("Error fetching unread messages:", messagesError);
        }

        // Fetch unread notifications count
        const { count: unreadNotifications, error: notificationsError } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false);

        if (notificationsError) {
          console.error("Error fetching unread notifications:", notificationsError);
        }

        // Fetch pending orders count (for store owners)
        // First get the user's store
        const { data: store, error: storeError } = await supabase
          .from("stores")
          .select("id")
          .eq("user_id", user.id)
          .single();

        let pendingOrders = 0;
        if (!storeError && store) {
          const { count: ordersCount, error: ordersError } = await supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("store_id", store.id)
            .eq("status", "pending");

          if (!ordersError) {
            pendingOrders = ordersCount || 0;
          }
        }

        const unreadCount = unreadMessages || 0;
        const unreadNotifCount = unreadNotifications || 0;
        setCounts({
          unreadMessages: unreadCount,
          pendingOrders,
          unreadNotifications: unreadNotifCount,
          totalNotifications: unreadCount + pendingOrders + unreadNotifCount,
        });
      } catch (error) {
        console.error("Error fetching notification counts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();

    // Subscribe to real-time updates for messages
    const messagesChannel = supabase
      .channel("notification-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    // Subscribe to real-time updates for orders
    const ordersChannel = supabase
      .channel("notification-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    // Subscribe to real-time updates for notifications
    const notificationsChannel = supabase
      .channel("notification-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    const handleManualRefresh = () => fetchCounts();
    window.addEventListener("notifications-updated", handleManualRefresh);
    window.addEventListener("messages-updated", handleManualRefresh);

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(notificationsChannel);
      window.removeEventListener("notifications-updated", handleManualRefresh);
      window.removeEventListener("messages-updated", handleManualRefresh);
    };
  }, [user]);

  return { ...counts, loading };
};
