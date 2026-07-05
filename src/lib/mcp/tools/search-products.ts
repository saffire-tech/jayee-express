import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

function publicClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export default defineTool({
  name: "search_products",
  title: "Search products",
  description:
    "Search active products on Jayee Express by keyword, category, or city. Returns id, name, price (GHS), category, store, and city.",
  inputSchema: {
    query: z.string().trim().optional().describe("Text to match against product name/description."),
    category: z.string().trim().optional().describe("Filter by product category."),
    city: z.string().trim().optional().describe("Filter by city (e.g. Tamale, Wa)."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, city, limit }) => {
    const supabase = publicClient();
    let q = supabase
      .from("products")
      .select(
        "id, name, description, price, category, image_url, store:stores!inner(id, name, slug, city, is_verified, is_suspended, subscription_expires_at)",
      )
      .eq("is_active", true)
      .eq("store.is_verified", true)
      .eq("store.is_suspended", false)
      .gt("store.subscription_expires_at", new Date().toISOString())
      .limit(limit ?? 20);

    if (query) q = q.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    if (category) q = q.eq("category", category);
    if (city) q = q.eq("store.city", city);

    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
