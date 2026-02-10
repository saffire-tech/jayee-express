import DeliveryMap from '@/components/maps/DeliveryMap';
import { useDeliveryTracking } from '@/hooks/useDeliveryTracking';
import { Badge } from '@/components/ui/badge';
import { Truck } from 'lucide-react';

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
  delivered: 'Delivered',
};

const DeliveryTracker = ({ orderId, storeLocation, buyerLocation, deliveryStatus }: DeliveryTrackerProps) => {
  const deliveryLocation = useDeliveryTracking(orderId);

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
      <DeliveryMap
        deliveryLocation={deliveryLocation}
        storeLocation={storeLocation}
        buyerLocation={buyerLocation}
        className="h-[250px]"
      />
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
