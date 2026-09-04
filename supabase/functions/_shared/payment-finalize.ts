// Shared, provider-agnostic finalisation logic for a successful payment.
// The `payment_attempts` row is the single source of truth: its `kind` decides
// which handler runs and its `payload` carries the details captured at init.

export interface FinalizeResult {
  finalized: boolean;
  already: boolean;
  kind: string;
  detail?: any;
}

export async function finalizeSuccessfulPayment(
  supabase: any,
  attempt: any,
  amountPaid: number,
): Promise<FinalizeResult> {
  const reference = attempt.reference as string;
  const kind = (attempt.kind as string) || "order";
  const meta = attempt.payload || {};

  if (kind === "order") {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("finalize_order_payment", {
      _reference: reference,
      _amount: amountPaid,
    });
    if (rpcErr) {
      await supabase.from("payment_attempts").update({
        last_error: rpcErr.message,
        provider_status: "success",
        verified_at: new Date().toISOString(),
      }).eq("reference", reference);
      throw new Error(rpcErr.message);
    }
    return {
      finalized: true,
      already: Boolean((rpcRes as any)?.already),
      kind,
      detail: rpcRes,
    };
  }

  // Subscriptions are idempotent via the payment_reference lookup.
  if (kind === "subscription" || kind === "store_subscription") {
    const { data: existing } = await supabase
      .from("store_subscriptions").select("id").eq("payment_reference", reference).limit(1);
    if (existing && existing.length > 0) {
      await markAttemptSuccess(supabase, reference);
      return { finalized: true, already: true, kind };
    }
    if (kind === "subscription") await processPlanSubscription(supabase, meta, reference);
    else await processStoreAdminSubscription(supabase, meta, reference);
    await markAttemptSuccess(supabase, reference);
    return { finalized: true, already: false, kind };
  }

  if (kind === "rider_subscription") {
    const { data: existing } = await supabase
      .from("delivery_subscriptions").select("id").eq("payment_reference", reference).limit(1);
    if (existing && existing.length > 0) {
      await markAttemptSuccess(supabase, reference);
      return { finalized: true, already: true, kind };
    }
    await processRiderSubscription(supabase, meta, reference);
    await markAttemptSuccess(supabase, reference);
    return { finalized: true, already: false, kind };
  }

  throw new Error(`Unknown payment kind: ${kind}`);
}

export async function markAttemptSuccess(supabase: any, reference: string) {
  await supabase.from("payment_attempts").update({
    status: "success",
    provider_status: "success",
    verified_at: new Date().toISOString(),
    orders_created_at: new Date().toISOString(),
    last_error: null,
  }).eq("reference", reference);
}

export async function markAttemptFailed(
  supabase: any,
  attempt: any,
  providerStatus: string,
  message: string,
) {
  if (!attempt || attempt.status !== "initialized") return;
  await supabase.from("payment_attempts").update({
    status: providerStatus === "abandoned" ? "abandoned" : "failed",
    provider_status: providerStatus,
    verified_at: new Date().toISOString(),
    last_error: message,
  }).eq("reference", attempt.reference);

  const userId = attempt.buyer_id || attempt.payload?.user_id;
  if (userId) {
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "payment",
      title: "Payment not completed",
      body: "Your recent payment did not go through. You were not charged — you can safely try again.",
      data: { reference: attempt.reference },
    });
  }
}

async function processPlanSubscription(supabase: any, metadata: any, reference: string) {
  const { store_id, plan_id, user_id, months } = metadata;
  const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));
  const { data: plan } = await supabase
    .from("subscription_plans").select("max_products, name, price_per_month").eq("id", plan_id).single();
  if (!plan) throw new Error("Plan not found");
  const amountPaid = Number(plan.price_per_month) * monthsInt;
  const { data: store } = await supabase
    .from("stores").select("subscription_expires_at").eq("id", store_id).single();
  const now = new Date();
  const baseDate = store?.subscription_expires_at && new Date(store.subscription_expires_at) > now
    ? new Date(store.subscription_expires_at) : now;
  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + monthsInt);
  await supabase.from("store_subscriptions").insert({
    store_id, user_id, plan_id, months: monthsInt, amount_paid: amountPaid,
    starts_at: baseDate.toISOString(), expires_at: newExpiry.toISOString(),
    status: "active", payment_reference: reference,
  });
  await supabase.from("stores").update({
    current_plan_id: plan_id, product_limit: plan.max_products,
    subscription_expires_at: newExpiry.toISOString(),
  }).eq("id", store_id);
  await supabase.from("notifications").insert({
    user_id, type: "subscription", title: "Subscription Active",
    body: `Your ${plan.name} plan is active until ${newExpiry.toLocaleDateString()}.`,
    data: { store_id, plan_id },
  });
}

async function processStoreAdminSubscription(supabase: any, metadata: any, reference: string) {
  const { user_id, store_id, months } = metadata;
  const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));
  const { data: store } = await supabase
    .from("stores").select("subscription_expires_at, name, monthly_fee").eq("id", store_id).maybeSingle();
  if (!store || !store.monthly_fee || Number(store.monthly_fee) <= 0) throw new Error("Monthly fee not set");
  const monthlyFee = Number(store.monthly_fee);
  const amountPaid = monthlyFee * monthsInt;
  const now = new Date();
  const baseDate = store?.subscription_expires_at && new Date(store.subscription_expires_at) > now
    ? new Date(store.subscription_expires_at) : now;
  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + monthsInt);
  await supabase.from("store_subscriptions").insert({
    store_id, user_id, monthly_fee: monthlyFee, months: monthsInt,
    amount_paid: amountPaid, starts_at: baseDate.toISOString(),
    expires_at: newExpiry.toISOString(), status: "active", payment_reference: reference,
  });
  await supabase.from("stores").update({ subscription_expires_at: newExpiry.toISOString() }).eq("id", store_id);
  await supabase.from("notifications").insert({
    user_id, type: "subscription", title: "Store Subscription Active",
    body: `${store?.name || "Your store"} is now live until ${newExpiry.toLocaleDateString()}.`,
    data: { store_id },
  });
}

async function processRiderSubscription(supabase: any, metadata: any, reference: string) {
  const { user_id, months } = metadata;
  const monthsInt = Math.max(1, Math.min(12, parseInt(months) || 1));
  const { data: app } = await supabase
    .from("rider_applications")
    .select("monthly_fee, status")
    .eq("user_id", user_id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!app || !app.monthly_fee || Number(app.monthly_fee) <= 0) throw new Error("Rider monthly fee not set");
  const monthlyFee = Number(app.monthly_fee);
  const amountPaid = monthlyFee * monthsInt;
  const { data: latest } = await supabase.from("delivery_subscriptions")
    .select("expires_at").eq("user_id", user_id).order("expires_at", { ascending: false }).limit(1).maybeSingle();
  const now = new Date();
  const baseDate = latest?.expires_at && new Date(latest.expires_at) > now ? new Date(latest.expires_at) : now;
  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + monthsInt);
  await supabase.from("delivery_subscriptions").insert({
    user_id, monthly_fee: monthlyFee, months: monthsInt, amount_paid: amountPaid,
    starts_at: baseDate.toISOString(), expires_at: newExpiry.toISOString(),
    status: "active", payment_reference: reference,
  });
  await supabase.from("notifications").insert({
    user_id, type: "rider_subscription", title: "Rider Subscription Active",
    body: `Your delivery subscription is active until ${newExpiry.toLocaleDateString()}.`,
  });
}
