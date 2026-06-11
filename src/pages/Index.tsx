import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Navbar from "@/components/layout/Navbar";
import AnnouncementBanner from "@/components/announcements/AnnouncementBanner";
import AdvertisementCarousel from "@/components/sections/AdvertisementCarousel";
import CategoriesSection from "@/components/sections/CategoriesSection";
import FeaturedProducts from "@/components/sections/FeaturedProducts";
import RecommendedProducts from "@/components/sections/RecommendedProducts";
import HowItWorks from "@/components/sections/HowItWorks";
import FeaturedStores from "@/components/sections/FeaturedStores";
import DownloadBanner from "@/components/sections/DownloadBanner";
import CTASection from "@/components/sections/CTASection";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
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
      <h1 className="sr-only">Jayee Express — community marketplace in Ghana. Shop and sell locally in Tamale and Wa.</h1>
      <AnnouncementBanner />
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
      <SEO
        title="Jayee Express — Community Marketplace in Ghana"
        description="Buy and sell goods and services in your community. Discover local stores, shop with delivery across Tamale and Wa on Jayee Express."
        canonicalPath="/"
      />
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
