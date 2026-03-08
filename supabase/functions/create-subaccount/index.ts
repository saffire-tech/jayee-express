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

    const { store_id, business_name, momo_number, momo_provider } = await req.json();

    // Verify store ownership
    const { data: store } = await supabase
      .from("stores")
      .select("id, user_id, paystack_subaccount_code")
      .eq("id", store_id)
      .eq("user_id", user.id)
      .single();

    if (!store) throw new Error("Store not found or not yours");

    // If already has subaccount, update MoMo details on Paystack
    if (store.paystack_subaccount_code) {
      const updateRes = await fetch(`https://api.paystack.co/subaccount/${store.paystack_subaccount_code}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          business_name,
          settlement_bank: momo_provider === "MTN" ? "MTN" : momo_provider === "Vodafone" ? "VOD" : "ATL",
          account_number: momo_number,
        }),
      });
      const updateData = await updateRes.json();

      // Update store MoMo details
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await adminClient.from("stores").update({
        momo_number,
        momo_provider,
      }).eq("id", store_id);

      return new Response(JSON.stringify({ 
        success: true, 
        subaccount_code: store.paystack_subaccount_code 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get commission percentage
    const { data: commissionSetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "commission_percentage")
      .single();
    
    const commissionPercent = commissionSetting ? parseFloat(commissionSetting.value) : 5;

    // Map provider to Paystack bank code
    const bankCodeMap: Record<string, string> = {
      "MTN": "MTN",
      "Vodafone": "VOD",
      "AirtelTigo": "ATL",
    };

    // Create Paystack subaccount
    const paystackRes = await fetch("https://api.paystack.co/subaccount", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_name,
        settlement_bank: bankCodeMap[momo_provider] || "MTN",
        account_number: momo_number,
        percentage_charge: commissionPercent,
        primary_contact_email: user.email,
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      throw new Error(paystackData.message || "Failed to create subaccount");
    }

    // Save subaccount code and MoMo details to store
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    await adminClient.from("stores").update({
      paystack_subaccount_code: paystackData.data.subaccount_code,
      momo_number,
      momo_provider,
    }).eq("id", store_id);

    return new Response(JSON.stringify({
      success: true,
      subaccount_code: paystackData.data.subaccount_code,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Create subaccount error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
