import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { haversineDistance } from '@/lib/distance';
import { MAPBOX_TOKEN, MAPBOX_SATELLITE_STYLE } from '@/lib/mapbox';
import { MapPin, Package, Loader2, LocateOff, X, Navigation, Clock } from 'lucide-react';
import { toast } from 'sonner';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = MAPBOX_TOKEN;

interface AvailableOrder {
  id: string;
  total_amount: number;
  delivery_fee: number;
  delivery_latitude: number;
  delivery_longitude: number;
  delivery_address: string | null;
  delivery_landmark?: string | null;
  created_at: string;
  store_id: string;
  store: {
    name: string;
    latitude: number | null;
    longitude: number | null;
    location: string | null;
  } | null;
}

interface OrderDetail {
  items: { name: string; quantity: number; price: number; image_url: string | null }[];
  route: { distance: number; duration: number; geometry: any } | null;
}

interface AvailableOrdersProps {
  onAccept: (orderId: string) => void;
  isOnline?: boolean;
}

const AvailableOrders = ({ onAccept, isOnline = true }: AvailableOrdersProps) => {
  const { user, profile } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [orders, setOrders] = useState<AvailableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AvailableOrder | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Track GPS
  useEffect(() => {
    if (!navigator.geolocation) { setLocationError(true); return; }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => { setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocationError(false); },
      () => setLocationError(true),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const fetchOrders = async () => {
    let query = supabase
      .from('orders')
      .select('id, total_amount, delivery_fee, delivery_latitude, delivery_longitude, delivery_address, delivery_landmark, created_at, store_id')
      .eq('delivery_type', 'delivery')
      .eq('delivery_status', 'pending')
      .is('delivery_person_id', null);
    if (profile?.city) query = query.eq('city', profile.city);
    const { data, error } = await query;

    if (error) { console.error(error); setLoading(false); return; }

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
    if (!isOnline) { setOrders([]); setLoading(false); return; }
    fetchOrders();
    const channel = supabase
      .channel('available-deliveries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isOnline, profile?.city]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || locationError) return;
    const center = userPos || { lat: 6.6745, lng: -1.5716 }; // Default: Kumasi
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAPBOX_SATELLITE_STYLE,
      center: [center.lng, center.lat],
      zoom: 13,
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [locationError]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // User marker
    if (userPos) {
      const el = document.createElement('div');
      el.className = 'w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg';
      const marker = new mapboxgl.Marker(el).setLngLat([userPos.lng, userPos.lat]).addTo(map);
      markersRef.current.push(marker);
    }

    // Order markers (store locations)
    orders.forEach((order) => {
      if (!order.store?.latitude || !order.store?.longitude) return;
      const el = document.createElement('div');
      el.className = 'w-8 h-8 bg-primary rounded-full border-2 border-white shadow-lg flex items-center justify-center cursor-pointer';
      el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.backgroundColor = 'hsl(var(--primary))';

      el.addEventListener('click', () => {
        setSelectedOrder(order);
        loadOrderDetail(order);
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([order.store.longitude, order.store.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Fit bounds
    if (orders.length > 0 || userPos) {
      const bounds = new mapboxgl.LngLatBounds();
      if (userPos) bounds.extend([userPos.lng, userPos.lat]);
      orders.forEach(o => {
        if (o.store?.latitude && o.store?.longitude) bounds.extend([o.store.longitude, o.store.latitude]);
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }
  }, [orders, userPos]);

  // Draw route when order selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing route layer
    if (map.getSource('route')) {
      map.removeLayer('route-line');
      map.removeSource('route');
    }

    if (orderDetail?.route?.geometry) {
      map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: orderDetail.route.geometry } });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.8 },
      });
    }
  }, [orderDetail]);

  const loadOrderDetail = async (order: AvailableOrder) => {
    setLoadingDetail(true);
    setOrderDetail(null);

    // Fetch order items
    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, price, product_id')
      .eq('order_id', order.id);

    const itemsWithProducts = await Promise.all(
      (items || []).map(async (item) => {
        const { data: product } = await supabase.from('products').select('name, image_url').eq('id', item.product_id).maybeSingle();
        return { name: product?.name || 'Unknown', quantity: item.quantity, price: Number(item.price), image_url: product?.image_url || null };
      })
    );

    // Fetch route: driver → store → buyer
    let route = null;
    if (userPos && order.store?.latitude && order.store?.longitude) {
      try {
        const coords = `${userPos.lng},${userPos.lat};${order.store.longitude},${order.store.latitude};${order.delivery_longitude},${order.delivery_latitude}`;
        const res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`);
        const data = await res.json();
        if (data.routes?.[0]) {
          route = {
            distance: data.routes[0].distance / 1000, // km
            duration: data.routes[0].duration / 60, // minutes
            geometry: data.routes[0].geometry,
          };
        }
      } catch (e) { console.error('Route fetch error', e); }
    }

    setOrderDetail({ items: itemsWithProducts, route });
    setLoadingDetail(false);
  };

  const handleAccept = async (orderId: string) => {
    if (!user) return;
    if (!isOnline) { toast.error('Go online to accept deliveries'); return; }
    setAccepting(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ delivery_person_id: user.id, delivery_status: 'accepted' })
        .eq('id', orderId)
        .is('delivery_person_id', null);
      if (error) throw error;
      toast.success('Delivery accepted!');
      onAccept(orderId);
    } catch {
      toast.error('Failed to accept delivery. It may have been taken.');
    } finally {
      setAccepting(null);
    }
  };

  const closeDetail = useCallback(() => {
    setSelectedOrder(null);
    setOrderDetail(null);
    // Remove route
    const map = mapRef.current;
    if (map?.getSource('route')) {
      map.removeLayer('route-line');
      map.removeSource('route');
    }
  }, []);

  if (!isOnline) {
    return (
      <div className="text-center py-12 border rounded-xl bg-card">
        <LocateOff className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold">You're offline</h3>
        <p className="text-sm text-muted-foreground">Turn on online mode to start receiving deliveries</p>
      </div>
    );
  }

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

  return (
    <div className="space-y-4">
      {/* Map section */}
      {!locationError && (
        <div className="relative" style={{ height: '50vh', minHeight: '300px' }}>
          <div ref={mapContainerRef} className="w-full h-full rounded-xl overflow-hidden" />

          {/* Order count badge */}
          <div className="absolute top-3 left-3 z-10">
            <Badge className="bg-background/90 text-foreground backdrop-blur-sm border shadow-md px-3 py-1.5">
              <Package className="h-3.5 w-3.5 mr-1.5" />
              {orders.length} available
            </Badge>
          </div>

          {/* Bottom sheet for selected order */}
          {selectedOrder && (
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-card border-t border-border rounded-t-2xl shadow-2xl max-h-[60%] overflow-y-auto animate-in slide-in-from-bottom">
              <div className="p-4">
                <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-3" />
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{selectedOrder.store?.name || 'Unknown Store'}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {selectedOrder.store?.location || 'No location'}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={closeDetail}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {loadingDetail ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading route & items...
                  </div>
                ) : (
                  <>
                    {orderDetail?.route && (
                      <div className="flex gap-3 mb-3">
                        <Badge variant="secondary" className="gap-1">
                          <Navigation className="h-3 w-3" />
                          {orderDetail.route.distance.toFixed(1)} km
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          ~{Math.ceil(orderDetail.route.duration)} min
                        </Badge>
                      </div>
                    )}
                    {orderDetail?.items && orderDetail.items.length > 0 && (
                      <div className="mb-3 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Order Items</p>
                        {orderDetail.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="w-8 h-8 rounded object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <span className="flex-1 line-clamp-1">{item.quantity}x {item.name}</span>
                            <span className="text-muted-foreground">₵{(item.quantity * item.price).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="outline" className="text-primary border-primary text-base px-3 py-1">
                    Fee: ₵{Number(selectedOrder.delivery_fee).toLocaleString()}
                  </Badge>
                  <Badge variant="secondary">
                    Order: ₵{Number(selectedOrder.total_amount).toLocaleString()}
                  </Badge>
                </div>

                {selectedOrder.delivery_address && (
                  <p className="text-sm text-muted-foreground mb-1">
                    <MapPin className="h-3 w-3 inline mr-1" />
                    Deliver to: {selectedOrder.delivery_address}
                  </p>
                )}
                {selectedOrder.delivery_landmark && (
                  <p className="text-sm text-muted-foreground mb-3">
                    <span className="font-medium">Landmark:</span> {selectedOrder.delivery_landmark}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => handleAccept(selectedOrder.id)} disabled={accepting === selectedOrder.id}>
                    {accepting === selectedOrder.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Accept Delivery
                  </Button>
                  <Button variant="outline" onClick={closeDetail}>Close</Button>
                </div>
              </div>
            </div>
          )}

          {orders.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold">No deliveries available</h3>
                <p className="text-sm text-muted-foreground">Check back later for new delivery requests</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* List view - always visible as fallback */}
      {orders.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground px-1">
            {orders.length} Available Deliver{orders.length === 1 ? 'y' : 'ies'}
          </h3>
          {orders.map((order) => {
            const dist = userPos && order.store?.latitude && order.store?.longitude
              ? haversineDistance(userPos.lat, userPos.lng, order.store.latitude, order.store.longitude)
              : null;
            return (
              <div
                key={order.id}
                className="bg-card border rounded-xl p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{order.store?.name || 'Unknown Store'}</p>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{order.delivery_address || order.store?.location || 'No address'}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant="outline" className="text-primary border-primary">
                      Fee: ₵{Number(order.delivery_fee).toLocaleString()}
                    </Badge>
                    {dist !== null && (
                      <span className="text-xs text-muted-foreground">{dist.toFixed(1)} km away</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAccept(order.id)}
                  disabled={accepting === order.id}
                >
                  {accepting === order.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Accept'
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {orders.length === 0 && locationError && (
        <div className="text-center py-12">
          <LocateOff className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">No deliveries available</h3>
          <p className="text-sm text-muted-foreground">Enable location for a better experience</p>
        </div>
      )}
    </div>
  );
};

export default AvailableOrders;
