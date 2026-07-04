import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { openPaystackCheckout } from "@/lib/paystackInline";

const RiderSubscriptionCard = () => {
  const { user } = useAuth();
  const [sub, setSub] = useState<any>(null);
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: subs }, { data: apps }] = await Promise.all([
      supabase
        .from("delivery_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("expires_at", { ascending: false })
        .limit(1),
      supabase
        .from("rider_applications")
        .select("monthly_fee, status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .order("reviewed_at", { ascending: false })
        .limit(1),
    ]);
    setSub(subs?.[0] || null);
    setApp(apps?.[0] || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleRenew = async () => {
    if (!user || !app?.monthly_fee) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("initialize-delivery-subscription", {
        body: { email: user.email, months: 1 },
      });
      if (error) throw error;
      if (data?.authorization_url) window.location.href = data.authorization_url;
    } catch (e: any) {
      toast.error(e.message || "Failed to start payment");
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;

  const isActive = sub && sub.status === "active" && new Date(sub.expires_at) > new Date();
  const daysLeft = sub ? differenceInDays(new Date(sub.expires_at), new Date()) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          Rider Subscription
        </CardTitle>
        {isActive ? (
          <Badge variant="outline" className="border-green-600 text-green-600">Active</Badge>
        ) : (
          <Badge variant="destructive">Inactive</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Monthly fee: <span className="font-semibold text-foreground">₵{Number(app?.monthly_fee || 0).toFixed(2)}</span>
        </div>
        {isActive ? (
          <div className="text-sm">
            Renews on <span className="font-medium">{format(new Date(sub.expires_at), "MMM d, yyyy")}</span>
            <span className="text-muted-foreground"> ({daysLeft} days left)</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pay your monthly subscription to start receiving delivery orders.
          </p>
        )}
        <Button onClick={handleRenew} disabled={paying || !app?.monthly_fee} className="w-full" variant="hero">
          {paying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isActive ? "Renew Now" : "Pay & Activate"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default RiderSubscriptionCard;
