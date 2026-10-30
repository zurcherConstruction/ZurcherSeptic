// 🗺️ Mapa de trabajos (OpenStreetMap + Leaflet): sede de Lehigh, trabajos con color por estado,
// trabajo seleccionado resaltado, recorrido opcional y modo "ubicar a mano".
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const LOGO = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1770244237/logo_v2cxn3.png';
const DEFAULT_CENTER = [26.5772, -81.6356];

const ASSET_LABELS = { vehicle: '🚚 Vehículo', machine: '🚜 Máquina', equipment: '🛠️ Equipo', trailer: '🚛 Trailer' };

const hqIcon = L.divIcon({
  className: '',
  html: `<div style="width:44px;height:44px;border-radius:9999px;background:#fff;border:3px solid #1e3a8a;box-shadow:0 4px 12px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="${LOGO}" style="width:34px;height:34px;object-fit:contain"/></div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -22],
});

const iconCache = new Map();
function pinIcon(color, { label = '', selected = false, faded = false } = {}) {
  const cacheKey = `${color}|${label}|${selected}|${faded}`;
  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);
  const size = selected ? 34 : label ? 26 : 18;
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};opacity:${faded ? 0.45 : 1};border:${selected ? 4 : 2}px solid #fff;box-shadow:0 0 0 ${selected ? 3 : 1}px ${selected ? '#0f172a' : 'rgba(0,0,0,.35)'},0 2px 6px rgba(0,0,0,.3);color:#fff;font:700 ${selected ? 13 : 11}px/1 system-ui,sans-serif;display:flex;align-items:center;justify-content:center">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
  iconCache.set(cacheKey, icon);
  return icon;
}

function FitBounds({ points, fitKey }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  return null;
}

function FocusOn({ point }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 12), { duration: 0.6 });
  }, [point, map]);
  return null;
}

function PickLocation({ onPick }) {
  useMapEvents({ click: (e) => onPick?.(e.latlng.lat, e.latlng.lng) });
  return null;
}

/**
 * props:
 *  hq: { lat, lng, address } · fleet: [] (se muestran en el globo de la sede)
 *  points: [{ id, lat, lng, color, label?, title, subtitle?, faded?, popup? (ReactNode) }]
 *  selectedId, onSelect(id) · route: [{lat,lng}] (línea del recorrido, empieza en la sede)
 *  picking: bool + onPick(lat,lng) para ubicar a mano · height
 */
export default function JobsMap({ hq, fleet = [], points, selectedId, onSelect, route, picking, onPick, height = '60vh', fitKey }) {
  const selected = points.find(p => p.id === selectedId);
  const fitPoints = useMemo(() => [...(hq ? [hq] : []), ...points], [hq, points]);
  const autoFitKey = fitKey ?? `${points.length}|${hq ? 1 : 0}`;

  return (
    <div className={`relative rounded-xl overflow-hidden border border-slate-200 shadow-sm ${picking ? 'cursor-crosshair' : ''}`} style={{ height, isolation: 'isolate' }}>
      <MapContainer center={hq ? [hq.lat, hq.lng] : DEFAULT_CENTER} zoom={10} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={fitPoints} fitKey={autoFitKey} />
        <FocusOn point={selected} />
        {picking && <PickLocation onPick={onPick} />}

        {route?.length > 1 && (
          <Polyline positions={route.map(p => [p.lat, p.lng])} pathOptions={{ color: '#1d4ed8', weight: 3, dashArray: '6 8', opacity: 0.8 }} />
        )}

        {hq && (
          <Marker position={[hq.lat, hq.lng]} icon={hqIcon} zIndexOffset={1000}>
            <Tooltip direction="top" offset={[0, -22]}>Sede Zurcher · Lehigh Acres</Tooltip>
            <Popup>
              <div className="text-sm min-w-[200px]">
                <p className="font-bold text-blue-900">🏠 Sede Zurcher</p>
                <p className="text-xs text-slate-500 mb-2">{hq.address}</p>
                {fleet.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-slate-700 mb-1">Flota Zurcher ({fleet.length})</p>
                    <ul className="text-xs text-slate-600 space-y-0.5 max-h-40 overflow-y-auto">
                      {fleet.map(a => (
                        <li key={a.id}>
                          {ASSET_LABELS[a.assetType] || a.assetType} — {a.name}
                          {a.status === 'in_repair' && <span className="text-red-600"> (en reparación)</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {points.map(p => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinIcon(p.color, { label: p.label, selected: p.id === selectedId, faded: p.faded })}
            zIndexOffset={p.id === selectedId ? 900 : p.faded ? 0 : 100}
            eventHandlers={{ click: () => onSelect?.(p.id) }}
          >
            <Tooltip direction="top" offset={[0, -8]}>{p.title}</Tooltip>
            {p.popup && <Popup>{p.popup}</Popup>}
          </Marker>
        ))}
      </MapContainer>
      {picking && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow">
          Hacé clic en el mapa donde está la propiedad
        </div>
      )}
    </div>
  );
}
