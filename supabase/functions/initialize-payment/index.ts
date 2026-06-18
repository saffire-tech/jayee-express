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

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { items, deliveryData, email } = await req.json();
    if (!Array.isArray(items) || items.length === 0) throw new Error("No items provided");

    // Fetch authoritative product data — never trust client prices
    const productIds = items.map((i: any) => i.product_id).filter(Boolean);
    const { data: products, error: prodErr } = await admin
      .from("products")
      .select("id, price, name, store_id, is_active")
      .in("id", productIds);
    if (prodErr) throw prodErr;

    const priceMap: Record<string, { price: number; name: string; store_id: string; is_active: boolean }> = {};
    for (const p of products || []) priceMap[p.id] = p as any;

    for (const item of items) {
      const p = priceMap[item.product_id];
      if (!p || !p.is_active) throw new Error(`Invalid product: ${item.product_id}`);
    }

    const subtotal = items.reduce(
      (sum: number, item: any) => sum + priceMap[item.product_id].price * (parseInt(item.quantity) || 1),
      0
    );

    // Server-side delivery fee — never trust client
    const deliveryType = deliveryData?.deliveryType === "delivery" ? "delivery" : "pickup";
    const destLat = deliveryData?.deliveryLatitude ?? null;
    const destLng = deliveryData?.deliveryLongitude ?? null;
    const uniqueStoreIds = Array.from(new Set((products || []).map((p: any) => p.store_id)));

    let deliveryFee = 0;
    if (deliveryType === "delivery") {
      const { data: feeRes, error: feeErr } = await admin.rpc("compute_delivery_fee", {
        _store_ids: uniqueStoreIds,
        _dest_lat: destLat,
        _dest_lng: destLng,
        _delivery_type: deliveryType,
      });
      if (feeErr) throw new Error(feeErr.message || "Could not compute delivery fee");
      if (!feeRes || (feeRes as any).ok !== true) {
        throw new Error(`Delivery unavailable: ${(feeRes as any)?.reason || "out_of_zone"}`);
      }
      deliveryFee = Number((feeRes as any).fee) || 0;
    }

    const totalAmount = Math.round((subtotal + deliveryFee) * 100); // pesewas

    const storeGroups: Record<string, any[]> = {};
    for (const item of items) {
      const p = priceMap[item.product_id];
      if (!storeGroups[p.store_id]) storeGroups[p.store_id] = [];
      storeGroups[p.store_id].push({
        product_id: item.product_id,
        quantity: parseInt(item.quantity) || 1,
        price: p.price,
        name: p.name,
      });
    }

    const metadata = {
      buyer_id: user.id,
      delivery_type: deliveryType,
      delivery_fee: deliveryFee,
      delivery_latitude: destLat,
      delivery_longitude: destLng,
      delivery_address: deliveryData?.deliveryAddress || null,
      delivery_landmark: deliveryData?.deliveryLandmark || null,
      store_groups: Object.entries(storeGroups).map(([storeId, storeItems]) => ({
        store_id: storeId,
        items: storeItems,
      })),
    };


    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: totalAmount,
        currency: "GHS",
        metadata,
        callback_url: `${req.headers.get("origin") || ""}/purchases?payment=success`,
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) throw new Error(paystackData.message || "Paystack initialization failed");

    const reference = paystackData.data.reference as string;

    // Record the attempt BEFORE redirecting — source of truth for reconciliation
    const { error: attemptErr } = await admin.from("payment_attempts").insert({
      reference,
      buyer_id: user.id,
      amount: (subtotal + deliveryFee),
      currency: "GHS",
      kind: "order",
      status: "initialized",
      payload: metadata,
    });
    if (attemptErr) {
      console.error("Failed to record payment_attempt:", attemptErr);
      throw new Error("Could not record payment attempt. Please try again.");
    }

    return new Response(JSON.stringify({
      authorization_url: paystackData.data.authorization_url,
      access_code: paystackData.data.access_code,
      reference,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Payment init error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
