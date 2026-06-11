import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";

interface UpdateAvailableBannerProps {
  onUpdate: () => void;
}

const UpdateAvailableBanner = ({ onUpdate }: UpdateAvailableBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => setDismissed(false), []);

  if (dismissed) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-[200] w-[calc(100%-2rem)] max-w-md">
      <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-background/95 backdrop-blur-xl shadow-2xl p-3 pl-4">
        <div className="p-2 rounded-xl bg-primary/10 shrink-0">
          <RefreshCw className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">New version available</p>
          <p className="text-xs text-muted-foreground">Tap update to get the latest</p>
        </div>
        <Button size="sm" variant="hero" className="rounded-xl h-9 shrink-0" onClick={onUpdate}>
          Update
        </Button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default UpdateAvailableBanner;
