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

    const { email, months } = await req.json();
    const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));

    // Look up rider's approved application for the assigned monthly fee
    const { data: app, error: appErr } = await supabase
      .from("rider_applications")
      .select("monthly_fee, status")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (appErr || !app) throw new Error("No approved rider application found");
    if (!app.monthly_fee || Number(app.monthly_fee) <= 0) throw new Error("Monthly fee not set by admin");

    const totalGhs = Number(app.monthly_fee) * monthsInt;
    const amountKobo = Math.round(totalGhs * 100);

    const metadata = {
      type: "rider_subscription",
      user_id: user.id,
      monthly_fee: Number(app.monthly_fee),
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
        callback_url: `${req.headers.get("origin") || ""}/delivery?subscription=success`,
      }),
    });
    const data = await res.json();
    if (!data.status) throw new Error(data.message || "Paystack init failed");

    return new Response(JSON.stringify({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("init-rider-subscription error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
