import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeaturedProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  description: string | null;
  store: { name: string; campus: string | null } | null;
}

const AdvertisementCarousel = () => {
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["ad-carousel-featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, description, store:stores(name, campus)")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data || []).map((p) => ({
        ...p,
        store: Array.isArray(p.store) ? p.store[0] : p.store,
      })) as FeaturedProduct[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center" },
    [Autoplay({ delay: 10000, stopOnInteraction: false, stopOnMouseEnter: true })]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  if (isLoading) {
    return (
      <div className="w-full h-[300px] md:h-[400px]">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="w-full relative pt-14 md:pt-16">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex-[0_0_100%] min-w-0 relative h-[300px] md:h-[400px] cursor-pointer"
              onClick={() => navigate(`/product/${product.id}`)}
            >
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  width={1200}
                  height={400}
                  fetchPriority={products.indexOf(product) === 0 ? "high" : "auto"}
                  loading={products.indexOf(product) === 0 ? "eager" : "lazy"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <ShoppingBag className="h-16 w-16 text-muted-foreground/40" />
                </div>
              )}
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              {/* Product info */}
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 text-white">
                <p className="text-xs md:text-sm font-medium opacity-80 mb-1">
                  {product.store?.name}{product.store?.campus ? ` • ${product.store.campus}` : ""}
                </p>
                <h2 className="text-xl md:text-3xl font-bold mb-1 line-clamp-2">{product.name}</h2>
                {product.description && (
                  <p className="text-sm md:text-base opacity-80 line-clamp-1 mb-2 hidden sm:block">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center gap-4">
                  <span className="text-lg md:text-2xl font-bold">GH₵ {product.price.toFixed(2)}</span>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
                    onClick={(e) => { e.stopPropagation(); navigate(`/product/${product.id}`); }}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Shop Now
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Dot indicators */}
      {products.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {products.map((_, i) => (
            <button
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === selectedIndex ? "bg-white w-6" : "bg-white/50"
              }`}
              onClick={() => emblaApi?.scrollTo(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default AdvertisementCarousel;
