import { get, set, del } from "idb-keyval";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

// Bump when cached query shapes change to invalidate old caches.
export const PERSIST_VERSION = "v1";
const KEY = `jayee-rq-cache-${PERSIST_VERSION}`;

/** IndexedDB-backed persister for React Query. */
export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(KEY, client);
      } catch (e) {
        console.warn("[cache] persist failed", e);
      }
    },
    restoreClient: async () => {
      try {
        return (await get<PersistedClient>(KEY)) ?? undefined;
      } catch (e) {
        console.warn("[cache] restore failed", e);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await del(KEY);
      } catch {
        // ignore
      }
    },
  };
}

// Query keys safe to persist offline. Only public catalog data and the user's
// own purchase history. Never persist auth-sensitive, mutation-driven, or
// admin data (cart, messages, notifications, admin, wallet).
const PERSIST_ALLOWLIST = new Set([
  "featured-products",
  "featured-products-fallback",
  "featured-stores",
  "recommendations",
  "all-products",
  "all-stores",
  "product-detail",
  "store-detail",
  "purchase-history",
]);

export const persistQueryFilter = (query: { queryKey: readonly unknown[] }) => {
  const root = query.queryKey?.[0];
  return typeof root === "string" && PERSIST_ALLOWLIST.has(root);
};
