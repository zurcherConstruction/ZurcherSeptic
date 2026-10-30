// 🗺️ Mapa del día para el calendario de asignaciones: el trabajo que se está asignando, los trabajos
// que ya hay ese día (con recorrido sugerido desde la sede) y los pendientes que quedan cerca.
import { useEffect, useMemo, useState } from 'react';
import JobsMap from './JobsMap';
import { fetchMapBase, useLocations, useDrivingMatrix, fmtTrip, googleDirectionsUrl } from './mapUtils';

const SELECTED_COLOR = '#dc2626';
const DAY_COLOR = '#2563eb';
const CANDIDATE_COLOR = '#64748b';

/**
 * props:
 *  selected: { key, address }                      — trabajo que se está asignando
 *  dayLabel: string                                 — fecha elegida (para los textos)
 *  dayJobs: [{ key, address, detail }]              — ya programados ese día
 *  candidates: [{ key, address }]                   — pendientes sin fecha (para agrupar por cercanía)
 *  onSelectCandidate(key)                           — opcional: seleccionar un pendiente cercano
 */
export default function DayRouteMap({ selected, dayLabel, dayJobs, candidates, onSelectCandidate }) {
  const [base, setBase] = useState(null);
  useEffect(() => { fetchMapBase().then(setBase).catch(() => {}); }, []);
  const hq = base?.hq;

  const jobs = useMemo(() => {
    const seen = new Set();
    const list = [];
    const push = (job, role) => {
      if (!job?.address || seen.has(job.key)) return;
      seen.add(job.key);
      list.push({ ...job, role });
    };
    push(selected, 'selected');
    dayJobs.forEach(j => push(j, 'day'));
    candidates.forEach(j => push(j, 'candidate'));
    return list;
  }, [selected, dayJobs, candidates]);

  const { locations, loading } = useLocations(useMemo(() => jobs.map(j => j.address), [jobs]));
  const located = useMemo(
    () => jobs.filter(j => locations[j.address]).map(j => ({ ...j, ...locations[j.address] })).slice(0, 89),
    [jobs, locations]
  );
  const coords = useMemo(() => located.map(p => ({ lat: p.lat, lng: p.lng })), [located]);
  const trip = useDrivingMatrix(hq, coords);

  const selIndex = located.findIndex(p => p.role === 'selected');
  const stopIdx = located.map((p, i) => (p.role === 'candidate' ? -2 : i)).filter(i => i !== -2);

  // Recorrido sugerido: desde la sede, siempre al trabajo más cercano que falte
  const routeOrder = useMemo(() => {
    if (!hq) return [];
    const left = [...stopIdx];
    const order = [];
    let current = -1;
    while (left.length) {
      left.sort((a, b) => trip(current, a).seconds - trip(current, b).seconds);
      current = left.shift();
      order.push(current);
    }
    return order;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hq, located, trip]);

  const routeTotal = routeOrder.reduce((acc, idx, k) => {
    const t = trip(k === 0 ? -1 : routeOrder[k - 1], idx);
    return { meters: acc.meters + t.meters, seconds: acc.seconds + t.seconds, approximate: acc.approximate || t.approximate };
  }, { meters: 0, seconds: 0, approximate: false });

  const nearbyCandidates = selIndex >= 0
    ? located
      .map((p, i) => ({ ...p, i }))
      .filter(p => p.role === 'candidate')
      .map(p => ({ ...p, t: trip(selIndex, p.i) }))
      .sort((a, b) => a.t.seconds - b.t.seconds)
      .slice(0, 4)
    : [];

  const points = located.map((p, i) => {
    const stopNumber = routeOrder.indexOf(i);
    return {
      id: p.key,
      lat: p.lat,
      lng: p.lng,
      color: p.role === 'selected' ? SELECTED_COLOR : p.role === 'day' ? DAY_COLOR : CANDIDATE_COLOR,
      label: stopNumber >= 0 ? String(stopNumber + 1) : '',
      faded: p.role === 'candidate',
      title: `${p.role === 'selected' ? '➡️ ' : p.role === 'candidate' ? 'Pendiente: ' : ''}${p.address}${p.detail ? ` · ${p.detail}` : ''}`,
    };
  });

  const route = hq ? [hq, ...routeOrder.map(i => located[i])] : null;
  const selectedLocated = selIndex >= 0;
  const notFound = selected?.address && locations[selected.address] === null;

  return (
    <div className="border-t border-slate-200 pt-4 mt-2">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-slate-700">🗺️ Mapa del día · {dayLabel}</h3>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: SELECTED_COLOR }} /> Este trabajo</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: DAY_COLOR }} /> Ya programados</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full opacity-50" style={{ background: CANDIDATE_COLOR }} /> Pendientes</span>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <JobsMap
            hq={hq}
            fleet={base?.fleet}
            points={points}
            selectedId={selected?.key}
            route={route}
            height="340px"
            fitKey={`${selected?.key}|${dayLabel}|${located.length}|${hq ? 1 : 0}`}
            onSelect={(id) => { if (located.find(p => p.key === id)?.role === 'candidate') onSelectCandidate?.(id); }}
          />
        </div>

        <div className="w-full xl:w-[300px] shrink-0 text-xs space-y-3">
          {loading && !selectedLocated && <p className="text-slate-400">📍 Ubicando direcciones…</p>}
          {notFound && <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">No encontramos esta dirección en el mapa. Podés ubicarla a mano desde la zona de mapas.</p>}

          {selectedLocated && hq && (
            <p className="text-slate-700">🏠 Desde la sede: <strong>{fmtTrip(trip(-1, selIndex).meters, trip(-1, selIndex).seconds, trip(-1, selIndex).approximate)}</strong></p>
          )}

          <div>
            <p className="font-semibold text-slate-500 mb-1">
              {routeOrder.length > 1 ? `Recorrido sugerido (${routeOrder.length} trabajos)` : `Ese día no hay otros trabajos programados`}
            </p>
            {routeOrder.length > 1 && (
              <>
                <ol className="space-y-1">
                  {routeOrder.map((idx, k) => {
                    const p = located[idx];
                    const t = trip(k === 0 ? -1 : routeOrder[k - 1], idx);
                    return (
                      <li key={p.key} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full text-white font-bold flex items-center justify-center shrink-0" style={{ background: p.role === 'selected' ? SELECTED_COLOR : DAY_COLOR }}>{k + 1}</span>
                        <span className="flex-1 truncate text-slate-700" title={p.address}>{p.address}{p.detail ? <span className="text-slate-400"> · {p.detail}</span> : null}</span>
                        <span className="text-slate-500 whitespace-nowrap">{fmtTrip(t.meters, t.seconds, t.approximate)}</span>
                      </li>
                    );
                  })}
                </ol>
                <p className="text-slate-500 mt-1">Total desde la sede: <strong>{fmtTrip(routeTotal.meters, routeTotal.seconds, routeTotal.approximate)}</strong> (solo ida)</p>
              </>
            )}
          </div>

          {nearbyCandidates.length > 0 && (
            <div>
              <p className="font-semibold text-slate-500 mb-1">Pendientes cerca de este trabajo</p>
              <ul className="space-y-1">
                {nearbyCandidates.map(c => (
                  <li key={c.key}>
                    <button onClick={() => onSelectCandidate?.(c.key)} className="w-full flex items-center gap-2 text-left hover:bg-slate-50 rounded px-1 py-0.5">
                      <span className="flex-1 truncate text-slate-700" title={c.address}>{c.address}</span>
                      <span className="text-slate-500 whitespace-nowrap">{fmtTrip(c.t.meters, c.t.seconds, c.t.approximate)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hq && routeOrder.length > 0 && (
            <a
              href={googleDirectionsUrl(hq, routeOrder.map(i => located[i]))}
              target="_blank"
              rel="noreferrer"
              className="inline-block font-semibold bg-white border border-slate-300 hover:border-blue-400 text-slate-700 px-3 py-1.5 rounded-lg"
            >
              🧭 Abrir recorrido en Google Maps
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
