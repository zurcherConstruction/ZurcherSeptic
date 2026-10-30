// 🧭 Armado de recorrido: paradas elegidas del mapa + paradas manuales (reclamos, mantenimientos,
// proveedores…), con tiempos por tramo, total, orden optimizado y link a Google Maps.
import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../utils/axios';
import { useDrivingMatrix, fmtTrip, googleDirectionsUrl } from './mapUtils';

export const MANUAL_STOP_COLOR = '#0f766e';
const MAX_GOOGLE_STOPS = 10; // Google Maps acepta hasta 9 paradas intermedias + destino

const newId = () => `manual:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * props:
 *  hq · stops: [{ id, label, lat, lng, color, manual? }] · setStops(fn|array)
 *  roundTrip, setRoundTrip · onPickOnMap(label) → activa "clic en el mapa" para una parada manual
 *  onFocus(stop) → centra el mapa en la parada
 */
export default function RoutePlanner({ hq, stops, setStops, roundTrip, setRoundTrip, onPickOnMap, onFocus }) {
  const [text, setText] = useState('');
  const [searching, setSearching] = useState(false);
  const coords = stops.map(s => ({ lat: s.lat, lng: s.lng }));
  const trip = useDrivingMatrix(hq, coords);

  const legs = stops.map((s, k) => trip(k === 0 ? -1 : k - 1, k));
  const back = roundTrip && stops.length ? trip(stops.length - 1, -1) : null;
  const total = [...legs, ...(back ? [back] : [])].reduce(
    (acc, t) => (t ? { meters: acc.meters + t.meters, seconds: acc.seconds + t.seconds, approximate: acc.approximate || t.approximate } : acc),
    { meters: 0, seconds: 0, approximate: false }
  );

  const move = (from, to) => setStops(prev => {
    if (to < 0 || to >= prev.length) return prev;
    const next = [...prev];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  });
  const remove = (id) => setStops(prev => prev.filter(s => s.id !== id));

  // Desde la sede, siempre al más cercano que falte
  const optimize = () => {
    const left = stops.map((_, i) => i);
    const order = [];
    let current = -1;
    while (left.length) {
      left.sort((a, b) => trip(current, a).seconds - trip(current, b).seconds);
      current = left.shift();
      order.push(current);
    }
    setStops(order.map(i => stops[i]));
    toast.success('Orden optimizado: siempre al más cercano');
  };

  const addManual = async (e) => {
    e.preventDefault();
    const address = text.trim();
    if (!address) return;
    setSearching(true);
    try {
      const { data } = await api.post('maps/geocode', { addresses: [address] });
      const loc = data.locations?.[address];
      if (loc) {
        const stop = { id: newId(), label: address, lat: loc.lat, lng: loc.lng, color: MANUAL_STOP_COLOR, manual: true };
        setStops(prev => [...prev, stop]);
        onFocus?.(stop);
        setText('');
      } else {
        toast.info('No encontramos esa dirección: hacé clic en el mapa donde queda');
        onPickOnMap?.(address);
        setText('');
      }
    } catch {
      toast.error('No se pudo buscar la dirección');
    } finally {
      setSearching(false);
    }
  };

  const googleUrl = hq && stops.length ? googleDirectionsUrl(hq, stops, { roundTrip }) : null;
  const tooManyForGoogle = stops.length + (roundTrip ? 1 : 0) > MAX_GOOGLE_STOPS;

  return (
    <div className="border-2 border-teal-200 rounded-xl p-3 bg-teal-50/40">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-bold text-slate-800 text-sm">🧭 Recorrido {stops.length ? `(${stops.length} paradas)` : ''}</p>
        {stops.length > 0 && (
          <button onClick={() => setStops([])} className="text-xs text-slate-400 hover:text-red-600">Vaciar</button>
        )}
      </div>

      {/* Parada manual */}
      <form onSubmit={addManual} className="flex gap-1.5 mb-1.5">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Parada manual: dirección (reclamo, mantenimiento…)"
          className="flex-1 min-w-0 text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-300"
        />
        <button type="submit" disabled={searching || !text.trim()} className="text-xs font-semibold bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white px-2.5 rounded-lg">
          {searching ? '…' : '＋'}
        </button>
      </form>
      <button onClick={() => onPickOnMap?.(text.trim() || 'Parada manual')} className="text-[11px] text-teal-700 hover:text-teal-900 underline mb-2">
        📍 o marcar la parada con un clic en el mapa
      </button>

      {stops.length === 0 ? (
        <p className="text-xs text-slate-500">
          Agregá trabajos con <strong>＋</strong> desde la lista o el detalle del trabajo, y paradas manuales con el buscador.
        </p>
      ) : (
        <>
          <ol className="space-y-1">
            <li className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center shrink-0">🏠</span>
              Sede (salida)
            </li>
            {stops.map((s, k) => (
              <li key={s.id} className="flex items-center gap-1.5 text-xs group">
                <span className="w-5 h-5 rounded-full text-white font-bold flex items-center justify-center shrink-0" style={{ background: s.color }}>{k + 1}</span>
                <button onClick={() => onFocus?.(s)} className="flex-1 min-w-0 text-left">
                  <span className="block truncate text-slate-700 font-medium" title={s.label}>{s.manual && '📌 '}{s.label}</span>
                  {legs[k] && <span className="text-slate-400">{fmtTrip(legs[k].meters, legs[k].seconds, legs[k].approximate)}</span>}
                </button>
                <button onClick={() => move(k, k - 1)} disabled={k === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-20 px-0.5" title="Subir">▲</button>
                <button onClick={() => move(k, k + 1)} disabled={k === stops.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-20 px-0.5" title="Bajar">▼</button>
                <button onClick={() => remove(s.id)} className="text-slate-400 hover:text-red-600 px-0.5" title="Quitar">✕</button>
              </li>
            ))}
            {roundTrip && back && (
              <li className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center shrink-0">🏠</span>
                <span className="flex-1">Vuelta a la sede</span>
                <span>{fmtTrip(back.meters, back.seconds, back.approximate)}</span>
              </li>
            )}
          </ol>

          <div className="mt-2 pt-2 border-t border-teal-200 text-xs text-slate-700">
            Total manejando: <strong>{fmtTrip(total.meters, total.seconds, total.approximate)}</strong>
            <span className="text-slate-400"> (sin contar el tiempo en cada parada)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={roundTrip} onChange={e => setRoundTrip(e.target.checked)} className="accent-teal-600" />
              Volver a la sede
            </label>
            {stops.length > 2 && (
              <button onClick={optimize} className="text-xs font-semibold bg-white border border-slate-300 hover:border-teal-400 text-slate-700 px-2.5 py-1 rounded-lg">
                ⚡ Optimizar orden
              </button>
            )}
            {googleUrl && (
              <a href={googleUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1 rounded-lg">
                Abrir en Google Maps
              </a>
            )}
          </div>
          {tooManyForGoogle && (
            <p className="text-[11px] text-amber-700 mt-1">Google Maps solo acepta 10 paradas por link: se abrirán las primeras 10.</p>
          )}
        </>
      )}
    </div>
  );
}
