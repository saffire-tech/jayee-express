import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Wallet, Plus, RefreshCw, Send } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface Summary {
  total_subscription_revenue: number;
  revenue_this_month: number;
  store_revenue: number;
  rider_revenue: number;
  total_withdrawn: number;
  pending_withdrawals: number;
  net_earned: number;
}
interface Balance { currency: string; balance: number }
interface Account {
  id: string; label: string; type: string;
  account_number: string; bank_code: string; account_name: string;
  is_default: boolean; paystack_recipient_code: string | null;
}
interface Payout {
  id: string; amount: number; status: string;
  paystack_transfer_code: string | null; failure_reason: string | null;
  created_at: string; recipient_snapshot: any;
}

const statusVariant: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  success: "default", pending: "secondary", failed: "destructive", reversed: "outline",
};

export default function Finance() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add account form
  const [form, setForm] = useState({
    label: "", type: "momo" as "momo" | "bank",
    account_number: "", bank_code: "MTN", account_name: "", is_default: false,
  });
  // Withdraw form
  const [wForm, setWForm] = useState({ account_id: "", amount: "" });

  const ghs = balances.find((b) => b.currency === "GHS");
  const availableGHS = ghs ? Number(ghs.balance) / 100 : 0;

  async function loadAll() {
    setLoading(true);
    try {
      const [balRes, accRes, payRes] = await Promise.all([
        supabase.functions.invoke("get-platform-balance"),
        supabase.from("platform_payout_accounts").select("*").order("created_at", { ascending: false }),
        supabase.from("platform_payouts").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      if (balRes.error) throw balRes.error;
      setSummary(balRes.data.summary);
      setBalances(balRes.data.paystack_balances || []);
      setAccounts((accRes.data as Account[]) || []);
      setPayouts((payRes.data as Payout[]) || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load finance data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function addAccount() {
    if (!form.label || !form.account_number || !form.account_name) {
      toast.error("All fields required"); return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-platform-payout-recipient", { body: form });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Payout account added");
      setAddOpen(false);
      setForm({ label: "", type: "momo", account_number: "", bank_code: "MTN", account_name: "", is_default: false });
      loadAll();
    } catch (e: any) {
      toast.error(e.message || "Failed to add account");
    } finally { setSubmitting(false); }
  }

  async function withdraw() {
    const amount = Number(wForm.amount);
    if (!wForm.account_id || !amount || amount <= 0) { toast.error("Pick account and amount"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-withdraw", {
        body: { account_id: wForm.account_id, amount },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`Withdrawal ${data.status === "success" ? "completed" : "initiated"}`);
      setWithdrawOpen(false);
      setWForm({ account_id: "", amount: "" });
      loadAll();
    } catch (e: any) {
      toast.error(e.message || "Withdrawal failed");
    } finally { setSubmitting(false); }
  }

  return (
    <AdminLayout title="Finance">
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Finance</h1>
            <p className="text-sm text-muted-foreground">Subscription revenue and platform withdrawals</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {loading && !summary ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader><CardTitle className="text-base">Subscription Revenue</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-3xl font-bold text-primary">₵{Number(summary?.total_subscription_revenue || 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">This month: ₵{Number(summary?.revenue_this_month || 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Stores: ₵{Number(summary?.store_revenue || 0).toFixed(2)} • Riders: ₵{Number(summary?.rider_revenue || 0).toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Net Earned (Withdrawable)</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-3xl font-bold">₵{Number(summary?.net_earned || 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Withdrawn: ₵{Number(summary?.total_withdrawn || 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Pending: ₵{Number(summary?.pending_withdrawals || 0).toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Paystack Balance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {balances.length === 0 && <p className="text-sm text-muted-foreground">No balance data</p>}
                  {balances.map((b) => (
                    <p key={b.currency} className="text-lg font-semibold">{b.currency} {(Number(b.balance) / 100).toFixed(2)}</p>
                  ))}
                  <Button size="sm" className="w-full mt-2" onClick={() => setWithdrawOpen(true)} disabled={accounts.length === 0}>
                    <Send className="h-4 w-4 mr-2" /> Withdraw
                  </Button>
                  {accounts.length === 0 && <p className="text-xs text-muted-foreground">Add a payout account first</p>}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Payout Accounts</CardTitle>
                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Payout Account</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Main MoMo" /></div>
                      <div>
                        <Label>Type</Label>
                        <Select value={form.type} onValueChange={(v: "momo" | "bank") => setForm({ ...form, type: v, bank_code: v === "momo" ? "MTN" : "" })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="momo">Mobile Money</SelectItem>
                            <SelectItem value="bank">Bank</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {form.type === "momo" ? (
                        <div>
                          <Label>Provider</Label>
                          <Select value={form.bank_code} onValueChange={(v) => setForm({ ...form, bank_code: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MTN">MTN</SelectItem>
                              <SelectItem value="Vodafone">Vodafone</SelectItem>
                              <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div><Label>Bank Code (Paystack)</Label><Input value={form.bank_code} onChange={(e) => setForm({ ...form, bank_code: e.target.value })} placeholder="e.g. 058" /></div>
                      )}
                      <div><Label>{form.type === "momo" ? "MoMo Number" : "Account Number"}</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
                      <div><Label>Account Name</Label><Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button onClick={addAccount} disabled={submitting}>{submitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No accounts yet.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Type</TableHead><TableHead>Number</TableHead><TableHead>Name</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {accounts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.label} {a.is_default && <Badge variant="outline" className="ml-2">Default</Badge>}</TableCell>
                          <TableCell className="capitalize">{a.type}</TableCell>
                          <TableCell>{a.account_number}</TableCell>
                          <TableCell>{a.account_name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Withdrawal History</CardTitle></CardHeader>
              <CardContent>
                {payouts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No withdrawals yet.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>To</TableHead><TableHead>Status</TableHead><TableHead>Reference</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {payouts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">{new Date(p.created_at).toLocaleString()}</TableCell>
                          <TableCell>₵{Number(p.amount).toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{p.recipient_snapshot?.label || "-"}</TableCell>
                          <TableCell><Badge variant={statusVariant[p.status] || "outline"}>{p.status}</Badge></TableCell>
                          <TableCell className="text-xs font-mono">{p.paystack_transfer_code || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Withdraw to Account</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Paystack available: <strong>₵{availableGHS.toFixed(2)}</strong> • Net earned: <strong>₵{Number(summary?.net_earned || 0).toFixed(2)}</strong></p>
              <div>
                <Label>Account</Label>
                <Select value={wForm.account_id} onValueChange={(v) => setWForm({ ...wForm, account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.label} ({a.account_number})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (₵)</Label>
                <Input type="number" step="0.01" value={wForm.amount} onChange={(e) => setWForm({ ...wForm, amount: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={withdraw} disabled={submitting}>{submitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}Confirm Withdrawal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
