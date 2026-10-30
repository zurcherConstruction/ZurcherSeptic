/**
 * 🗺️ Geocodificación y distancias para los mapas de trabajos.
 *
 * - Coordenadas: US Census Geocoder (gratis, sin clave, muy bueno para direcciones de EE.UU.);
 *   si no la encuentra, OpenStreetMap Nominatim (máx. 1 consulta por segundo).
 *   Cada dirección se busca una sola vez y queda guardada en la tabla GeoLocations.
 * - Distancias/tiempos manejando: OSRM (OSRM_URL, por defecto el servidor público).
 *   Si no responde, se estima con la distancia en línea recta × 1.3 (marcado como aproximado).
 */
const { GeoLocation } = require('../data');

const HQ_ADDRESS = process.env.COMPANY_HQ_ADDRESS || '450 Rathburn St, Lehigh Acres, FL 33974';
const OSRM_URL = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
const USER_AGENT = 'ZurcherSeptic/1.0 (admin@zurcherseptic.com)';
const RETRY_NOT_FOUND_AFTER_MS = 7 * 24 * 3600 * 1000;

// Florida (con margen): descarta resultados que caen en otro estado
const inFlorida = (lat, lng) => lat > 24.3 && lat < 31.1 && lng > -87.7 && lng < -79.8;

