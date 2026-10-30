// 🗺️ Mapa de trabajos de campo (pendientes de comenzar, instalando, inspección, cubrir)
// con distancias manejando desde la sede de Lehigh y entre trabajos.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import JobsMap from './JobsMap';
import { fetchMapBase, useLocations, useDrivingMatrix, fmtTrip, googleDirectionsUrl } from './mapUtils';
import RoutePlanner, { MANUAL_STOP_COLOR } from './RoutePlanner';

const ROUTE_STORAGE_KEY = 'workMap.route';
function loadRoute() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(ROUTE_STORAGE_KEY) || 'null');
    if (Array.isArray(saved?.stops)) return saved;
  } catch { /* sin storage */ }
  return { stops: [], roundTrip: true };
}

const STATUS_GROUPS = [
  { key: 'start', label: 'COMENZAR', color: '#eab308', statuses: ['pending', 'assigned'] },
  { key: 'installing', label: 'INSTALANDO', color: '#2563eb', statuses: ['inProgress'] },
  { key: 'inspection', label: 'INSPECCIÓN', color: '#9333ea', statuses: ['installed', 'firstInspectionPending', 'rejectedInspection'] },
  { key: 'cover', label: 'CUBRIR', color: '#ea580c', statuses: ['coverPending'] },
];
const groupOf = (status) => STATUS_GROUPS.find(g => g.statuses.includes(status));
const colorOf = (work) => (work.status === 'rejectedInspection' ? '#dc2626' : groupOf(work.status)?.color || '#64748b');

