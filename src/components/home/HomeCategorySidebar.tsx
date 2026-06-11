import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Utensils, Shirt, Laptop, BookOpen, Scissors, Camera, Briefcase, Sparkles,
  ChevronLeft, ChevronRight, LayoutGrid,
} from "lucide-react";
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

interface Props {
  selectedCategory: string | null;
  onCategorySelect: (category: string | null) => void;
}

const HomeCategorySidebar = ({ selectedCategory, onCategorySelect }: Props) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden lg:block sticky top-20 self-start transition-all duration-200",
        collapsed ? "w-12" : "w-56"
      )}
    >
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/40 hover:bg-muted transition-colors"
          aria-label={collapsed ? "Expand categories" : "Collapse categories"}
        >
          {!collapsed && (
            <span className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-foreground">
              <LayoutGrid className="h-3.5 w-3.5" />
              Categories
            </span>
          )}
          {collapsed ? <ChevronRight className="h-4 w-4 mx-auto" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <nav className="py-1">
          <button
            onClick={() => onCategorySelect(null)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left",
              !selectedCategory
                ? "bg-accent text-accent-foreground font-semibold"
                : "hover:bg-muted text-foreground"
            )}
            title="All"
          >
            <Sparkles className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>All</span>}
          </button>
          {categories.map(cat => {
            const Icon = cat.icon;
            const active = selectedCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => onCategorySelect(active ? null : cat.name)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left",
                  active
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "hover:bg-muted text-foreground"
                )}
                title={cat.name}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{cat.name}</span>}
              </button>
            );
          })}
          {!collapsed && (
            <Link
              to="/products"
              className="block px-3 py-2 mt-1 text-xs font-medium text-primary hover:underline"
            >
              View all categories →
            </Link>
          )}
        </nav>
      </div>
    </aside>
  );
};

export default HomeCategorySidebar;
