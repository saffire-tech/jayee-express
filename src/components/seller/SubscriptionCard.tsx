import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Crown, AlertTriangle } from "lucide-react";
import SubscribeDialog from "./SubscribeDialog";

interface Props {
  storeId: string;
  productCount: number;
  onUpdated?: () => void;
}

interface StoreSub {
  product_limit: number;
  subscription_expires_at: string | null;
  current_plan_id: string | null;
}

const useCountdown = (target: string | null) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff / 3600000) % 24);
  const minutes = Math.floor((diff / 60000) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { expired: false, days, hours, minutes, seconds };
};

const SubscriptionCard = ({ storeId, productCount, onUpdated }: Props) => {
  const [store, setStore] = useState<StoreSub | null>(null);
  const [planName, setPlanName] = useState<string>("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("stores")
      .select("product_limit, subscription_expires_at, current_plan_id")
      .eq("id", storeId)
      .single();
    if (data) {
      setStore(data as StoreSub);
      if (data.current_plan_id) {
        const { data: p } = await supabase
          .from("subscription_plans")
          .select("name")
          .eq("id", data.current_plan_id)
          .single();
        setPlanName(p?.name || "");
      }
    }
  };

  useEffect(() => { load(); }, [storeId]);

  // Refresh when window regains focus (after Paystack redirect)
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [storeId]);

  const cd = useCountdown(store?.subscription_expires_at || null);
  const noSub = !store?.subscription_expires_at;
  const isExpired = cd?.expired || noSub;

  return (
    <>
      <Card className={`p-5 ${isExpired ? "border-destructive/50 bg-destructive/5" : "border-primary/30"}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${isExpired ? "bg-destructive/10" : "bg-primary/10"}`}>
              {isExpired ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <Crown className="h-5 w-5 text-primary" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">
                  {isExpired ? "No Active Subscription" : `${planName} Plan`}
                </h3>
                {!isExpired && (
                  <Badge variant="outline">
                    {productCount} / {store?.product_limit || 0} products
                  </Badge>
                )}
              </div>
              {isExpired ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Subscribe to a plan to start listing products.
                </p>
              ) : (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <CalendarClock className="h-4 w-4" />
                  <span>
                    Renews in <span className="font-mono font-semibold text-foreground">
                      {cd!.days}d {cd!.hours}h {cd!.minutes}m {cd!.seconds}s
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
          <Button onClick={() => setOpen(true)} variant={isExpired ? "default" : "outline"}>
            {isExpired ? "Subscribe Now" : "Renew / Upgrade"}
          </Button>
        </div>
      </Card>

      <SubscribeDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { load(); onUpdated?.(); } }} />
    </>
  );
};

export default SubscriptionCard;
