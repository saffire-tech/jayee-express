// Shared Paystack API helpers. Amounts we store are GHS; Paystack wants pesewas.
const PAYSTACK_BASE = "https://api.paystack.co";

function secret(): string {
  const key = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!key) throw new Error("Paystack is not configured");
  return key;
}

/** App-generated payment reference. */
export function newReference(prefix = "jx"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export interface InitResult {
  ok: boolean;
  message: string;
  accessCode?: string;
  authorizationUrl?: string;
}

/** Starts a Paystack transaction; buyer completes it in the inline popup. */
export async function paystackInitialize(params: {
  email: string;
  amountGhs: number;
  reference: string;
  metadata?: Record<string, unknown>;
  callbackUrl?: string;
}): Promise<InitResult> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amountGhs * 100),
      currency: "GHS",
      reference: params.reference,
      metadata: params.metadata || {},
      ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  console.log("paystack init", JSON.stringify({ reference: params.reference, status: data?.status, message: data?.message }));
  if (!data?.status) return { ok: false, message: data?.message || "Could not start the payment" };
  return {
    ok: true,
    message: "ok",
    accessCode: data.data?.access_code,
    authorizationUrl: data.data?.authorization_url,
  };
}

export type TxStatus = "success" | "pending" | "failed" | "not_found";

export interface StatusResult {
  status: TxStatus;
  amount: number | null; // GHS
  message: string;
  raw: any;
}

export async function paystackStatus(reference: string): Promise<StatusResult> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!data?.status) {
    return { status: "not_found", amount: null, message: data?.message || "Transaction not found", raw: data };
  }
  const s = String(data.data?.status || "");
  const amount = data.data?.amount != null ? Number(data.data.amount) / 100 : null;
  let status: TxStatus = "pending";
  if (s === "success") status = "success";
  else if (s === "failed" || s === "reversed" || s === "abandoned") status = "failed";
  // "abandoned" on Paystack also covers "popup opened but not yet paid" — treat as pending
  if (s === "abandoned" || s === "ongoing" || s === "pending" || s === "processing" || s === "queued") status = "pending";
  return { status, amount, message: data.data?.gateway_response || s, raw: data };
}

/** Full refund of a Paystack transaction. */
export async function paystackRefund(reference: string, amountGhs?: number) {
  const res = await fetch(`${PAYSTACK_BASE}/refund`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction: reference,
      ...(amountGhs ? { amount: Math.round(amountGhs * 100) } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: Boolean(data?.status), message: String(data?.message || "Refund failed"), raw: data };
}

/** Verifies the x-paystack-signature header (HMAC-SHA512 of the raw body). */
export async function verifyPaystackSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-512" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === signature;
}
