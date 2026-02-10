import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DeliveryLocation {
  latitude: number;
  longitude: number;
  updated_at: string;
}

export function useDeliveryTracking(orderId: string | null) {
  const [location, setLocation] = useState<DeliveryLocation | null>(null);

  useEffect(() => {
    if (!orderId) return;

    // Fetch initial location
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('delivery_locations')
        .select('latitude, longitude, updated_at')
        .eq('order_id', orderId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setLocation(data);
    };
    fetchInitial();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`delivery-tracking-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_locations',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData) {
            setLocation({
              latitude: newData.latitude,
              longitude: newData.longitude,
              updated_at: newData.updated_at,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return location;
}

/**
 * Hook for the delivery person to broadcast their GPS location.
 */
export function useLocationBroadcast(orderId: string | null) {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationIdRef = useRef<string | null>(null);

  const startBroadcasting = useCallback(() => {
    if (!orderId || !user || !navigator.geolocation) return;

    const sendLocation = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const payload = {
            user_id: user.id,
            order_id: orderId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            updated_at: new Date().toISOString(),
          };

          if (locationIdRef.current) {
            await supabase
              .from('delivery_locations')
              .update({
                latitude: payload.latitude,
                longitude: payload.longitude,
                updated_at: payload.updated_at,
              })
              .eq('id', locationIdRef.current);
          } else {
            const { data } = await supabase
              .from('delivery_locations')
              .insert(payload)
              .select('id')
              .single();
            if (data) locationIdRef.current = data.id;
          }
        },
        (err) => console.error('Geolocation error:', err),
        { enableHighAccuracy: true }
      );
    };

    sendLocation();
    intervalRef.current = setInterval(sendLocation, 5000);
  }, [orderId, user]);

  const stopBroadcasting = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopBroadcasting();
  }, [stopBroadcasting]);

  return { startBroadcasting, stopBroadcasting };
}
