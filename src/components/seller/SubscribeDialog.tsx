import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import MoMoPaymentDialog from "@/components/payments/MoMoPaymentDialog";

interface Plan {
  id: string;
  name: string;
  max_products: number;
  price_per_month: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SubscribeDialog = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [months, setMonths] = useState(1);
  const [loading, setLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("subscription_plans")
      .select("id, name, max_products, price_per_month")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .then(({ data }) => {
        setPlans((data as Plan[]) || []);
        if (data && data.length && !selected) setSelected(data[0].id);
      });
  }, [open]);

  const plan = plans.find(p => p.id === selected);
  const total = plan ? Number(plan.price_per_month) * months : 0;

  const handleSubscribe = () => {
    if (!plan) return;
    setPayOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a Plan</DialogTitle>
          <DialogDescription>Subscribe monthly to list products on your store.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {plans.map(p => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={cn(
                "w-full text-left border rounded-lg p-4 transition",
                selected === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {p.name}
                    {selected === p.id && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="text-sm text-muted-foreground">Up to {p.max_products} products</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">₵{Number(p.price_per_month).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">/ month</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div>
          <Label>Months</Label>
          <div className="flex items-center gap-3 mt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setMonths(m => Math.max(1, m - 1))}>-</Button>
            <Input
              type="number"
              min={1}
              max={12}
              value={months}
              onChange={(e) => setMonths(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
              className="w-20 text-center"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setMonths(m => Math.min(12, m + 1))}>+</Button>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div>
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">₵{total.toFixed(2)}</div>
          </div>
          <Button onClick={handleSubscribe} disabled={!plan || loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Pay & Subscribe
          </Button>
        </div>
      </DialogContent>

      {plan && (
        <MoMoPaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          amount={total}
          title="Pay for your plan"
          description={`You are paying ₵${total.toFixed(2)} for ${months} month(s) of the ${plan.name} plan.`}
          functionName="initialize-subscription"
          body={{ plan_id: plan.id, months }}
          onSuccess={() => {
            toast.success("Subscription activated");
            setPayOpen(false);
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
};

export default SubscribeDialog;
