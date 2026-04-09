import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Navbar from "@/components/layout/Navbar";
import AdvertisementCarousel from "@/components/sections/AdvertisementCarousel";
import CategoriesSection from "@/components/sections/CategoriesSection";
import FeaturedProducts from "@/components/sections/FeaturedProducts";
import RecommendedProducts from "@/components/sections/RecommendedProducts";
import HowItWorks from "@/components/sections/HowItWorks";
import FeaturedStores from "@/components/sections/FeaturedStores";
import DownloadBanner from "@/components/sections/DownloadBanner";
import CTASection from "@/components/sections/CTASection";
import Footer from "@/components/layout/Footer";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    await queryClient.invalidateQueries({ queryKey: ['featured-products'] });
    await queryClient.invalidateQueries({ queryKey: ['featured-stores'] });
    await queryClient.invalidateQueries({ queryKey: ['featured-products-fallback'] });
    toast.success("Content refreshed");
  }, [queryClient]);

  const content = (
    <>
      <AdvertisementCarousel />
      <RecommendedProducts />
      <CategoriesSection 
        selectedCategory={selectedCategory} 
        onCategorySelect={setSelectedCategory} 
      />
      <FeaturedProducts selectedCategory={selectedCategory} />
      <HowItWorks />
      <FeaturedStores />
      <DownloadBanner />
      <CTASection />
      <Footer />
    </>
  );

  return (
    <main className="min-h-screen bg-background pb-16 md:pb-0">
      <Navbar />
      {isMobile ? (
        <PullToRefresh onRefresh={handleRefresh}>
          {content}
        </PullToRefresh>
      ) : (
        content
      )}
    </main>
  );
};

export default Index;
