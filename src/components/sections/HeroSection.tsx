import { Button } from "@/components/ui/button";
import { ShoppingBag, Store, ArrowRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import GlobalSearch from "@/components/search/GlobalSearch";
import { Skeleton } from "@/components/ui/skeleton";
import { CompactCounter } from "@/components/ui/AnimatedCounter";

const HeroSection = () => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['homepage-stats'],
    queryFn: async () => {
      const [storesRes, productsRes, usersRes] = await Promise.all([
      supabase.from('stores').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true })]
      );

      return {
        activeStores: storesRes.count || 0,
        productsListed: productsRes.count || 0,
        happyUsers: usersRes.count || 0
      };
    },
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden gradient-hero">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" style={{
          animationDelay: '-3s'
        }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-8 animate-fade-up">
            <Zap className="h-4 w-4" />
            <span>Your Community Marketplace</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-tight mb-6 animate-fade-up" style={{
            animationDelay: '0.1s'
          }}>
            Connect to{" "}
            <span className="text-gradient text-primary-foreground">Commerce</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up" style={{
            animationDelay: '0.2s'
          }}>
            Buy and sell goods & services within your community. Set up your store, showcase your skills, and grow your hustle right where you are.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto mb-8 animate-fade-up relative z-50" style={{ animationDelay: '0.25s' }}>
            <GlobalSearch variant="hero" placeholder="Search for products, services, or stores..." />
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{
            animationDelay: '0.3s'
          }}>
            <Link to="/products" className="text-primary-foreground">
              <Button variant="hero" size="xl" className="w-full sm:w-auto gap-2">
                <ShoppingBag className="h-5 w-5" />
                Start Shopping
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/seller">
              <Button variant="heroOutline" size="xl" className="w-full sm:w-auto gap-2">
                <Store className="h-5 w-5" />
                Create Your Store
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 md:gap-8 mt-10 md:mt-16 pt-6 md:pt-12 border-t border-border/50 animate-fade-up" style={{
            animationDelay: '0.4s'
          }}>
            <div className="text-center p-2 sm:p-4 rounded-xl bg-card/50 backdrop-blur-sm">
              {statsLoading ?
              <Skeleton className="h-8 md:h-10 w-16 mx-auto mb-1" /> :

              <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
                  <CompactCounter value={stats?.activeStores || 0} />
                </p>
              }
              <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground mt-0.5 sm:mt-1">Active Stores</p>
            </div>
            <div className="text-center p-2 sm:p-4 rounded-xl bg-card/50 backdrop-blur-sm">
              {statsLoading ?
              <Skeleton className="h-8 md:h-10 w-16 mx-auto mb-1" /> :

              <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
                  <CompactCounter value={stats?.productsListed || 0} />
                </p>
              }
              <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground mt-0.5 sm:mt-1">Products Listed</p>
            </div>
            <div className="text-center p-2 sm:p-4 rounded-xl bg-card/50 backdrop-blur-sm">
              {statsLoading ?
              <Skeleton className="h-8 md:h-10 w-16 mx-auto mb-1" /> :

              <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
                  <CompactCounter value={stats?.happyUsers || 0} />
                </p>
              }
              <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground mt-0.5 sm:mt-1">Happy Users</p>
            </div>
          </div>
        </div>
      </div>
    </section>);

};

export default HeroSection;