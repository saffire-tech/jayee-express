// Lightweight, best-effort device fingerprint (NOT a security boundary).
// Used only to recognise "is this the same browser/device as last time" so
// we can email the user when a new device signs in.

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getDeviceHash(): Promise<string> {
  const parts = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    navigator.hardwareConcurrency || "",
    (navigator as any).deviceMemory || "",
    navigator.platform || "",
  ].join("|");
  return await sha256(parts);
}

export function getDeviceLabel(): string {
  return navigator.userAgent;
}
