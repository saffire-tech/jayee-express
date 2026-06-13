import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_WITHDRAWAL = 20;

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

    const { amount } = await req.json();
    const amt = Number(amount);
    if (!amt || amt <= 0) throw new Error("Invalid amount");
    if (amt < MIN_WITHDRAWAL) throw new Error(`Minimum withdrawal is ₵${MIN_WITHDRAWAL}`);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check cleared (withdrawable) balance
    const { data: clearedData, error: clearedErr } = await adminClient.rpc("wallet_cleared_balance", {
      _user_id: user.id,
    });
    if (clearedErr) throw new Error(clearedErr.message || "Failed to read wallet balance");
    const cleared = Number(clearedData) || 0;
    if (cleared < amt) {
      throw new Error(`Insufficient cleared balance. Available: ₵${cleared.toFixed(2)}.`);
    }

    // Resolve MoMo details (profile first, then store)
    let momoNumber: string | null = null;
    let momoProvider: string | null = null;

    const { data: profile } = await adminClient
      .from("profiles")
      .select("momo_number, momo_provider, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.momo_number && profile?.momo_provider) {
      momoNumber = profile.momo_number;
      momoProvider = profile.momo_provider;
    } else {
      const { data: store } = await adminClient
        .from("stores")
        .select("momo_number, momo_provider, name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (store?.momo_number && store?.momo_provider) {
        momoNumber = store.momo_number;
        momoProvider = store.momo_provider;
      }
    }

    if (!momoNumber || !momoProvider) {
      throw new Error("MoMo details not configured. Please add them in your profile or store settings.");
    }

    // Debit wallet (hold the funds until admin pays or rejects)
    const { error: debitError } = await adminClient.rpc("update_wallet_balance", {
      _user_id: user.id,
      _amount: amt,
      _type: "debit",
      _description: `Withdrawal request to ${momoProvider} ${momoNumber}`,
    });
    if (debitError) throw new Error(debitError.message || "Failed to hold funds");

    // Create request
    const { data: withdrawal, error: wdError } = await adminClient
      .from("withdrawal_requests")
      .insert({
        user_id: user.id,
        amount: amt,
        momo_number: momoNumber,
        momo_provider: momoProvider,
        status: "pending",
      })
      .select()
      .single();

    if (wdError) {
      // Refund hold
      await adminClient.rpc("update_wallet_balance", {
        _user_id: user.id,
        _amount: amt,
        _type: "credit",
        _description: "Refund — failed to create withdrawal request",
      });
      throw new Error("Failed to create withdrawal request");
    }

    // Notify admins
    const { data: admins } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (admins && admins.length > 0) {
      const notifications = admins.map((a: any) => ({
        user_id: a.user_id,
        type: "payout",
        title: "New Withdrawal Request",
        body: `${profile?.full_name || "A user"} requested ₵${amt.toLocaleString()} to ${momoProvider} ${momoNumber}.`,
        data: { withdrawal_id: withdrawal.id },
      }));
      await adminClient.from("notifications").insert(notifications);
    }

    return new Response(JSON.stringify({ success: true, withdrawal_id: withdrawal.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Withdrawal request error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
