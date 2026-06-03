import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN, MAPBOX_SATELLITE_STYLE } from '@/lib/mapbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Search, Users, Map as MapIcon, Plus, X, Crosshair, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { haversineDistance } from '@/lib/distance';
import { toast } from 'sonner';

mapboxgl.accessToken = MAPBOX_TOKEN;

interface StoreMarker {
  name: string;
  latitude: number;
  longitude: number;
}

interface CommunityPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  usage_count: number;
}

interface MapboxResult {
  place_name: string;
  center: [number, number];
}

interface MapPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationSelect: (lat: number, lng: number) => void;
  storeMarkers?: StoreMarker[];
  className?: string;
  enableCommunityContributions?: boolean;
}

const MapPicker = ({
  latitude,
  longitude,
  onLocationSelect,
  storeMarkers,
  className,
  enableCommunityContributions = true,
}: MapPickerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const storeMarkerRefs = useRef<mapboxgl.Marker[]>([]);
  const reqIdRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [communityResults, setCommunityResults] = useState<CommunityPin[]>([]);
  const [mapboxResults, setMapboxResults] = useState<MapboxResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Save-as-pin form state
  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number; suggestedName?: string } | null>(null);
  const [pinName, setPinName] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const defaultLat = latitude || 5.6037;
  const defaultLng = longitude || -0.1870;

  const placeMarker = useCallback((lat: number, lng: number) => {
    if (!map.current) return;
    if (marker.current) {
      marker.current.setLngLat([lng, lat]);
    } else {
      marker.current = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([lng, lat])
        .addTo(map.current);
    }
  }, []);

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

    if (latitude && longitude) {
      placeMarker(latitude, longitude);
    }

    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      placeMarker(lat, lng);
      onLocationSelect(lat, lng);
      if (enableCommunityContributions && user) {
        setPendingPin({ lat, lng });
        setPinName('');
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current) return;
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

    if (storeMarkers.length > 0 && !marker.current) {
      const bounds = new mapboxgl.LngLatBounds();
      storeMarkers.forEach((s) => bounds.extend([s.longitude, s.latitude]));
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }
  }, [storeMarkers]);

  // Debounced suggestion fetcher
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setCommunityResults([]);
      setMapboxResults([]);
      setLoadingSuggestions(false);
      return;
    }
    setLoadingSuggestions(true);
    debounceRef.current = window.setTimeout(async () => {
      const myReq = ++reqIdRef.current;
      try {
        const [communityRes, mapboxRes] = await Promise.all([
          supabase
            .from('community_locations')
            .select('id, name, latitude, longitude, usage_count')
            .ilike('name_lower', `%${q.toLowerCase()}%`)
            .order('usage_count', { ascending: false })
            .limit(6),
          fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&country=gh&proximity=-0.1870,5.6037&limit=4`
          ).then((r) => r.json()),
        ]);
        if (myReq !== reqIdRef.current) return;
        setCommunityResults((communityRes.data as CommunityPin[]) || []);
        setMapboxResults(
          (mapboxRes?.features || []).map((f: any) => ({ place_name: f.place_name, center: f.center }))
        );
      } catch (err) {
        console.error('Suggestion fetch error:', err);
      } finally {
        if (myReq === reqIdRef.current) setLoadingSuggestions(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const selectCommunity = (pin: CommunityPin) => {
    if (!map.current) return;
    map.current.flyTo({ center: [pin.longitude, pin.latitude], zoom: 16 });
    placeMarker(pin.latitude, pin.longitude);
    onLocationSelect(pin.latitude, pin.longitude);
    setShowSuggestions(false);
    setSearchQuery(pin.name);
    supabase.rpc('bump_location_usage', { _id: pin.id }).then(() => {});
  };

  const selectMapbox = (res: MapboxResult) => {
    if (!map.current) return;
    const [lng, lat] = res.center;
    map.current.flyTo({ center: [lng, lat], zoom: 15 });
    placeMarker(lat, lng);
    onLocationSelect(lat, lng);
    setShowSuggestions(false);
    setSearchQuery(res.place_name);
    if (enableCommunityContributions && user) {
      const short = res.place_name.split(',')[0];
      setPendingPin({ lat, lng, suggestedName: short });
      setPinName(short);
    }
  };

  const savePin = async () => {
    if (!pendingPin || !user) return;
    const name = pinName.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80) {
      toast.error('Name must be 2–80 characters');
      return;
    }
    setSavingPin(true);
    try {
      // Check for a near-duplicate (~50m, same name)
      const lower = name.toLowerCase();
      const { data: existing } = await supabase
        .from('community_locations')
        .select('id, latitude, longitude')
        .eq('name_lower', lower)
        .limit(20);
      const dup = (existing || []).find(
        (e: any) => haversineDistance(e.latitude, e.longitude, pendingPin.lat, pendingPin.lng) < 0.05
      );
      if (dup) {
        await supabase.rpc('bump_location_usage', { _id: (dup as any).id });
        toast.success('Thanks! This place is already on the map.');
      } else {
        const { error } = await supabase.from('community_locations').insert({
          name,
          latitude: pendingPin.lat,
          longitude: pendingPin.lng,
          contributed_by: user.id,
        });
        if (error) throw error;
        toast.success('Place saved — others can find it now.');
      }
      setPendingPin(null);
      setPinName('');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Could not save place');
    } finally {
      setSavingPin(false);
    }
  };

  const hasSuggestions =
    showSuggestions && (communityResults.length > 0 || mapboxResults.length > 0 || loadingSuggestions);

  return (
    <div className={className}>
      <div className="relative mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Search a place or community pin..."
            className="pl-9"
          />
        </div>

        {hasSuggestions && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-md max-h-72 overflow-y-auto">
            {loadingSuggestions && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
            )}
            {communityResults.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
                  <Users className="h-3 w-3" /> Community pins
                </div>
                {communityResults.map((pin) => (
                  <button
                    key={pin.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectCommunity(pin)}
                    className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 text-sm"
                  >
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate flex-1">{pin.name}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {pin.usage_count}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
            {mapboxResults.length > 0 && (
              <div className="py-1 border-t border-border">
                <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
                  <MapIcon className="h-3 w-3" /> Map results
                </div>
                {mapboxResults.map((res, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectMapbox(res)}
                    className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 text-sm"
                  >
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{res.place_name}</span>
                  </button>
                ))}
              </div>
            )}
            {!loadingSuggestions && communityResults.length === 0 && mapboxResults.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
            )}
          </div>
        )}
      </div>

      <div
        ref={mapContainer}
        className="w-full h-[300px] rounded-lg overflow-hidden border border-border"
      />

      {pendingPin && (
        <div className="mt-3 p-3 border border-border rounded-lg bg-muted/40 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-primary" />
              Name this place to help others
            </p>
            <button
              type="button"
              onClick={() => setPendingPin(null)}
              className="p-1 hover:bg-accent rounded"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <Input
            value={pinName}
            onChange={(e) => setPinName(e.target.value)}
            placeholder="e.g. Mama Lizzy Shop, Adenta SDA Junction"
            maxLength={80}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={savePin} disabled={savingPin || pinName.trim().length < 2}>
              {savingPin ? 'Saving...' : 'Save place'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPendingPin(null)}>
              Skip
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Saved places appear as suggestions when others search this area.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        Click on the map to set your delivery location
        {!user && enableCommunityContributions && ' — sign in to save places for others'}
      </p>
    </div>
  );
};

export default MapPicker;
