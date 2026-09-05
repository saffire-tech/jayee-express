import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { moolreStatus } from "../_shared/moolre.ts";
import { finalizeSuccessfulPayment, markAttemptFailed } from "../_shared/payment-finalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require admin authentication for all calls
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const onlyReference: string | undefined = body?.reference;

    // Moolre-only: legacy Paystack rows are left untouched for history.
    let query = supabase
      .from("payment_attempts")
      .select("*")
      .eq("status", "initialized")
      .eq("provider", "moolre");

    if (onlyReference) {
      query = query.eq("reference", onlyReference);
    } else {
      const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      query = query.lt("created_at", cutoff).limit(50);
    }

    const { data: pending, error } = await query;
    if (error) throw error;

    const results: any[] = [];
    for (const attempt of pending || []) {
      try {
        const result = await moolreStatus(attempt.reference);

        if (result.status === "success") {
          const amountPaid = result.amount ?? Number(attempt.amount);
          const finalized = await finalizeSuccessfulPayment(supabase, attempt, amountPaid);
          results.push({ reference: attempt.reference, action: finalized.already ? "already" : "finalized" });
        } else if (result.status === "pending") {
          results.push({ reference: attempt.reference, action: "still_pending" });
        } else {
          await markAttemptFailed(supabase, attempt, result.status, result.message || "Payment not completed");
          results.push({ reference: attempt.reference, action: "marked_failed", status: result.status });
        }
      } catch (e: any) {
        console.error("Reconcile error for", attempt.reference, e);
        await supabase.from("payment_attempts")
          .update({ last_error: e.message }).eq("reference", attempt.reference);
        results.push({ reference: attempt.reference, action: "error", error: e.message });
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
