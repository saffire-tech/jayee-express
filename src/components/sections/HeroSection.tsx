import { Button } from "@/components/ui/button";
import { ShoppingBag, Store, ArrowRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import GlobalSearch from "@/components/search/GlobalSearch";
import { Skeleton } from "@/components/ui/skeleton";
import { CompactCounter } from "@/components/ui/AnimatedCounter";
import { motion } from "framer-motion";

const HeroSection = () => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['homepage-stats'],
    queryFn: async () => {
      const [storesRes, productsRes, usersRes] = await Promise.all([
        supabase.from('stores').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
      ]);
      
      return {
        activeStores: storesRes.count || 0,
        productsListed: productsRes.count || 0,
        happyUsers: usersRes.count || 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
    }),
  };

  return (
    <section className="relative min-h-[92vh] md:min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent/40 via-background to-background" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/8 rounded-full blur-[100px] animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-[120px] animate-float" style={{ animationDelay: '-3s' }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/3 rounded-full blur-[150px]" />
      </div>

      <div className="container relative z-10 px-4">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium mb-6"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Your Community Marketplace</span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-4xl md:text-6xl lg:text-7xl font-black leading-[1.1] mb-5 tracking-tight"
          >
            Connect to{" "}
            <span className="text-gradient">Commerce</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed"
          >
            Buy and sell goods & services within your community. Set up your store, showcase your skills, and grow your hustle.
          </motion.p>

          {/* Search Bar */}
          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="max-w-lg mx-auto mb-7 relative z-50"
          >
            <GlobalSearch variant="hero" placeholder="Search products, services, or stores..." />
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            custom={4}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link to="/products">
              <Button variant="hero" size="lg" className="w-full sm:w-auto gap-2 rounded-xl">
                <ShoppingBag className="h-4 w-4" />
                Start Shopping
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/seller">
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 rounded-xl border-foreground/20 hover:bg-foreground hover:text-background">
                <Store className="h-4 w-4" />
                Create Your Store
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            custom={5}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="grid grid-cols-3 gap-3 sm:gap-6 mt-12 md:mt-16 pt-8 border-t border-border/40"
          >
            {[
              { label: "Active Stores", value: stats?.activeStores || 0 },
              { label: "Products Listed", value: stats?.productsListed || 0 },
              { label: "Happy Users", value: stats?.happyUsers || 0 },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                {statsLoading ? (
                  <Skeleton className="h-8 w-14 mx-auto mb-1" />
                ) : (
                  <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tabular-nums">
                    <CompactCounter value={stat.value} />
                  </p>
                )}
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
