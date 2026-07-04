import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Crown, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import SubscribeDialog from "./SubscribeDialog";
import { openPaystackCheckout } from "@/lib/paystackInline";

interface Props {
  storeId: string;
  productCount: number;
  onUpdated?: () => void;
}

interface StoreSub {
  product_limit: number | null;
  subscription_expires_at: string | null;
  current_plan_id: string | null;
  monthly_fee: number | null;
  is_verified: boolean | null;
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
  const { user } = useAuth();
  const [store, setStore] = useState<StoreSub | null>(null);
  const [planName, setPlanName] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("stores")
      .select("product_limit, subscription_expires_at, current_plan_id, monthly_fee, is_verified")
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
      } else {
        setPlanName("");
      }
    }
  };

  useEffect(() => { load(); }, [storeId]);

  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [storeId]);

  // If returning from Paystack with a reference, verify it (fallback if webhook is delayed)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (params.get("subscription") === "success" && reference) {
      supabase.functions.invoke("verify-payment", { body: { reference } })
        .then(() => load())
        .finally(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("reference");
          url.searchParams.delete("trxref");
          url.searchParams.delete("subscription");
          window.history.replaceState({}, "", url.toString());
        });
    }
  }, []);

  const cd = useCountdown(store?.subscription_expires_at || null);
  const noSub = !store?.subscription_expires_at;
  const isExpired = cd?.expired || noSub;
  const isPending = store?.is_verified === false;
  const hasAdminFee = !!store?.monthly_fee && Number(store.monthly_fee) > 0;

  const payAdminFee = async () => {
    if (!user?.email || !hasAdminFee) return;
    setPayLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("initialize-store-subscription", {
        body: { email: user.email, store_id: storeId, months: 1 },
      });
      if (error) throw error;
      if (data?.access_code || data?.authorization_url) {
        await openPaystackCheckout({
          accessCode: data.access_code,
          authorizationUrl: data.authorization_url,
          onSuccess: async (reference) => {
            try {
              if (reference) await supabase.functions.invoke("verify-payment", { body: { reference } });
              toast.success("Subscription paid");
              await load();
            } catch (err: any) {
              toast.error(err.message || "Verification failed");
            } finally {
              setPayLoading(false);
            }
          },
          onClose: () => setPayLoading(false),
        });
        return;
      }
      throw new Error(data?.error || "Could not start payment");
    } catch (e: any) {
      toast.error(e.message || "Payment failed to start");
    } finally {
      setPayLoading(false);
    }
  };

  // Pending admin approval — no fee yet
  if (isPending) {
    return (
      <Card className="p-5 border-amber-500/50 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold">Awaiting Admin Review</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your store was submitted for review. An admin will approve it and assign your monthly subscription fee shortly.
              Your products will go live once you pay your subscription.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Approved + admin-assigned fee — show admin-managed renewal flow
  if (hasAdminFee) {
    return (
      <Card className={`p-5 ${isExpired ? "border-destructive/50 bg-destructive/5" : "border-primary/30"}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${isExpired ? "bg-destructive/10" : "bg-primary/10"}`}>
              {isExpired ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <Crown className="h-5 w-5 text-primary" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">
                  {isExpired ? "Subscription Expired" : "Store Subscription"}
                </h3>
                <Badge variant="outline">₵{Number(store.monthly_fee).toFixed(2)} / month</Badge>
              </div>
              {isExpired ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Pay your monthly subscription so your products appear in the marketplace.
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
          <Button onClick={payAdminFee} disabled={payLoading} variant={isExpired ? "default" : "outline"}>
            {payLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isExpired ? "Pay & Activate" : "Renew Now"}
          </Button>
        </div>
      </Card>
    );
  }

  // Fallback (legacy self-serve plan flow)
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
                {!isExpired && store?.product_limit && (
                  <Badge variant="outline">
                    {productCount} / {store.product_limit} products
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
