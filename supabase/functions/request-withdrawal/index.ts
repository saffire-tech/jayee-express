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

    const { amount } = await req.json();
    if (!amount || amount <= 0) throw new Error("Invalid amount");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check wallet balance
    const { data: wallet } = await adminClient
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!wallet || wallet.balance < amount) {
      throw new Error("Insufficient balance");
    }

    // Get MoMo details - check profile first, then store
    let momoNumber: string | null = null;
    let momoProvider: string | null = null;
    let recipientName = "User";

    const { data: profile } = await adminClient
      .from("profiles")
      .select("momo_number, momo_provider, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.momo_number && profile?.momo_provider) {
      momoNumber = profile.momo_number;
      momoProvider = profile.momo_provider;
      recipientName = profile.full_name || "User";
    } else {
      // Check store
      const { data: store } = await adminClient
        .from("stores")
        .select("momo_number, momo_provider, name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (store?.momo_number && store?.momo_provider) {
        momoNumber = store.momo_number;
        momoProvider = store.momo_provider;
        recipientName = store.name || "Store Owner";
      }
    }

    if (!momoNumber || !momoProvider) {
      throw new Error("MoMo details not configured");
    }

    const providerMap: Record<string, string> = {
      "MTN": "MTN",
      "Vodafone": "VOD",
      "AirtelTigo": "ATL",
    };
    const bankCode = providerMap[momoProvider];
    if (!bankCode) throw new Error("Invalid MoMo provider");

    // Debit wallet first (atomic)
    const { error: debitError } = await adminClient.rpc("update_wallet_balance", {
      _user_id: user.id,
      _amount: amount,
      _type: "debit",
      _description: `Withdrawal to ${momoProvider} ${momoNumber}`,
    });

    if (debitError) throw new Error(debitError.message || "Failed to debit wallet");

    // Create withdrawal request
    const { data: withdrawal, error: wdError } = await adminClient
      .from("withdrawal_requests")
      .insert({
        user_id: user.id,
        amount,
        momo_number: momoNumber,
        momo_provider: momoProvider,
        status: "processing",
      })
      .select()
      .single();

    if (wdError) throw new Error("Failed to create withdrawal request");

    // Create transfer recipient on Paystack
    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "mobile_money",
        name: recipientName,
        account_number: momoNumber,
        bank_code: bankCode,
        currency: "GHS",
      }),
    });

    const recipientData = await recipientRes.json();
    if (!recipientData.status) {
      // Reverse the debit
      await adminClient.rpc("update_wallet_balance", {
        _user_id: user.id,
        _amount: amount,
        _type: "credit",
        _description: "Withdrawal reversal - transfer failed",
      });
      await adminClient.from("withdrawal_requests").update({ status: "failed" }).eq("id", withdrawal.id);
      throw new Error(recipientData.message || "Failed to create recipient");
    }

    // Initiate transfer
    const transferAmount = Math.round(amount * 100);
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
        reason: `Wallet withdrawal`,
        currency: "GHS",
      }),
    });

    const transferData = await transferRes.json();

    if (transferData.status) {
      await adminClient.from("withdrawal_requests").update({
        status: "completed",
        paystack_transfer_code: transferData.data.transfer_code,
        processed_at: new Date().toISOString(),
      }).eq("id", withdrawal.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Reverse the debit
      await adminClient.rpc("update_wallet_balance", {
        _user_id: user.id,
        _amount: amount,
        _type: "credit",
        _description: "Withdrawal reversal - transfer failed",
      });
      await adminClient.from("withdrawal_requests").update({ status: "failed" }).eq("id", withdrawal.id);
      throw new Error(transferData.message || "Transfer failed");
    }
  } catch (error: unknown) {
    console.error("Withdrawal error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
