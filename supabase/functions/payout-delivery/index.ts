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

    // Platform keeps 10% of every delivery fee; rider receives the rest.
    const RIDER_COMMISSION_PCT = 10;
    const grossFee = Number(order.delivery_fee);
    const commission = Math.round(grossFee * RIDER_COMMISSION_PCT) / 100;
    const riderNet = Math.round((grossFee - commission) * 100) / 100;

    // Credit delivery person's wallet — idempotent per order
    const { data: existingCredit } = await adminClient
      .from("wallet_transactions")
      .select("id")
      .eq("user_id", order.delivery_person_id)
      .eq("reference_id", order_id)
      .eq("type", "credit")
      .ilike("description", "Delivery fee for order%")
      .limit(1);

    if (!existingCredit || existingCredit.length === 0) {
      const { error: walletErr } = await adminClient.rpc("update_wallet_balance", {
        _user_id: order.delivery_person_id,
        _amount: riderNet,
        _type: "credit",
        _description: `Delivery fee for order #${order_id.slice(0, 8)} (after ${RIDER_COMMISSION_PCT}% commission)`,
        _reference_id: order_id,
      });
      if (walletErr) throw new Error("Failed to credit delivery wallet");

      await adminClient.from("platform_commission_ledger").insert({
        order_id,
        product_id: null,
        category: "Delivery",
        gross_amount: grossFee,
        commission_pct: RIDER_COMMISSION_PCT,
        commission_amount: commission,
      });
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
      body: `₵${riderNet.toLocaleString()} credited to your wallet for order #${order_id.slice(0, 8)} (₵${grossFee.toLocaleString()} fee less ${RIDER_COMMISSION_PCT}% commission).`,
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
