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

    // Paystack balance
    const balanceRes = await fetch("https://api.paystack.co/balance", {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const balanceJson = await balanceRes.json();
    const balances = balanceJson?.data ?? [];

    // Revenue summary
    const { data: summary, error: sumErr } = await adminClient.rpc("platform_revenue_summary");
    if (sumErr) throw new Error(sumErr.message);

    return new Response(JSON.stringify({
      paystack_balances: balances,
      summary: Array.isArray(summary) ? summary[0] : summary,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("get-platform-balance error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message, stack: (e as Error).stack }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
