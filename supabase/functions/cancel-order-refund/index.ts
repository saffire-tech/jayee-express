import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { moolrePayout } from "../_shared/moolre.ts";

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

    // Fetch order
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) throw new Error("Order not found");
    if (order.buyer_id !== user.id) throw new Error("Not your order");
    if (order.status !== "pending") throw new Error("Only pending orders can be cancelled");

    // Check 15-minute window
    const createdAt = new Date(order.created_at).getTime();
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;
    if (now - createdAt > fifteenMinutes) {
      throw new Error("Cancellation window (15 minutes) has expired");
    }

    // Cancel the order
    await adminClient
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", order_id);

    // Reverse seller wallet credit — only if the original credit actually happened
    const { data: store } = await adminClient
      .from("stores")
      .select("user_id")
      .eq("id", order.store_id)
      .single();

    if (store) {
      // Use the actual prior credit amount (already net of commission)
      const { data: priorCredit } = await adminClient
        .from("wallet_transactions")
        .select("id, amount")
        .eq("user_id", store.user_id)
        .eq("reference_id", order_id)
        .eq("type", "credit")
        .ilike("description", "Sale from order%")
        .limit(1);

      const { data: priorReversal } = await adminClient
        .from("wallet_transactions")
        .select("id")
        .eq("user_id", store.user_id)
        .eq("reference_id", order_id)
        .eq("type", "debit")
        .ilike("description", "Order cancelled%")
        .limit(1);

      const sellerShare = Number(priorCredit?.[0]?.amount || 0);

      if (priorCredit?.length && !priorReversal?.length && sellerShare > 0) {
        try {
          await adminClient.rpc("update_wallet_balance", {
            _user_id: store.user_id,
            _amount: sellerShare,
            _type: "debit",
            _description: `Order cancelled - refund reversal`,
            _reference_id: order_id,
          });
        } catch (e) {
          console.error("Seller wallet reversal error:", e);
        }
      }
    }

    // Reverse platform commission ledger entries for this order
    try {
      await adminClient
        .from("platform_commission_ledger")
        .update({
          reversed_at: new Date().toISOString(),
          reversal_reason: "order_cancelled",
        })
        .eq("order_id", order_id)
        .is("reversed_at", null);
    } catch (e) {
      console.error("Commission ledger reversal error:", e);
    }


    // Reverse rider wallet credit if the delivery fee was already paid out
    if (order.delivery_person_id && Number(order.delivery_fee || 0) > 0) {
      const { data: riderCredit } = await adminClient
        .from("wallet_transactions")
        .select("id")
        .eq("user_id", order.delivery_person_id)
        .eq("reference_id", order_id)
        .eq("type", "credit")
        .ilike("description", "Delivery fee for order%")
        .limit(1);

      const { data: riderReversal } = await adminClient
        .from("wallet_transactions")
        .select("id")
        .eq("user_id", order.delivery_person_id)
        .eq("reference_id", order_id)
        .eq("type", "debit")
        .ilike("description", "Delivery cancelled%")
        .limit(1);

      if (riderCredit?.length && !riderReversal?.length) {
        try {
          await adminClient.rpc("update_wallet_balance", {
            _user_id: order.delivery_person_id,
            _amount: Number(order.delivery_fee),
            _type: "debit",
            _description: `Delivery cancelled - refund reversal`,
            _reference_id: order_id,
          });
          await adminClient.from("notifications").insert({
            user_id: order.delivery_person_id,
            type: "payout",
            title: "Delivery Refunded",
            body: `Order #${order_id.slice(0, 8)} was cancelled. ₵${Number(order.delivery_fee).toLocaleString()} delivery fee has been reversed.`,
            data: { order_id },
          });
        } catch (e) {
          console.error("Rider wallet reversal error:", e);
        }
      }
    }


    // Refund the buyer's mobile money account via Moolre.
    if (order.payment_reference) {
      try {
        const { data: attempt } = await adminClient
          .from("payment_attempts")
          .select("payer_number, payer_channel, provider")
          .eq("reference", order.payment_reference)
          .maybeSingle();

        const refundAmount = Number(order.total_amount || 0);
        let refunded = false;

        if (attempt?.provider === "moolre" && attempt.payer_number && attempt.payer_channel && refundAmount > 0) {
          const payout = await moolrePayout({
            amount: refundAmount,
            receiver: attempt.payer_number,
            channel: Number(attempt.payer_channel),
            externalref: `refund_${order_id}`,
            reference: "Jayee Express order refund",
          });
          refunded = payout.ok;
          if (!payout.ok) console.error("Moolre refund failed:", payout.message);
        }

        if (!refunded) {
          // Fall back to a manual refund task for admins.
          const { data: admins } = await adminClient
            .from("user_roles").select("user_id").eq("role", "admin");
          for (const a of admins || []) {
            await adminClient.from("notifications").insert({
              user_id: a.user_id,
              type: "payment",
              title: "Manual refund needed",
              body: `Order #${order_id.slice(0, 8)} was cancelled but the automatic refund of ₵${refundAmount.toLocaleString()} did not go through. Please refund the buyer manually.`,
              data: { order_id, reference: order.payment_reference },
            });
          }
        }
      } catch (refundErr) {
        console.error("Refund error:", refundErr);
      }
    }

    // Notify seller
    if (store) {
      const { data: buyerProfile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      await adminClient.from("notifications").insert({
        user_id: store.user_id,
        type: "order",
        title: "Order Cancelled",
        body: `Order of ₵${Number(order.total_amount).toLocaleString()} from ${buyerProfile?.full_name || "a buyer"} has been cancelled and refunded.`,
        data: { order_id },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Cancel order error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
