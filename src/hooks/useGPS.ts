import { useState, useCallback, useRef } from 'react';

export interface GPSLocation {
  lat: number;
  lng: number;
  accuracy: number;
  source: 'high_accuracy' | 'network' | 'cached';
  timestamp: number;
}

export interface UseGPSReturn {
  location: GPSLocation | null;
  lastKnownLocation: GPSLocation | null; // persiste mesmo após nova tentativa falhar
  isLoading: boolean;
  error: string | null;
  getFreshLocation: () => Promise<GPSLocation>;
}

const GPS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const HIGH_ACC_TIMEOUT = 8000;
const LOW_ACC_TIMEOUT  = 5000;

export function useGPS(): UseGPSReturn {
  const [location, setLocation] = useState<GPSLocation | null>(null);
  const [lastKnownLocation, setLastKnownLocation] = useState<GPSLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<GPSLocation | null>(null);

  const getPosition = (
    highAccuracy: boolean,
    timeout: number
  ): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: highAccuracy,
        timeout,
        maximumAge: GPS_CACHE_TTL_MS,
      })
    );

  const toGPSLocation = (
    pos: GeolocationPosition,
    source: GPSLocation['source']
  ): GPSLocation => ({
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: Math.round(pos.coords.accuracy),
    source,
    timestamp: Date.now(),
  });

  const getFreshLocation = useCallback(async (): Promise<GPSLocation> => {
    if (!navigator.geolocation) {
      throw new Error('GPS não disponível neste dispositivo.');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Tentativa 1: High Accuracy (GPS real)
      try {
        const pos = await getPosition(true, HIGH_ACC_TIMEOUT);
        const loc = toGPSLocation(pos, 'high_accuracy');
        cacheRef.current = loc;
        setLocation(loc);
        setLastKnownLocation(loc); // mantém o último GPS conhecido
        return loc;
      } catch {
        // Tentativa 2: Network / Cell tower
        try {
          const pos = await getPosition(false, LOW_ACC_TIMEOUT);
          const loc = toGPSLocation(pos, 'network');
          cacheRef.current = loc;
          setLocation(loc);
          setLastKnownLocation(loc); // mantém o último GPS conhecido
          return loc;
        } catch {
          // Tentativa 3: Cache local (≤ 5 min)
          if (cacheRef.current) {
            const ageMs = Date.now() - cacheRef.current.timestamp;
            if (ageMs <= GPS_CACHE_TTL_MS) {
              setLocation(cacheRef.current);
              // lastKnownLocation já está definido, não atualizar (cache não é "novo")
              return cacheRef.current;
            }
          }
          throw new Error(
            'Localização indisponível. Ative o GPS e tente novamente.'
          );
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { location, lastKnownLocation, isLoading, error, getFreshLocation };
}
