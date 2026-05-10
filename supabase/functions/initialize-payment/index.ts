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

    const { items, deliveryData, email } = await req.json();

    // Calculate total amount — all money goes to platform
    const subtotal = items.reduce((sum: number, item: any) => sum + item.product.price * item.quantity, 0);
    const deliveryFee = deliveryData?.deliveryFee || 0;
    const totalAmount = Math.round((subtotal + deliveryFee) * 100); // pesewas

    // Group items by store for metadata
    const storeGroups: Record<string, any[]> = {};
    for (const item of items) {
      const storeId = item.product.store_id;
      if (!storeGroups[storeId]) storeGroups[storeId] = [];
      storeGroups[storeId].push(item);
    }

    const metadata = {
      buyer_id: user.id,
      delivery_type: deliveryData?.deliveryType || "pickup",
      delivery_fee: deliveryFee,
      delivery_latitude: deliveryData?.deliveryLatitude || null,
      delivery_longitude: deliveryData?.deliveryLongitude || null,
      delivery_address: deliveryData?.deliveryAddress || null,
      delivery_landmark: deliveryData?.deliveryLandmark || null,
      store_groups: Object.entries(storeGroups).map(([storeId, storeItems]) => ({
        store_id: storeId,
        items: storeItems.map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.product.price,
          name: item.product.name,
        })),
      })),
    };

    // Initialize Paystack transaction — no splits, all to platform
    const paystackPayload: any = {
      email,
      amount: totalAmount,
      currency: "GHS",
      metadata,
      callback_url: `${req.headers.get("origin") || ""}/purchases?payment=success`,
    };

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      throw new Error(paystackData.message || "Paystack initialization failed");
    }

    return new Response(JSON.stringify({
      authorization_url: paystackData.data.authorization_url,
      access_code: paystackData.data.access_code,
      reference: paystackData.data.reference,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Payment init error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
