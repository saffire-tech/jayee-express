import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { paystackInitialize, newReference } from "../_shared/paystack.ts";

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

    const { plan_id, months } = await req.json();
    const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));


    const { data: plan, error: planErr } = await admin
      .from("subscription_plans")
      .select("id, name, price_per_month, max_products, is_active")
      .eq("id", plan_id)
      .single();
    if (planErr || !plan || !plan.is_active) throw new Error("Invalid plan");

    const { data: store, error: storeErr } = await admin
      .from("stores")
      .select("id, name")
      .eq("user_id", user.id)
      .single();
    if (storeErr || !store) throw new Error("Store not found");

    const totalGhs = Number((Number(plan.price_per_month) * monthsInt).toFixed(2));

    const metadata = {
      user_id: user.id,
      store_id: store.id,
      plan_id: plan.id,
      months: monthsInt,
    };

    let reference = newReference("jxp");
    const { error: attemptErr } = await admin.from("payment_attempts").insert({
      reference,
      buyer_id: user.id,
      amount: totalGhs,
      currency: "GHS",
      kind: "subscription",
      status: "initialized",
      provider: "paystack",
      payload: metadata,
    });
    if (attemptErr) throw new Error("Could not record payment attempt. Please try again.");

    const init = await paystackInitialize({
      email: user.email || `${user.id}@users.jayeeexpress.com`,
      amountGhs: totalGhs,
      reference,
      metadata: { user_id: user.id },
    });
    if (!init.ok) {
      await admin.from("payment_attempts").update({
        status: "failed", provider_status: "init_failed", last_error: init.message,
        verified_at: new Date().toISOString(),
      }).eq("reference", reference);
      throw new Error(init.message);
    }

    return new Response(JSON.stringify({
      reference,
      access_code: init.accessCode,
      authorization_url: init.authorizationUrl,
      amount: totalGhs,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("init-subscription error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
