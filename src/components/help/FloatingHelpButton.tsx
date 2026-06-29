import { useLocation, useNavigate } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const HIDE_PREFIXES = ["/admin", "/auth", "/reset-password", "/select-city", "/cart", "/messages", "/help"];

export function FloatingHelpButton() {
  const location = useLocation();
  const navigate = useNavigate();

  const shouldHide = HIDE_PREFIXES.some((p) =>
    location.pathname === p || location.pathname.startsWith(p + "/")
  );
  if (shouldHide) return null;

  return (
    <button
      type="button"
      aria-label="Open help center"
      onClick={() => navigate("/help")}
      className={cn(
        "fixed z-50 right-4 bottom-20 md:bottom-6",
        "h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg",
        "flex items-center justify-center hover:scale-105 active:scale-95 transition-transform",
        "ring-2 ring-primary/30"
      )}
    >
      <HelpCircle className="h-7 w-7" />
    </button>
  );
}
