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
    if (!signature) {
      return new Response("Missing signature", { status: 401 });
    }
    const hash = createHmac("sha512", PAYSTACK_SECRET_KEY).update(body).digest("hex");
    if (hash !== signature) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event !== "charge.success") {
      return new Response("OK", { status: 200 });
    }

    const data = event.data;
    const metadata = data.metadata;
    const reference = data.reference;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Subscription payment branch
    if (metadata?.type === "subscription") {
      await processSubscription(supabase, metadata, reference, Number(data.amount) / 100);
      return new Response("OK", { status: 200 });
    }

    // Rider subscription branch
    if (metadata?.type === "rider_subscription") {
      await processRiderSubscription(supabase, metadata, reference, Number(data.amount) / 100);
      return new Response("OK", { status: 200 });
    }

    if (!metadata?.buyer_id || !metadata?.store_groups) {
      return new Response("Missing metadata", { status: 400 });
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

      // Credit seller's wallet with full items total (no commission)
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

    // Clear buyer's cart
    await supabase.from("cart_items").delete().eq("user_id", metadata.buyer_id);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal error", { status: 500 });
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

