import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocationBroadcast } from '@/hooks/useDeliveryTracking';
import DeliveryMap from '@/components/maps/DeliveryMap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Navigation, Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { sendPushNotification } from '@/lib/pushNotifications';

interface ActiveDeliveryProps {
  orderId: string;
  onComplete: () => void;
}

const statusProgression = ['accepted', 'picked_up', 'in_transit', 'delivered'] as const;
const statusLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  accepted: { label: 'Head to Store', icon: <Navigation className="h-4 w-4" /> },
  picked_up: { label: 'Picked Up', icon: <Package className="h-4 w-4" /> },
  in_transit: { label: 'In Transit', icon: <Truck className="h-4 w-4" /> },
  delivered: { label: 'Delivered', icon: <CheckCircle className="h-4 w-4" /> },
};

const ActiveDelivery = ({ orderId, onComplete }: ActiveDeliveryProps) => {
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [updating, setUpdating] = useState(false);
  const { startBroadcasting, stopBroadcasting } = useLocationBroadcast(orderId);

  useEffect(() => {
    const fetchOrder = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, store_id')
        .eq('id', orderId)
        .maybeSingle();

      if (data) {
        const { data: store } = await supabase
          .from('stores')
          .select('name, latitude, longitude, location')
          .eq('id', data.store_id)
          .maybeSingle();
        setOrder({ ...data, store });
      }
    };
    fetchOrder();
    startBroadcasting();

    // Track current position for the map
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      undefined,
      { enableHighAccuracy: true }
    );

    return () => {
      stopBroadcasting();
      navigator.geolocation.clearWatch(watchId);
    };
  }, [orderId]);

  // Subscribe to real-time updates for buyer confirmation
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`delivery-confirm-${orderId}`)
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
          if (newStatus === 'confirmed') {
            stopBroadcasting();
            toast.success('Buyer confirmed receipt! Delivery complete.');
            setTimeout(() => onComplete(), 500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const handleStatusUpdate = async () => {
    if (!order) return;
    const currentIdx = statusProgression.indexOf(order.delivery_status);
    if (currentIdx >= statusProgression.length - 1) return;

    const nextStatus = statusProgression[currentIdx + 1];
    setUpdating(true);

    try {
      // Only update delivery_status; do NOT set main status to delivered yet
      const { error } = await supabase
        .from('orders')
        .update({ delivery_status: nextStatus })
        .eq('id', orderId);

      if (error) throw error;
      setOrder({ ...order, delivery_status: nextStatus });

      if (nextStatus === 'delivered') {
        toast.success('Marked as delivered! Waiting for buyer to confirm receipt.');
        // Send push notification to buyer
        if (order.buyer_id) {
          sendPushNotification(order.buyer_id, {
            title: '📦 Your order has been delivered!',
            body: 'Please confirm you received the item by tapping here.',
            tag: `delivery-${orderId}`,
            data: { type: 'order', url: '/purchase-history' },
          });
        }
      } else {
        toast.success(`Status updated to: ${statusLabels[nextStatus].label}`);
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  if (!order) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const currentIdx = statusProgression.indexOf(order.delivery_status);
  const nextStatus = currentIdx < statusProgression.length - 1 ? statusProgression[currentIdx + 1] : null;
  const isWaitingConfirmation = order.delivery_status === 'delivered';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{order.store?.name || 'Order'}</CardTitle>
            <Badge>{statusLabels[order.delivery_status]?.label || order.delivery_status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status progression */}
          <div className="flex items-center justify-between gap-1">
            {statusProgression.map((step, idx) => {
              const isCompleted = idx <= currentIdx;
              return (
                <div key={step} className="flex-1 flex flex-col items-center">
                  <div className="flex items-center w-full">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {statusLabels[step].icon}
                    </div>
                    {idx < statusProgression.length - 1 && (
                      <div className={`flex-1 h-1 mx-1 rounded ${idx < currentIdx ? 'bg-primary' : 'bg-muted'}`} />
                    )}
                  </div>
                  <span className="text-xs mt-1 text-center">{statusLabels[step].label}</span>
                </div>
              );
            })}
          </div>

          <DeliveryMap
            deliveryLocation={currentPosition}
            storeLocation={order.store?.latitude && order.store?.longitude ? { latitude: order.store.latitude, longitude: order.store.longitude } : null}
            buyerLocation={order.delivery_latitude && order.delivery_longitude ? { latitude: order.delivery_latitude, longitude: order.delivery_longitude } : null}
            showRoute={!isWaitingConfirmation}
            deliveryStatus={order.delivery_status}
            className="h-[350px]"
          />

          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Store</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Destination</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> You</span>
          </div>

          {isWaitingConfirmation ? (
            <div className="flex items-center gap-2 justify-center py-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <Clock className="h-4 w-4 animate-pulse" />
              Waiting for buyer to confirm receipt...
            </div>
          ) : nextStatus ? (
            <Button onClick={handleStatusUpdate} disabled={updating} className="w-full" size="lg">
              {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : statusLabels[nextStatus].icon}
              <span className="ml-2">Mark as {statusLabels[nextStatus].label}</span>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActiveDelivery;
