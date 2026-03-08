import { Button } from "@/components/ui/button";
import { Store, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const CTASection = () => {
  return (
    <section className="py-10 md:py-16">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl gradient-primary p-8 md:p-14"
        >
          {/* Subtle pattern */}
          <div className="absolute inset-0 opacity-[0.08]">
            <div className="absolute top-0 left-0 w-32 h-32 bg-background rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-background rounded-full translate-x-1/3 translate-y-1/3" />
          </div>

          <div className="relative z-10 max-w-lg mx-auto text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-foreground/15 text-primary-foreground text-xs font-medium mb-5">
              <Sparkles className="h-3 w-3" />
              <span>Join 500+ Entrepreneurs</span>
            </div>

            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-primary-foreground mb-4 leading-tight">
              Ready to Start Your Business?
            </h2>
            
            <p className="text-sm md:text-base text-primary-foreground/75 mb-7 max-w-sm mx-auto">
              Create your store in minutes and start selling to your community. No fees to get started.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/seller">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto bg-background text-foreground hover:bg-background/90 gap-2 rounded-xl"
                >
                  <Store className="h-4 w-4" />
                  Create Free Store
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
