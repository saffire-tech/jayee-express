import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Check, X, Send, Download } from "lucide-react";

type Status = "pending" | "approved" | "paid" | "rejected";
interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  momo_number: string;
  momo_provider: string;
  status: string;
  admin_note: string | null;
  rejection_reason: string | null;
  payment_method: string | null;
  admin_payment_reference: string | null;
  paid_at: string | null;
  created_at: string;
  // joined
  full_name?: string | null;
  is_seller?: boolean;
  is_rider?: boolean;
}

const STATUS_VARIANT: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  paid: "default",
  rejected: "destructive",
  processing: "secondary",
  completed: "default",
  failed: "destructive",
};

const PayoutsManagement = () => {
  const [tab, setTab] = useState<Status>("pending");
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Withdrawal | null>(null);
  const [dialog, setDialog] = useState<null | "pay" | "reject">(null);
  const [paymentMethod, setPaymentMethod] = useState("MTN MoMo");
  const [paymentRef, setPaymentRef] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Fetch profiles and roles for displayed users
    const userIds = [...new Set((data || []).map((r: any) => r.user_id))];
    let profiles: Record<string, string> = {};
    let roles: Record<string, Set<string>> = {};
    if (userIds.length > 0) {
      const [{ data: profs }, { data: rs }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
      ]);
      (profs || []).forEach((p: any) => { profiles[p.user_id] = p.full_name; });
      (rs || []).forEach((r: any) => {
        if (!roles[r.user_id]) roles[r.user_id] = new Set();
        roles[r.user_id].add(r.role);
      });
    }
    // Determine sellers via stores
    let sellerSet = new Set<string>();
    if (userIds.length > 0) {
      const { data: stores } = await supabase.from("stores").select("user_id").in("user_id", userIds);
      (stores || []).forEach((s: any) => sellerSet.add(s.user_id));
    }

    const enriched = (data || []).map((r: any) => ({
      ...r,
      full_name: profiles[r.user_id] || "Unknown",
      is_rider: roles[r.user_id]?.has("delivery") ?? false,
      is_seller: sellerSet.has(r.user_id),
    }));

    setRows(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const callAction = async (action: "approve" | "mark_paid" | "reject", payload: any = {}) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-payout", {
        body: { withdrawal_id: selected.id, action, ...payload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Done");
      setDialog(null);
      setSelected(null);
      setPaymentRef(""); setNote(""); setReason("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const exportCSV = () => {
    const headers = ["Date", "Name", "Role", "Amount", "Provider", "Number", "Status", "Payment Ref"];
    const lines = rows.map((r) =>
      [
        new Date(r.created_at).toISOString(),
        r.full_name,
        r.is_seller ? "Seller" : r.is_rider ? "Rider" : "User",
        r.amount,
        r.momo_provider,
        r.momo_number,
        r.status,
        r.admin_payment_reference || "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payouts</h1>
          <p className="text-sm text-muted-foreground">Review and process withdrawal requests from sellers and riders.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="capitalize">{tab} ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : rows.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">No {tab} requests.</p>
              ) : (
                <div className="space-y-3">
                  {rows.map((r) => (
                    <div key={r.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{r.full_name}</span>
                          {r.is_seller && <Badge variant="outline">Seller</Badge>}
                          {r.is_rider && <Badge variant="outline">Rider</Badge>}
                          <Badge variant={STATUS_VARIANT[r.status] || "secondary"}>{r.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {r.momo_provider} — {r.momo_number} · {new Date(r.created_at).toLocaleString()}
                        </p>
                        {r.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">Reason: {r.rejection_reason}</p>
                        )}
                        {r.admin_payment_reference && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Paid via {r.payment_method} · Ref: {r.admin_payment_reference}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xl font-bold text-primary">
                            ₵{Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        {(r.status === "pending" || r.status === "approved") && (
                          <div className="flex gap-2">
                            {r.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setSelected(r); callAction("approve"); }}
                                disabled={submitting}
                              >
                                <Check className="h-4 w-4 mr-1" /> Approve
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => { setSelected(r); setDialog("pay"); }}
                            >
                              <Send className="h-4 w-4 mr-1" /> Mark Paid
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => { setSelected(r); setDialog("reject"); }}
                            >
                              <X className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mark Paid dialog */}
      <Dialog open={dialog === "pay"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Confirm that ₵{selected ? Number(selected.amount).toLocaleString() : 0} was sent to {selected?.momo_provider} {selected?.momo_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Payment Method</Label>
              <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="e.g. MTN MoMo" />
            </div>
            <div>
              <Label>Payment Reference / Transaction ID</Label>
              <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="MoMo transaction code" />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              onClick={() => callAction("mark_paid", { payment_method: paymentMethod, admin_payment_reference: paymentRef, admin_note: note })}
              disabled={submitting || !paymentRef || !paymentMethod}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirm Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={dialog === "reject"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Withdrawal</DialogTitle>
            <DialogDescription>The held amount will be refunded to the user's wallet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being rejected?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => callAction("reject", { rejection_reason: reason })}
              disabled={submitting || !reason}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Reject & Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayoutsManagement;
