// Admin action handler for manual payouts.
// Actions:
//  - approve: mark request 'approved' (no money movement)
//  - mark_paid: mark request 'paid' with payment_method + admin_payment_reference
//  - reject: mark 'rejected', refund the held amount to user wallet
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden — admins only");

    const body = await req.json();
    const { withdrawal_id, action, admin_note, payment_method, admin_payment_reference, rejection_reason } = body;

    if (!withdrawal_id || !action) throw new Error("withdrawal_id and action required");

    const { data: wd, error: wdErr } = await admin
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawal_id)
      .single();
    if (wdErr || !wd) throw new Error("Withdrawal not found");

    if (action === "approve") {
      if (!["pending"].includes(wd.status)) throw new Error("Only pending requests can be approved");
      await admin.from("withdrawal_requests").update({
        status: "approved",
        reviewed_by: user.id,
        admin_note: admin_note || null,
      }).eq("id", withdrawal_id);

      await admin.from("notifications").insert({
        user_id: wd.user_id,
        type: "payout",
        title: "Withdrawal Approved",
        body: `Your ₵${Number(wd.amount).toLocaleString()} withdrawal has been approved and is pending payout.`,
        data: { withdrawal_id },
      });
    } else if (action === "mark_paid") {
      if (!["pending", "approved"].includes(wd.status)) {
        throw new Error("Only pending/approved requests can be marked paid");
      }
      if (!payment_method || !admin_payment_reference) {
        throw new Error("payment_method and admin_payment_reference required");
      }
      await admin.from("withdrawal_requests").update({
        status: "paid",
        reviewed_by: user.id,
        paid_at: new Date().toISOString(),
        payment_method,
        admin_payment_reference,
        admin_note: admin_note || wd.admin_note,
        processed_at: new Date().toISOString(),
      }).eq("id", withdrawal_id);

      await admin.from("notifications").insert({
        user_id: wd.user_id,
        type: "payout",
        title: "Payout Sent",
        body: `Your ₵${Number(wd.amount).toLocaleString()} payout was sent to ${wd.momo_provider} ${wd.momo_number}. Ref: ${admin_payment_reference}`,
        data: { withdrawal_id },
      });
    } else if (action === "reject") {
      if (!["pending", "approved"].includes(wd.status)) {
        throw new Error("Only pending/approved requests can be rejected");
      }
      if (!rejection_reason) throw new Error("rejection_reason required");

      // Refund the held amount
      await admin.rpc("update_wallet_balance", {
        _user_id: wd.user_id,
        _amount: Number(wd.amount),
        _type: "credit",
        _description: `Withdrawal rejected — refund (request ${withdrawal_id.slice(0, 8)})`,
        _reference_id: withdrawal_id,
      });

      await admin.from("withdrawal_requests").update({
        status: "rejected",
        reviewed_by: user.id,
        rejection_reason,
        admin_note: admin_note || null,
        processed_at: new Date().toISOString(),
      }).eq("id", withdrawal_id);

      await admin.from("notifications").insert({
        user_id: wd.user_id,
        type: "payout",
        title: "Withdrawal Rejected",
        body: `Your ₵${Number(wd.amount).toLocaleString()} request was rejected: ${rejection_reason}. The amount has been refunded to your wallet.`,
        data: { withdrawal_id },
      });
    } else {
      throw new Error("Invalid action");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Process payout error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
