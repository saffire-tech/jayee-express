import { defineMcp } from "@lovable.dev/mcp-js";
import searchProducts from "./tools/search-products";
import getProduct from "./tools/get-product";
import listStores from "./tools/list-stores";

export default defineMcp({
  name: "jayee-express-mcp",
  title: "Jayee Express",
  version: "0.1.0",
  instructions:
    "Read-only tools for the Jayee Express community marketplace (Tamale & Wa, Ghana). Use search_products to find items by keyword/category/city, get_product for a single product's details, and list_stores to browse verified stores. Prices are in Ghana Cedis (GHS).",
  tools: [searchProducts, getProduct, listStores],
});
