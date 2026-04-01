import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Search, MapPin, Check, Loader2, Navigation } from 'lucide-react';

/* ════════════════════════════════════════════════════════════════
   GoogleMapPicker — Modal reutilizável com mapa Google Maps

   Usa tipos `any` para evitar dependência de @types/google.maps.
   A API é carregada via script tag no index.html.
   ════════════════════════════════════════════════════════════════ */

declare const google: any;

export interface MapPickerResult {
  lat: number;
  lng: number;
  address: string;
}

export interface GoogleMapPickerProps {
  /** Latitude inicial para centralizar o mapa */
  initialLat?: number;
  /** Longitude inicial para centralizar o mapa */
  initialLng?: number;
  /** Texto de busca inicial (ex.: nome de empresa) — será pesquisado ao abrir */
  initialSearch?: string;
  /** Mostrar barra de busca (default: true) */
  showSearch?: boolean;
  /** Título do modal */
  title?: string;
  /** Callback ao confirmar a seleção */
  onConfirm: (data: MapPickerResult) => void;
  /** Callback ao cancelar */
  onCancel: () => void;
}

// Posição padrão: São Paulo, Brasil
const DEFAULT_LAT = -23.5505;
const DEFAULT_LNG = -46.6333;

const GoogleMapPicker: React.FC<GoogleMapPickerProps> = ({
  initialLat,
  initialLng,
  initialSearch,
  showSearch = true,
  title = 'Selecionar Localização',
  onConfirm,
  onCancel,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);

  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat || DEFAULT_LAT,
    lng: initialLng || DEFAULT_LNG,
  });
  const [loading, setLoading] = useState(true);
  const [gettingGPS, setGettingGPS] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [searching, setSearching] = useState(false);

  // ── Fix: Ensure Places Autocomplete dropdown appears above the modal ──
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '.pac-container { z-index: 99999 !important; }';
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // ── Check if Google Maps API is loaded ──
  useEffect(() => {
    const check = () => {
      if (typeof google !== 'undefined' && google.maps) {
        setApiReady(true);
        return;
      }
      setTimeout(check, 200);
    };
    check();
  }, []);

  // ── Reverse geocode to get address from coordinates ──
  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (!geocoderRef.current) return;
    geocoderRef.current.geocode(
      { location: { lat, lng } },
      (results: any[], status: string) => {
        if (status === 'OK' && results && results[0]) {
          setSelectedAddress(results[0].formatted_address);
        }
      }
    );
  }, []);

  // ── Move marker to new position ──
  const moveMarker = useCallback((lat: number, lng: number, pan = true) => {
    const pos = { lat, lng };
    setSelectedCoords(pos);
    if (markerRef.current) {
      markerRef.current.setPosition(pos);
    }
    if (pan && mapRef.current) {
      mapRef.current.panTo(pos);
    }
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  // ── Initialize map ──
  useEffect(() => {
    if (!apiReady || !mapContainerRef.current) return;

    const initialPos = {
      lat: initialLat || DEFAULT_LAT,
      lng: initialLng || DEFAULT_LNG,
    };

    // Create map
    const map = new google.maps.Map(mapContainerRef.current, {
      center: initialPos,
      zoom: initialLat ? 17 : 14,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
        position: google.maps.ControlPosition.TOP_RIGHT,
      },
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'greedy',
    });
    mapRef.current = map;

    // Create draggable marker
    const marker = new google.maps.Marker({
      position: initialPos,
      map,
      draggable: true,
      animation: google.maps.Animation.DROP,
      title: 'Arraste para ajustar a posição',
    });
    markerRef.current = marker;

    // Create geocoder
    geocoderRef.current = new google.maps.Geocoder();

    // Marker drag end
    marker.addListener('dragend', () => {
      const pos = marker.getPosition();
      if (pos) {
        setSelectedCoords({ lat: pos.lat(), lng: pos.lng() });
        reverseGeocode(pos.lat(), pos.lng());
      }
    });

    // Click on map to move marker
    map.addListener('click', (e: any) => {
      if (e.latLng) {
        moveMarker(e.latLng.lat(), e.latLng.lng(), false);
      }
    });

    // Setup Places Autocomplete
    if (showSearch && searchInputRef.current) {
      const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
        types: ['establishment', 'geocode'],
        componentRestrictions: { country: 'br' },
        fields: ['geometry', 'formatted_address', 'name'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          moveMarker(lat, lng);
          map.setZoom(17);
          if (place.formatted_address) {
            setSelectedAddress(
              place.name && !place.formatted_address.startsWith(place.name)
                ? `${place.name} — ${place.formatted_address}`
                : place.formatted_address
            );
          }
        }
      });
    }

    // Initial reverse geocode (if we have coordinates)
    if (initialLat && initialLng) {
      reverseGeocode(initialLat, initialLng);
    }

    // If initialSearch is provided, search for it
    if (initialSearch && initialSearch.trim()) {
      const service = new google.maps.places.PlacesService(map);
      service.findPlaceFromQuery(
        {
          query: initialSearch,
          fields: ['geometry', 'formatted_address', 'name'],
          locationBias: initialLat ? { lat: initialLat, lng: initialLng! } : undefined,
        },
        (results: any[], status: string) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
            const place = results[0];
            if (place.geometry?.location) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              moveMarker(lat, lng);
              map.setZoom(17);
              if (place.formatted_address) {
                setSelectedAddress(
                  place.name && !place.formatted_address.startsWith(place.name)
                    ? `${place.name} — ${place.formatted_address}`
                    : place.formatted_address
                );
              }
            }
          }
        }
      );
    }

    setLoading(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady]);

  // ── GPS: Use current location ──
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não suportada.');
      return;
    }
    setGettingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        moveMarker(pos.coords.latitude, pos.coords.longitude);
        mapRef.current?.setZoom(17);
        setGettingGPS(false);
      },
      () => {
        alert('Não foi possível obter sua localização.');
        setGettingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // ── Manual text search (when user types and clicks Search instead of autocomplete) ──
  const handleManualSearch = useCallback(() => {
    const text = searchInputRef.current?.value?.trim();
    if (!text || !mapRef.current) return;
    setSearching(true);
    const service = new google.maps.places.PlacesService(mapRef.current);
    service.findPlaceFromQuery(
      { query: text, fields: ['geometry', 'formatted_address', 'name'] },
      (results: any[], status: string) => {
        setSearching(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
          const place = results[0];
          if (place.geometry?.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            moveMarker(lat, lng);
            mapRef.current?.setZoom(17);
            const addr = place.formatted_address || '';
            setSelectedAddress(
              place.name && !addr.startsWith(place.name) ? `${place.name} — ${addr}` : addr
            );
          }
        } else {
          alert('Endereço não encontrado. Tente um termo mais específico.');
        }
      }
    );
  }, [moveMarker]);

  // ── Confirm selection ──
  const handleConfirm = () => {
    onConfirm({
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      address: selectedAddress,
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-600" />
            {title}
          </h2>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {showSearch && (
          <div className="px-5 pt-4 pb-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar endereço ou nome do estabelecimento..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  defaultValue={initialSearch || ''}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleManualSearch(); } }}
                />
              </div>
              <button
                onClick={handleManualSearch}
                disabled={searching || !apiReady}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                {searching
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Search className="w-4 h-4" />}
                Buscar
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Digite e clique em <strong>Buscar</strong>, ou clique no mapa para posicionar o marcador.
            </p>
          </div>
        )}

        {/* Map container */}
        <div className="relative flex-1 min-h-[350px]">
          {(loading || !apiReady) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <div className="flex items-center gap-3 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">Carregando mapa...</span>
              </div>
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '350px' }} />
        </div>

        {/* Footer: selected address + actions */}
        <div className="px-5 py-4 border-t border-gray-200 space-y-3 bg-gray-50">
          {/* Selected address display */}
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Endereço Selecionado</p>
              <p className="text-sm text-gray-800 mt-0.5 break-words">
                {selectedAddress || 'Clique no mapa ou busque um endereço'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Lat: {selectedCoords.lat.toFixed(6)}, Lng: {selectedCoords.lng.toFixed(6)}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {/* Row 1: GPS button (full width on mobile) */}
            <button
              onClick={handleUseMyLocation}
              disabled={gettingGPS}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 disabled:opacity-50 transition-colors"
            >
              <Navigation className="w-4 h-4 flex-shrink-0" />
              {gettingGPS ? 'Buscando localização...' : 'Minha Localização'}
            </button>
            {/* Row 2: Cancel + Confirm */}
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedAddress}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Check className="w-4 h-4 flex-shrink-0" />
                Confirmar Localização
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleMapPicker;
