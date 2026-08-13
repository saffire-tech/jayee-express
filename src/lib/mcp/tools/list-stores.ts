import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

declare const process: { env: Record<string, string | undefined> };

function publicClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export default defineTool({
  name: "list_stores",
  title: "List stores",
  description:
    "List verified, active stores on Jayee Express, optionally filtered by city (e.g. Accra, Tamale, Wa).",
  inputSchema: {
    city: z.string().trim().optional().describe("Filter by city."),
    query: z.string().trim().optional().describe("Match store name."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ city, query, limit }) => {
    const supabase = publicClient();
    let q = supabase
      .from("stores")
      .select("id, name, slug, description, city, category, logo_url, is_verified, subscription_expires_at")
      .eq("is_verified", true)
      .eq("is_suspended", false)
      .gt("subscription_expires_at", new Date().toISOString())
      .limit(limit ?? 20);
    if (city) q = q.eq("city", city);
    if (query) q = q.ilike("name", `%${query}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { stores: data ?? [] },
    };
  },
});
