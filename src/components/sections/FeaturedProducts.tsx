import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { ProductGridSkeleton } from "@/components/ui/skeletons";
import { motion } from "framer-motion";
import SectionHeader from "@/components/home/SectionHeader";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string;
  views: number | null;
  store: { name: string; logo_url?: string | null } | null;
}

interface FeaturedProductsProps {
  selectedCategory?: string | null;
}

const fetchFeaturedProducts = async (category: string | null): Promise<Product[]> => {
  let query = supabase
    .from('products')
    .select(`id, name, price, image_url, category, views, store:stores(name, logo_url)`)
    .eq('is_active', true);

  if (category) {
    query = query.eq('category', category);
  } else {
    query = query.eq('is_featured', true);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) throw error;

  return data?.map(p => ({
    ...p,
    store: Array.isArray(p.store) ? p.store[0] : p.store
  })) || [];
};

const FeaturedProducts = ({ selectedCategory }: FeaturedProductsProps) => {
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['featured-products', selectedCategory],
    queryFn: () => fetchFeaturedProducts(selectedCategory ?? null),
    staleTime: 1000 * 60 * 5,
  });

  const handleAddToCart = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    await addToCart(productId, 1);
  };

  const handleBuyNow = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    await addToCart(productId, 1);
    navigate("/cart");
  };

  const sectionTitle = selectedCategory ? `Freshly in ${selectedCategory}` : "Freshly in Stocked";
  const viewAllHref = selectedCategory
    ? `/products?category=${encodeURIComponent(selectedCategory)}`
    : "/products";

  if (isLoading) {
    return (
      <section className="py-6 md:py-10">
        <div className="container px-4">
          <SectionHeader title={sectionTitle} viewAllHref={viewAllHref} />
          <ProductGridSkeleton count={8} />
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="py-6 md:py-10">
        <div className="container px-4">
          <SectionHeader title={sectionTitle} viewAllHref={viewAllHref} />
          <div className="text-center py-12 bg-card border border-border rounded-2xl">
            <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-base mb-1">
              {selectedCategory ? `No products in ${selectedCategory}` : "No products yet"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {selectedCategory
                ? "Try selecting a different category"
                : "Be the first to list your products on Jayee Express!"}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6 md:py-10">
      <div className="container px-4">
        <SectionHeader title={sectionTitle} viewAllHref={viewAllHref} />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className="group bg-card rounded-2xl overflow-hidden border border-border/60 hover:border-primary/30 transition-all duration-300 hover:shadow-card-hover"
            >
              <Link to={`/product/${product.id}`} className="block">
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {product.image_url && !product.image_url.startsWith('data:') ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}

                  {/* Store chip overlay */}
                  {product.store && (
                    <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/85 backdrop-blur-md border border-border/40 shadow-sm">
                      <div className="w-4 h-4 rounded-full bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {product.store.logo_url ? (
                          <img src={product.store.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[8px] font-bold text-muted-foreground">
                            {product.store.name?.[0] ?? "?"}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-foreground truncate flex-1">
                        {product.store.name}
                      </span>
                    </div>
                  )}

                  {/* Rating badge */}
                  <div className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-background/85 backdrop-blur-md text-[10px] font-bold shadow-sm">
                    <Star className="h-2.5 w-2.5 fill-warning text-warning" style={{ color: 'hsl(var(--warning))', fill: 'hsl(var(--warning))' }} />
                    <span>4.7</span>
                  </div>
                </div>
              </Link>

              <div className="p-2.5 md:p-3">
                <Link to={`/product/${product.id}`}>
                  <h3 className="font-semibold text-sm text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-1">
                    {product.name}
                  </h3>
                </Link>
                <p className="text-sm font-bold text-foreground mb-2">
                  ₵{product.price.toFixed(2)}
                  <span className="text-[10px] font-normal text-muted-foreground ml-1">(per item)</span>
                </p>

                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-[11px] rounded-lg border-primary/40 text-primary hover:bg-primary/5"
                    onClick={(e) => handleAddToCart(e, product.id)}
                  >
                    Add to Cart
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 px-2 text-[11px] rounded-lg"
                    onClick={(e) => handleBuyNow(e, product.id)}
                  >
                    Buy Now
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
