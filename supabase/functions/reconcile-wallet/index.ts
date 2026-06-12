import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WalletTxn {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string;
  reference_id: string | null;
  created_at: string;
}

interface OrderRow {
  id: string;
  total_amount: number;
  delivery_fee: number;
  payment_reference: string | null;
  payment_status: string;
  status: string;
  store_id: string;
  delivery_person_id: string | null;
}

const PAYSTACK_BASE = "https://api.paystack.co";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!PAYSTACK_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "PAYSTACK_SECRET_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Default window: last 48h, override via body
  let windowHours = 48;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.window_hours && Number(body.window_hours) > 0) {
        windowHours = Math.min(Number(body.window_hours), 24 * 14); // cap at 14 days
      }
    }
  } catch { /* ignore */ }

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowHours * 3600 * 1000);

  // Create run row
  const { data: run, error: runErr } = await supabase
    .from("reconciliation_runs")
    .insert({
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      status: "running",
    })
    .select()
    .single();

  if (runErr || !run) {
    return new Response(JSON.stringify({ error: runErr?.message || "Failed to create run" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const issues: any[] = [];
  let paystackCalls = 0;
  const verifyCache = new Map<string, { ok: boolean; amount: number | null; status: string | null }>();

  async function verifyPaystack(reference: string) {
    if (verifyCache.has(reference)) return verifyCache.get(reference)!;
    paystackCalls++;
    try {
      const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      const json = await res.json();
      const data = json?.data;
      const result = {
        ok: !!json?.status && data?.status === "success",
        amount: data?.amount != null ? Number(data.amount) / 100 : null,
        status: data?.status ?? null,
      };
      verifyCache.set(reference, result);
      return result;
    } catch (e) {
      console.error("Paystack verify error:", reference, e);
      const result = { ok: false, amount: null as number | null, status: "error" };
      verifyCache.set(reference, result);
      return result;
    }
  }

  try {
    // ====== 1) Audit wallet credits in window ======
    const { data: txns, error: txErr } = await supabase
      .from("wallet_transactions")
      .select("id, user_id, type, amount, description, reference_id, created_at")
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", windowEnd.toISOString());

    if (txErr) throw txErr;
    const allTxns = (txns || []) as WalletTxn[];
    const credits = allTxns.filter(t => t.type === "credit");

    // Pre-fetch all orders referenced by credits
    const orderIds = Array.from(new Set(credits.filter(t => t.reference_id && (
      t.description.startsWith("Sale from order") || t.description.startsWith("Delivery fee for order")
    )).map(t => t.reference_id!)));

    const orderMap = new Map<string, OrderRow>();
    if (orderIds.length > 0) {
      for (let i = 0; i < orderIds.length; i += 200) {
        const slice = orderIds.slice(i, i + 200);
        const { data: ords } = await supabase
          .from("orders")
          .select("id, total_amount, delivery_fee, payment_reference, payment_status, status, store_id, delivery_person_id")
          .in("id", slice);
        for (const o of (ords || []) as OrderRow[]) orderMap.set(o.id, o);
      }
    }

    // Check each credit
    for (const tx of credits) {
      const isSale = tx.description.startsWith("Sale from order");
      const isDelivery = tx.description.startsWith("Delivery fee for order");
      const isStoreSub = tx.description.toLowerCase().includes("subscription");

      if (!isSale && !isDelivery && !isStoreSub) {
        // Unknown credit source — log low-severity
        issues.push({
          run_id: run.id, issue_type: "unknown_credit_source", severity: "info",
          user_id: tx.user_id, transaction_id: tx.id, actual_amount: tx.amount,
          details: { description: tx.description },
        });
        continue;
      }

      if (isSale || isDelivery) {
        if (!tx.reference_id) {
          issues.push({
            run_id: run.id, issue_type: "credit_missing_order_ref", severity: "warning",
            user_id: tx.user_id, transaction_id: tx.id, actual_amount: tx.amount,
            details: { description: tx.description },
          });
          continue;
        }
        const order = orderMap.get(tx.reference_id);
        if (!order) {
          issues.push({
            run_id: run.id, issue_type: "orphan_credit", severity: "critical",
            user_id: tx.user_id, transaction_id: tx.id, order_id: tx.reference_id,
            actual_amount: tx.amount,
            details: { description: tx.description, reason: "Credit references an order that does not exist" },
          });
          continue;
        }
        if (!order.payment_reference) {
          issues.push({
            run_id: run.id, issue_type: "credit_unpaid_order", severity: "critical",
            user_id: tx.user_id, transaction_id: tx.id, order_id: order.id,
            actual_amount: tx.amount,
            details: { reason: "Order has no payment_reference" },
          });
          continue;
        }
        const v = await verifyPaystack(order.payment_reference);
        if (!v.ok) {
          issues.push({
            run_id: run.id, issue_type: "credit_payment_not_verified", severity: "critical",
            user_id: tx.user_id, transaction_id: tx.id, order_id: order.id,
            payment_reference: order.payment_reference, actual_amount: tx.amount,
            details: { paystack_status: v.status },
          });
          continue;
        }
        // Validate amount matches what could plausibly come from this Paystack txn
        const expected = isSale
          ? Number(order.total_amount) - Number(order.delivery_fee || 0)
          : Number(order.delivery_fee || 0);
        if (Math.abs(Number(tx.amount) - expected) > 0.01) {
          issues.push({
            run_id: run.id, issue_type: "credit_amount_mismatch", severity: "warning",
            user_id: tx.user_id, transaction_id: tx.id, order_id: order.id,
            payment_reference: order.payment_reference,
            expected_amount: expected, actual_amount: tx.amount,
            details: { kind: isSale ? "sale" : "delivery" },
          });
        }
        // Validate recipient: sale credit must go to store owner; delivery credit to rider
        if (isDelivery && order.delivery_person_id && order.delivery_person_id !== tx.user_id) {
          issues.push({
            run_id: run.id, issue_type: "wrong_recipient", severity: "critical",
            user_id: tx.user_id, transaction_id: tx.id, order_id: order.id,
            details: { kind: "delivery", expected_user_id: order.delivery_person_id },
          });
        }
      }
    }

    // ====== 2) Duplicate credits (same user + order + kind) ======
    const seen = new Map<string, string[]>();
    for (const tx of credits) {
      if (!tx.reference_id) continue;
      const kind = tx.description.startsWith("Sale from order")
        ? "sale"
        : tx.description.startsWith("Delivery fee for order")
        ? "delivery"
        : null;
      if (!kind) continue;
      const key = `${tx.user_id}|${tx.reference_id}|${kind}`;
      const arr = seen.get(key) || [];
      arr.push(tx.id);
      seen.set(key, arr);
    }
    for (const [key, ids] of seen) {
      if (ids.length > 1) {
        const [user_id, order_id, kind] = key.split("|");
        issues.push({
          run_id: run.id, issue_type: "duplicate_credit", severity: "critical",
          user_id, order_id, details: { kind, transaction_ids: ids },
        });
      }
    }

    // ====== 3) Paid orders in window missing a seller credit ======
    const { data: paidOrders } = await supabase
      .from("orders")
      .select("id, total_amount, delivery_fee, payment_reference, payment_status, status, store_id, delivery_person_id, created_at")
      .eq("payment_status", "paid")
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", windowEnd.toISOString());

    for (const o of (paidOrders || []) as (OrderRow & { created_at: string })[]) {
      if (o.status === "cancelled") continue;
      const itemsTotal = Number(o.total_amount) - Number(o.delivery_fee || 0);
      if (itemsTotal <= 0) continue;

      // Find store owner
      const { data: store } = await supabase
        .from("stores").select("user_id").eq("id", o.store_id).maybeSingle();
      if (!store?.user_id) continue;

      const { data: credit } = await supabase
        .from("wallet_transactions")
        .select("id, amount")
        .eq("user_id", store.user_id)
        .eq("reference_id", o.id)
        .eq("type", "credit")
        .ilike("description", "Sale from order%")
        .limit(1)
        .maybeSingle();

      if (!credit) {
        // Verify the Paystack payment is real before flagging
        const v = o.payment_reference ? await verifyPaystack(o.payment_reference) : { ok: false, amount: null, status: null };
        if (v.ok) {
          issues.push({
            run_id: run.id, issue_type: "missing_seller_credit", severity: "critical",
            user_id: store.user_id, order_id: o.id, payment_reference: o.payment_reference,
            expected_amount: itemsTotal,
            details: { reason: "Paid+verified order has no wallet credit for the seller" },
          });
        }
      }
    }

    // ====== Persist issues ======
    if (issues.length > 0) {
      for (let i = 0; i < issues.length; i += 200) {
        await supabase.from("reconciliation_issues").insert(issues.slice(i, i + 200));
      }
    }

    // ====== Notify admins on critical findings ======
    const criticalCount = issues.filter(i => i.severity === "critical").length;
    if (criticalCount > 0) {
      const { data: admins } = await supabase
        .from("user_roles").select("user_id").eq("role", "admin");
      const adminIds = Array.from(new Set((admins || []).map((r: any) => r.user_id)));
      if (adminIds.length > 0) {
        await supabase.from("notifications").insert(
          adminIds.map((uid) => ({
            user_id: uid,
            type: "reconciliation",
            title: "Wallet reconciliation flagged issues",
            body: `${criticalCount} critical issue(s) found in the last ${windowHours}h. Review the reconciliation dashboard.`,
            data: { run_id: run.id, critical: criticalCount, total: issues.length },
          }))
        );
      }
    }

    await supabase.from("reconciliation_runs").update({
      completed_at: new Date().toISOString(),
      transactions_checked: allTxns.length,
      paystack_calls: paystackCalls,
      mismatches_found: issues.length,
      status: "completed",
    }).eq("id", run.id);

    return new Response(JSON.stringify({
      run_id: run.id,
      transactions_checked: allTxns.length,
      paystack_calls: paystackCalls,
      issues: issues.length,
      critical: criticalCount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Reconcile error:", err);
    await supabase.from("reconciliation_runs").update({
      completed_at: new Date().toISOString(),
      status: "failed",
      notes: (err as Error).message,
    }).eq("id", run.id);
    return new Response(JSON.stringify({ error: (err as Error).message, run_id: run.id }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
