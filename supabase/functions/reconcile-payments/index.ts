import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not set");

    // Optional admin check when called from the app
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const onlyReference: string | undefined = body?.reference;

    let query = supabase.from("payment_attempts").select("reference, kind, created_at").eq("status", "initialized");
    if (onlyReference) {
      query = query.eq("reference", onlyReference);
    } else {
      const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      query = query.lt("created_at", cutoff).limit(50);
    }

    const { data: pending, error } = await query;
    if (error) throw error;

    const results: any[] = [];
    for (const row of pending || []) {
      try {
        const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${row.reference}`, {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        });
        const verifyData = await verifyRes.json();
        const txStatus = verifyData?.data?.status;

        if (verifyData?.status && txStatus === "success") {
          if (row.kind === "order") {
            const { error: rpcErr } = await supabase.rpc("finalize_order_payment", {
              _reference: row.reference,
              _amount: Number(verifyData.data.amount) / 100,
            });
            if (rpcErr) {
              await supabase.from("payment_attempts").update({
                last_error: rpcErr.message, paystack_status: "success", verified_at: new Date().toISOString(),
              }).eq("reference", row.reference);
              results.push({ reference: row.reference, action: "finalize_failed", error: rpcErr.message });
            } else {
              results.push({ reference: row.reference, action: "finalized" });
            }
          } else {
            results.push({ reference: row.reference, action: "skipped_non_order" });
          }
        } else {
          await supabase.from("payment_attempts").update({
            status: txStatus === "abandoned" ? "abandoned" : "failed",
            paystack_status: txStatus || "failed",
            verified_at: new Date().toISOString(),
            last_error: verifyData?.message || `Paystack status: ${txStatus || "unknown"}`,
          }).eq("reference", row.reference);
          results.push({ reference: row.reference, action: "marked_failed", status: txStatus });
        }
      } catch (e: any) {
        console.error("Reconcile error for", row.reference, e);
        results.push({ reference: row.reference, action: "error", error: e.message });
      }
    }

    return new Response(JSON.stringify({ checked: pending?.length || 0, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Reconcile-payments error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
