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
import HomeUtilityStrip from "@/components/home/HomeUtilityStrip";
import HomeCategorySidebar from "@/components/home/HomeCategorySidebar";

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

  const mobileContent = (
    <>
      <h1 className="sr-only">Jayee Express — community marketplace in Ghana.</h1>
      <AnnouncementBanner />
      <AdvertisementCarousel />
      <div className="-mt-2">
        <CategoriesSection
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
        />
      </div>
      <RecommendedProducts />
      <FeaturedProducts selectedCategory={selectedCategory} />
      <FeaturedStores />
      <HowItWorks />
      <DownloadBanner />
      <CTASection />
      <Footer />
    </>
  );

  const desktopContent = (
    <>
      <h1 className="sr-only">Jayee Express — community marketplace in Ghana.</h1>
      <AnnouncementBanner />
      <HomeUtilityStrip />
      <AdvertisementCarousel />
      <CategoriesSection
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
      />

      <div className="container px-4 py-6">
        <div className="flex gap-6">
          <HomeCategorySidebar
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
          />
          <div className="flex-1 min-w-0 space-y-2">
            <RecommendedProducts />
            <FeaturedProducts selectedCategory={selectedCategory} />
            <FeaturedStores />
          </div>
        </div>
      </div>

      <HowItWorks />
      <DownloadBanner />
      <CTASection />
      <Footer />
    </>
  );

  return (
    <main className="min-h-screen bg-background pb-16 md:pb-0">
      <SEO
        title="Jayee Express — Community Marketplace in Ghana"
        description="Buy and sell goods and services in your community. Discover local stores, shop with delivery across Accra, Tamale and Wa on Jayee Express."
        canonicalPath="/"
      />
      <Navbar />
      {isMobile ? (
        <PullToRefresh onRefresh={handleRefresh}>{mobileContent}</PullToRefresh>
      ) : (
        desktopContent
      )}
    </main>
  );
};

export default Index;
