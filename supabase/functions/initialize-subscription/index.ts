import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { moolrePayin, newReference, normalisePhone, isValidChannel } from "../_shared/moolre.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { plan_id, months, payer, channel, otpcode, reference: existingRef } = await req.json();
    const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));

    const payerNumber = normalisePhone(payer);
    if (!payerNumber) throw new Error("Enter a valid Ghanaian mobile money number");
    const channelInt = parseInt(channel);
    if (!isValidChannel(channelInt)) throw new Error("Choose a valid mobile money network");

    const { data: plan, error: planErr } = await admin
      .from("subscription_plans")
      .select("id, name, price_per_month, max_products, is_active")
      .eq("id", plan_id)
      .single();
    if (planErr || !plan || !plan.is_active) throw new Error("Invalid plan");

    const { data: store, error: storeErr } = await admin
      .from("stores")
      .select("id, name")
      .eq("user_id", user.id)
      .single();
    if (storeErr || !store) throw new Error("Store not found");

    const totalGhs = Number((Number(plan.price_per_month) * monthsInt).toFixed(2));

    const metadata = {
      user_id: user.id,
      store_id: store.id,
      plan_id: plan.id,
      months: monthsInt,
    };

    let reference = newReference("jxp");
    if (otpcode && existingRef) {
      const { data: prior } = await admin
        .from("payment_attempts").select("reference, buyer_id, status")
        .eq("reference", existingRef).maybeSingle();
      if (!prior || prior.buyer_id !== user.id) throw new Error("Unknown payment reference");
      if (prior.status !== "initialized") throw new Error("This payment has already been processed");
      reference = prior.reference;
    } else {
      const { error: attemptErr } = await admin.from("payment_attempts").insert({
        reference,
        buyer_id: user.id,
        amount: totalGhs,
        currency: "GHS",
        kind: "subscription",
        status: "initialized",
        provider: "moolre",
        payer_number: payerNumber,
        payer_channel: channelInt,
        payload: metadata,
      });
      if (attemptErr) throw new Error("Could not record payment attempt. Please try again.");
    }

    const payin = await moolrePayin({
      amount: totalGhs,
      payer: payerNumber,
      channel: channelInt,
      externalref: reference,
      reference: `Jayee Express ${plan.name} plan`,
      otpcode: otpcode || undefined,
    });

    if (!payin.ok && !payin.requiresOtp) {
      await admin.from("payment_attempts").update({
        status: "failed", provider_status: payin.code || "failed",
        last_error: payin.message, verified_at: new Date().toISOString(),
      }).eq("reference", reference);
      throw new Error(payin.message);
    }

    return new Response(JSON.stringify({
      reference,
      pending: true,
      requires_otp: payin.requiresOtp,
      amount: totalGhs,
      message: payin.requiresOtp
        ? payin.message
        : "Approve the payment prompt on your phone to activate your plan.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("init-subscription error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
