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
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div>
        <p className="text-xs font-semibold text-primary tracking-widest mb-2">TOP SELLERS</p>
        <h2 className="text-2xl md:text-3xl font-bold">Featured Stores</h2>
      </div>
      <Link to="/stores">
        <Button variant="outline" size="sm" className="rounded-xl">
          View All Stores
        </Button>
      </Link>
    </div>
  );

  if (isLoading) {
    return (
      <section id="stores" className="py-12 md:py-20 bg-muted/30">
        <div className="container px-4">
          {header}
          <StoreGridSkeleton count={4} />
        </div>
      </section>
    );
  }

  if (stores.length === 0) {
    return (
      <section id="stores" className="py-12 md:py-20 bg-muted/30">
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
    <section id="stores" className="py-12 md:py-20 bg-muted/30">
      <div className="container px-4">
        {header}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
                {/* Cover */}
                <div className="relative h-24 sm:h-28 overflow-hidden bg-muted">
                  {store.cover_url ? (
                    <img
                      src={store.cover_url}
                      alt={store.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                </div>

                {/* Content */}
                <div className="relative p-3 pt-0">
                  <div className="relative -mt-6 mb-2">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 border-card shadow-sm bg-muted flex items-center justify-center overflow-hidden">
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
