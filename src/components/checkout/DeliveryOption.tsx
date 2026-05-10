import { useState, useEffect, useMemo } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Package, Truck } from 'lucide-react';
import MapPicker from '@/components/maps/MapPicker';
import { haversineDistance } from '@/lib/distance';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { MapPin } from 'lucide-react';

interface StoreInfo {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

interface DeliveryOptionProps {
  stores: StoreInfo[];
  onDeliveryChange: (data: {
    deliveryType: 'pickup' | 'delivery';
    deliveryFee: number;
    deliveryLatitude?: number;
    deliveryLongitude?: number;
    deliveryAddress?: string;
    deliveryLandmark?: string;
  }) => void;
}

interface DeliveryZone {
  id: string;
  name: string;
  min_distance_km: number;
  max_distance_km: number;
  fee: number;
}

/**
 * Nearest-neighbor ordering: start from first store, visit nearest unvisited, then buyer.
 * Returns ordered stores and total route distance.
 */
function computeRouteDistance(
  stores: Array<{ name: string; latitude: number; longitude: number }>,
  buyerLat: number,
  buyerLng: number
): { orderedStores: typeof stores; totalDistance: number } {
  if (stores.length === 0) return { orderedStores: [], totalDistance: 0 };
  if (stores.length === 1) {
    const dist = haversineDistance(stores[0].latitude, stores[0].longitude, buyerLat, buyerLng);
    return { orderedStores: stores, totalDistance: dist };
  }

  const remaining = [...stores];
  const ordered: typeof stores = [];
  let current = remaining.shift()!;
  ordered.push(current);

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistance(current.latitude, current.longitude, remaining[i].latitude, remaining[i].longitude);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    current = remaining.splice(nearestIdx, 1)[0];
    ordered.push(current);
  }

  // Sum distances along the chain + last store to buyer
  let total = 0;
  for (let i = 0; i < ordered.length - 1; i++) {
    total += haversineDistance(ordered[i].latitude, ordered[i].longitude, ordered[i + 1].latitude, ordered[i + 1].longitude);
  }
  total += haversineDistance(ordered[ordered.length - 1].latitude, ordered[ordered.length - 1].longitude, buyerLat, buyerLng);

  return { orderedStores: ordered, totalDistance: total };
}

const DeliveryOption = ({ stores, onDeliveryChange }: DeliveryOptionProps) => {
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [routeInfo, setRouteInfo] = useState<{ totalDistance: number; orderedStores: Array<{ name: string }> } | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [noZoneMatch, setNoZoneMatch] = useState(false);

  useEffect(() => {
    const fetchZones = async () => {
      const { data } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('is_active', true)
        .order('min_distance_km', { ascending: true });
      setZones((data as DeliveryZone[]) || []);
    };
    fetchZones();
  }, []);

  useEffect(() => {
    if (deliveryType === 'pickup') {
      onDeliveryChange({ deliveryType: 'pickup', deliveryFee: 0 });
      setRouteInfo(null);
    }
  }, [deliveryType]);

  // Filter stores that have valid coordinates
  const storesWithCoords = useMemo(
    () => stores.filter((s): s is StoreInfo & { latitude: number; longitude: number } => !!(s.latitude && s.longitude)),
    [stores]
  );

  const hasDeliveryStores = storesWithCoords.length > 0;

  // Store markers for MapPicker
  const storeMarkers = useMemo(
    () => storesWithCoords.map((s) => ({ name: s.name, latitude: s.latitude, longitude: s.longitude })),
    [storesWithCoords]
  );

  const handleLocationSelect = (lat: number, lng: number) => {
    if (storesWithCoords.length === 0) return;

    const { orderedStores, totalDistance } = computeRouteDistance(
      storesWithCoords.map((s) => ({ name: s.name, latitude: s.latitude, longitude: s.longitude })),
      lat,
      lng
    );

    setRouteInfo({ totalDistance, orderedStores });

    const zone = zones.find((z) => totalDistance >= z.min_distance_km && totalDistance < z.max_distance_km);
    if (zone) {
      setDeliveryFee(zone.fee);
      setNoZoneMatch(false);
      onDeliveryChange({
        deliveryType: 'delivery',
        deliveryFee: zone.fee,
        deliveryLatitude: lat,
        deliveryLongitude: lng,
      });
    } else {
      setDeliveryFee(0);
      setNoZoneMatch(true);
      onDeliveryChange({
        deliveryType: 'delivery',
        deliveryFee: 0,
        deliveryLatitude: lat,
        deliveryLongitude: lng,
      });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-base">Delivery Option</h3>
      <RadioGroup
        value={deliveryType}
        onValueChange={(v) => setDeliveryType(v as 'pickup' | 'delivery')}
        className="grid grid-cols-2 gap-3"
      >
        <Label
          htmlFor="pickup"
          className={`flex items-center gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${
            deliveryType === 'pickup' ? 'border-primary bg-primary/5' : 'border-border'
          }`}
        >
          <RadioGroupItem value="pickup" id="pickup" />
          <Package className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Pick Up</p>
            <p className="text-xs text-muted-foreground">Collect from store</p>
          </div>
        </Label>
        <Label
          htmlFor="delivery"
          className={`flex items-center gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${
            deliveryType === 'delivery' ? 'border-primary bg-primary/5' : 'border-border'
          } ${!hasDeliveryStores ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RadioGroupItem value="delivery" id="delivery" disabled={!hasDeliveryStores} />
          <Truck className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Deliver to Me</p>
            <p className="text-xs text-muted-foreground">
              {hasDeliveryStores ? 'Set your location' : 'No store map locations'}
            </p>
          </div>
        </Label>
      </RadioGroup>

      {deliveryType === 'delivery' && hasDeliveryStores && (
        <div className="space-y-3">
          <MapPicker onLocationSelect={handleLocationSelect} storeMarkers={storeMarkers} />
          {routeInfo && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p className="text-xs text-muted-foreground">
                Route: {routeInfo.orderedStores.map((s) => s.name).join(' → ')} → You
              </p>
              <p>Total route: <strong>{routeInfo.totalDistance.toFixed(1)} km</strong> across {storesWithCoords.length} store{storesWithCoords.length > 1 ? 's' : ''}</p>
              {noZoneMatch ? (
                <p className="text-destructive">
                  Delivery not available for this distance. Please choose a closer location.
                </p>
              ) : (
                <p>Delivery Fee: <strong className="text-primary">₵{deliveryFee.toLocaleString()}</strong></p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryOption;
