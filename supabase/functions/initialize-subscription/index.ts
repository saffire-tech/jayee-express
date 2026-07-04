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

    const { plan_id, months, email } = await req.json();
    const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));

    // Look up plan and store
    const { data: plan, error: planErr } = await supabase
      .from("subscription_plans")
      .select("id, name, price_per_month, max_products, is_active")
      .eq("id", plan_id)
      .single();
    if (planErr || !plan || !plan.is_active) throw new Error("Invalid plan");

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, name")
      .eq("user_id", user.id)
      .single();
    if (storeErr || !store) throw new Error("Store not found");

    const totalGhs = Number(plan.price_per_month) * monthsInt;
    const amountKobo = Math.round(totalGhs * 100);

    const metadata = {
      type: "subscription",
      user_id: user.id,
      store_id: store.id,
      plan_id: plan.id,
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
      access_code: data.data.access_code,
      reference: data.data.reference,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("init-subscription error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
