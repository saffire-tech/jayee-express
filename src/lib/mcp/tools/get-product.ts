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
  name: "get_product",
  title: "Get product",
  description: "Fetch a single Jayee Express product by its id, including store info.",
  inputSchema: {
    id: z.string().uuid().describe("Product UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }) => {
    const supabase = publicClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, description, price, category, image_url, images, stock, is_service, views, store:stores(id, name, slug, city, is_verified, is_suspended)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Product not found." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { product: data },
    };
  },
});
