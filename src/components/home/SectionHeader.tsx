import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}

const SectionHeader = ({ title, viewAllHref, viewAllLabel = "VIEW ALL", className = "" }: SectionHeaderProps) => {
  return (
    <div className={`flex items-end justify-between gap-4 mb-3 md:mb-4 ${className}`}>
      <h2 className="text-lg md:text-2xl font-bold tracking-tight">{title}</h2>
      {viewAllHref && (
        <Link
          to={viewAllHref}
          className="text-[11px] md:text-xs font-bold tracking-wider text-primary hover:text-primary/80 inline-flex items-center gap-0.5"
        >
          {viewAllLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
};

export default SectionHeader;
