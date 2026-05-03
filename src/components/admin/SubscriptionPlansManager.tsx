import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  max_products: number;
  price_per_month: number;
  is_active: boolean;
  display_order: number;
}

const empty = { name: "", max_products: 10, price_per_month: 100, is_active: true, display_order: 0 };

const SubscriptionPlansManager = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<any>(empty);

  const { data: plans = [] } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as Plan[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("subscription_plans").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subscription_plans").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Plan updated" : "Plan created");
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      setOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan deleted");
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = (p: Plan) => {
    setEditing(p);
    setForm({
      name: p.name, max_products: p.max_products, price_per_month: p.price_per_month,
      is_active: p.is_active, display_order: p.display_order,
    });
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Subscription Plans</CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Plan
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {plans.map(p => (
            <div key={p.id} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <div className="font-medium">{p.name} {!p.is_active && <span className="text-xs text-muted-foreground">(inactive)</span>}</div>
                <div className="text-sm text-muted-foreground">
                  Up to {p.max_products} products · ₵{Number(p.price_per_month).toFixed(2)}/month
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this plan?")) remove.mutate(p.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {plans.length === 0 && <p className="text-sm text-muted-foreground">No plans yet.</p>}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Plan" : "New Plan"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max products</Label>
                <Input type="number" value={form.max_products} onChange={(e) => setForm({ ...form, max_products: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Price / month (₵)</Label>
                <Input type="number" value={form.price_per_month} onChange={(e) => setForm({ ...form, price_per_month: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Display order</Label>
              <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
            <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending || !form.name}>
              {editing ? "Save Changes" : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SubscriptionPlansManager;
