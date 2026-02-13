import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { haversineDistance } from '@/lib/distance';
import { MapPin, Package, Loader2, Navigation, LocateOff } from 'lucide-react';
import { toast } from 'sonner';

interface AvailableOrder {
  id: string;
  total_amount: number;
  delivery_fee: number;
  delivery_latitude: number;
  delivery_longitude: number;
  delivery_address: string | null;
  created_at: string;
  store: {
    name: string;
    latitude: number | null;
    longitude: number | null;
    location: string | null;
  } | null;
}

interface AvailableOrdersProps {
  onAccept: (orderId: string) => void;
}

const AvailableOrders = ({ onAccept }: AvailableOrdersProps) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<AvailableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState(false);

  // Track delivery person's GPS
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError(false);
      },
      () => setLocationError(true),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, total_amount, delivery_fee, delivery_latitude, delivery_longitude, delivery_address, created_at, store_id')
      .eq('delivery_type', 'delivery')
      .eq('delivery_status', 'pending')
      .is('delivery_person_id', null);

    if (error) {
      console.error('Error fetching available orders:', error);
      setLoading(false);
      return;
    }

    const ordersWithStores = await Promise.all(
      (data || []).map(async (order) => {
        const { data: store } = await supabase
          .from('stores')
          .select('name, latitude, longitude, location')
          .eq('id', order.store_id)
          .maybeSingle();
        return { ...order, store } as AvailableOrder;
      })
    );

    setOrders(ordersWithStores);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('available-deliveries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Sort orders by proximity to delivery person
  const sortedOrders = useMemo(() => {
    if (!userPos) return orders;
    return [...orders].sort((a, b) => {
      const distA = a.store?.latitude != null && a.store?.longitude != null
        ? haversineDistance(userPos.lat, userPos.lng, a.store.latitude, a.store.longitude)
        : Infinity;
      const distB = b.store?.latitude != null && b.store?.longitude != null
        ? haversineDistance(userPos.lat, userPos.lng, b.store.latitude, b.store.longitude)
        : Infinity;
      return distA - distB;
    });
  }, [orders, userPos]);

  const handleAccept = async (orderId: string) => {
    if (!user) return;
    setAccepting(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          delivery_person_id: user.id,
          delivery_status: 'accepted',
        })
        .eq('id', orderId)
        .is('delivery_person_id', null);

      if (error) throw error;
      toast.success('Delivery accepted!');
      onAccept(orderId);
      fetchOrders();
    } catch {
      toast.error('Failed to accept delivery. It may have been taken.');
    } finally {
      setAccepting(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (locationError) {
    return (
      <div className="text-center py-12">
        <LocateOff className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold">Location access needed</h3>
        <p className="text-sm text-muted-foreground">Please enable location permissions to see nearby deliveries</p>
      </div>
    );
  }

  if (sortedOrders.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold">No deliveries available</h3>
        <p className="text-sm text-muted-foreground">Check back later for new delivery requests</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedOrders.map((order) => {
        const distToStore = userPos && order.store?.latitude != null && order.store?.longitude != null
          ? haversineDistance(userPos.lat, userPos.lng, order.store.latitude, order.store.longitude)
          : null;

        const deliveryDist = order.store?.latitude != null && order.store?.longitude != null
          ? haversineDistance(order.store.latitude, order.store.longitude, order.delivery_latitude, order.delivery_longitude)
          : null;

        return (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <p className="font-semibold">{order.store?.name || 'Unknown Store'}</p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {order.store?.location || 'No location'}
                  </div>
                  {distToStore !== null && (
                    <div className="flex items-center gap-1 text-sm font-medium text-primary">
                      <Navigation className="h-3 w-3" />
                      {distToStore.toFixed(1)} km from you
                    </div>
                  )}
                  {deliveryDist !== null && (
                    <p className="text-sm text-muted-foreground">Delivery distance: {deliveryDist.toFixed(1)} km</p>
                  )}
                  <div className="flex gap-3 mt-2">
                    <Badge variant="secondary">Order: ₵{Number(order.total_amount).toLocaleString()}</Badge>
                    <Badge variant="outline" className="text-primary border-primary">Fee: ₵{Number(order.delivery_fee).toLocaleString()}</Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAccept(order.id)}
                  disabled={accepting === order.id}
                >
                  {accepting === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept'}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AvailableOrders;
