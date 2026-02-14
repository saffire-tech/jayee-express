import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN, MAPBOX_SATELLITE_STYLE } from '@/lib/mapbox';
import { Input } from '@/components/ui/input';
import { MapPin, Search } from 'lucide-react';

mapboxgl.accessToken = MAPBOX_TOKEN;

interface StoreMarker {
  name: string;
  latitude: number;
  longitude: number;
}

interface MapPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationSelect: (lat: number, lng: number) => void;
  storeMarkers?: StoreMarker[];
  className?: string;
}

const MapPicker = ({ latitude, longitude, onLocationSelect, storeMarkers, className }: MapPickerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const storeMarkerRefs = useRef<mapboxgl.Marker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const defaultLat = latitude || 5.6037;
  const defaultLng = longitude || -0.1870;

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAPBOX_SATELLITE_STYLE,
      center: [defaultLng, defaultLat],
      zoom: latitude ? 15 : 6,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      'top-right'
    );

    // Add initial marker if coordinates exist
    if (latitude && longitude) {
      marker.current = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([longitude, latitude])
        .addTo(map.current);
    }

    // Click to place marker
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      if (marker.current) {
        marker.current.setLngLat([lng, lat]);
      } else {
        marker.current = new mapboxgl.Marker({ color: '#ef4444' })
          .setLngLat([lng, lat])
          .addTo(map.current!);
      }
      onLocationSelect(lat, lng);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Render store markers when provided
  useEffect(() => {
    if (!map.current) return;

    // Clear existing store markers
    storeMarkerRefs.current.forEach((m) => m.remove());
    storeMarkerRefs.current = [];

    if (!storeMarkers || storeMarkers.length === 0) return;

    storeMarkers.forEach((store) => {
      const m = new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat([store.longitude, store.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(store.name))
        .addTo(map.current!);
      storeMarkerRefs.current.push(m);
    });

    // Fit bounds to show all store markers
    if (storeMarkers.length > 0 && !marker.current) {
      const bounds = new mapboxgl.LngLatBounds();
      storeMarkers.forEach((s) => bounds.extend([s.longitude, s.latitude]));
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }
  }, [storeMarkers]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !map.current) return;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
      );
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        map.current.flyTo({ center: [lng, lat], zoom: 15 });
        if (marker.current) {
          marker.current.setLngLat([lng, lat]);
        } else {
          marker.current = new mapboxgl.Marker({ color: '#ef4444' })
            .setLngLat([lng, lat])
            .addTo(map.current);
        }
        onLocationSelect(lat, lng);
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
  };

  return (
    <div className={className}>
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a location..."
            className="pl-9"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Search
        </button>
      </div>
      <div
        ref={mapContainer}
        className="w-full h-[300px] rounded-lg overflow-hidden border border-border"
      />
      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        Click on the map to set your delivery location
      </p>
    </div>
  );
};

export default MapPicker;
