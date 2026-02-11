import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN, MAPBOX_SATELLITE_STYLE } from '@/lib/mapbox';

mapboxgl.accessToken = MAPBOX_TOKEN;

interface DeliveryMapProps {
  deliveryLocation?: { latitude: number; longitude: number } | null;
  storeLocation?: { latitude: number; longitude: number } | null;
  buyerLocation?: { latitude: number; longitude: number } | null;
  showRoute?: boolean;
  deliveryStatus?: string;
  className?: string;
}

const DeliveryMap = ({ deliveryLocation, storeLocation, buyerLocation, showRoute, deliveryStatus, className }: DeliveryMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const deliveryMarker = useRef<mapboxgl.Marker | null>(null);
  const storeMarker = useRef<mapboxgl.Marker | null>(null);
  const buyerMarker = useRef<mapboxgl.Marker | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const center: [number, number] = storeLocation
      ? [storeLocation.longitude, storeLocation.latitude]
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

  // Update store marker
  useEffect(() => {
    if (!map.current || !storeLocation) return;
    if (storeMarker.current) {
      storeMarker.current.setLngLat([storeLocation.longitude, storeLocation.latitude]);
    } else {
      storeMarker.current = new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat([storeLocation.longitude, storeLocation.latitude])
        .setPopup(new mapboxgl.Popup().setText('Store (Pickup)'))
        .addTo(map.current);
    }
  }, [storeLocation]);

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

  // Fetch and draw route
  useEffect(() => {
    if (!map.current || !showRoute || !deliveryLocation) return;

    // Determine destination based on delivery status
    let destination: { latitude: number; longitude: number } | null = null;
    if (deliveryStatus === 'accepted' && storeLocation) {
      destination = storeLocation;
    } else if ((deliveryStatus === 'picked_up' || deliveryStatus === 'in_transit') && buyerLocation) {
      destination = buyerLocation;
    }

    if (!destination) return;

    const fetchRoute = async () => {
      try {
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${deliveryLocation.longitude},${deliveryLocation.latitude};${destination!.longitude},${destination!.latitude}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
        );
        const data = await response.json();
        if (!data.routes || data.routes.length === 0) return;

        const route = data.routes[0];
        const geojson = route.geometry;

        // Distance in km, duration in minutes
        const distKm = (route.distance / 1000).toFixed(1);
        const durMin = Math.ceil(route.duration / 60);
        setRouteInfo({ distance: `${distKm} km`, duration: `${durMin} min` });

        const m = map.current;
        if (!m) return;

        const sourceData: GeoJSON.Feature = {
          type: 'Feature',
          properties: {},
          geometry: geojson,
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

    // Wait for map style to load before adding layers
    if (map.current.isStyleLoaded()) {
      fetchRoute();
    } else {
      map.current.once('styledata', fetchRoute);
    }
  }, [deliveryLocation, deliveryStatus, showRoute, storeLocation, buyerLocation]);

  // Fit bounds when all locations are available
  useEffect(() => {
    if (!map.current) return;
    const points: [number, number][] = [];
    if (storeLocation) points.push([storeLocation.longitude, storeLocation.latitude]);
    if (buyerLocation) points.push([buyerLocation.longitude, buyerLocation.latitude]);
    if (deliveryLocation) points.push([deliveryLocation.longitude, deliveryLocation.latitude]);

    if (points.length >= 2) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((p) => bounds.extend(p));
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    }
  }, [deliveryLocation, storeLocation, buyerLocation]);

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

export default DeliveryMap;
