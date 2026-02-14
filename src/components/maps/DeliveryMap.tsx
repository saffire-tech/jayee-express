import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN, MAPBOX_SATELLITE_STYLE } from '@/lib/mapbox';

mapboxgl.accessToken = MAPBOX_TOKEN;

interface StoreLocation {
  name: string;
  latitude: number;
  longitude: number;
}

interface DeliveryMapProps {
  deliveryLocation?: { latitude: number; longitude: number } | null;
  storeLocations?: StoreLocation[];
  /** @deprecated Use storeLocations instead */
  storeLocation?: { latitude: number; longitude: number } | null;
  buyerLocation?: { latitude: number; longitude: number } | null;
  showRoute?: boolean;
  deliveryStatus?: string;
  className?: string;
}

const DeliveryMap = ({ deliveryLocation, storeLocations, storeLocation, buyerLocation, showRoute, deliveryStatus, className }: DeliveryMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const deliveryMarker = useRef<mapboxgl.Marker | null>(null);
  const storeMarkerRefs = useRef<mapboxgl.Marker[]>([]);
  const buyerMarker = useRef<mapboxgl.Marker | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  // Normalize storeLocations: support both old single prop and new array prop
  const allStores: StoreLocation[] = storeLocations || (storeLocation ? [{ name: 'Store', latitude: storeLocation.latitude, longitude: storeLocation.longitude }] : []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const center: [number, number] = allStores.length > 0
      ? [allStores[0].longitude, allStores[0].latitude]
      : [0, 0];

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAPBOX_SATELLITE_STYLE,
      center,
      zoom: 13,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update store markers
  useEffect(() => {
    if (!map.current) return;

    // Clear old store markers
    storeMarkerRefs.current.forEach((m) => m.remove());
    storeMarkerRefs.current = [];

    allStores.forEach((store) => {
      const m = new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat([store.longitude, store.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(store.name))
        .addTo(map.current!);
      storeMarkerRefs.current.push(m);
    });
  }, [allStores.map((s) => `${s.latitude},${s.longitude}`).join('|')]);

  // Update buyer marker
  useEffect(() => {
    if (!map.current || !buyerLocation) return;
    if (buyerMarker.current) {
      buyerMarker.current.setLngLat([buyerLocation.longitude, buyerLocation.latitude]);
    } else {
      buyerMarker.current = new mapboxgl.Marker({ color: '#22c55e' })
        .setLngLat([buyerLocation.longitude, buyerLocation.latitude])
        .setPopup(new mapboxgl.Popup().setText('Delivery Destination'))
        .addTo(map.current);
    }
  }, [buyerLocation]);

  // Update delivery person marker (real-time)
  useEffect(() => {
    if (!map.current || !deliveryLocation) return;
    if (deliveryMarker.current) {
      deliveryMarker.current.setLngLat([deliveryLocation.longitude, deliveryLocation.latitude]);
    } else {
      deliveryMarker.current = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([deliveryLocation.longitude, deliveryLocation.latitude])
        .setPopup(new mapboxgl.Popup().setText('Delivery Person'))
        .addTo(map.current);
    }
  }, [deliveryLocation]);

  // Fetch and draw multi-waypoint route
  useEffect(() => {
    if (!map.current || !showRoute || !deliveryLocation) return;

    // Build waypoints based on delivery status
    let waypoints: Array<{ lng: number; lat: number }> = [];

    if (deliveryStatus === 'accepted') {
      // Route: delivery person -> all stores (nearest-neighbor order)
      const ordered = nearestNeighborOrder(
        { lat: deliveryLocation.latitude, lng: deliveryLocation.longitude },
        allStores.map((s) => ({ lat: s.latitude, lng: s.longitude }))
      );
      waypoints = [{ lat: deliveryLocation.latitude, lng: deliveryLocation.longitude }, ...ordered];
    } else if ((deliveryStatus === 'picked_up' || deliveryStatus === 'in_transit') && buyerLocation) {
      // Route: delivery person -> buyer
      waypoints = [
        { lat: deliveryLocation.latitude, lng: deliveryLocation.longitude },
        { lat: buyerLocation.latitude, lng: buyerLocation.longitude },
      ];
    }

    if (waypoints.length < 2) return;

    const fetchRoute = async () => {
      try {
        const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
        );
        const data = await response.json();
        if (!data.routes || data.routes.length === 0) return;

        const route = data.routes[0];
        const distKm = (route.distance / 1000).toFixed(1);
        const durMin = Math.ceil(route.duration / 60);
        setRouteInfo({ distance: `${distKm} km`, duration: `${durMin} min` });

        const m = map.current;
        if (!m) return;

        const sourceData: GeoJSON.Feature = {
          type: 'Feature',
          properties: {},
          geometry: route.geometry,
        };

        if (m.getSource('route')) {
          (m.getSource('route') as mapboxgl.GeoJSONSource).setData(sourceData);
        } else {
          m.addSource('route', { type: 'geojson', data: sourceData });
          m.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 4,
              'line-dasharray': [2, 1],
            },
          });
        }
      } catch (err) {
        console.error('Failed to fetch route:', err);
      }
    };

    if (map.current.isStyleLoaded()) {
      fetchRoute();
    } else {
      map.current.once('styledata', fetchRoute);
    }
  }, [deliveryLocation, deliveryStatus, showRoute, allStores.length, buyerLocation]);

  // Fit bounds when all locations are available
  useEffect(() => {
    if (!map.current) return;
    const points: [number, number][] = [];
    allStores.forEach((s) => points.push([s.longitude, s.latitude]));
    if (buyerLocation) points.push([buyerLocation.longitude, buyerLocation.latitude]);
    if (deliveryLocation) points.push([deliveryLocation.longitude, deliveryLocation.latitude]);

    if (points.length >= 2) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((p) => bounds.extend(p));
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    }
  }, [deliveryLocation, allStores.length, buyerLocation]);

  return (
    <div className="relative">
      <div
        ref={mapContainer}
        className={`w-full h-[400px] rounded-lg overflow-hidden border border-border ${className || ''}`}
      />
      {showRoute && routeInfo && (
        <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-medium shadow border border-border">
          {routeInfo.distance} · ~{routeInfo.duration}
        </div>
      )}
    </div>
  );
};

/** Simple nearest-neighbor ordering from a start point */
function nearestNeighborOrder(
  start: { lat: number; lng: number },
  points: Array<{ lat: number; lng: number }>
): Array<{ lat: number; lng: number }> {
  if (points.length === 0) return [];
  const remaining = [...points];
  const result: Array<{ lat: number; lng: number }> = [];
  let current = start;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistanceSimple(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    current = remaining.splice(nearestIdx, 1)[0];
    result.push(current);
  }
  return result;
}

function haversineDistanceSimple(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default DeliveryMap;
