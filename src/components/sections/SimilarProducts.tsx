import { getCdnImageUrl } from "@/lib/cdn";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

interface SimilarProductsProps {
  currentProductId: string;
  category: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string;
  store: {
    name: string;
    campus: string | null;
  } | null;
}

const SimilarProducts = ({ currentProductId, category, price }: SimilarProductsProps) => {
  const { addToCart } = useCart();

  const { data: similarProducts = [], isLoading } = useQuery({
    queryKey: ['similar-products', currentProductId, category, price],
    queryFn: async () => {
      // Define price range (±50% of current price)
      const minPrice = price * 0.5;
      const maxPrice = price * 1.5;

      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          image_url,
          category,
          store:stores(name, campus)
        `)
        .eq('is_active', true)
        .eq('category', category)
        .neq('id', currentProductId)
        .gte('price', minPrice)
        .lte('price', maxPrice)
        .limit(8);

      if (error) throw error;

      return (data?.map(p => ({
        ...p,
        store: Array.isArray(p.store) ? p.store[0] : p.store
      })) || []) as Product[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleAddToCart = async (e: React.MouseEvent, productId: string, productName: string) => {
    e.preventDefault();
    e.stopPropagation();
    await addToCart(productId);
    toast.success(`${productName} added to cart`);
  };

  if (isLoading) {
    return (
      <section className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Similar Products</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-0">
                <Skeleton className="aspect-square w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (similarProducts.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold mb-6">Similar Products</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {similarProducts.map((product) => (
          <Link key={product.id} to={`/product/${product.id}`}>
            <Card className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all h-full">
              <CardContent className="p-0">
                <div className="aspect-square relative overflow-hidden bg-muted">
                  {product.image_url ? (
                    <img 
                      src={getCdnImageUrl(product.image_url)}  loading="lazy"
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Package className="h-8 w-8" />
                    </div>
                  )}
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleAddToCart(e, product.id, product.name)}
                  >
                    <ShoppingCart className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4">
                  <h3 className="font-medium line-clamp-1 group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {product.store?.name} {product.store?.campus && `• ${product.store.campus}`}
                  </p>
                  <p className="text-primary font-semibold mt-1">
                    ₵{product.price.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default SimilarProducts;
