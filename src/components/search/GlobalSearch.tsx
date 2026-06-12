import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Package, Store, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  id: string;
  slug?: string | null;
  name: string;
  type: "product" | "store";
  image_url?: string | null;
  price?: number;
  category?: string;
}

interface GlobalSearchProps {
  variant?: "hero" | "navbar";
  placeholder?: string;
}

const GlobalSearch = ({ variant = "navbar", placeholder = "Search products, stores..." }: GlobalSearchProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const [productsRes, storesRes] = await Promise.all([
          supabase
            .from("products")
            .select("id, name, image_url, price, category")
            .eq("is_active", true)
            .ilike("name", `%${query}%`)
            .limit(5),
          supabase
            .from("stores")
            .select("id, slug, name, logo_url")
            .eq("is_active", true)
            .ilike("name", `%${query}%`)
            .limit(3),
        ]);

        const productResults: SearchResult[] = (productsRes.data || []).map((p) => ({
          id: p.id,
          name: p.name,
          type: "product" as const,
          image_url: p.image_url,
          price: p.price,
          category: p.category,
        }));

        const storeResults: SearchResult[] = (storesRes.data || []).map((s: any) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          type: "store" as const,
          image_url: s.logo_url,
        }));

        setResults([...productResults, ...storeResults]);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false);
    setQuery("");
    if (result.type === "product") {
      navigate(`/product/${result.id}`);
    } else {
      navigate(`/store/${result.slug || result.id}`);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSearch}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className={`pl-10 pr-10 ${
              variant === "hero"
                ? "h-14 text-lg rounded-xl bg-background/80 backdrop-blur-sm border-border/50 focus:border-primary"
                : "h-10"
            }`}
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Results dropdown */}
      {isOpen && (query.length >= 2 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-[100] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-border">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {result.image_url && !result.image_url.startsWith("data:") ? (
                      <img
                        src={result.image_url}
                        alt={result.name}
                        className="h-full w-full object-cover"
                      />
                    ) : result.type === "product" ? (
                      <Package className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Store className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {result.type === "product" ? (
                        <>
                          {result.category} • ₵{result.price?.toFixed(2)}
                        </>
                      ) : (
                        "Store"
                      )}
                    </p>
                  </div>
                </button>
              ))}
              <button
                className="w-full p-3 text-center text-sm text-primary hover:bg-muted transition-colors font-medium"
                onClick={handleSearch}
              >
                View all results for "{query}"
              </button>
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              No results found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
