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
  const priv = Deno.env.get("MOOLRE_PRIVATE_KEY") ?? Deno.env.get("MMOLRE_PRIVATE_KEY");
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
  /** Moolre wants a verification code before it will push the PIN prompt. */
  requiresOtp: boolean;
  /** A code was submitted but Moolre rejected it (wrong/expired). */
  otpRejected: boolean;
  message: string;
  code?: string;
  /** Moolre's own transaction id, returned by the initial charge. Must be
   *  echoed back when verifying an OTP so Moolre resumes the same session. */
  txid?: string;
  raw: any;
}

/** Codes Moolre returns when a verification code is required / was rejected. */
// TP14 = "verification code required". TP15 appears both ways: on a first
// charge it means "request a code first" (so it must open the code screen);
// after a code was submitted it means the code was wrong/expired.
const OTP_REQUIRED_CODES = ["TP14", "TP15"];
// TP15 = wrong/expired code. TP16 = the OTP session could not be resumed at all
// ("Unknown Error ... request a new code") — both keep the payer on the code
// screen so they can request a fresh code instead of seeing a hard failure.
const OTP_REJECTED_CODES = ["TP15", "TP16"];

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
  /** Moolre transaction id from the initial charge — required when verifying
   *  an OTP so the code is applied to the ORIGINAL session, not a new charge. */
  transactionid?: string;
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
  if (params.transactionid) body.transactionid = params.transactionid;

  const res = await fetch(`${MOOLRE_BASE}/payment`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));

  const status = String(data?.status ?? "0");
  const code = data?.code as string | undefined;
  const message = String(data?.message || "Payment request failed");
  const rawOk = status === "1";

  // Moolre's transaction id can appear under several keys depending on channel.
  const txRaw = data?.data?.transactionid ?? data?.data?.transaction_id ?? data?.data?.id
    ?? data?.transactionid ?? data?.transaction_id;
  const txid = txRaw != null && txRaw !== "" ? String(txRaw) : undefined;

  // Decide the OTP step from the provider's response CODE, never from wording.
  // Moolre returns TP14 ("verification code sent") WITH status 1, so a code
  // check must come before the success check or the payer sits on a spinner.
  const codeIsOtp = OTP_REQUIRED_CODES.includes(code || "");
  const requiresOtp = codeIsOtp && !params.otpcode;
  const otpRejected = Boolean(params.otpcode) && OTP_REJECTED_CODES.includes(code || "");
  // A charge that only asked for a code has not started yet.
  const ok = rawOk && !codeIsOtp;

  // Never logs credentials — only what Moolre replied.
  console.log("moolre payin", JSON.stringify({
    externalref: params.externalref,
    channel: params.channel,
    amount: params.amount,
    withOtp: Boolean(params.otpcode),
    status,
    code,
    message,
    requiresOtp,
    otpRejected,
    txid,
  }));

  return {
    ok,
    pending: ok,
    requiresOtp,
    otpRejected,
    message: otpRejected && code === "TP16"
      ? "That code didn't work. Tap \"Get a new code\" and try again."
      : message,
    code,
    txid,
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

export interface PayoutResult {
  ok: boolean;
  message: string;
  code?: string;
  raw: any;
}

/** Sends money out to a mobile money wallet (used for refunds). */
export async function moolrePayout(params: {
  amount: number;
  receiver: string;
  channel: number;
  externalref: string;
  reference: string;
}): Promise<PayoutResult> {
  const receiver = normalisePhone(params.receiver);
  if (!receiver) return { ok: false, message: "Invalid receiver number", raw: null };

  const res = await fetch(`${MOOLRE_BASE}/transfer`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      type: 1,
      channel: params.channel,
      currency: "GHS",
      receiver,
      amount: params.amount.toFixed(2),
      accountnumber: moolreAccount(),
      reference: params.reference.slice(0, 100),
      externalref: params.externalref,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: String(data?.status ?? "0") === "1",
    message: String(data?.message || "Transfer failed"),
    code: data?.code,
    raw: data,
  };
}