export default function WorkMapView({ works, isWorker }) {
  const [base, setBase] = useState(null);
  const [activeGroups, setActiveGroups] = useState(() => STATUS_GROUPS.map(g => g.key));
  const [selectedId, setSelectedId] = useState(null);
  // Clic en el mapa: { type: 'fix', address } corrige un trabajo · { type: 'stop', label } agrega parada manual
  const [picking, setPicking] = useState(null);
  const [routeStops, setRouteStops] = useState(() => loadRoute().stops);
  const [roundTrip, setRoundTrip] = useState(() => loadRoute().roundTrip);

  useEffect(() => {
    fetchMapBase().then(setBase).catch(() => toast.error('No se pudo cargar la sede para el mapa'));
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify({ stops: routeStops, roundTrip })); } catch { /* sin storage */ }
  }, [routeStops, roundTrip]);

  const routeIndexOf = (id) => routeStops.findIndex(s => s.id === id);
  const toggleInRoute = (p) => {
    if (routeIndexOf(p.work.idWork) >= 0) {
      setRouteStops(prev => prev.filter(s => s.id !== p.work.idWork));
    } else {
      setRouteStops(prev => [...prev, { id: p.work.idWork, label: p.work.propertyAddress, lat: p.lat, lng: p.lng, color: colorOf(p.work) }]);
    }
  };

  const visibleWorks = useMemo(
    () => works.filter(w => activeGroups.includes(groupOf(w.status)?.key)),
    [works, activeGroups]
  );
  const addresses = useMemo(() => works.map(w => w.propertyAddress), [works]);
  const { locations, pending, loading, setManual } = useLocations(addresses);

  const located = useMemo(
    () => visibleWorks.filter(w => locations[w.propertyAddress]).map(w => ({ work: w, ...locations[w.propertyAddress] })),
    [visibleWorks, locations]
  );
  const notLocated = visibleWorks.filter(w => w.propertyAddress && locations[w.propertyAddress] === null);
  const coords = useMemo(() => located.map(p => ({ lat: p.lat, lng: p.lng })), [located]);
  const hq = base?.hq;
  const trip = useDrivingMatrix(hq, coords);

  // Lista ordenada por tiempo de manejo desde la sede
  const ordered = useMemo(() => {
    if (!hq) return located.map((p, i) => ({ ...p, i, fromHq: null }));
    return located
      .map((p, i) => ({ ...p, i, fromHq: trip(-1, i) }))
      .sort((a, b) => (a.fromHq?.seconds ?? 0) - (b.fromHq?.seconds ?? 0));
  }, [located, hq, trip]);

  const selectedIndex = located.findIndex(p => p.work.idWork === selectedId);
  const selected = selectedIndex >= 0 ? located[selectedIndex] : null;
  const nearby = selected
    ? located
      .map((p, i) => ({ ...p, i, t: trip(selectedIndex, i) }))
      .filter(p => p.i !== selectedIndex)
      .sort((a, b) => a.t.seconds - b.t.seconds)
      .slice(0, 5)
    : [];

  // Trabajos (con el número de parada si están en el recorrido) + paradas manuales
  const points = [
    ...located.map(p => {
      const stop = routeIndexOf(p.work.idWork);
      return {
        id: p.work.idWork,
        lat: p.lat,
        lng: p.lng,
        color: colorOf(p.work),
        label: stop >= 0 ? String(stop + 1) : '',
        title: `${p.work.propertyAddress} · ${groupOf(p.work.status)?.label || p.work.status}`,
      };
    }),
    ...routeStops.filter(s => s.manual).map(s => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      color: MANUAL_STOP_COLOR,
      label: String(routeIndexOf(s.id) + 1),
      title: `📌 ${s.label}`,
    })),
  ];
  const routeLine = hq && routeStops.length
    ? [hq, ...routeStops, ...(roundTrip ? [hq] : [])]
    : selected && hq ? [hq, selected] : null;

  const toggleGroup = (key) => setActiveGroups(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const handlePick = async (lat, lng) => {
    if (!picking) return;
    if (picking.type === 'stop') {
      const id = `manual:${Date.now()}`;
      setRouteStops(prev => [...prev, { id, label: picking.label, lat, lng, color: MANUAL_STOP_COLOR, manual: true }]);
      setPicking(null);
      return;
    }
    try {
      await setManual(picking.address, lat, lng);
      toast.success('Ubicación guardada');
    } catch {
      toast.error('No se pudo guardar la ubicación');
    }
    setPicking(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-3 sm:p-4 mb-6">
      {/* Filtros por estado */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {STATUS_GROUPS.map(g => {
          const count = works.filter(w => g.statuses.includes(w.status)).length;
          const on = activeGroups.includes(g.key);
          return (
            <button
              key={g.key}
              onClick={() => toggleGroup(g.key)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${on ? 'bg-white shadow-sm border-slate-300 text-slate-800' : 'bg-slate-100 border-transparent text-slate-400'}`}
            >
              <span className="w-3 h-3 rounded-full" style={{ background: on ? g.color : '#cbd5e1' }} />
              {g.label} <span className="font-normal">({count})</span>
            </button>
          );
        })}
        <span className="text-xs text-slate-400 ml-auto">
          {loading || pending ? `📍 Ubicando direcciones… ${pending ? `(${pending} restantes)` : ''}` : `${located.length} en el mapa`}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <JobsMap
            hq={hq}
            fleet={base?.fleet}
            points={points}
            selectedId={selectedId}
            onSelect={setSelectedId}
            route={routeLine}
            picking={!!picking}
            onPick={handlePick}
            height="62vh"
          />
          {picking && (
            <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
              <span>{picking.type === 'stop' ? 'Nueva parada' : 'Ubicando'}: <strong>{picking.type === 'stop' ? picking.label : picking.address}</strong></span>
              <button onClick={() => setPicking(null)} className="font-semibold underline">Cancelar</button>
            </div>
          )}
        </div>

        {/* Panel lateral */}
        <div className="w-full lg:w-[360px] shrink-0 flex flex-col gap-3 lg:max-h-[62vh] lg:overflow-y-auto">
          <RoutePlanner
            hq={hq}
            stops={routeStops}
            setStops={setRouteStops}
            roundTrip={roundTrip}
            setRoundTrip={setRoundTrip}
            onPickOnMap={(label) => setPicking({ type: 'stop', label })}
            onFocus={(stop) => setSelectedId(stop.id)}
          />

          {selected ? (
            <div className="border-2 border-blue-200 rounded-xl p-3 bg-blue-50/40">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-slate-800 text-sm">{selected.work.propertyAddress}</p>
                <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">×</button>
              </div>
              <span className="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: colorOf(selected.work) }}>
                {groupOf(selected.work.status)?.label}
              </span>
              {hq && (
                <p className="text-sm text-slate-700 mt-2">🏠 Desde la sede: <strong>{fmtTrip(trip(-1, selectedIndex).meters, trip(-1, selectedIndex).seconds, trip(-1, selectedIndex).approximate)}</strong></p>
              )}
              {nearby.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-slate-500 mt-3 mb-1">Trabajos más cercanos</p>
                  <ul className="space-y-1">
                    {nearby.map(n => (
                      <li key={n.work.idWork}>
                        <button onClick={() => setSelectedId(n.work.idWork)} className="w-full text-left text-xs flex items-center gap-2 hover:bg-white rounded-md px-1.5 py-1">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(n.work) }} />
                          <span className="flex-1 truncate text-slate-700">{n.work.propertyAddress}</span>
                          <span className="text-slate-500 whitespace-nowrap">{fmtTrip(n.t.meters, n.t.seconds, n.t.approximate)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => toggleInRoute(selected)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${routeIndexOf(selected.work.idWork) >= 0 ? 'bg-teal-100 text-teal-800 border border-teal-300' : 'bg-teal-600 hover:bg-teal-700 text-white'}`}
                >
                  {routeIndexOf(selected.work.idWork) >= 0 ? `✓ Parada ${routeIndexOf(selected.work.idWork) + 1} (quitar)` : '＋ Agregar al recorrido'}
                </button>
                {!isWorker && (
                  <Link to={`/work/${selected.work.idWork}`} className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg">Ver obra</Link>
                )}
                {hq && (
                  <a href={googleDirectionsUrl(hq, [selected])} target="_blank" rel="noreferrer" className="text-xs font-semibold bg-white border border-slate-300 hover:border-blue-400 text-slate-700 px-3 py-1.5 rounded-lg">
                    🧭 Cómo llegar
                  </a>
                )}
                {!isWorker && (
                  <button onClick={() => setPicking({ type: 'fix', address: selected.work.propertyAddress })} className="text-xs text-slate-500 hover:text-blue-700 underline">
                    Corregir ubicación
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              Tocá un trabajo en el mapa o en la lista para ver la distancia desde la sede y los trabajos más cercanos.
            </p>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Ordenados por distancia desde la sede</p>
            <ul className="space-y-1">
              {ordered.map(p => {
                const stop = routeIndexOf(p.work.idWork);
                return (
                  <li key={p.work.idWork} className={`flex items-center rounded-lg border transition-colors ${p.work.idWork === selectedId ? 'bg-blue-50 border-blue-300' : 'border-transparent hover:bg-slate-50'}`}>
                    <button onClick={() => setSelectedId(p.work.idWork)} className="flex-1 min-w-0 text-left text-xs flex items-center gap-2 px-2 py-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(p.work) }} />
                      <span className="flex-1 truncate text-slate-700 font-medium">{p.work.propertyAddress}</span>
                      {p.fromHq && <span className="text-slate-500 whitespace-nowrap">{fmtTrip(p.fromHq.meters, p.fromHq.seconds, p.fromHq.approximate)}</span>}
                    </button>
                    <button
                      onClick={() => toggleInRoute(p)}
                      title={stop >= 0 ? 'Quitar del recorrido' : 'Agregar al recorrido'}
                      className={`w-6 h-6 mr-1 rounded-full text-xs font-bold shrink-0 ${stop >= 0 ? 'bg-teal-600 text-white' : 'bg-slate-100 text-teal-700 hover:bg-teal-100'}`}
                    >
                      {stop >= 0 ? stop + 1 : '＋'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {notLocated.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-2">
              <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ {notLocated.length} sin ubicar (dirección no encontrada)</p>
              <ul className="space-y-1">
                {notLocated.map(w => (
                  <li key={w.idWork} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate text-slate-700">{w.propertyAddress}</span>
                    {!isWorker && (
                      <button onClick={() => setPicking({ type: 'fix', address: w.propertyAddress })} className="text-amber-800 font-semibold underline whitespace-nowrap">Ubicar en el mapa</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
