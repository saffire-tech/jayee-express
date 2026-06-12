import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, RefreshCw, PlayCircle, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface RunRow {
  id: string;
  started_at: string;
  completed_at: string | null;
  window_start: string;
  window_end: string;
  transactions_checked: number;
  paystack_calls: number;
  mismatches_found: number;
  status: string;
  notes: string | null;
}

interface IssueRow {
  id: string;
  run_id: string;
  issue_type: string;
  severity: string;
  user_id: string | null;
  transaction_id: string | null;
  order_id: string | null;
  payment_reference: string | null;
  expected_amount: number | null;
  actual_amount: number | null;
  details: any;
  resolved: boolean;
  created_at: string;
}

const severityVariant: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  warning: "default",
  info: "secondary",
};

export default function ReconciliationPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: runsData }, { data: issuesData }] = await Promise.all([
      supabase.from("reconciliation_runs").select("*").order("started_at", { ascending: false }).limit(30),
      supabase.from("reconciliation_issues").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(200),
    ]);
    setRuns((runsData || []) as RunRow[]);
    setIssues((issuesData || []) as IssueRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("reconcile-wallet", { body: { window_hours: 48 } });
      if (error) throw error;
      toast.success("Reconciliation run started");
      setTimeout(fetchData, 1500);
    } catch (e: any) {
      toast.error(e.message || "Failed to run reconciliation");
    } finally {
      setRunning(false);
    }
  };

  const resolve = async (id: string) => {
    const { error } = await supabase.from("reconciliation_issues").update({
      resolved: true,
      resolved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    setIssues((s) => s.filter((i) => i.id !== id));
    toast.success("Marked as resolved");
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Wallet Reconciliation</h1>
            <p className="text-sm text-muted-foreground">Daily audit of wallet credits against Paystack transactions.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button onClick={runNow} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              Run now
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Recent runs</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Checked</TableHead>
                    <TableHead className="text-right">Paystack calls</TableHead>
                    <TableHead className="text-right">Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{new Date(r.started_at).toLocaleString()}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.window_start).toLocaleString()} → {new Date(r.window_end).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{r.transactions_checked}</TableCell>
                      <TableCell className="text-right">{r.paystack_calls}</TableCell>
                      <TableCell className="text-right font-medium">{r.mismatches_found}</TableCell>
                    </TableRow>
                  ))}
                  {runs.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No runs yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Open issues ({issues.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(i.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs font-mono">{i.issue_type}</TableCell>
                    <TableCell><Badge variant={severityVariant[i.severity] || "secondary"}>{i.severity}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{i.order_id?.slice(0, 8) || "-"}</TableCell>
                    <TableCell className="text-right">{i.expected_amount != null ? `₵${Number(i.expected_amount).toFixed(2)}` : "-"}</TableCell>
                    <TableCell className="text-right">{i.actual_amount != null ? `₵${Number(i.actual_amount).toFixed(2)}` : "-"}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate" title={JSON.stringify(i.details)}>
                      {i.details ? JSON.stringify(i.details) : "-"}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => resolve(i.id)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {issues.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No open issues — all wallet credits reconcile with Paystack.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
