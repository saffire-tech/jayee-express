import { useState, useEffect } from 'react';
import DeliveryMap from '@/components/maps/DeliveryMap';
import { useDeliveryTracking } from '@/hooks/useDeliveryTracking';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Truck, Clock, Navigation } from 'lucide-react';
import { MAPBOX_TOKEN } from '@/lib/mapbox';

interface DeliveryTrackerProps {
  orderId: string;
  storeLocation?: { latitude: number; longitude: number } | null;
  buyerLocation?: { latitude: number; longitude: number } | null;
  deliveryStatus?: string | null;
}

const statusLabels: Record<string, string> = {
  pending: 'Waiting for delivery person',
  accepted: 'Delivery person assigned',
  picked_up: 'Picked up from store',
  in_transit: 'On the way',
  delivered: 'Delivered — awaiting your confirmation',
  confirmed: 'Buyer confirmed receipt',
};

const DeliveryTracker = ({ orderId, storeLocation, buyerLocation, deliveryStatus: initialStatus }: DeliveryTrackerProps) => {
  const deliveryLocation = useDeliveryTracking(orderId);
  const [deliveryStatus, setDeliveryStatus] = useState(initialStatus);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  useEffect(() => {
    setDeliveryStatus(initialStatus);
  }, [initialStatus]);

  // Subscribe to realtime delivery_status changes on this order
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`delivery-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const newStatus = (payload.new as any).delivery_status;
          if (newStatus) setDeliveryStatus(newStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // Fetch route info for ETA display
  useEffect(() => {
    if (!deliveryLocation || !deliveryStatus || deliveryStatus === 'delivered' || deliveryStatus === 'confirmed') {
      setRouteInfo(null);
      return;
    }

    let destination: { latitude: number; longitude: number } | null = null;
    if (deliveryStatus === 'accepted' && storeLocation) {
      destination = storeLocation;
    } else if ((deliveryStatus === 'picked_up' || deliveryStatus === 'in_transit') && buyerLocation) {
      destination = buyerLocation;
    }

    if (!destination) return;

    const fetchRoute = async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${deliveryLocation.longitude},${deliveryLocation.latitude};${destination!.longitude},${destination!.latitude}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
        );
        const data = await res.json();
        if (!data.routes?.length) return;
        const route = data.routes[0];
        setRouteInfo({
          distance: `${(route.distance / 1000).toFixed(1)} km`,
          duration: `${Math.ceil(route.duration / 60)} min`,
        });
      } catch {
        // silently fail
      }
    };

    fetchRoute();
  }, [deliveryLocation, deliveryStatus, storeLocation, buyerLocation]);

  const showRoute = !!deliveryLocation && !!deliveryStatus && deliveryStatus !== 'delivered' && deliveryStatus !== 'confirmed';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Live Delivery Tracking</span>
        </div>
        {deliveryStatus && (
          <Badge variant="outline" className="text-xs">
            {statusLabels[deliveryStatus] || deliveryStatus}
          </Badge>
        )}
      </div>

      {/* ETA & Route Info */}
      {routeInfo && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
          <Navigation className="h-4 w-4 text-primary shrink-0" />
          <div className="text-sm">
            <span className="font-medium">{routeInfo.distance}</span>
            <span className="text-muted-foreground mx-1">·</span>
            <span className="font-medium flex items-center gap-1 inline-flex">
              <Clock className="h-3 w-3" />
              ~{routeInfo.duration} away
            </span>
          </div>
        </div>
      )}

      {deliveryStatus !== 'confirmed' && (
        <DeliveryMap
          deliveryLocation={deliveryLocation}
          storeLocation={storeLocation}
          buyerLocation={buyerLocation}
          showRoute={showRoute}
          deliveryStatus={deliveryStatus || undefined}
          className="h-[250px]"
        />
      )}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Store
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Destination
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Delivery Person
        </span>
      </div>
    </div>
  );
};

export default DeliveryTracker;
