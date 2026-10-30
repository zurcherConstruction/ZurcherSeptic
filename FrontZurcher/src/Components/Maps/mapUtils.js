// 🗺️ Utilidades de los mapas de trabajos: sede, coordenadas, distancias y links a Google Maps
import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/axios';

const METERS_PER_MILE = 1609.34;

export const fmtMiles = (meters) => (meters == null ? '—' : `${(meters / METERS_PER_MILE).toFixed(meters < 16000 ? 1 : 0)} mi`);
export function fmtDuration(seconds) {
  if (seconds == null) return '—';
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}
export const fmtTrip = (meters, seconds, approximate) => `${approximate ? '~' : ''}${fmtMiles(meters)} · ${fmtDuration(seconds)}`;

// Estimación instantánea (línea recta × 1.3, ~40 mph) mientras llegan las distancias reales
const toRad = (d) => (d * Math.PI) / 180;
export function estimateTrip(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const meters = 2 * 6371000 * Math.asin(Math.sqrt(h)) * 1.3;
  return { meters, seconds: meters / 17.9, approximate: true };
}

// Ruta en Google Maps desde la sede pasando por las paradas (en el orden dado)
// (roundTrip: termina de nuevo en la sede). Google acepta hasta 9 paradas intermedias.
export function googleDirectionsUrl(hq, stops, { roundTrip = false } = {}) {
  if (!stops.length) return null;
  const point = (p) => `${p.lat},${p.lng}`;
  const hqText = hq?.address || point(hq);
  const destination = roundTrip ? hqText : point(stops[stops.length - 1]);
  const middle = roundTrip ? stops : stops.slice(0, -1);
  const waypoints = middle.slice(0, 9).map(point).join('|');
  const params = new URLSearchParams({ api: '1', origin: hqText, destination, travelmode: 'driving' });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

let basePromise = null;
export function fetchMapBase() {
  if (!basePromise) {
    basePromise = api.get('maps/base').then(r => r.data).catch((err) => { basePromise = null; throw err; });
  }
  return basePromise;
}

const locationCache = new Map(); // dirección → {lat,lng} | null (por sesión)

/**
 * Coordenadas para una lista de direcciones. Las nuevas se van ubicando por tandas
 * (el backend las guarda), así que el mapa se completa solo en unos segundos.
 */
export function useLocations(addresses) {
  const key = useMemo(() => [...new Set(addresses.filter(Boolean))].sort().join('\n'), [addresses]);
  const [locations, setLocations] = useState({});
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const list = key ? key.split('\n') : [];
    let cancelled = false;
    const known = {};
    list.forEach(a => { if (locationCache.has(a)) known[a] = locationCache.get(a); });
    setLocations(known);
    const missing = list.filter(a => !locationCache.has(a));
    if (!missing.length) { setPending(0); return undefined; }

    (async () => {
      setLoading(true);
      let remaining = missing;
      for (let round = 0; round < 20 && remaining.length && !cancelled; round++) {
        try {
          const { data } = await api.post('maps/geocode', { addresses: remaining });
          Object.entries(data.locations || {}).forEach(([a, loc]) => locationCache.set(a, loc));
          if (cancelled) return;
          setLocations(prev => ({ ...prev, ...data.locations }));
          remaining = remaining.filter(a => !locationCache.has(a));
          setPending(remaining.length);
          if (!data.pending) break;
        } catch {
          break;
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [key, version]);

  const setManual = async (address, lat, lng) => {
    const { data } = await api.put('maps/location', { address, lat, lng });
    locationCache.set(address, { lat: data.lat, lng: data.lng, source: 'manual' });
    setLocations(prev => ({ ...prev, [address]: { lat: data.lat, lng: data.lng, source: 'manual' } }));
  };

  return { locations, pending, loading, setManual, reload: () => setVersion(v => v + 1) };
}

/**
 * Distancias manejando entre la sede (índice 0) y los puntos. Devuelve una función
 * trip(i, j) → { meters, seconds, approximate } usando índices de `points` (-1 = sede).
 */
export function useDrivingMatrix(hq, points) {
  const all = useMemo(() => (hq ? [hq, ...points].slice(0, 90) : []), [hq, points]);
  const key = all.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';');
  const [matrix, setMatrix] = useState(null);

  useEffect(() => {
    setMatrix(null);
    if (all.length < 2) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api.post('maps/matrix', { points: all.map(p => ({ lat: p.lat, lng: p.lng })) })
        .then(r => { if (!cancelled) setMatrix({ key, ...r.data }); })
        .catch(() => {});
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (i, j) => {
    const a = i === -1 ? hq : points[i];
    const b = j === -1 ? hq : points[j];
    if (!a || !b) return null;
    const mi = i + 1;
    const mj = j + 1;
    if (matrix?.key === key && mi < all.length && mj < all.length) {
      return { meters: matrix.distances[mi][mj], seconds: matrix.durations[mi][mj], approximate: matrix.approximate };
    }
    return estimateTrip(a, b);
  };
}
