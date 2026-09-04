// Shared Moolre API helpers.
// Moolre collects money via a direct mobile-money debit (Payin): we push an
// approval prompt to the payer's phone and then poll the status endpoint.

const MOOLRE_BASE = "https://api.moolre.com/open/transact";

export const MOOLRE_CHANNELS: Record<number, string> = {
  13: "MTN Mobile Money",
  6: "Telecel Cash",
  7: "AirtelTigo Money",
};

export function isValidChannel(channel: unknown): channel is number {
  return typeof channel === "number" && Object.prototype.hasOwnProperty.call(MOOLRE_CHANNELS, channel);
}

/** Normalises a Ghanaian mobile number to the 0XXXXXXXXX form Moolre expects. */
export function normalisePhone(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("233")) local = "0" + local.slice(3);
  if (local.length === 9 && !local.startsWith("0")) local = "0" + local;
  return /^0\d{9}$/.test(local) ? local : null;
}

function headers() {
  const user = Deno.env.get("MOOLRE_API_USER");
  const pub = Deno.env.get("MOOLRE_PUBLIC_KEY");
  const priv = Deno.env.get("MOOLRE_PRIVATE_KEY");
  if (!user || !pub || !priv) throw new Error("Moolre credentials are not configured");
  return {
    "Content-Type": "application/json",
    "X-API-USER": user,
    "X-API-PUBKEY": pub,
    "X-API-KEY": priv,
  };
}

export function moolreAccount(): string {
  const acct = Deno.env.get("MOOLRE_ACCOUNT_NUMBER");
  if (!acct) throw new Error("MOOLRE_ACCOUNT_NUMBER is not configured");
  return acct;
}

/** App-generated payment reference. Moolre expects the merchant to supply one. */
export function newReference(prefix = "jx"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export interface PayinResult {
  ok: boolean;
  pending: boolean;
  requiresOtp: boolean;
  message: string;
  code?: string;
  raw: any;
}

/**
 * Initiates a mobile-money debit. Amount is in GHS units (not pesewas).
 * On success the payer receives an approval prompt on their phone.
 */
export async function moolrePayin(params: {
  amount: number;
  payer: string;
  channel: number;
  externalref: string;
  reference: string;
  otpcode?: string;
}): Promise<PayinResult> {
  const body: Record<string, unknown> = {
    type: 1,
    channel: params.channel,
    currency: "GHS",
    payer: params.payer,
    amount: params.amount.toFixed(2),
    accountnumber: moolreAccount(),
    reference: params.reference.slice(0, 100),
    externalref: params.externalref,
  };
  if (params.otpcode) body.otpcode = params.otpcode;

  const res = await fetch(`${MOOLRE_BASE}/payment`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));

  const status = String(data?.status ?? "0");
  const code = data?.code as string | undefined;
  const message = String(data?.message || "Payment request failed");
  // TP14 / OTP-related codes ask the payer for a one-time code before the debit.
  const requiresOtp = code === "TP14" || /otp/i.test(message);

  return {
    ok: status === "1",
    pending: status === "1",
    requiresOtp,
    message,
    code,
    raw: data,
  };
}

export type MoolreTxStatus = "success" | "pending" | "failed" | "not_found";

export interface StatusResult {
  status: MoolreTxStatus;
  amount: number | null;
  message: string;
  raw: any;
}

/** Looks a transaction up by the external reference we generated. */
export async function moolreStatus(externalref: string): Promise<StatusResult> {
  const res = await fetch(`${MOOLRE_BASE}/status`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      type: 1,
      idtype: 1,
      id: externalref,
      accountnumber: moolreAccount(),
    }),
  });
  const data = await res.json().catch(() => ({}));

  const message = String(data?.message || "");
  const code = data?.code as string | undefined;
  const tx = data?.data ?? {};
  const txStatus = Number(tx?.txstatus);
  const amount = tx?.amount != null ? Number(tx.amount) : null;

  if (code === "SS07" || /not found/i.test(message)) {
    return { status: "not_found", amount: null, message: message || "Transaction not found", raw: data };
  }

  let status: MoolreTxStatus = "failed";
  if (txStatus === 1) status = "success";
  else if (txStatus === 2) status = "pending";

  return { status, amount, message: message || `txstatus ${txStatus}`, raw: data };
}
