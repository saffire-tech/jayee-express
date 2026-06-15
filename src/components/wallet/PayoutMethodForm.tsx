import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Lock, Smartphone, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PayoutTarget =
  | { kind: "profile"; userId: string }
  | { kind: "store"; storeId: string };

interface PayoutDetails {
  payout_method: "momo" | "bank" | null;
  momo_number: string;
  momo_provider: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
}

const empty: PayoutDetails = {
  payout_method: null,
  momo_number: "",
  momo_provider: "",
  bank_name: "",
  bank_account_number: "",
  bank_account_name: "",
};

interface Props {
  target: PayoutTarget;
  onSaved?: () => void;
}

const PayoutMethodForm = ({ target, onSaved }: Props) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<PayoutDetails>(empty);
  const [method, setMethod] = useState<"momo" | "bank">("momo");

  const load = async () => {
    setLoading(true);
    try {
      if (target.kind === "store") {
        const { data } = await supabase.rpc("get_my_store_payout", { _store_id: target.storeId });
        const row: any = Array.isArray(data) ? data[0] : data;
        if (row) {
          const d: PayoutDetails = {
            payout_method: row.payout_method ?? null,
            momo_number: row.momo_number || "",
            momo_provider: row.momo_provider || "",
            bank_name: row.bank_name || "",
            bank_account_number: row.bank_account_number || "",
            bank_account_name: row.bank_account_name || "",
          };
          setDetails(d);
          if (d.payout_method) setMethod(d.payout_method);
        }
      } else {
        const { data } = await supabase.rpc("get_my_momo");
        const row: any = Array.isArray(data) ? data[0] : data;
        if (row) {
          const d: PayoutDetails = {
            payout_method: row.payout_method ?? null,
            momo_number: row.momo_number || "",
            momo_provider: row.momo_provider || "",
            bank_name: row.bank_name || "",
            bank_account_number: row.bank_account_number || "",
            bank_account_name: row.bank_account_name || "",
          };
          setDetails(d);
          if (d.payout_method) setMethod(d.payout_method);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.kind, (target as any).storeId, (target as any).userId]);

  const locked = !!details.payout_method;

  const handleSave = async () => {
    // Validate
    if (method === "momo") {
      if (!details.momo_number || !details.momo_provider) {
        toast.error("Enter your MoMo provider and number");
        return;
      }
    } else {
      if (!details.bank_name || !details.bank_account_number || !details.bank_account_name) {
        toast.error("Fill in all bank fields");
        return;
      }
    }

    setSaving(true);
    try {
      const payload: any =
        method === "momo"
          ? {
              payout_method: "momo",
              momo_number: details.momo_number,
              momo_provider: details.momo_provider,
              bank_name: null,
              bank_account_number: null,
              bank_account_name: null,
            }
          : {
              payout_method: "bank",
              bank_name: details.bank_name,
              bank_account_number: details.bank_account_number,
              bank_account_name: details.bank_account_name,
              momo_number: null,
              momo_provider: null,
            };

      const q =
        target.kind === "store"
          ? supabase.from("stores").update(payload).eq("id", target.storeId)
          : supabase.from("profiles").update(payload).eq("user_id", target.userId);
      const { error } = await q;
      if (error) throw error;
      toast.success("Payout details saved. These can no longer be edited — contact support if you need to change them.");
      await load();
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to save payout details");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (locked) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Lock className="h-4 w-4 text-primary" />
          Payout method locked
        </div>
        {details.payout_method === "momo" ? (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-1">
            <p className="flex items-center gap-2 font-medium"><Smartphone className="h-4 w-4" /> Mobile Money</p>
            <p>{details.momo_provider} — {details.momo_number}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-1">
            <p className="flex items-center gap-2 font-medium"><Landmark className="h-4 w-4" /> Bank Account</p>
            <p>{details.bank_name}</p>
            <p>Acc: {details.bank_account_number}</p>
            <p>Name: {details.bank_account_name}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          For security, payout details can only be set once. Contact support to make changes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={method} onValueChange={(v) => setMethod(v as "momo" | "bank")}>
        <TabsList className="w-full">
          <TabsTrigger value="momo" className="flex-1 gap-2">
            <Smartphone className="h-4 w-4" /> Mobile Money
          </TabsTrigger>
          <TabsTrigger value="bank" className="flex-1 gap-2">
            <Landmark className="h-4 w-4" /> Bank Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="momo" className="mt-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>MoMo Provider</Label>
              <Select
                value={details.momo_provider}
                onValueChange={(v) => setDetails({ ...details, momo_provider: v })}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                  <SelectItem value="Vodafone">Vodafone Cash</SelectItem>
                  <SelectItem value="AirtelTigo">AirtelTigo Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>MoMo Number</Label>
              <Input
                value={details.momo_number}
                onChange={(e) => setDetails({ ...details, momo_number: e.target.value })}
                placeholder="e.g., 0241234567"
                className="mt-1"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bank" className="mt-4 space-y-4">
          <div>
            <Label>Bank Name</Label>
            <Input
              value={details.bank_name}
              onChange={(e) => setDetails({ ...details, bank_name: e.target.value })}
              placeholder="e.g., GCB Bank"
              className="mt-1"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Account Number</Label>
              <Input
                value={details.bank_account_number}
                onChange={(e) => setDetails({ ...details, bank_account_number: e.target.value })}
                placeholder="e.g., 1234567890123"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Account Holder Name</Label>
              <Input
                value={details.bank_account_name}
                onChange={(e) => setDetails({ ...details, bank_account_name: e.target.value })}
                placeholder="As it appears on the account"
                className="mt-1"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Heads up: once you save, your payout method and details are locked. Double-check before saving.
      </p>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Save Payout Details
      </Button>
    </div>
  );
};

export default PayoutMethodForm;
