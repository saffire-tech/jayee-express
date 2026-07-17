import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Mail } from "lucide-react";
import { Helmet } from "react-helmet-async";

type Row = {
  message_id: string;
  template_name: string | null;
  recipient_email: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  attempts: number;
};

const PRESETS = [
  { key: "24h", label: "Last 24h", hours: 24 },
  { key: "7d", label: "Last 7 days", hours: 24 * 7 },
  { key: "30d", label: "Last 30 days", hours: 24 * 30 },
];

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  dlq: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  failed: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  pending: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  rate_limited: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  suppressed: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  bounced: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  complained: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

export default function EmailLogs() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [preset, setPreset] = useState("7d");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = async () => {
    setLoading(true);
    const hours = PRESETS.find((p) => p.key === preset)?.hours ?? 168;
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    // Fetch raw rows in window, then dedupe client-side by message_id (latest).
    const { data, error } = await supabase
      .from("email_send_log")
      .select("message_id, template_name, recipient_email, status, error_message, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error(error);
      setRows([]);
      setLoading(false);
      return;
    }

    const latest = new Map<string, Row>();
    const attempts = new Map<string, number>();
    for (const r of data || []) {
      const key = (r as any).message_id || `${(r as any).recipient_email}-${(r as any).created_at}`;
      if (!latest.has(key)) {
        latest.set(key, { ...(r as any), attempts: 0 } as Row);
      }
      if ((r as any).status === "failed" || (r as any).status === "rate_limited") {
        attempts.set(key, (attempts.get(key) ?? 0) + 1);
      }
    }
    const out: Row[] = [];
    latest.forEach((v, k) => {
      out.push({ ...v, attempts: attempts.get(k) ?? 0 });
    });
    out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    setRows(out);
    setTemplates(Array.from(new Set(out.map((r) => r.template_name).filter(Boolean) as string[])).sort());
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (templateFilter !== "all" && r.template_name !== templateFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "failed" && !(r.status === "dlq" || r.status === "failed")) return false;
        if (statusFilter === "sent" && r.status !== "sent") return false;
        if (statusFilter === "suppressed" && !(r.status === "suppressed" || r.status === "bounced" || r.status === "complained")) return false;
      }
      if (search && !(r.recipient_email || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, templateFilter, statusFilter, search]);

  const stats = useMemo(() => {
    const s = { total: filtered.length, sent: 0, failed: 0, suppressed: 0, retried: 0 };
    for (const r of filtered) {
      if (r.status === "sent") s.sent++;
      else if (r.status === "dlq" || r.status === "failed") s.failed++;
      else if (r.status === "suppressed" || r.status === "bounced" || r.status === "complained") s.suppressed++;
      if (r.attempts > 0) s.retried++;
    }
    return s;
  }, [filtered]);

  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <Helmet><title>Email Logs — Admin</title></Helmet>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Email Logs</h1>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Transient send failures are retried automatically (up to 5 attempts). Rows below are deduplicated by message — the status shown is the <strong>final outcome</strong>.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats.total}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Sent</div><div className="text-2xl font-bold text-green-600">{stats.sent}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Failed</div><div className="text-2xl font-bold text-red-600">{stats.failed}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Suppressed</div><div className="text-2xl font-bold text-yellow-600">{stats.suppressed}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Retried</div><div className="text-2xl font-bold text-amber-600">{stats.retried}</div></Card>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.key} variant={preset === p.key ? "default" : "outline"} size="sm" onClick={() => { setPreset(p.key); setPage(0); }}>
              {p.label}
            </Button>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Select value={templateFilter} onValueChange={(v) => { setTemplateFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Template" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All templates</SelectItem>
              {templates.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="suppressed">Suppressed</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Search recipient…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            ) : paged.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No emails in this window.</TableCell></TableRow>
            ) : paged.map((r, i) => (
              <TableRow key={`${r.message_id}-${i}`}>
                <TableCell className="font-mono text-xs">{r.template_name || "—"}</TableCell>
                <TableCell className="text-sm">{r.recipient_email || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_COLORS[r.status] || ""}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-sm">{r.attempts > 0 ? `${r.attempts + 1}×` : "1×"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-xs text-red-600 max-w-xs truncate" title={r.error_message || ""}>{r.error_message || ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
