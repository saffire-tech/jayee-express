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

    // Use service role for order lookup and updates
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch order
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

    // Get delivery person's MoMo details
    const { data: deliveryProfile } = await adminClient
      .from("profiles")
      .select("momo_number, momo_provider, full_name")
      .eq("user_id", order.delivery_person_id)
      .single();

    if (!deliveryProfile?.momo_number || !deliveryProfile?.momo_provider) {
      // Mark as pending - delivery person hasn't set up MoMo
      await adminClient
        .from("orders")
        .update({ delivery_payout_status: "pending" })
        .eq("id", order_id);

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Payout pending - delivery person needs to set up MoMo" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map MoMo provider to Paystack bank code
    const providerMap: Record<string, string> = {
      "MTN": "MTN",
      "Vodafone": "VOD",
      "AirtelTigo": "ATL",
    };

    const bankCode = providerMap[deliveryProfile.momo_provider];
    if (!bankCode) throw new Error("Invalid MoMo provider");

    // Create transfer recipient
    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "mobile_money",
        name: deliveryProfile.full_name || "Delivery Person",
        account_number: deliveryProfile.momo_number,
        bank_code: bankCode,
        currency: "GHS",
      }),
    });

    const recipientData = await recipientRes.json();
    if (!recipientData.status) {
      throw new Error(recipientData.message || "Failed to create recipient");
    }

    // Initiate transfer
    const transferAmount = Math.round(order.delivery_fee * 100); // pesewas
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: transferAmount,
        recipient: recipientData.data.recipient_code,
        reason: `Delivery payout for order ${order_id.slice(0, 8)}`,
        currency: "GHS",
      }),
    });

    const transferData = await transferRes.json();

    if (transferData.status) {
      await adminClient
        .from("orders")
        .update({ delivery_payout_status: "paid" })
        .eq("id", order_id);

      // Notify delivery person
      await adminClient.from("notifications").insert({
        user_id: order.delivery_person_id,
        type: "payout",
        title: "Delivery Payout Sent!",
        body: `₵${order.delivery_fee} has been sent to your MoMo (${deliveryProfile.momo_number}).`,
        data: { order_id },
      });

      return new Response(JSON.stringify({ success: true, message: "Payout sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      await adminClient
        .from("orders")
        .update({ delivery_payout_status: "failed" })
        .eq("id", order_id);

      throw new Error(transferData.message || "Transfer failed");
    }
  } catch (error) {
    console.error("Payout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