const normalizeAddress = (address) => String(address || '').toLowerCase().replace(/[.#]/g, ' ').replace(/\s+/g, ' ').trim();

// Si la dirección no dice el estado ni tiene código postal, se completa con ", FL"
function withState(address) {
  const a = String(address).trim();
  if (/\b(fl|florida)\b/i.test(a) || /\b\d{5}\b/.test(a.replace(/^\s*\d+/, ''))) return a;
  return `${a}, FL`;
}

async function fetchJson(url, timeoutMs = 10000) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function geocodeCensus(address) {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
  const data = await fetchJson(url);
  const match = data?.result?.addressMatches?.[0];
  if (!match) return null;
  return { lat: match.coordinates.y, lng: match.coordinates.x };
}

let lastNominatimCall = 0;
async function geocodeNominatim(address) {
  const wait = lastNominatimCall + 1100 - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatimCall = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`;
  const data = await fetchJson(url);
  if (!data?.[0]) return null;
  return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
}

const toResult = (row) => (row && row.status === 'ok' && row.latitude != null
  ? { lat: Number(row.latitude), lng: Number(row.longitude), source: row.source }
  : null);

/** Busca (o recupera de la caché) las coordenadas de una dirección. Devuelve { lat, lng, source } o null. */
async function geocodeAddress(address) {
  const addressKey = normalizeAddress(address).slice(0, 300);
  if (!addressKey) return null;

  const cached = await GeoLocation.findOne({ where: { addressKey } });
  if (cached && (cached.status === 'ok' || Date.now() - new Date(cached.geocodedAt).getTime() < RETRY_NOT_FOUND_AFTER_MS)) {
    return toResult(cached);
  }

  const query = withState(address);
  let found = null;
  let source = null;
  for (const [name, fn] of [['census', geocodeCensus], ['nominatim', geocodeNominatim]]) {
    try {
      const r = await fn(query);
      if (r && inFlorida(r.lat, r.lng)) { found = r; source = name; break; }
    } catch (err) {
      console.warn(`⚠️ [Geo] ${name} falló para "${address}": ${err.message}`);
    }
  }

  const values = {
    address: String(address).slice(0, 300),
    latitude: found?.lat ?? null,
    longitude: found?.lng ?? null,
    status: found ? 'ok' : 'not_found',
    source,
    geocodedAt: new Date(),
  };
  if (cached) await cached.update(values);
  else await GeoLocation.create({ addressKey, ...values });
  return found ? { ...found, source } : null;
}

/**
 * Geocodifica varias direcciones. Las que ya están guardadas salen al instante; las nuevas se buscan
 * hasta agotar el tiempo disponible y el resto queda como "pending" para la siguiente llamada.
 */
async function geocodeMany(addresses, { timeBudgetMs = 15000 } = {}) {
  const unique = [...new Set(addresses.map(a => String(a || '').trim()).filter(Boolean))];
  const keys = unique.map(a => normalizeAddress(a).slice(0, 300));
  const rows = await GeoLocation.findAll({ where: { addressKey: keys } });
  const byKey = new Map(rows.map(r => [r.addressKey, r]));

  const locations = {};
  const toLookup = [];
  unique.forEach((address, i) => {
    const row = byKey.get(keys[i]);
    if (row && (row.status === 'ok' || Date.now() - new Date(row.geocodedAt).getTime() < RETRY_NOT_FOUND_AFTER_MS)) {
      locations[address] = toResult(row);
    } else {
      toLookup.push(address);
    }
  });

  const deadline = Date.now() + timeBudgetMs;
  let pending = 0;
  for (const address of toLookup) {
    if (Date.now() > deadline) { pending++; continue; }
    locations[address] = await geocodeAddress(address);
  }
  return { locations, pending };
}

/** Fija a mano la ubicación de una dirección (cuando el geocodificador no la encuentra o la pone mal). */
async function setManualLocation(address, lat, lng) {
  const addressKey = normalizeAddress(address).slice(0, 300);
  const values = { address: String(address).slice(0, 300), latitude: lat, longitude: lng, status: 'ok', source: 'manual', geocodedAt: new Date() };
  const existing = await GeoLocation.findOne({ where: { addressKey } });
  if (existing) await existing.update(values);
  else await GeoLocation.create({ addressKey, ...values });
  return { lat, lng, source: 'manual' };
}

// ── Distancias ──────────────────────────────────────────────────────────────

const toRad = (d) => (d * Math.PI) / 180;
function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Estimación sin servicio de rutas: línea recta × 1.3 a ~40 mph promedio
function estimateMatrix(points) {
  const distances = points.map(a => points.map(b => Math.round(haversineMeters(a, b) * 1.3)));
  const durations = distances.map(row => row.map(m => Math.round(m / 17.9)));
  return { distances, durations, approximate: true };
}

const matrixCache = new Map();
const MATRIX_TTL_MS = 6 * 3600 * 1000;

/** Matriz de distancias (metros) y tiempos (segundos) manejando entre todos los puntos. */
async function drivingMatrix(points) {
  if (points.length < 2) return { distances: [[0]], durations: [[0]], approximate: false };
  const coords = points.map(p => `${Number(p.lng).toFixed(5)},${Number(p.lat).toFixed(5)}`).join(';');
  const hit = matrixCache.get(coords);
  if (hit && hit.expires > Date.now()) return hit.value;

  let value;
  try {
    const data = await fetchJson(`${OSRM_URL}/table/v1/driving/${coords}?annotations=duration,distance`, 15000);
    if (data.code !== 'Ok') throw new Error(data.code);
    const fallback = estimateMatrix(points);
    // Si algún par no tiene ruta, se completa con la estimación
    value = {
      distances: data.distances.map((row, i) => row.map((v, j) => (v == null ? fallback.distances[i][j] : Math.round(v)))),
      durations: data.durations.map((row, i) => row.map((v, j) => (v == null ? fallback.durations[i][j] : Math.round(v)))),
      approximate: false,
    };
  } catch (err) {
    console.warn(`⚠️ [Geo] OSRM no disponible (${err.message}); se usan distancias estimadas`);
    value = estimateMatrix(points);
  }
  matrixCache.set(coords, { value, expires: Date.now() + MATRIX_TTL_MS });
  if (matrixCache.size > 500) matrixCache.delete(matrixCache.keys().next().value);
  return value;
}

module.exports = { HQ_ADDRESS, geocodeAddress, geocodeMany, setManualLocation, drivingMatrix, normalizeAddress };
