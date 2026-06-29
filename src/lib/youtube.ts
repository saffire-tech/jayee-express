// Extract YouTube video ID from many URL shapes (watch, youtu.be, shorts, embed)
export function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    if (host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      // /shorts/<id>, /embed/<id>, /v/<id>, /live/<id>
      if (["shorts", "embed", "v", "live"].includes(parts[0])) {
        return parts[1] || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function toYouTubeEmbed(url: string | null | undefined): string | null {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function isYouTubeShorts(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url.trim());
    return u.pathname.startsWith("/shorts/");
  } catch {
    return false;
  }
}
