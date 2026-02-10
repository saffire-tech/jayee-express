import { useState, useEffect } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Package, Truck } from 'lucide-react';
import MapPicker from '@/components/maps/MapPicker';
import { haversineDistance } from '@/lib/distance';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryOptionProps {
  storeLatitude?: number | null;
  storeLongitude?: number | null;
  onDeliveryChange: (data: {
    deliveryType: 'pickup' | 'delivery';
    deliveryFee: number;
    deliveryLatitude?: number;
    deliveryLongitude?: number;
    deliveryAddress?: string;
  }) => void;
}

interface DeliveryZone {
  id: string;
  name: string;
  min_distance_km: number;
  max_distance_km: number;
  fee: number;
}

const DeliveryOption = ({ storeLatitude, storeLongitude, onDeliveryChange }: DeliveryOptionProps) => {
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [distance, setDistance] = useState<number | null>(null);
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
    }
  }, [deliveryType]);

  const storeHasCoordinates = !!(storeLatitude && storeLongitude);

  const handleLocationSelect = (lat: number, lng: number) => {
    if (!storeLatitude || !storeLongitude) return;

    const dist = haversineDistance(storeLatitude, storeLongitude, lat, lng);
    setDistance(dist);

    const zone = zones.find(z => dist >= z.min_distance_km && dist < z.max_distance_km);
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
          } ${!storeHasCoordinates ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RadioGroupItem value="delivery" id="delivery" disabled={!storeHasCoordinates} />
          <Truck className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Deliver to Me</p>
            <p className="text-xs text-muted-foreground">
              {storeHasCoordinates ? 'Set your location' : 'Store has no map location'}
            </p>
          </div>
        </Label>
      </RadioGroup>

      {deliveryType === 'delivery' && storeHasCoordinates && (
        <div className="space-y-3">
          <MapPicker onLocationSelect={handleLocationSelect} />
          {distance !== null && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p>Distance: <strong>{distance.toFixed(1)} km</strong></p>
              {noZoneMatch ? (
                <p className="text-destructive mt-1">
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
