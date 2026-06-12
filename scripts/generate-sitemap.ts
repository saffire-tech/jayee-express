// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.
// Fetches verified stores and active products from Supabase to include dynamic routes.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://jayeeexpress.com";
const SUPABASE_URL = "https://brqzedcxzjqwzpkwrmow.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJycXplZGN4empxd3pwa3dybW93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MTY5OTcsImV4cCI6MjA4MTI5Mjk5N30.9Vj78OJNRQJQ4JlB_69cFCSLMQz2jUCZNjIcK2u8Yjw";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/products", changefreq: "daily", priority: "0.9" },
  { path: "/stores", changefreq: "daily", priority: "0.9" },
  { path: "/download", changefreq: "monthly", priority: "0.7" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
];

async function supabaseSelect(path: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    console.warn(`[sitemap] ${path} returned ${res.status}; skipping`);
    return [];
  }
  return res.json();
}

async function fetchDynamicEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  try {
    const stores = await supabaseSelect(
      "stores?select=id,slug,updated_at&is_verified=eq.true&is_active=eq.true&is_suspended=eq.false&limit=2000",
    );
    for (const s of stores) {
      entries.push({
        path: `/store/${s.slug || s.id}`,
        lastmod: s.updated_at ? new Date(s.updated_at).toISOString().split("T")[0] : undefined,
        changefreq: "weekly",
        priority: "0.7",
      });
    }
  } catch (e) {
    console.warn("[sitemap] failed to fetch stores:", e);
  }

  try {
    const products = await supabaseSelect(
      "products?select=id,updated_at&is_active=eq.true&limit=5000",
    );
    for (const p of products) {
      entries.push({
        path: `/product/${p.id}`,
        lastmod: p.updated_at ? new Date(p.updated_at).toISOString().split("T")[0] : undefined,
        changefreq: "weekly",
        priority: "0.6",
      });
    }
  } catch (e) {
    console.warn("[sitemap] failed to fetch products:", e);
  }

  return entries;
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

(async () => {
  const dynamic = await fetchDynamicEntries();
  const all = [...staticEntries, ...dynamic];
  writeFileSync(resolve("public/sitemap.xml"), generateSitemap(all));
  console.log(`sitemap.xml written (${all.length} entries: ${staticEntries.length} static + ${dynamic.length} dynamic)`);
})();
