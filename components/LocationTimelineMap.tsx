import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import type { LocationPing } from '../services/trackerService';

declare const google: any;

interface LocationTimelineMapProps {
  pings: LocationPing[];
  height?: number;
}

const DEFAULT_LAT = -23.1024;
const DEFAULT_LNG = -47.2094;

const fmtHora = (p: LocationPing) => {
  const d = p.timestamp?.toDate?.();
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
};

/**
 * Trilha de GPS bruta de um colaborador num dia — sem vínculo com O.S.
 * Compartilhado entre a aba web (TrackerColaborador) e a aba do app (FieldGestaoOS).
 */
const LocationTimelineMap: React.FC<LocationTimelineMapProps> = ({ pings, height = 420 }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    const check = () => {
      if (typeof google !== 'undefined' && google.maps) { setApiReady(true); return; }
      setTimeout(check, 250);
    };
    check();
  }, []);

  const clearOverlays = useCallback(() => {
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
  }, []);

  useEffect(() => {
    if (!apiReady || !mapContainerRef.current) return;

    const center = pings.length > 0
      ? { lat: pings[0].lat, lng: pings[0].lng }
      : { lat: DEFAULT_LAT, lng: DEFAULT_LNG };

    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center,
        zoom: pings.length > 0 ? 14 : 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'greedy',
      });
    }
    const map = mapRef.current;
    clearOverlays();

    if (pings.length === 0) return;

    const path = pings.map(p => ({ lat: p.lat, lng: p.lng }));

    polylineRef.current = new google.maps.Polyline({
      path,
      map,
      strokeColor: '#7c3aed',
      strokeOpacity: 0.8,
      strokeWeight: 3,
      icons: [{
        icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: '#7c3aed' },
        offset: '0', repeat: '80px',
      }],
    });

    pings.forEach((p, i) => {
      const isFirst = i === 0;
      const isLast = i === pings.length - 1;
      const color = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#3b82f6';
      const scale = isFirst || isLast ? 9 : 5;

      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        zIndex: isFirst || isLast ? 100 : 10,
        title: `${isFirst ? 'Início — ' : isLast ? 'Fim — ' : ''}${fmtHora(p)}`,
      });

      const info = new google.maps.InfoWindow({
        content: `
          <div style="padding:6px;font-family:system-ui;max-width:200px">
            <strong style="font-size:13px;color:#1f2937">${isFirst ? '🟢 Início' : isLast ? '🔴 Fim' : '📍 Ping'} — ${fmtHora(p)}</strong>
            <div style="margin-top:4px;font-size:11px;color:#6b7280">
              ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}<br/>
              ${p.accuracy != null ? `Precisão: ±${Math.round(p.accuracy)}m` : ''}
            </div>
          </div>
        `,
      });
      marker.addListener('click', () => info.open(map, marker));
      markersRef.current.push(marker);
    });

    const bounds = new google.maps.LatLngBounds();
    path.forEach(pos => bounds.extend(pos));
    if (path.length > 1) map.fitBounds(bounds, 50);
    else { map.setCenter(path[0]); map.setZoom(16); }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, pings, clearOverlays]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
      {!apiReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10" style={{ height }}>
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Carregando mapa...</span>
        </div>
      )}
      {apiReady && pings.length === 0 && (
        <div className="flex flex-col items-center justify-center bg-gray-50 text-gray-400" style={{ height }}>
          <MapPin size={28} className="mb-2 opacity-40" />
          <p className="text-sm font-medium">Nenhum ping de GPS neste dia.</p>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full" style={{ height, display: pings.length === 0 ? 'none' : 'block' }} />
    </div>
  );
};

export default LocationTimelineMap;
