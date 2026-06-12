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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { email, store_id, months } = await req.json();
    if (!store_id) throw new Error("store_id required");
    const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));

    // Find the store and confirm ownership; read admin-assigned monthly_fee
    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, user_id, monthly_fee, is_verified, name")
      .eq("id", store_id)
      .maybeSingle();

    if (storeErr || !store) throw new Error("Store not found");
    if (store.user_id !== user.id) throw new Error("Not your store");
    if (!store.is_verified) throw new Error("Store is pending admin approval");
    if (!store.monthly_fee || Number(store.monthly_fee) <= 0) {
      throw new Error("Monthly fee not assigned by admin yet");
    }

    const totalGhs = Number(store.monthly_fee) * monthsInt;
    const amountKobo = Math.round(totalGhs * 100);

    const metadata = {
      type: "store_subscription",
      user_id: user.id,
      store_id: store.id,
      monthly_fee: Number(store.monthly_fee),
      months: monthsInt,
    };

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        currency: "GHS",
        metadata,
        callback_url: `${req.headers.get("origin") || ""}/seller?subscription=success`,
      }),
    });
    const data = await res.json();
    if (!data.status) throw new Error(data.message || "Paystack init failed");

    return new Response(JSON.stringify({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("init-store-subscription error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
