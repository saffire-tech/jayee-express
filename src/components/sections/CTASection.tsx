import { Button } from "@/components/ui/button";
import { Store, ArrowRight, Sparkles } from "lucide-react";

const CTASection = () => {
  return (
    <section className="py-12 md:py-20 lg:py-28 bg-background">
      <div className="container px-4">
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl gradient-primary p-6 md:p-12 lg:p-16">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-24 md:w-40 h-24 md:h-40 bg-background rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-32 md:w-60 h-32 md:h-60 bg-background rounded-full translate-x-1/3 translate-y-1/3" />
            <div className="absolute top-1/2 left-1/4 w-12 md:w-20 h-12 md:h-20 bg-background rounded-full" />
          </div>

          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-primary-foreground/20 text-primary-foreground text-xs md:text-sm font-medium mb-4 md:mb-6">
              <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span>Join 500+ Entrepreneurs</span>
            </div>

            <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-primary-foreground mb-4 md:mb-6">
              Ready to Start Your Business?
            </h2>
            
            <p className="text-sm md:text-base lg:text-lg text-primary-foreground/80 mb-6 md:mb-8 max-w-lg mx-auto">
              Create your store in minutes and start selling to thousands of people in your community. No fees to get started.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
              <Button 
                size="lg" 
                className="w-full sm:w-auto bg-background text-foreground hover:bg-background/90 gap-2 h-11 md:h-12 text-sm md:text-base"
              >
                <Store className="h-4 w-4 md:h-5 md:w-5" />
                Create Free Store
                <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
              <Button 
                variant="link" 
                size="lg"
                className="text-primary-foreground hover:text-primary-foreground/80 text-sm md:text-base"
              >
                Learn More →
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
