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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { order_id } = await req.json();
    if (!order_id) throw new Error("order_id required");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) throw new Error("Order not found");
    if (order.buyer_id !== user.id) throw new Error("Not your order");
    if (order.delivery_payout_status === "paid") throw new Error("Already paid out");
    if (!order.delivery_person_id) throw new Error("No delivery person assigned");
    if (order.delivery_fee <= 0) throw new Error("No delivery fee to pay out");

    // Credit delivery person's wallet instead of direct MoMo transfer
    try {
      await adminClient.rpc("update_wallet_balance", {
        _user_id: order.delivery_person_id,
        _amount: order.delivery_fee,
        _type: "credit",
        _description: `Delivery fee for order #${order_id.slice(0, 8)}`,
        _reference_id: order_id,
      });
    } catch (e) {
      throw new Error("Failed to credit delivery wallet");
    }

    // Mark as paid
    await adminClient
      .from("orders")
      .update({ delivery_payout_status: "paid" })
      .eq("id", order_id);

    // Notify delivery person
    await adminClient.from("notifications").insert({
      user_id: order.delivery_person_id,
      type: "payout",
      title: "Delivery Payment Received!",
      body: `₵${order.delivery_fee} has been added to your wallet for delivery #${order_id.slice(0, 8)}.`,
      data: { order_id },
    });

    return new Response(JSON.stringify({ success: true, message: "Delivery fee credited to wallet" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Payout error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
