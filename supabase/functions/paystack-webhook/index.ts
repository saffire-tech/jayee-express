import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not set");

    const body = await req.text();
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) return new Response("Missing signature", { status: 401 });
    const hash = createHmac("sha512", PAYSTACK_SECRET_KEY).update(body).digest("hex");
    if (hash !== signature) return new Response("Invalid signature", { status: 401 });

    const event = JSON.parse(body);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const data = event.data;
    const reference = data?.reference;
    const metadata = data?.metadata;

    // Failure / abandonment events → mark attempt accordingly
    if (event.event === "charge.failed" || event.event === "charge.abandoned") {
      if (reference) {
        const { data: attempt } = await supabase.from("payment_attempts").select("buyer_id, status").eq("reference", reference).maybeSingle();
        if (attempt && attempt.status === "initialized") {
          await supabase.from("payment_attempts").update({
            status: event.event === "charge.abandoned" ? "abandoned" : "failed",
            paystack_status: data?.status || event.event,
            verified_at: new Date().toISOString(),
            last_error: data?.gateway_response || event.event,
          }).eq("reference", reference);
          await supabase.from("notifications").insert({
            user_id: attempt.buyer_id,
            type: "payment",
            title: "Payment not completed",
            body: "Your recent payment did not go through. You were not charged — your cart is still saved.",
            data: { reference },
          });
        }
      }
      return new Response("OK", { status: 200 });
    }

    if (event.event !== "charge.success") return new Response("OK", { status: 200 });

    // Subscription branches
    if (metadata?.type === "subscription") {
      await processSubscription(supabase, metadata, reference, Number(data.amount) / 100);
      return new Response("OK", { status: 200 });
    }
    if (metadata?.type === "rider_subscription") {
      await processRiderSubscription(supabase, metadata, reference, Number(data.amount) / 100);
      return new Response("OK", { status: 200 });
    }
    if (metadata?.type === "store_subscription") {
      await processStoreAdminSubscription(supabase, metadata, reference, Number(data.amount) / 100);
      return new Response("OK", { status: 200 });
    }

    // Order branch — finalize via atomic RPC
    const { data: attempt } = await supabase.from("payment_attempts").select("id").eq("reference", reference).maybeSingle();
    if (!attempt) {
      console.error("Webhook: no payment_attempt for reference", reference);
      return new Response("OK", { status: 200 });
    }

    const { error: rpcErr } = await supabase.rpc("finalize_order_payment", {
      _reference: reference,
      _amount: Number(data.amount) / 100,
    });
    if (rpcErr) {
      console.error("Webhook finalize error:", rpcErr);
      await supabase.from("payment_attempts").update({
        last_error: rpcErr.message,
        paystack_status: "success",
        verified_at: new Date().toISOString(),
      }).eq("reference", reference);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal error", { status: 500 });
  }
});

async function processSubscription(supabase: any, metadata: any, reference: string, _amountPaid: number) {
  const { store_id, plan_id, user_id, months } = metadata;
  const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));
  const { data: existing } = await supabase.from("store_subscriptions").select("id").eq("payment_reference", reference).limit(1);
  if (existing && existing.length > 0) return;
  // Re-read plan from DB — never trust metadata.price
  const { data: plan } = await supabase.from("subscription_plans").select("max_products, name, price_per_month").eq("id", plan_id).single();
  if (!plan) throw new Error("Plan not found");
  const amountPaid = Number(plan.price_per_month) * monthsInt;
  const { data: store } = await supabase.from("stores").select("subscription_expires_at").eq("id", store_id).single();
  const now = new Date();
  const baseDate = store?.subscription_expires_at && new Date(store.subscription_expires_at) > now ? new Date(store.subscription_expires_at) : now;
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
  const { data: existing } = await supabase.from("store_subscriptions").select("id").eq("payment_reference", reference).limit(1);
  if (existing && existing.length > 0) return;
  // Re-read monthly_fee from DB — never trust metadata
  const { data: store } = await supabase.from("stores").select("subscription_expires_at, name, monthly_fee").eq("id", store_id).maybeSingle();
  if (!store || !store.monthly_fee || Number(store.monthly_fee) <= 0) throw new Error("Monthly fee not set");
  const monthlyFee = Number(store.monthly_fee);
  const amountPaid = monthlyFee * monthsInt;
  const now = new Date();
  const baseDate = store?.subscription_expires_at && new Date(store.subscription_expires_at) > now ? new Date(store.subscription_expires_at) : now;
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
  const { data: existing } = await supabase.from("delivery_subscriptions").select("id").eq("payment_reference", reference).limit(1);
  if (existing && existing.length > 0) return;
  // Re-read monthly_fee from approved rider application
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

