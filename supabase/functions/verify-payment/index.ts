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

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== "success") {
      return new Response(JSON.stringify({ verified: false, error: "Payment not successful" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txData = verifyData.data;
    const metadata = txData.metadata;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Subscription branch
    if (metadata?.type === "subscription") {
      // Check idempotency
      const { data: existingSub } = await supabase
        .from("store_subscriptions")
        .select("id")
        .eq("payment_reference", reference)
        .limit(1);
      if (!existingSub || existingSub.length === 0) {
        await processSubscription(supabase, metadata, reference, Number(txData.amount) / 100);
      }
      return new Response(JSON.stringify({ verified: true, subscription: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rider subscription branch
    if (metadata?.type === "rider_subscription") {
      const { data: existingRider } = await supabase
        .from("delivery_subscriptions")
        .select("id")
        .eq("payment_reference", reference)
        .limit(1);
      if (!existingRider || existingRider.length === 0) {
        await processRiderSubscription(supabase, metadata, reference, Number(txData.amount) / 100);
      }
      return new Response(JSON.stringify({ verified: true, rider_subscription: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!metadata?.buyer_id || !metadata?.store_groups) {
      return new Response(JSON.stringify({ verified: false, error: "Missing metadata" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if orders already exist
    const { data: existingOrders } = await supabase
      .from("orders")
      .select("id")
      .eq("payment_reference", reference)
      .limit(1);

    if (existingOrders && existingOrders.length > 0) {
      return new Response(JSON.stringify({ verified: true, orders_created: false, message: "Orders already exist" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const storeGroups = metadata.store_groups;
    const totalDeliveryFee = parseFloat(metadata.delivery_fee) || 0;

    const { data: buyerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", metadata.buyer_id)
      .single();

    for (let i = 0; i < storeGroups.length; i++) {
      const group = storeGroups[i];
      const orderDeliveryFee = i === 0 ? totalDeliveryFee : 0;
      const itemsTotal = group.items.reduce((sum: number, item: any) => sum + parseFloat(item.price) * parseInt(item.quantity), 0);
      const orderTotal = itemsTotal + orderDeliveryFee;

      const deliveryLat = metadata.delivery_latitude ? parseFloat(metadata.delivery_latitude) : null;
      const deliveryLng = metadata.delivery_longitude ? parseFloat(metadata.delivery_longitude) : null;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          buyer_id: metadata.buyer_id,
          store_id: group.store_id,
          total_amount: orderTotal,
          status: "pending",
          payment_status: "paid",
          payment_reference: reference,
          delivery_type: metadata.delivery_type || "pickup",
          delivery_fee: orderDeliveryFee,
          delivery_latitude: deliveryLat !== null && !isNaN(deliveryLat) ? deliveryLat : null,
          delivery_longitude: deliveryLng !== null && !isNaN(deliveryLng) ? deliveryLng : null,
          delivery_address: metadata.delivery_address || null,
          delivery_landmark: metadata.delivery_landmark || null,
          delivery_status: null,
          delivery_payout_status: metadata.delivery_type === "delivery" ? "pending" : null,
        })
        .select()
        .single();

      if (orderError) {
        console.error("Error creating order:", orderError);
        continue;
      }

      const orderItems = group.items.map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: parseInt(item.quantity) || 1,
        price: parseFloat(item.price),
      }));

      await supabase.from("order_items").insert(orderItems);

      // Credit seller's wallet
      const { data: storeData } = await supabase
        .from("stores")
        .select("user_id, name")
        .eq("id", group.store_id)
        .single();

      if (storeData?.user_id) {
        const sellerShare = itemsTotal;
        if (sellerShare > 0) {
          try {
            await supabase.rpc("update_wallet_balance", {
              _user_id: storeData.user_id,
              _amount: sellerShare,
              _type: "credit",
              _description: `Sale from order #${order.id.slice(0, 8)}`,
              _reference_id: order.id,
            });
          } catch (e) {
            console.error("Wallet credit error for seller:", e);
          }
        }

        await supabase.from("notifications").insert({
          user_id: storeData.user_id,
          type: "order",
          title: "New Order Received!",
          body: `New order of ₵${orderTotal.toLocaleString()} from ${buyerProfile?.full_name || "a buyer"}. Payment confirmed.`,
          data: { order_id: order.id },
        });
      }
    }

    await supabase.from("cart_items").delete().eq("user_id", metadata.buyer_id);

    return new Response(JSON.stringify({ verified: true, orders_created: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Verify payment error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processSubscription(supabase: any, metadata: any, reference: string, amountPaid: number) {
  const { store_id, plan_id, user_id, months } = metadata;
  const monthsInt = parseInt(months) || 1;

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("max_products, name")
    .eq("id", plan_id)
    .single();
  if (!plan) throw new Error("Plan not found");

  const { data: store } = await supabase
    .from("stores")
    .select("subscription_expires_at")
    .eq("id", store_id)
    .single();

  const now = new Date();
  const baseDate = store?.subscription_expires_at && new Date(store.subscription_expires_at) > now
    ? new Date(store.subscription_expires_at)
    : now;
  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + monthsInt);

  await supabase.from("store_subscriptions").insert({
    store_id, user_id, plan_id,
    months: monthsInt,
    amount_paid: amountPaid,
    starts_at: baseDate.toISOString(),
    expires_at: newExpiry.toISOString(),
    status: "active",
    payment_reference: reference,
  });

  await supabase.from("stores").update({
    current_plan_id: plan_id,
    product_limit: plan.max_products,
    subscription_expires_at: newExpiry.toISOString(),
  }).eq("id", store_id);

  await supabase.from("notifications").insert({
    user_id,
    type: "subscription",
    title: "Subscription Active",
    body: `Your ${plan.name} plan is active until ${newExpiry.toLocaleDateString()}.`,
    data: { store_id, plan_id },
  });
}
