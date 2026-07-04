/**
 * Paystack Inline helper.
 * Opens the Paystack checkout as an in-app modal overlay using the access_code
 * returned by transaction/initialize, instead of redirecting the whole tab
 * to Paystack's hosted page.
 */

const SCRIPT_URL = "https://js.paystack.co/v2/inline.js";
let scriptLoading: Promise<boolean> | null = null;

function loadPaystackScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if ((window as any).PaystackPop) return Promise.resolve(true);
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_URL}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => {
      scriptLoading = null;
      resolve(false);
    };
    document.head.appendChild(s);
  });

  return scriptLoading;
}

export interface OpenPaystackOptions {
  accessCode?: string;
  authorizationUrl?: string;
  onSuccess?: (ref: string) => void;
  onClose?: () => void;
}

/**
 * Opens the Paystack payment overlay in the current page.
 * If the inline script cannot load or no access_code was provided,
 * falls back to redirecting the tab to `authorizationUrl`.
 */
export async function openPaystackCheckout(opts: OpenPaystackOptions): Promise<void> {
  const { accessCode, authorizationUrl, onSuccess, onClose } = opts;

  const loaded = accessCode ? await loadPaystackScript() : false;
  const PaystackPop = (window as any).PaystackPop;

  if (loaded && accessCode && PaystackPop?.resumeTransaction) {
    PaystackPop.resumeTransaction(accessCode, {
      onSuccess: (tx: any) => onSuccess?.(tx?.reference || ""),
      onCancel: () => onClose?.(),
      onClose: () => onClose?.(),
    });
    return;
  }

  // Fallback: full-page redirect
  if (authorizationUrl) {
    window.location.href = authorizationUrl;
    return;
  }

  throw new Error("Unable to open Paystack checkout");
}
