import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Admin only");

    const { amount, account_id } = await req.json();
    if (!amount || amount <= 0) throw new Error("Invalid amount");
    if (!account_id) throw new Error("Account required");

    const { data: account, error: accErr } = await adminClient
      .from("platform_payout_accounts")
      .select("*")
      .eq("id", account_id)
      .single();
    if (accErr || !account) throw new Error("Account not found");
    if (!account.paystack_recipient_code) throw new Error("Recipient not set up on Paystack");

    // Check Paystack balance
    const balanceRes = await fetch("https://api.paystack.co/balance", {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const balanceJson = await balanceRes.json();
    const ghs = (balanceJson?.data ?? []).find((b: any) => b.currency === "GHS");
    const available = ghs ? Number(ghs.balance) / 100 : 0;
    if (available < amount) {
      throw new Error(`Insufficient Paystack balance. Available: ₵${available.toFixed(2)}`);
    }

    // Defense in depth: cap to net earned revenue
    const { data: summary } = await adminClient.rpc("platform_revenue_summary");
    const net = Array.isArray(summary) ? Number(summary[0]?.net_earned ?? 0) : 0;
    if (net < amount) {
      throw new Error(`Withdrawal exceeds net subscription revenue (₵${net.toFixed(2)}). User funds cannot be withdrawn.`);
    }

    // Create payout record
    const { data: payout, error: payErr } = await adminClient.from("platform_payouts").insert({
      admin_user_id: user.id,
      account_id: account.id,
      amount,
      recipient_snapshot: {
        label: account.label, type: account.type,
        account_number: account.account_number, bank_code: account.bank_code,
        account_name: account.account_name,
      },
      paystack_recipient_code: account.paystack_recipient_code,
      status: "pending",
    }).select().single();
    if (payErr) throw payErr;

    // Initiate transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "balance",
        amount: Math.round(amount * 100),
        recipient: account.paystack_recipient_code,
        reason: `Platform payout: ${account.label}`,
        currency: "GHS",
        reference: `platform_${payout.id}`,
      }),
    });
    const transferData = await transferRes.json();
    if (!transferData.status) {
      await adminClient.from("platform_payouts").update({
        status: "failed", failure_reason: transferData.message || "Transfer failed",
      }).eq("id", payout.id);
      throw new Error(transferData.message || "Transfer failed");
    }

    // Paystack transfers may return "success", "pending", or "otp"
    const paystackStatus = transferData.data?.status;
    const newStatus = paystackStatus === "success" ? "success" : "pending";

    await adminClient.from("platform_payouts").update({
      status: newStatus,
      paystack_transfer_code: transferData.data.transfer_code,
    }).eq("id", payout.id);

    return new Response(JSON.stringify({
      success: true, payout_id: payout.id, status: newStatus,
      transfer_code: transferData.data.transfer_code,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
