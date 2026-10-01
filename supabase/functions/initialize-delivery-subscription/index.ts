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

    const { months } = await req.json();
    const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));


    const { data: app, error: appErr } = await admin
      .from("rider_applications")
      .select("monthly_fee, status")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (appErr || !app) throw new Error("No approved rider application found");
    if (!app.monthly_fee || Number(app.monthly_fee) <= 0) throw new Error("Monthly fee not set by admin");

    const totalGhs = Number((Number(app.monthly_fee) * monthsInt).toFixed(2));

    const metadata = {
      user_id: user.id,
      monthly_fee: Number(app.monthly_fee),
      months: monthsInt,
    };

    let reference = newReference("jxr");
    const { error: attemptErr } = await admin.from("payment_attempts").insert({
      reference,
      buyer_id: user.id,
      amount: totalGhs,
      currency: "GHS",
      kind: "rider_subscription",
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
    console.error("init-rider-subscription error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
