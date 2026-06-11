import { useRef } from "react";
import { 
  Utensils, Shirt, Laptop, BookOpen, Scissors, Camera, Briefcase, Sparkles,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const categories = [
  { name: "Food & Snacks", icon: Utensils },
  { name: "Fashion", icon: Shirt },
  { name: "Electronics", icon: Laptop },
  { name: "Books & Notes", icon: BookOpen },
  { name: "Beauty & Care", icon: Scissors },
  { name: "Photography", icon: Camera },
  { name: "Tutoring", icon: Briefcase },
  { name: "Other Services", icon: Sparkles },
];

interface CategoriesSectionProps {
  selectedCategory: string | null;
  onCategorySelect: (category: string | null) => void;
}

const CategoriesSection = ({ selectedCategory, onCategorySelect }: CategoriesSectionProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -200 : 200,
        behavior: "smooth",
      });
    }
  };

  const handleCategoryClick = (categoryName: string) => {
    onCategorySelect(selectedCategory === categoryName ? null : categoryName);
  };

  return (
    <section id="categories" className="py-8 md:py-12 bg-background">
      <div className="container px-4">
        <div className="text-center mb-5">
          <p className="text-xs font-semibold text-primary tracking-widest mb-1.5">CATEGORIES</p>
          <h2 className="text-xl md:text-2xl font-bold">Browse by Category</h2>
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Scroll categories left"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex bg-background/90 backdrop-blur-sm shadow-sm rounded-full h-8 w-8 -ml-3"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            aria-label="Scroll categories right"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex bg-background/90 backdrop-blur-sm shadow-sm rounded-full h-8 w-8 -mr-3"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div
            ref={scrollContainerRef}
            className="flex gap-2 overflow-x-auto pb-2 px-1 snap-x snap-mandatory touch-pan-x"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
          >
            <button
              onClick={() => onCategorySelect(null)}
              className={cn(
                "flex-shrink-0 snap-center flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200 active:scale-95 text-sm font-medium",
                !selectedCategory
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border/60 hover:border-primary/30 hover:bg-accent"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              All
            </button>

            {categories.map((category) => {
              const isSelected = selectedCategory === category.name;
              return (
                <button
                  key={category.name}
                  onClick={() => handleCategoryClick(category.name)}
                  className={cn(
                    "flex-shrink-0 snap-center flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200 active:scale-95 text-sm font-medium",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card border-border/60 hover:border-primary/30 hover:bg-accent"
                  )}
                >
                  <category.icon className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">{category.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CategoriesSection;
