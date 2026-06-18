import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Attempt {
  id: string;
  reference: string;
  buyer_id: string;
  amount: number;
  status: string;
  paystack_status: string | null;
  kind: string;
  last_error: string | null;
  created_at: string;
  verified_at: string | null;
  orders_created_at: string | null;
}

const STATUS_TABS = ["initialized", "success", "failed", "abandoned"] as const;

export default function PaymentsReconciliation() {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("initialized");
  const [rows, setRows] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcilingRef, setReconcilingRef] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_attempts")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setRows((data as Attempt[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const runReconcile = async (reference?: string) => {
    if (reference) setReconcilingRef(reference); else setReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-payments", {
        body: reference ? { reference } : {},
      });
      if (error) throw error;
      toast.success(`Checked ${data?.checked ?? 0} attempt(s)`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Reconcile failed");
    } finally {
      setReconciling(false);
      setReconcilingRef(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Payment Reconciliation</h1>
            <p className="text-sm text-muted-foreground">
              Every checkout attempt is recorded here. Stuck "initialized" rows are auto-reconciled after 10 minutes.
            </p>
          </div>
          <Button onClick={() => runReconcile()} disabled={reconciling}>
            {reconciling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Reconcile pending
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            {STATUS_TABS.map((s) => (
              <TabsTrigger key={s} value={s} className="capitalize">{s}</TabsTrigger>
            ))}
          </TabsList>

          {STATUS_TABS.map((s) => (
            <TabsContent key={s} value={s} className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base capitalize flex items-center gap-2">
                    {s === "initialized" && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                    {s === "success" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    {(s === "failed" || s === "abandoned") && <XCircle className="h-4 w-4 text-red-600" />}
                    {s} payments
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {loading ? (
                    <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No {s} payments.</p>
                  ) : (
                    rows.map((r) => (
                      <div key={r.id} className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-mono text-xs break-all">{r.reference}</div>
                          <div className="text-muted-foreground text-xs">
                            ₵{Number(r.amount).toLocaleString()} • {r.kind} •{" "}
                            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                          </div>
                          {r.last_error && (
                            <div className="text-xs text-red-600 break-words max-w-md">⚠ {r.last_error}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{r.paystack_status || r.status}</Badge>
                          {s === "initialized" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={reconcilingRef === r.reference}
                              onClick={() => runReconcile(r.reference)}
                            >
                              {reconcilingRef === r.reference ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify now"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AdminLayout>
  );
}
