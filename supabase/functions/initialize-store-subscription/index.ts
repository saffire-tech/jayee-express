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

    const { store_id, months, payer, channel, otpcode, reference: existingRef } = await req.json();
    if (!store_id) throw new Error("store_id required");
    const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));

    const payerNumber = normalisePhone(payer);
    if (!payerNumber) throw new Error("Enter a valid Ghanaian mobile money number");
    const channelInt = parseInt(channel);
    if (!isValidChannel(channelInt)) throw new Error("Choose a valid mobile money network");

    const { data: store, error: storeErr } = await admin
      .from("stores")
      .select("id, user_id, monthly_fee, is_verified, name")
      .eq("id", store_id)
      .maybeSingle();

    if (storeErr || !store) throw new Error("Store not found");
    if (store.user_id !== user.id) throw new Error("Not your store");
    if (!store.is_verified) throw new Error("Store is pending admin approval");
    if (!store.monthly_fee || Number(store.monthly_fee) <= 0) {
      throw new Error("Monthly fee not assigned by admin yet");
    }

    const totalGhs = Number((Number(store.monthly_fee) * monthsInt).toFixed(2));

    const metadata = {
      user_id: user.id,
      store_id: store.id,
      monthly_fee: Number(store.monthly_fee),
      months: monthsInt,
    };

    let reference = newReference("jxs");
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
        kind: "store_subscription",
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
      reference: "Jayee Express store subscription",
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
        : "Approve the payment prompt on your phone to activate your store.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("init-store-subscription error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
