import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Verified, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { StoreGridSkeleton } from "@/components/ui/skeletons";
import { motion } from "framer-motion";

interface StoreData {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  location: string | null;
  is_verified: boolean | null;
  product_count?: number;
}

const fetchFeaturedStores = async (): Promise<StoreData[]> => {
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, description, logo_url, cover_url, location, is_verified')
    .eq('is_active', true)
    .eq('is_featured', true)
    .eq('is_verified', true)
    .eq('is_suspended', false)
    .order('total_sales', { ascending: false })
    .limit(4);

  if (error) throw error;

  const storesWithCounts = await Promise.all(
    (data || []).map(async (store) => {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .eq('is_active', true);
      
      return { ...store, product_count: count || 0 };
    })
  );
  
  return storesWithCounts;
};

const FeaturedStores = () => {
  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['featured-stores'],
    queryFn: fetchFeaturedStores,
    staleTime: 1000 * 60 * 5,
  });

  const header = (
    <div className="flex items-end justify-between gap-4 mb-3 md:mb-4">
      <h2 className="text-lg md:text-2xl font-bold tracking-tight">Featured Stores</h2>
      <Link to="/stores" className="text-[11px] md:text-xs font-bold tracking-wider text-primary hover:text-primary/80">
        VIEW ALL ›
      </Link>
    </div>
  );

  if (isLoading) {
    return (
      <section id="stores" className="py-6 md:py-10 bg-muted/30">
        <div className="container px-4">
          {header}
          <StoreGridSkeleton count={4} />
        </div>
      </section>
    );
  }

  if (stores.length === 0) {
    return (
      <section id="stores" className="py-6 md:py-10 bg-muted/30">
        <div className="container px-4">
          {header}
          <div className="text-center py-12 bg-card border border-border rounded-2xl">
            <Store className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-base mb-1">No stores yet</h3>
            <p className="text-sm text-muted-foreground">Be the first to create your store on Jayee Express!</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="stores" className="py-6 md:py-10 bg-muted/30">
      <div className="container px-4">
        {header}

        {/* Mobile: horizontal scroll with image-forward cards */}
        <div className="md:hidden -mx-4 px-4 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
          {stores.map((store, i) => (
            <motion.div
              key={store.id}
              initial={{ opacity: 0, x: 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="flex-shrink-0 w-[78%] snap-start"
            >
              <Link
                to={`/store/${store.id}`}
                className="group block relative rounded-2xl overflow-hidden border border-border/60 bg-card shadow-sm h-44"
              >
                {store.cover_url ? (
                  <img src={store.cover_url} alt={store.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10" />
                )}
                {/* Floating info card */}
                <div className="absolute top-3 left-3 right-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-background/95 backdrop-blur-md shadow-md border border-border/40">
                  <div className="w-8 h-8 rounded-lg bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {store.logo_url ? (
                      <img src={store.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Store className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h3 className="text-sm font-bold truncate">{store.name}</h3>
                      {store.is_verified && <Verified className="h-3 w-3 text-primary flex-shrink-0" />}
                    </div>
                    {store.location && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                        <MapPin className="h-2.5 w-2.5" /> {store.location}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">★ 4.7</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Desktop grid */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {stores.map((store, i) => (
            <motion.div
              key={store.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
            >
              <Link
                to={`/store/${store.id}`}
                className="group block bg-card rounded-2xl overflow-hidden border border-border/60 hover:border-primary/20 transition-all duration-300 hover:shadow-lg"
              >
                <div className="relative h-32 overflow-hidden bg-muted">
                  {store.cover_url ? (
                    <img src={store.cover_url} alt={store.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                </div>
                <div className="relative p-3 pt-0">
                  <div className="relative -mt-6 mb-2">
                    <div className="w-12 h-12 rounded-xl border-2 border-card shadow-sm bg-muted flex items-center justify-center overflow-hidden">
                      {store.logo_url ? (
                        <img src={store.logo_url} alt={store.name} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <Store className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    {store.is_verified && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full gradient-primary flex items-center justify-center">
                        <Verified className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-0.5 group-hover:text-primary transition-colors line-clamp-1">
                    {store.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mb-2 line-clamp-1">
                    {store.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    {store.location ? (
                      <span className="flex items-center gap-1 line-clamp-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{store.location}</span>
                      </span>
                    ) : (
                      <span>{store.product_count} products</span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedStores;
