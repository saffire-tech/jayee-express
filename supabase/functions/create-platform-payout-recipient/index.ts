import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const momoProviderMap: Record<string, string> = { MTN: "MTN", Vodafone: "VOD", AirtelTigo: "ATL" };

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

    const { label, type, account_number, bank_code, account_name, is_default } = await req.json();
    if (!label || !type || !account_number || !bank_code || !account_name) {
      throw new Error("Missing fields");
    }
    if (!["momo", "bank"].includes(type)) throw new Error("Invalid type");

    const paystackType = type === "momo" ? "mobile_money" : "ghipss";
    const resolvedBankCode = type === "momo" ? (momoProviderMap[bank_code] || bank_code) : bank_code;

    const recRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: paystackType,
        name: account_name,
        account_number,
        bank_code: resolvedBankCode,
        currency: "GHS",
      }),
    });
    const recData = await recRes.json();
    if (!recData.status) throw new Error(recData.message || "Failed to create recipient");

    if (is_default) {
      await adminClient.from("platform_payout_accounts").update({ is_default: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { data, error } = await adminClient.from("platform_payout_accounts").insert({
      label, type, account_number, bank_code: resolvedBankCode, account_name,
      paystack_recipient_code: recData.data.recipient_code,
      is_default: !!is_default,
      created_by: user.id,
    }).select().single();
    if (error) throw error;

    return new Response(JSON.stringify({ account: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
