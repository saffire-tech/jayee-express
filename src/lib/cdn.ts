const CDN_BASE = (import.meta.env.VITE_IMAGE_CDN_URL || "https://cdn.jayeeexpress.com").replace(/\/+$/, "");

/** Resolve an image path/object key to a full CDN URL. Absolute URLs pass through. */
export function getCdnImageUrl(path?: string | null): string {
  if (!path || !path.trim()) return "/placeholder.svg";
  const p = path.trim();
  if (/^https?:\/\//i.test(p) || p.startsWith("data:") || p.startsWith("blob:")) return p;
  return `${CDN_BASE}/${p.replace(/^\/+/, "")}`;
}
