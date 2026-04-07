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
    
    // Verify Paystack signature
    const signature = req.headers.get("x-paystack-signature");
    if (signature) {
      const hash = createHmac("sha512", PAYSTACK_SECRET_KEY).update(body).digest("hex");
      if (hash !== signature) {
        return new Response("Invalid signature", { status: 401 });
      }
    }

    const event = JSON.parse(body);

    if (event.event !== "charge.success") {
      return new Response("OK", { status: 200 });
    }

    const data = event.data;
    const metadata = data.metadata;
    const reference = data.reference;

    if (!metadata?.buyer_id || !metadata?.store_groups) {
      return new Response("Missing metadata", { status: 400 });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const storeGroups = metadata.store_groups;
    const totalDeliveryFee = metadata.delivery_fee || 0;

    // Get buyer profile for notifications
    const { data: buyerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", metadata.buyer_id)
      .single();

    // Create orders for each store
    for (let i = 0; i < storeGroups.length; i++) {
      const group = storeGroups[i];
      const orderDeliveryFee = i === 0 ? totalDeliveryFee : 0;
      const itemsTotal = group.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
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
          delivery_latitude: isNaN(deliveryLat) ? null : deliveryLat,
          delivery_longitude: isNaN(deliveryLng) ? null : deliveryLng,
          delivery_address: metadata.delivery_address || null,
          delivery_status: metadata.delivery_type === "delivery" ? "pending" : null,
          delivery_payout_status: metadata.delivery_type === "delivery" ? "pending" : null,
        })
        .select()
        .single();

      if (orderError) {
        console.error("Error creating order:", orderError);
        continue;
      }

      // Create order items
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

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal error", { status: 500 });
  }
});
