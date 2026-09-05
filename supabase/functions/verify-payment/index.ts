import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { moolreStatus } from "../_shared/moolre.ts";
import { finalizeSuccessfulPayment, markAttemptFailed } from "../_shared/payment-finalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// A transaction Moolre has not surfaced yet is treated as still pending
// for this long before we call it failed.
const NOT_FOUND_GRACE_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { reference } = await req.json();
    if (!reference) throw new Error("No reference provided");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: attempt } = await supabase
      .from("payment_attempts")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (!attempt) {
      return new Response(JSON.stringify({
        verified: false, status: "unknown",
        message: "We could not find that payment.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ownerId = attempt.buyer_id || attempt.payload?.user_id;
    if (ownerId && ownerId !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already settled — report the stored outcome without calling Moolre again.
    if (attempt.status === "success") {
      return new Response(JSON.stringify({ verified: true, status: "success", already: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (attempt.status === "failed" || attempt.status === "abandoned") {
      return new Response(JSON.stringify({
        verified: false, status: attempt.status,
        message: attempt.last_error || "Payment was not completed. You were not charged.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await moolreStatus(reference);
    const age = Date.now() - new Date(attempt.created_at).getTime();

    if (result.status === "pending" || (result.status === "not_found" && age < NOT_FOUND_GRACE_MS)) {
      return new Response(JSON.stringify({
        verified: false, status: "pending",
        message: "Waiting for you to approve the prompt on your phone.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (result.status !== "success") {
      await markAttemptFailed(supabase, attempt, result.status, result.message || "Payment was not completed");
      return new Response(JSON.stringify({
        verified: false,
        status: "failed",
        message: "Payment was not successful. You were not charged.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const amountPaid = result.amount ?? Number(attempt.amount);
    const finalized = await finalizeSuccessfulPayment(supabase, attempt, amountPaid);

    return new Response(JSON.stringify({
      verified: true,
      status: "success",
      kind: finalized.kind,
      orders_created: finalized.finalized && !finalized.already,
      already: finalized.already,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Verify payment error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
