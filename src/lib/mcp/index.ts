import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchProducts from "./tools/search-products";
import getProduct from "./tools/get-product";
import listStores from "./tools/list-stores";

// The OAuth issuer MUST be the direct Supabase host — build it from the
// project ref (Vite inlines VITE_SUPABASE_PROJECT_ID as a literal at build
// time so this stays import-safe). The fallback keeps the issuer well-formed
// during the throwaway manifest-extract eval where tokens never verify.
const projectRef =
  (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "jayee-express-mcp",
  title: "Jayee Express",
  version: "0.1.0",
  instructions:
    "Read-only tools for the Jayee Express community marketplace (Accra, Tamale & Wa, Ghana). Use search_products to find items by keyword/category/city, get_product for a single product's details, and list_stores to browse verified stores. Prices are in Ghana Cedis (GHS).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchProducts, getProduct, listStores],
});
