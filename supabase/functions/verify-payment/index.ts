import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reference } = await req.json();
    if (!reference) throw new Error("No reference provided");

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const verifyData = await verifyRes.json();

    const txStatus = verifyData?.data?.status as string | undefined;
    const txData = verifyData?.data;
    const metadata = txData?.metadata;

    // Load attempt row (if any) — source of truth
    const { data: attempt } = await supabase
      .from("payment_attempts")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    // Not successful → record failure (if attempt exists) and return
    if (!verifyData?.status || txStatus !== "success") {
      if (attempt && attempt.status === "initialized") {
        await supabase.from("payment_attempts").update({
          status: txStatus === "abandoned" ? "abandoned" : "failed",
          paystack_status: txStatus || "failed",
          verified_at: new Date().toISOString(),
          last_error: verifyData?.message || `Paystack status: ${txStatus || "unknown"}`,
        }).eq("reference", reference);

        await supabase.from("notifications").insert({
          user_id: attempt.buyer_id,
          type: "payment",
          title: "Payment not completed",
          body: "Your recent payment did not go through. You were not charged — your cart is still saved if you'd like to try again.",
          data: { reference },
        });
      }
      return new Response(JSON.stringify({
        verified: false,
        status: txStatus || "failed",
        message: "Payment was not successful. You were not charged.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Subscription branches still use metadata path (unchanged)
    if (metadata?.type === "subscription") {
      const { data: existing } = await supabase.from("store_subscriptions").select("id").eq("payment_reference", reference).limit(1);
      if (!existing || existing.length === 0) {
        await processSubscription(supabase, metadata, reference, Number(txData.amount) / 100);
      }
      return new Response(JSON.stringify({ verified: true, subscription: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (metadata?.type === "rider_subscription") {
      const { data: existing } = await supabase.from("delivery_subscriptions").select("id").eq("payment_reference", reference).limit(1);
      if (!existing || existing.length === 0) {
        await processRiderSubscription(supabase, metadata, reference, Number(txData.amount) / 100);
      }
      return new Response(JSON.stringify({ verified: true, rider_subscription: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (metadata?.type === "store_subscription") {
      const { data: existing } = await supabase.from("store_subscriptions").select("id").eq("payment_reference", reference).limit(1);
      if (!existing || existing.length === 0) {
        await processStoreAdminSubscription(supabase, metadata, reference, Number(txData.amount) / 100);
      }
      return new Response(JSON.stringify({ verified: true, store_subscription: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Order branch — use the atomic RPC
    if (!attempt) {
      return new Response(JSON.stringify({
        verified: true,
        orders_created: false,
        message: "Payment recorded but no local attempt found. Support has been notified.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: rpcRes, error: rpcErr } = await supabase.rpc("finalize_order_payment", {
      _reference: reference,
      _amount: Number(txData.amount) / 100,
    });

    if (rpcErr) {
      console.error("finalize_order_payment error:", rpcErr);
      await supabase.from("payment_attempts").update({
        last_error: rpcErr.message,
        paystack_status: "success",
        verified_at: new Date().toISOString(),
      }).eq("reference", reference);
      throw new Error("Could not finalize order. Our team has been notified.");
    }

    return new Response(JSON.stringify({
      verified: true,
      orders_created: (rpcRes as any)?.orders_created ?? false,
      already: (rpcRes as any)?.already ?? false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Verify payment error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processSubscription(supabase: any, metadata: any, reference: string, _amountPaid: number) {
  const { store_id, plan_id, user_id, months } = metadata;
  const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));
  const { data: plan } = await supabase.from("subscription_plans").select("max_products, name, price_per_month").eq("id", plan_id).single();
  if (!plan) throw new Error("Plan not found");
  const amountPaid = Number(plan.price_per_month) * monthsInt;
  const { data: store } = await supabase.from("stores").select("subscription_expires_at").eq("id", store_id).single();
  const now = new Date();
  const baseDate = store?.subscription_expires_at && new Date(store.subscription_expires_at) > now
    ? new Date(store.subscription_expires_at) : now;
  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + monthsInt);
  await supabase.from("store_subscriptions").insert({
    store_id, user_id, plan_id, months: monthsInt, amount_paid: amountPaid,
    starts_at: baseDate.toISOString(), expires_at: newExpiry.toISOString(),
    status: "active", payment_reference: reference,
  });
  await supabase.from("stores").update({
    current_plan_id: plan_id, product_limit: plan.max_products,
    subscription_expires_at: newExpiry.toISOString(),
  }).eq("id", store_id);
  await supabase.from("notifications").insert({
    user_id, type: "subscription", title: "Subscription Active",
    body: `Your ${plan.name} plan is active until ${newExpiry.toLocaleDateString()}.`,
    data: { store_id, plan_id },
  });
}

async function processStoreAdminSubscription(supabase: any, metadata: any, reference: string, _amountPaid: number) {
  const { user_id, store_id, months } = metadata;
  const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));
  const { data: store } = await supabase.from("stores").select("subscription_expires_at, name, monthly_fee").eq("id", store_id).maybeSingle();
  if (!store || !store.monthly_fee || Number(store.monthly_fee) <= 0) throw new Error("Monthly fee not set");
  const monthlyFee = Number(store.monthly_fee);
  const amountPaid = monthlyFee * monthsInt;
  const now = new Date();
  const baseDate = store?.subscription_expires_at && new Date(store.subscription_expires_at) > now
    ? new Date(store.subscription_expires_at) : now;
  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + monthsInt);
  await supabase.from("store_subscriptions").insert({
    store_id, user_id, monthly_fee: monthlyFee, months: monthsInt,
    amount_paid: amountPaid, starts_at: baseDate.toISOString(),
    expires_at: newExpiry.toISOString(), status: "active", payment_reference: reference,
  });
  await supabase.from("stores").update({ subscription_expires_at: newExpiry.toISOString() }).eq("id", store_id);
  await supabase.from("notifications").insert({
    user_id, type: "subscription", title: "Store Subscription Active",
    body: `${store?.name || "Your store"} is now live until ${newExpiry.toLocaleDateString()}.`,
    data: { store_id },
  });
}

async function processRiderSubscription(supabase: any, metadata: any, reference: string, _amountPaid: number) {
  const { user_id, months } = metadata;
  const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));
  const { data: app } = await supabase
    .from("rider_applications")
    .select("monthly_fee, status")
    .eq("user_id", user_id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!app || !app.monthly_fee || Number(app.monthly_fee) <= 0) throw new Error("Rider monthly fee not set");
  const monthlyFee = Number(app.monthly_fee);
  const amountPaid = monthlyFee * monthsInt;
  const { data: latest } = await supabase.from("delivery_subscriptions")
    .select("expires_at").eq("user_id", user_id).order("expires_at", { ascending: false }).limit(1).maybeSingle();
  const now = new Date();
  const baseDate = latest?.expires_at && new Date(latest.expires_at) > now ? new Date(latest.expires_at) : now;
  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + monthsInt);
  await supabase.from("delivery_subscriptions").insert({
    user_id, monthly_fee: monthlyFee, months: monthsInt, amount_paid: amountPaid,
    starts_at: baseDate.toISOString(), expires_at: newExpiry.toISOString(),
    status: "active", payment_reference: reference,
  });
  await supabase.from("notifications").insert({
    user_id, type: "rider_subscription", title: "Rider Subscription Active",
    body: `Your delivery subscription is active until ${newExpiry.toLocaleDateString()}.`,
  });
}

