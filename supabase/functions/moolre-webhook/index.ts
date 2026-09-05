import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { moolreStatus } from "../_shared/moolre.ts";
import { finalizeSuccessfulPayment, markAttemptFailed } from "../_shared/payment-finalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Moolre payment callback.
 *
 * The callback body is never trusted: we only take the external reference from
 * it and then ask Moolre's status endpoint (authenticated with our private key)
 * what actually happened. That makes a forged callback harmless.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const reference: string | undefined =
      body?.externalref || body?.data?.externalref || body?.external_ref || body?.reference;

    if (!reference) {
      console.warn("Moolre webhook without external reference:", JSON.stringify(body).slice(0, 400));
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      console.warn("Moolre webhook for unknown reference:", reference);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (attempt.status === "success") {
      return new Response(JSON.stringify({ received: true, already: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await moolreStatus(reference);

    if (result.status === "success") {
      const amountPaid = result.amount ?? Number(attempt.amount);
      await finalizeSuccessfulPayment(supabase, attempt, amountPaid);
    } else if (result.status === "failed") {
      await markAttemptFailed(supabase, attempt, "failed", result.message || "Payment failed");
    }
    // pending / not_found: leave alone, reconciliation will pick it up.

    return new Response(JSON.stringify({ received: true, status: result.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Moolre webhook error:", error);
    // Always 200 so Moolre does not hammer us; reconciliation is the safety net.
    return new Response(JSON.stringify({ received: true, error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
