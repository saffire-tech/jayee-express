import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecommendedGridSkeleton } from "@/components/ui/skeletons";
import { Sparkles, ShoppingCart, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

interface RecommendedProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  image_url: string | null;
  store: {
    name: string;
    campus: string | null;
  } | null;
}

const RecommendedProducts = () => {
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const accessToken = session?.access_token;

  // Fetch AI recommendations
  const { data: recommendations = [], isLoading: isLoadingRecs, isError: isRecsError } = useQuery({
    queryKey: ['recommendations', user?.id],
    queryFn: async () => {
      if (!accessToken) return [];

      const { data, error } = await supabase.functions.invoke('get-recommendations', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) {
        console.warn('Recommendations unavailable, showing fallback products');
        return [];
      }
      return Array.isArray(data?.recommendations) ? data.recommendations as RecommendedProduct[] : [];
    },
    enabled: !authLoading && !!accessToken,
    staleTime: 5 * 60 * 1000,
    retry: false,
    meta: { suppressError: true },
  });

  // Fallback: fetch featured products when recommendations fail or empty
  const shouldFetchFallback = !authLoading && (!accessToken || isRecsError || (!isLoadingRecs && recommendations.length === 0));
  
  const { data: featuredProducts = [], isLoading: isLoadingFeatured } = useQuery({
    queryKey: ['featured-products-fallback'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          category,
          price,
          image_url,
          store:stores(name, campus)
        `)
        .eq('is_active', true)
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(8);
      
      if (error) throw error;
      
      return (data || []).map(p => ({
        ...p,
        store: Array.isArray(p.store) ? p.store[0] : p.store
      })) as RecommendedProduct[];
    },
    enabled: shouldFetchFallback,
    staleTime: 5 * 60 * 1000,
  });

  const handleAddToCart = async (e: React.MouseEvent, product: RecommendedProduct) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Please sign in to add items to cart");
      navigate("/auth");
      return;
    }
    await addToCart(product.id);
    toast.success(`${product.name} added to cart`);
  };

  const isLoading = authLoading || isLoadingRecs || (shouldFetchFallback && isLoadingFeatured);
  
  if (isLoading) {
    return (
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container px-4">
          <div className="flex items-center gap-2 mb-6 md:mb-8">
            <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-primary animate-pulse" />
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold">Recommended for You</h2>
          </div>
          <RecommendedGridSkeleton count={4} />
        </div>
      </section>
    );
  }

  // Decide which products to show
  const isFallback = !accessToken || isRecsError || recommendations.length === 0;
  const productsToShow = isFallback ? featuredProducts : recommendations;
  
  if (productsToShow.length === 0) return null;

  const sectionTitle = isFallback ? "Trending Now" : "Recommended for You";
  const SectionIcon = isFallback ? TrendingUp : Sparkles;

  return (
    <section className="py-12 md:py-16 bg-muted/30">
      <div className="container px-4">
        <div className="flex items-center gap-2 mb-6 md:mb-8">
          <SectionIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold">{sectionTitle}</h2>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
          {productsToShow.slice(0, 8).map((product) => (
            <Card 
              key={product.id} 
              className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all border-border hover:border-primary/30"
              onClick={() => navigate(`/product/${product.id}`)}
            >
              <CardContent className="p-0">
                <div className="aspect-square relative overflow-hidden bg-muted">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      No image
                    </div>
                  )}
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-1.5 right-1.5 md:bottom-2 md:right-2 h-7 w-7 md:h-8 md:w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleAddToCart(e, product)}
                  >
                    <ShoppingCart className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </Button>
                </div>
                <div className="p-2.5 md:p-4">
                  <h3 className="font-medium text-sm md:text-base line-clamp-1">{product.name}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                    {product.store?.name} {product.store?.campus && `• ${product.store.campus}`}
                  </p>
                  <p className="text-primary font-semibold text-sm md:text-base mt-0.5 md:mt-1">
                    GH₵ {product.price.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RecommendedProducts;
