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
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not set");

    const { reference } = await req.json();
    if (!reference) throw new Error("No reference provided");

    // Verify transaction with Paystack
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

    if (!metadata?.buyer_id || !metadata?.store_groups) {
      return new Response(JSON.stringify({ verified: false, error: "Missing metadata" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if orders already exist for this reference
    const { data: existingOrders } = await supabase
      .from("orders")
      .select("id")
      .eq("payment_reference", reference)
      .limit(1);

    if (existingOrders && existingOrders.length > 0) {
      // Orders already created (webhook beat us)
      return new Response(JSON.stringify({ verified: true, orders_created: false, message: "Orders already exist" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create orders (same logic as webhook)
    const storeGroups = metadata.store_groups;
    const totalDeliveryFee = metadata.delivery_fee || 0;

    const { data: buyerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", metadata.buyer_id)
      .single();

    for (let i = 0; i < storeGroups.length; i++) {
      const group = storeGroups[i];
      const orderDeliveryFee = i === 0 ? totalDeliveryFee : 0;
      const itemsTotal = group.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
      const orderTotal = itemsTotal + orderDeliveryFee;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          buyer_id: metadata.buyer_id,
          store_id: group.store_id,
          total_amount: orderTotal,
          status: "pending",
          payment_status: "paid",
          payment_reference: reference,
          delivery_type: metadata.delivery_type,
          delivery_fee: orderDeliveryFee,
          delivery_latitude: metadata.delivery_latitude,
          delivery_longitude: metadata.delivery_longitude,
          delivery_address: metadata.delivery_address,
          delivery_status: metadata.delivery_type === "delivery" ? "pending" : null,
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
        quantity: item.quantity,
        price: item.price,
      }));

      await supabase.from("order_items").insert(orderItems);

      // Notify seller
      const { data: storeData } = await supabase
        .from("stores")
        .select("user_id, name")
        .eq("id", group.store_id)
        .single();

      if (storeData?.user_id) {
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

    return new Response(JSON.stringify({ verified: true, orders_created: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
