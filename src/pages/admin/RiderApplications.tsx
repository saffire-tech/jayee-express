import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { Eye, Check, X, Loader2, Pencil } from "lucide-react";

const RiderApplications = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [reviewing, setReviewing] = useState<any>(null);
  const [action, setAction] = useState<"approve" | "reject" | "edit-fee" | null>(null);
  const [monthlyFee, setMonthlyFee] = useState("50");
  const [reason, setReason] = useState("");
  const [docs, setDocs] = useState<{ card?: string; photo?: string }>({});

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["rider-applications", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rider_applications")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const openReview = async (app: any) => {
    setReviewing(app);
    setAction(null);
    setReason("");
    setMonthlyFee("50");
    const [cardSigned, photoSigned] = await Promise.all([
      supabase.storage.from("rider-documents").createSignedUrl(app.ghana_card_url, 3600),
      supabase.storage.from("rider-documents").createSignedUrl(app.photo_id_url, 3600),
    ]);
    setDocs({
      card: cardSigned.data?.signedUrl,
      photo: photoSigned.data?.signedUrl,
    });
  };

  const submitAction = useMutation({
    mutationFn: async () => {
      if (!reviewing || !action) return;
      if (action === "approve") {
        const fee = parseFloat(monthlyFee);
        if (!fee || fee <= 0) throw new Error("Set a valid monthly fee");
        const { error } = await supabase
          .from("rider_applications")
          .update({
            status: "approved",
            monthly_fee: fee,
            reviewed_at: new Date().toISOString(),
          } as any)
          .eq("id", reviewing.id);
        if (error) throw error;
        // Grant delivery role
        await supabase
          .from("user_roles")
          .upsert({ user_id: reviewing.user_id, role: "delivery" } as any, { onConflict: "user_id,role" });
        // Notify rider
        await supabase.from("notifications").insert({
          user_id: reviewing.user_id,
          type: "rider_approved",
          title: "Rider Application Approved!",
          body: `Your application was approved. Monthly subscription: ₵${fee.toFixed(2)}. Pay to activate.`,
        } as any);
      } else {
        if (!reason.trim()) throw new Error("Reason required");
        const { error } = await supabase
          .from("rider_applications")
          .update({
            status: "rejected",
            rejection_reason: reason,
            reviewed_at: new Date().toISOString(),
          } as any)
          .eq("id", reviewing.id);
        if (error) throw error;
        await supabase.from("notifications").insert({
          user_id: reviewing.user_id,
          type: "rider_rejected",
          title: "Rider Application Rejected",
          body: reason,
        } as any);
      }
    },
    onSuccess: () => {
      toast.success(action === "approve" ? "Application approved" : "Application rejected");
      qc.invalidateQueries({ queryKey: ["rider-applications"] });
      setReviewing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AdminLayout title="Rider Applications" description="Review delivery rider applications">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3 mt-4">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          ) : apps.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No {tab} applications</p>
          ) : (
            apps.map((a) => (
              <Card key={a.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">{a.full_name}</CardTitle>
                  <Badge variant="outline">{a.city || "—"}</Badge>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Phone:</span> {a.phone}</p>
                  <p><span className="text-muted-foreground">Ghana Card:</span> {a.ghana_card_number}</p>
                  <p><span className="text-muted-foreground">Motor Reg:</span> {a.motor_registration}</p>
                  <p><span className="text-muted-foreground">Address:</span> {a.house_address}</p>
                  <p className="text-xs text-muted-foreground">
                    Submitted {format(new Date(a.created_at), "MMM d, yyyy HH:mm")}
                  </p>
                  {a.status === "approved" && (
                    <p className="font-medium">Monthly Fee: ₵{Number(a.monthly_fee).toFixed(2)}</p>
                  )}
                  {a.status === "rejected" && a.rejection_reason && (
                    <p className="text-destructive">Reason: {a.rejection_reason}</p>
                  )}
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => openReview(a)}>
                    <Eye className="h-4 w-4 mr-1" /> Review
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Application — {reviewing?.full_name}</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Ghana Card</Label>
                  {docs.card && <img src={docs.card} alt="Ghana Card" className="rounded border w-full" />}
                </div>
                <div>
                  <Label className="text-xs">Photo ID</Label>
                  {docs.photo && <img src={docs.photo} alt="Photo ID" className="rounded border w-full" />}
                </div>
              </div>

              {reviewing.status === "pending" && (
                <>
                  {action === null && (
                    <div className="flex gap-2">
                      <Button onClick={() => setAction("approve")} className="flex-1" variant="hero">
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button onClick={() => setAction("reject")} className="flex-1" variant="destructive">
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                  {action === "approve" && (
                    <div>
                      <Label>Monthly Subscription Fee (₵)</Label>
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        value={monthlyFee}
                        onChange={(e) => setMonthlyFee(e.target.value)}
                      />
                    </div>
                  )}
                  {action === "reject" && (
                    <div>
                      <Label>Rejection Reason</Label>
                      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {action && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setAction(null)}>Back</Button>
              <Button onClick={() => submitAction.mutate()} disabled={submitAction.isPending}>
                {submitAction.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Confirm {action === "approve" ? "Approval" : "Rejection"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default RiderApplications;
