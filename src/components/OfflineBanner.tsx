import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[200] bg-yellow-500 text-black text-xs md:text-sm px-3 py-1.5 flex items-center justify-center gap-2 shadow">
      <WifiOff className="h-3.5 w-3.5" />
      <span>You’re offline — showing saved data. Connect to place orders.</span>
    </div>
  );
}
