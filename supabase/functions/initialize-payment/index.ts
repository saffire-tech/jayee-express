import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { paystackInitialize, newReference } from "../_shared/paystack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { items, deliveryData } = await req.json();
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

    // Variants: if a product has variants, the buyer MUST have chosen one that
    // belongs to that product and is in stock. Attributes come from the DB.
    const { data: allVariants, error: varErr } = await admin
      .from("product_variants")
      .select("id, product_id, color, size, material, stock")
      .in("product_id", productIds);
    if (varErr) throw varErr;

    const variantsByProduct: Record<string, any[]> = {};
    for (const v of allVariants || []) {
      (variantsByProduct[v.product_id] ||= []).push(v);
    }
    const resolvedVariant: Record<number, any | null> = {};
    items.forEach((item: any, idx: number) => {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1) throw new Error("Invalid quantity");
      const options = variantsByProduct[item.product_id] || [];
      if (options.length === 0) {
        resolvedVariant[idx] = null;
        return;
      }
      const name = priceMap[item.product_id].name;
      if (!item.variant_id) {
        throw new Error(`Please choose a variant (colour, size or material) for "${name}" before checkout.`);
      }
      const chosen = options.find((v) => v.id === item.variant_id);
      if (!chosen) throw new Error(`The selected variant for "${name}" is no longer available. Please choose again.`);
      if ((chosen.stock ?? 0) < qty) throw new Error(`The selected variant for "${name}" doesn't have enough stock.`);
      resolvedVariant[idx] = chosen;
    });

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

    const totalGhs = Number((subtotal + deliveryFee).toFixed(2));
    if (totalGhs <= 0.01) throw new Error("Order total is too small to charge");

    const storeGroups: Record<string, any[]> = {};
    items.forEach((item: any, idx: number) => {
      const p = priceMap[item.product_id];
      const v = resolvedVariant[idx];
      if (!storeGroups[p.store_id]) storeGroups[p.store_id] = [];
      storeGroups[p.store_id].push({
        product_id: item.product_id,
        quantity: parseInt(item.quantity) || 1,
        price: p.price,
        name: p.name,
        variant_id: v?.id ?? null,
        color: v?.color ?? null,
        size: v?.size ?? null,
        material: v?.material ?? null,
      });
    });

    const metadata = {
      buyer_id: user.id,
      user_id: user.id,
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

    // Resuming an OTP challenge: reuse the reference AND the provider's own
    // transaction id already recorded, so Moolre resumes the same session.
    let reference = newReference();
    // Record the attempt BEFORE charging — source of truth for reconciliation
    const { error: attemptErr } = await admin.from("payment_attempts").insert({
      reference,
      buyer_id: user.id,
      amount: totalGhs,
      currency: "GHS",
      kind: "order",
      status: "initialized",
      provider: "paystack",
      payload: metadata,
    });
    if (attemptErr) {
      console.error("Failed to record payment_attempt:", attemptErr);
      throw new Error("Could not record payment attempt. Please try again.");
    }

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

  } catch (error: unknown) {
    console.error("Payment init error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
