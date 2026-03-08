import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Verified, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { StoreGridSkeleton } from "@/components/ui/skeletons";

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
    .limit(3);

  if (error) throw error;

  // Fetch product counts for each store in parallel
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
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  if (isLoading) {
    return (
      <section id="stores" className="py-20 md:py-28 bg-secondary/30">
        <div className="container px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <p className="text-primary font-semibold mb-3">TOP SELLERS</p>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
                Featured Stores
              </h2>
            </div>
          </div>
          <StoreGridSkeleton count={3} />
        </div>
      </section>
    );
  }

  if (stores.length === 0) {
    return (
      <section id="stores" className="py-20 md:py-28 bg-secondary/30">
        <div className="container px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <p className="text-primary font-semibold mb-3">TOP SELLERS</p>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
                Featured Stores
              </h2>
            </div>
          </div>
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No stores yet</h3>
            <p className="text-muted-foreground">
              Be the first to create your store on Shodel!
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="stores" className="py-20 md:py-28 bg-secondary/30">
      <div className="container px-4">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div>
            <p className="text-primary font-semibold mb-3">TOP SELLERS</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
              Featured Stores
            </h2>
          </div>
          <Link to="/stores">
            <Button variant="outline" className="w-fit">
              View All Stores
            </Button>
          </Link>
        </div>

        {/* Stores Grid - consistent 2-col mobile, scales up */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {stores.map((store) => (
            <div
              key={store.id}
              className="group bg-card rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-card-hover"
            >
              {/* Cover Image */}
              <div className="relative h-24 sm:h-28 overflow-hidden bg-muted">
                {store.cover_url ? (
                  <img
                    src={store.cover_url}
                    alt={store.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Store className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              </div>

              {/* Content */}
              <div className="relative p-3 pt-0">
                {/* Avatar */}
                <div className="relative -mt-6 mb-2">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg border-2 border-card shadow-md bg-muted flex items-center justify-center overflow-hidden">
                    {store.logo_url ? (
                      <img
                        src={store.logo_url}
                        alt={store.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store className="h-5 w-5 text-muted-foreground" />
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
                <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                  {store.description || 'No description'}
                </p>

                {/* Meta */}
                {store.location && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                    <MapPin className="h-3 w-3" />
                    <span className="line-clamp-1">{store.location}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-muted-foreground">
                    {store.product_count} {store.product_count === 1 ? 'product' : 'products'}
                  </span>
                  <Link to={`/store/${store.id}`}>
                    <Button size="sm" className="h-7 px-2 text-xs">Visit</Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedStores;
