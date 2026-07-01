import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Bell, 
  Mail, 
  Smartphone, 
  ShoppingBag, 
  MessageSquare, 
  AlertTriangle,
  Check,
  Trash2,
  CheckCheck,
  ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  channel: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  channel: string;
  title: string;
  body: string;
  data: unknown;
  is_read: boolean;
  created_at: string;
};

const NotificationCenter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchNotifications();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          console.log("Notification update:", payload);
          if (payload.eventType === "INSERT") {
            const newNotif = payload.new as NotificationRow;
            setNotifications(prev => [{
              ...newNotif,
              data: (newNotif.data as Record<string, unknown>) || null,
            }, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as NotificationRow;
            setNotifications(prev =>
              prev.map(n => n.id === updated.id ? {
                ...updated,
                data: (updated.data as Record<string, unknown>) || null,
              } : n)
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setNotifications(prev => prev.filter(n => n.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform the data to match our interface
      const transformed: Notification[] = (data || []).map((row: NotificationRow) => ({
        ...row,
        data: (row.data as Record<string, unknown>) || null,
      }));
      setNotifications(transformed);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", ids);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (ids.includes(n.id) ? { ...n, is_read: true } : n))
      );
      setSelectedIds([]);
      window.dispatchEvent(new Event("notifications-updated"));
      toast.success("Marked as read");
    } catch (error) {
      console.error("Error marking as read:", error);
      toast.error("Failed to mark as read");
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await markAsRead(unreadIds);
  };

  const deleteNotifications = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .in("id", ids);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
      setSelectedIds([]);
      toast.success("Notifications deleted");
    } catch (error) {
      console.error("Error deleting notifications:", error);
      toast.error("Failed to delete notifications");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const filteredNotifications = getFilteredNotifications();
    if (selectedIds.length === filteredNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map(n => n.id));
    }
  };

  const getFilteredNotifications = () => {
    switch (activeTab) {
      case "email":
        return notifications.filter(n => n.channel === "email");
      case "push":
        return notifications.filter(n => n.channel === "push");
      case "unread":
        return notifications.filter(n => !n.is_read);
      default:
        return notifications;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "order":
        return <ShoppingBag className="h-5 w-5 text-primary" />;
      case "message":
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case "low_stock":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getChannelIcon = (channel: string) => {
    return channel === "email" ? (
      <Mail className="h-4 w-4" />
    ) : (
      <Smartphone className="h-4 w-4" />
    );
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead([notification.id]);
    }

    // Navigate based on type
    const data = notification.data as { url?: string };
    if (data?.url) {
      navigate(data.url);
    }
  };

  const filteredNotifications = getFilteredNotifications();
  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Notification Center</h1>
            <p className="text-muted-foreground">
              View all your notifications in one place
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-sm">
              {unreadCount} unread
            </Badge>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              All
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="push" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Push
            </TabsTrigger>
            <TabsTrigger value="unread" className="flex items-center gap-2">
              <Badge variant="outline" className="h-5 px-1.5">
                {unreadCount}
              </Badge>
              Unread
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Actions Bar */}
        {filteredNotifications.length > 0 && (
          <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.length === filteredNotifications.length && filteredNotifications.length > 0}
                onCheckedChange={selectAll}
              />
              <span className="text-sm text-muted-foreground">
                {selectedIds.length > 0
                  ? `${selectedIds.length} selected`
                  : "Select all"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAsRead(selectedIds)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Mark Read
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteNotifications(selectedIds)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={markAllAsRead}>
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Mark All Read
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Notifications List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-16 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No notifications</h3>
              <p className="text-muted-foreground">
                {activeTab === "unread"
                  ? "You're all caught up!"
                  : "You don't have any notifications yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map(notification => (
              <Card
                key={notification.id}
                className={`transition-colors cursor-pointer hover:bg-accent/50 ${
                  !notification.is_read ? "bg-primary/5 border-primary/20" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.includes(notification.id)}
                      onCheckedChange={() => toggleSelect(notification.id)}
                      onClick={e => e.stopPropagation()}
                    />
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getTypeIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4
                              className={`font-medium truncate ${
                                !notification.is_read ? "text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {notification.title}
                            </h4>
                            {!notification.is_read && (
                              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {notification.body}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              {getChannelIcon(notification.channel)}
                              {notification.channel === "email" ? "Email" : "Push"}
                            </span>
                            <span>
                              {format(new Date(notification.created_at), "MMM d, h:mm a")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default NotificationCenter;
