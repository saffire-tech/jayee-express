import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN, MAPBOX_SATELLITE_STYLE } from '@/lib/mapbox';

mapboxgl.accessToken = MAPBOX_TOKEN;

interface DeliveryMapProps {
  deliveryLocation?: { latitude: number; longitude: number } | null;
  storeLocation?: { latitude: number; longitude: number } | null;
  buyerLocation?: { latitude: number; longitude: number } | null;
  className?: string;
}

const DeliveryMap = ({ deliveryLocation, storeLocation, buyerLocation, className }: DeliveryMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const deliveryMarker = useRef<mapboxgl.Marker | null>(null);
  const storeMarker = useRef<mapboxgl.Marker | null>(null);
  const buyerMarker = useRef<mapboxgl.Marker | null>(null);

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
    <div
      ref={mapContainer}
      className={`w-full h-[400px] rounded-lg overflow-hidden border border-border ${className || ''}`}
    />
  );
};

export default DeliveryMap;
