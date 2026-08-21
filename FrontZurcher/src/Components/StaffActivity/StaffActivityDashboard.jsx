import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../utils/axios';
import socket from '../../utils/io';

const toLocalDateInput = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { from: mon, to: sun };
};

const getMonthRange = (offsetMonths = 0) => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1, 0, 0, 0, 0);
  const last = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0, 23, 59, 59, 999);
  return { from: first, to: last };
};

const REPORT_ROLE_LABELS = {
  owner: 'Owner', admin: 'Admin', recept: 'Recept', finance: 'Finance', capataz: 'Capataz',
  'finance-viewer': 'Finance Viewer', sales_rep: 'Sales Rep', 'follow-up': 'Follow-up',
};

function buildReportHTML(data, fromDate, toDate) {
  const fmtDate = (d) => new Date(d).toLocaleDateString('es-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  const fmtMin = (m) => { if (!m) return '—'; if (m < 60) return `${m}m`; return `${Math.floor(m / 60)}h ${m % 60}m`; };
  const fmtH = (m) => { if (!m) return '0.0h'; return `${(m / 60).toFixed(1)}h`; };
  const fromLabel = fmtDate(fromDate);
  const toLabel = fmtDate(toDate);

  // Collect all unique dates across all staff
  const dateSet = new Set();
  data.forEach((s) => s.days.forEach((d) => dateSet.add(d.date)));
  const allDates = [...dateSet].sort();

  // Group by week for totals
  const getWeekNum = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    const jan1 = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  };
  const weeks = [...new Set(allDates.map(getWeekNum))];

  const staffRows = data
    .filter((s) => s.totalMinutes > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .map((s) => {
      const dayMap = {};
      s.days.forEach((d) => { dayMap[d.date] = d.minutes; });
      const cells = allDates.map((date) => {
        const min = dayMap[date] || 0;
        const weekend = new Date(date + 'T12:00:00').getDay() === 0 || new Date(date + 'T12:00:00').getDay() === 6;
        const color = min === 0 ? '#f1f5f9' : weekend ? '#ede9fe' : min >= 480 ? '#dcfce7' : min >= 240 ? '#fef9c3' : '#fee2e2';
        return `<td style="padding:6px 8px;text-align:center;background:${color};font-size:12px;white-space:nowrap;">${min > 0 ? fmtH(min) : '—'}</td>`;
      }).join('');
      const weekCells = weeks.map((wk) => {
        const wkDates = allDates.filter((d) => getWeekNum(d) === wk);
        const wkMin = wkDates.reduce((a, d) => a + (dayMap[d] || 0), 0);
        return `<td style="padding:6px 8px;text-align:center;background:#f0f9ff;font-weight:600;font-size:12px;white-space:nowrap;border-left:2px solid #bae6fd;">${fmtH(wkMin)}</td>`;
      }).join('');
      return `<tr>
        <td style="padding:8px 12px;font-weight:600;font-size:13px;white-space:nowrap;">${s.name}</td>
        <td style="padding:8px 12px;font-size:11px;color:#64748b;white-space:nowrap;">${REPORT_ROLE_LABELS[s.role] || s.role}</td>
        ${cells}
        ${weekCells}
        <td style="padding:8px 12px;text-align:center;font-weight:700;font-size:13px;background:#eff6ff;color:#1d4ed8;border-left:2px solid #93c5fd;white-space:nowrap;">${fmtH(s.totalMinutes)}</td>
      </tr>`;
    }).join('');

  // Totals row
  const totalByDate = {};
  data.forEach((s) => s.days.forEach((d) => { totalByDate[d.date] = (totalByDate[d.date] || 0) + d.minutes; }));
  const totalCells = allDates.map((date) => {
    const min = totalByDate[date] || 0;
    return `<td style="padding:6px 8px;text-align:center;font-weight:700;font-size:12px;background:#f1f5f9;border-top:2px solid #94a3b8;white-space:nowrap;">${min > 0 ? fmtH(min) : '—'}</td>`;
  }).join('');
  const totalWeekCells = weeks.map((wk) => {
    const wkDates = allDates.filter((d) => getWeekNum(d) === wk);
    const wkTotal = wkDates.reduce((a, d) => a + (totalByDate[d] || 0), 0);
    return `<td style="padding:6px 8px;text-align:center;font-weight:700;font-size:12px;background:#e0f2fe;border-left:2px solid #bae6fd;white-space:nowrap;">${fmtH(wkTotal)}</td>`;
  }).join('');
  const grandTotal = data.reduce((a, s) => a + s.totalMinutes, 0);
  const totalRow = `<tr style="background:#f8fafc;">
    <td colspan="2" style="padding:8px 12px;font-weight:700;font-size:13px;color:#334155;">TOTAL EQUIPO</td>
    ${totalCells}${totalWeekCells}
    <td style="padding:8px 12px;text-align:center;font-weight:800;font-size:14px;background:#dbeafe;color:#1e40af;border-left:2px solid #93c5fd;white-space:nowrap;">${fmtH(grandTotal)}</td>
  </tr>`;

  const dateHeaders = allDates.map((date) => {
    const d = new Date(date + 'T12:00:00');
    const lbl = d.toLocaleDateString('es-US', { weekday: 'short', day: 'numeric' });
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    return `<th style="padding:6px 8px;text-align:center;font-size:11px;white-space:nowrap;background:${weekend ? '#f3f0ff' : '#f8fafc'};color:${weekend ? '#7c3aed' : '#64748b'};">${lbl}</th>`;
  }).join('');
  const weekHeaders = weeks.map((wk) => `<th style="padding:6px 8px;text-align:center;font-size:11px;white-space:nowrap;background:#e0f2fe;color:#0369a1;border-left:2px solid #bae6fd;">Semana ${wk}</th>`).join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte de Actividad — Zurcher Septic</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; color: #1e293b; }
    h1 { font-size: 20px; margin: 0 0 4px; color: #1e3a5f; }
    .sub { color: #64748b; font-size: 13px; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th { padding: 8px 10px; text-align: left; background: #f1f5f9; color: #475569; font-weight: 600; }
    tr:nth-child(even) td:not([style]) { background: #fafafa; }
    .legend { margin-top: 20px; font-size: 11px; color: #94a3b8; display: flex; gap: 16px; flex-wrap: wrap; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; }
    @media print {
      @page { size: landscape; margin: 1cm; }
      button { display: none !important; }
      body { padding: 0; }
    }
  </style>
  </head><body>
  <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:8px;">
    <div>
      <h1>Monitor de Actividad del Equipo</h1>
      <div class="sub">Zurcher Septic · Período: ${fromLabel} — ${toLabel}</div>
    </div>
    <button onclick="window.print()" style="padding:8px 16px;background:#1d4ed8;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Imprimir / Guardar PDF</button>
  </div>
  <div style="overflow-x:auto;">
  <table>
    <thead>
      <tr>
        <th style="min-width:140px;">Empleado</th>
        <th style="min-width:90px;">Rol</th>
        ${dateHeaders}
        ${weekHeaders}
        <th style="text-align:center;background:#dbeafe;color:#1e40af;border-left:2px solid #93c5fd;white-space:nowrap;">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${staffRows}
      ${totalRow}
    </tbody>
  </table>
  </div>
  <div class="legend">
    <span><span class="dot" style="background:#dcfce7;border:1px solid #86efac;"></span>8+ horas</span>
    <span><span class="dot" style="background:#fef9c3;border:1px solid #fde047;"></span>4–8 horas</span>
    <span><span class="dot" style="background:#fee2e2;border:1px solid #fca5a5;"></span>Menos de 4 horas</span>
    <span><span class="dot" style="background:#ede9fe;border:1px solid #c4b5fd;"></span>Fin de semana</span>
    <span><span class="dot" style="background:#f1f5f9;border:1px solid #cbd5e1;"></span>Sin actividad</span>
    <span>· Horas estimadas por sesiones de actividad API (30 min sin actividad = nueva sesión, +5 min buffer/sesión, 2 min debounce)</span>
  </div>
  </body></html>`;
}

const ReportModal = ({ onClose }) => {
  const [preset, setPreset] = useState('week');
  const [customFrom, setCustomFrom] = useState(() => toLocalDateInput(getWeekRange().from));
  const [customTo, setCustomTo] = useState(() => toLocalDateInput(getWeekRange().to));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const applyPreset = (p) => {
    setPreset(p);
    if (p === 'week') {
      const r = getWeekRange();
      setCustomFrom(toLocalDateInput(r.from));
      setCustomTo(toLocalDateInput(r.to));
    } else if (p === 'month') {
      const r = getMonthRange(0);
      setCustomFrom(toLocalDateInput(r.from));
      setCustomTo(toLocalDateInput(r.to));
    } else if (p === 'prevmonth') {
      const r = getMonthRange(-1);
      setCustomFrom(toLocalDateInput(r.from));
      setCustomTo(toLocalDateInput(r.to));
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const from = new Date(customFrom + 'T00:00:00').toISOString();
      const to = new Date(customTo + 'T23:59:59').toISOString();
      const { data } = await api.get(`/staff-activity/report?from=${from}&to=${to}`);
      const html = buildReportHTML(data.data || [], from, to);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      } else {
        setError('El navegador bloqueó la ventana emergente. Por favor, permite popups para este sitio.');
      }
    } catch (_) {
      setError('Error al generar el reporte. Intente nuevamente.');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-800 to-blue-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-white font-semibold">Generar Reporte PDF</h2>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl font-light">✕</button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Período del reporte</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { key: 'week', label: 'Semana actual' },
                { key: 'month', label: 'Mes actual' },
                { key: 'prevmonth', label: 'Mes anterior' },
                { key: 'custom', label: 'Personalizado' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`py-2 px-3 rounded-xl text-sm font-medium border transition-colors ${preset === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Desde</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => { setCustomFrom(e.target.value); setPreset('custom'); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Hasta</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => { setCustomTo(e.target.value); setPreset('custom'); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
            El reporte se abrirá en una nueva ventana con una tabla de horas por día por empleado, totales semanales y total del período. Desde ahí podrá imprimirlo o guardarlo como PDF.
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button
              onClick={handleGenerate}
              disabled={loading || !customFrom || !customTo}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando...</> : 'Generar Reporte'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SessionDiagram = () => {
  const actions = [
    { t: 0, label: '9:00am', note: 'Abre presupuesto' },
    { t: 18, label: '9:18am', note: 'Guarda cambios' },
    { t: 35, label: '9:35am', note: 'Envía correo' },
  ];
  const actions2 = [
    { t: 85, label: '10:25am', note: 'Abre obra #312' },
    { t: 100, label: '10:40am', note: 'Carga foto' },
    { t: 115, label: '10:55am', note: 'Cierra obra' },
  ];
  const totalMin = 130;
  const pct = (m) => `${(m / totalMin) * 100}%`;
  const s1Start = 0, s1End = 35, s2Start = 85, s2End = 115;

  return (
    <div className="mt-3 select-none">
      <div className="relative h-10 bg-gray-100 rounded-xl overflow-visible mx-2">
        {/* Sesión 1 */}
        <div
          className="absolute top-0 h-full bg-blue-200 rounded-l-xl"
          style={{ left: pct(s1Start), width: pct(s1End - s1Start) }}
          title="Sesión 1"
        />
        {/* Buffer 1 */}
        <div
          className="absolute top-0 h-full bg-blue-100 border-r-2 border-dashed border-blue-300"
          style={{ left: pct(s1End), width: pct(5) }}
          title="+5 min buffer"
        />
        {/* Gap */}
        <div
          className="absolute top-0 h-full flex items-center justify-center"
          style={{ left: pct(s1End + 5), width: pct(s2Start - s1End - 5) }}
        >
          <div className="bg-amber-100 border border-amber-300 rounded-lg px-2 py-0.5 text-[10px] font-bold text-amber-700 whitespace-nowrap z-10 shadow-sm">
            45 min sin actividad
          </div>
        </div>
        {/* Sesión 2 */}
        <div
          className="absolute top-0 h-full bg-emerald-200 rounded-r-xl"
          style={{ left: pct(s2Start), width: pct(s2End - s2Start) }}
        />
        {/* Buffer 2 */}
        <div
          className="absolute top-0 h-full bg-emerald-100"
          style={{ left: pct(s2End), width: pct(5) }}
        />
        {/* Puntos de acción */}
        {[...actions, ...actions2].map((a, i) => (
          <div
            key={i}
            className="absolute top-1/2 -translate-y-1/2 group"
            style={{ left: pct(a.t) }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-500 shadow -translate-x-1/2 cursor-default" />
            <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] rounded-md px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg">
              <div className="font-semibold">{a.label}</div>
              <div className="text-gray-300">{a.note}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Leyenda debajo */}
      <div className="flex items-start gap-3 mt-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <div className="w-4 h-3 rounded-sm bg-blue-200 shrink-0" />
          <span>Sesión 1 <span className="text-gray-400">(35 min trabajados + 5 min buffer = <strong className="text-blue-700">40 min</strong>)</span></span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <div className="w-4 h-3 rounded-sm bg-emerald-200 shrink-0" />
          <span>Sesión 2 <span className="text-gray-400">(30 min trabajados + 5 min buffer = <strong className="text-emerald-700">35 min</strong>)</span></span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <div className="w-4 h-3 rounded-sm bg-amber-100 border border-amber-300 shrink-0" />
          <span>Pausa &gt;30 min → <strong className="text-amber-700">nueva sesión</strong></span>
        </div>
      </div>

      <div className="mt-3 bg-blue-50 rounded-xl px-3 py-2 text-[11px] text-blue-700">
        <strong>Total del ejemplo:</strong> 40 + 35 = <strong>1h 15min</strong> registradas para este empleado en ese bloque del día.
        Pase el cursor sobre los puntos para ver cada acción.
      </div>
    </div>
  );
};

const ComplianceExample = () => {
  const days = [
    { label: 'Lun', min: 480, weekend: false },
    { label: 'Mar', min: 390, weekend: false },
    { label: 'Mié', min: 510, weekend: false },
    { label: 'Jue', min: 0, weekend: false },
    { label: 'Vie', min: 460, weekend: false },
    { label: 'Sáb', min: 120, weekend: true },
    { label: 'Dom', min: 0, weekend: true },
  ];
  const total = days.filter(d => !d.weekend).reduce((a, d) => a + d.min, 0);
  const expected = 5 * 480;
  const pct = Math.round((total / expected) * 100);
  return (
    <div className="mt-3">
      <div className="flex items-end gap-2 mb-3">
        {days.map((d, i) => {
          const h = d.min > 0 ? Math.max(12, Math.round((d.min / 540) * 56)) : 4;
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <div className="text-[10px] text-gray-500 font-medium">{d.min > 0 ? `${(d.min/60).toFixed(1)}h` : '—'}</div>
              <div className="w-full relative" style={{ height: '56px' }}>
                <div
                  className={`absolute bottom-0 w-full rounded-t-md transition-all ${d.weekend ? 'bg-violet-300' : d.min >= 480 ? 'bg-emerald-400' : d.min > 0 ? 'bg-amber-300' : 'bg-gray-200'}`}
                  style={{ height: `${h}px` }}
                />
                {!d.weekend && (
                  <div className="absolute bottom-0 w-full border-t-2 border-dashed border-gray-400" style={{ bottom: `${Math.round((480 / 540) * 56)}px` }} />
                )}
              </div>
              <div className={`text-[10px] font-semibold ${d.weekend ? 'text-violet-500' : 'text-gray-500'}`}>{d.label}</div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
          <div className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-bold text-blue-700 whitespace-nowrap">{pct}% cumplimiento</span>
      </div>
      <div className="flex gap-3 mt-2 text-[10px] text-gray-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />8h+ (cumplió)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-300 inline-block" />Menos de 8h</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 inline-block" />Sin actividad</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-violet-300 inline-block" />Fin de semana (extra, no penaliza)</span>
      </div>
    </div>
  );
};

const OnlineDemo = () => (
  <div className="mt-3 space-y-2">
    {[
      { label: 'María López', online: true, note: 'Tiene el sistema abierto ahora mismo' },
      { label: 'Carlos Ruiz', online: false, today: true, note: 'Estuvo activo hoy, ya cerró sesión' },
      { label: 'Ana Torres', online: false, today: false, note: 'Sin actividad reciente' },
    ].map((p, i) => (
      <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center text-white text-xs font-bold">
            {p.label.split(' ').map(w => w[0]).join('')}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5">
            {p.online
              ? <span className="relative flex w-2.5 h-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/><span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-green-500"/></span>
              : p.today
              ? <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              : <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700">{p.label}</p>
          <p className="text-[11px] text-gray-400">{p.note}</p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${p.online ? 'bg-green-100 text-green-700' : p.today ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
          {p.online ? 'Conectado ahora' : p.today ? 'Activo hoy' : 'Sin actividad'}
        </span>
      </div>
    ))}
    <p className="text-[11px] text-gray-400 pt-1">El punto verde pulsante se actualiza al instante — no hay que esperar al refresco de 2 minutos.</p>
  </div>
);

const INFO_CARDS = [
  {
    id: 'acciones',
    icon: '📡',
    color: 'blue',
    title: 'Registro automático',
    short: 'No hay que fichar entrada ni salida. Cada acción en el sistema se registra sola.',
    detail: 'Cuando un empleado abre una orden de trabajo, guarda un presupuesto, consulta un cliente o navega por cualquier sección, el sistema registra esa acción automáticamente en segundo plano. No requiere nada del empleado.',
    example: (
      <div className="mt-3 space-y-1.5">
        {['Abre Orden de Trabajo #512', 'Guarda nota en presupuesto', 'Consulta cliente en Sales Leads', 'Revisa estado de instalación'].map((a, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px] text-gray-600 bg-blue-50 rounded-lg px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            {a}
            <span className="ml-auto text-blue-400 font-medium">✓ registrado</span>
          </div>
        ))}
        <p className="text-[11px] text-gray-400 pt-1">Cada una de estas acciones genera un registro. El empleado ni lo nota.</p>
      </div>
    ),
  },
  {
    id: 'sesiones',
    icon: '⏱',
    color: 'indigo',
    title: 'Sesiones de trabajo',
    short: 'El sistema agrupa las acciones en bloques. Más de 30 min sin actividad = nueva sesión.',
    detail: 'Las acciones cercanas en el tiempo se agrupan en una sola "sesión de trabajo". Si hay una pausa de más de 30 minutos (almuerzo, reunión, etc.), el sistema cierra la sesión anterior y la siguiente es una nueva. A cada sesión se le suman 5 minutos de buffer al final para reconocer el tiempo de lectura o trabajo pasivo.',
    example: <SessionDiagram />,
  },
  {
    id: 'debounce',
    icon: '🔁',
    color: 'violet',
    title: 'Filtro anti-inflación (2 min)',
    short: 'Acciones muy seguidas cuentan como una sola para no inflar el conteo.',
    detail: 'Si alguien navega rápido entre pantallas (abre 5 cosas en 30 segundos), el sistema solo registra una acción cada 2 minutos. Esto evita que un usuario "rápido" acumule el doble de tiempo que uno que trabaja concentrado en una sola tarea.',
    example: (
      <div className="mt-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-[11px] font-bold text-red-600 mb-2">❌ Sin filtro (inflado)</p>
            {['9:00:00 — acción 1', '9:00:20 — acción 2', '9:00:45 — acción 3', '9:01:10 — acción 4'].map((a, i) => (
              <div key={i} className="text-[10px] text-gray-500 py-0.5 border-b border-red-50 last:border-0">{a}</div>
            ))}
            <p className="text-[11px] font-bold text-red-500 mt-2">= 4 registros, tiempo inflado</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
            <p className="text-[11px] font-bold text-emerald-600 mb-2">✅ Con filtro (real)</p>
            <div className="text-[10px] text-gray-500 py-0.5 border-b border-emerald-50">9:00:00 — acción 1 ✓</div>
            <div className="text-[10px] text-gray-400 py-0.5 border-b border-emerald-50 line-through opacity-50">9:00:20 — ignorada</div>
            <div className="text-[10px] text-gray-400 py-0.5 border-b border-emerald-50 line-through opacity-50">9:00:45 — ignorada</div>
            <div className="text-[10px] text-gray-400 py-0.5 line-through opacity-50">9:01:10 — ignorada</div>
            <p className="text-[11px] font-bold text-emerald-600 mt-2">= 1 registro, tiempo real</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'roles',
    icon: '🖥',
    color: 'teal',
    title: '¿A quién cubre?',
    short: 'Solo el equipo de oficina. Los técnicos de campo no aparecen aquí.',
    detail: 'Este monitor cubre a todos los roles que trabajan en el sistema web. Los empleados de campo que no usan la plataforma no generan actividad aquí — su seguimiento se hace por otros medios (asistencia, GPS, etc.).',
    example: (
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-bold text-teal-600 mb-1.5">✅ Aparecen en el monitor</p>
          {['Owner', 'Admin', 'Finance', 'Recept', 'Sales Rep', 'Follow-up', 'Capataz'].map((r) => (
            <div key={r} className="text-[11px] text-gray-600 flex items-center gap-1.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />{r}
            </div>
          ))}
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 mb-1.5">⭕ No aparecen</p>
          {['Técnicos de campo', 'Operadores sin acceso web', 'Subcontratistas'].map((r) => (
            <div key={r} className="text-[11px] text-gray-400 flex items-center gap-1.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />{r}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'online',
    icon: '🟢',
    color: 'green',
    title: 'Punto verde = tiempo real',
    short: 'El punto pulsante cambia al instante cuando alguien abre o cierra el sistema.',
    detail: 'La presencia "en línea" funciona por conexión directa (Socket.IO), no por polling. Cuando alguien abre el sistema, el punto verde aparece de inmediato. Cuando cierra el navegador o la pestaña, desaparece al instante — sin esperar al refresco de 2 minutos.',
    example: <OnlineDemo />,
  },
  {
    id: 'cumplimiento',
    icon: '📅',
    color: 'amber',
    title: 'Cumplimiento semanal',
    short: 'Se compara el tiempo registrado vs. 8 horas por día hábil (lunes a viernes).',
    detail: 'La jornada esperada es de 8 horas de lunes a viernes. Si la semana tiene 5 días hábiles, la expectativa es 40 horas. El porcentaje muestra cuánto de eso cubrió el empleado según el tiempo registrado en el sistema. Los fines de semana cuentan como información extra, pero no afectan el cumplimiento.',
    example: <ComplianceExample />,
  },
];

const COLOR_MAP = {
  blue: { badge: 'bg-blue-100 text-blue-700', border: 'border-blue-200', header: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', active: 'ring-2 ring-blue-400 border-blue-300' },
  indigo: { badge: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-200', header: 'bg-indigo-50', icon: 'bg-indigo-100 text-indigo-600', active: 'ring-2 ring-indigo-400 border-indigo-300' },
  violet: { badge: 'bg-violet-100 text-violet-700', border: 'border-violet-200', header: 'bg-violet-50', icon: 'bg-violet-100 text-violet-600', active: 'ring-2 ring-violet-400 border-violet-300' },
  teal: { badge: 'bg-teal-100 text-teal-700', border: 'border-teal-200', header: 'bg-teal-50', icon: 'bg-teal-100 text-teal-600', active: 'ring-2 ring-teal-400 border-teal-300' },
  green: { badge: 'bg-green-100 text-green-700', border: 'border-green-200', header: 'bg-green-50', icon: 'bg-green-100 text-green-600', active: 'ring-2 ring-green-400 border-green-300' },
  amber: { badge: 'bg-amber-100 text-amber-700', border: 'border-amber-200', header: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', active: 'ring-2 ring-amber-400 border-amber-300' },
};

const InfoSection = () => {
  const [open, setOpen] = useState(false);
  const [activeCard, setActiveCard] = useState(null);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
      <button
        onClick={() => { setOpen((v) => !v); if (open) setActiveCard(null); }}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-bold text-slate-800">¿Cómo se calculan las horas y la actividad?</span>
            <p className="text-xs text-gray-400 mt-0.5">Toca cada tarjeta para ver la explicación con ejemplos</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {open && <span className="text-xs text-blue-500 font-medium hidden sm:block">Toca una tarjeta</span>}
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4">
          {/* Grid de tarjetas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {INFO_CARDS.map((card) => {
              const c = COLOR_MAP[card.color];
              const isActive = activeCard === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => setActiveCard(isActive ? null : card.id)}
                  className={`text-left rounded-xl border p-3 transition-all ${c.border} ${isActive ? c.active + ' shadow-md' : 'hover:shadow-sm hover:scale-[1.02]'} bg-white`}
                >
                  <div className={`w-8 h-8 rounded-lg ${c.icon} flex items-center justify-center text-base mb-2`}>
                    {card.icon}
                  </div>
                  <p className="text-xs font-bold text-gray-800 leading-tight mb-1">{card.title}</p>
                  <p className="text-[10px] text-gray-400 leading-snug">{card.short}</p>
                  <div className={`mt-2 text-[10px] font-semibold ${isActive ? 'text-blue-600' : 'text-gray-300'}`}>
                    {isActive ? '▲ cerrar' : '▼ ver más'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Panel de detalle */}
          {activeCard && (() => {
            const card = INFO_CARDS.find((c) => c.id === activeCard);
            const c = COLOR_MAP[card.color];
            return (
              <div className={`rounded-2xl border ${c.border} overflow-hidden`}>
                <div className={`${c.header} px-4 py-3 flex items-center gap-2`}>
                  <span className="text-lg">{card.icon}</span>
                  <h3 className="font-bold text-gray-800 text-sm">{card.title}</h3>
                </div>
                <div className="bg-white px-4 pb-4 pt-3">
                  <p className="text-sm text-gray-600 leading-relaxed">{card.detail}</p>
                  {card.example}
                </div>
              </div>
            );
          })()}

          <div className="mt-3 flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2.5 text-[11px] text-gray-500">
            <span className="shrink-0 mt-0.5">💡</span>
            <span><strong>Importante:</strong> Es una estimación precisa, no un reloj de fichar. Puede subestimar levemente si alguien trabaja en papel o fuera del sistema. Lo que mide con exactitud es el tiempo activo dentro de la plataforma Zurcher.</span>
          </div>
        </div>
      )}
    </div>
  );
};

const ROLE_LABELS = {
  owner: 'Owner', admin: 'Admin', recept: 'Recept', finance: 'Finance', capataz: 'Capataz',
  'finance-viewer': 'Finance Viewer', sales_rep: 'Sales Rep', 'follow-up': 'Follow-up',
};

const ROLE_BADGE = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  recept: 'bg-emerald-100 text-emerald-700',
  finance: 'bg-amber-100 text-amber-700',
  capataz: 'bg-teal-100 text-teal-700',
  'finance-viewer': 'bg-gray-100 text-gray-600',
  sales_rep: 'bg-orange-100 text-orange-700',
  'follow-up': 'bg-pink-100 text-pink-700',
};

const ROLE_AVATAR = {
  owner: 'bg-purple-500', admin: 'bg-blue-500', recept: 'bg-emerald-500', finance: 'bg-amber-500', capataz: 'bg-teal-500',
  'finance-viewer': 'bg-gray-400', sales_rep: 'bg-orange-500', 'follow-up': 'bg-pink-500',
};

// Orden de visualización preferido: Owner primero, luego Admin/Finance/Recept/Capataz,
// y Sales Rep / Finance Viewer al final (roles con menos necesidad de seguimiento diario).
const ROLE_ORDER = ['owner', 'admin', 'finance', 'recept', 'capataz', 'follow-up', 'sales_rep', 'finance-viewer'];
const roleSortIndex = (role) => {
  const idx = ROLE_ORDER.indexOf(role);
  return idx === -1 ? ROLE_ORDER.length : idx;
};

const formatMinutes = (min) => {
  if (!min) return '—';
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
};

const formatHoursDecimal = (min) => {
  if (!min) return '0h';
  return `${(min / 60).toFixed(1)}h`;
};

const formatRelative = (dateStr) => {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Hace ${d}d`;
  return new Date(dateStr).toLocaleDateString('es-US', { month: 'short', day: 'numeric' });
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' });
};

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

const isSameDay = (dateStr, ref = new Date()) =>
  dateStr && new Date(dateStr).toDateString() === ref.toDateString();

const StatusDot = ({ isOnline, lastSeen }) => {
  if (isOnline) {
    return (
      <span className="relative flex w-2.5 h-2.5" title="Conectado ahora (sesión abierta en tiempo real)">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-green-500" />
      </span>
    );
  }
  if (isSameDay(lastSeen)) return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" title="Activo hoy, sesión cerrada" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" title="Sin actividad reciente" />;
};

const Avatar = ({ name, role }) => (
  <div className={`w-9 h-9 rounded-full ${ROLE_AVATAR[role] || 'bg-gray-400'} text-white flex items-center justify-center text-xs font-semibold shrink-0 shadow-sm`}>
    {getInitials(name)}
  </div>
);

// Mini gráfico de barras: horas trabajadas de los últimos 7 días
const EXPECTED_DAILY_MINUTES = 480; // 8hs

const PATTERN_LABELS = {
  continuo: 'Jornada continua',
  partido: 'Jornada partida (2 bloques)',
  disperso: 'Jornada dispersa (varios bloques)',
  sin_actividad: 'Sin actividad',
};

const PATTERN_BADGE = {
  continuo: 'bg-emerald-50 text-emerald-700',
  partido: 'bg-amber-50 text-amber-700',
  disperso: 'bg-orange-50 text-orange-700',
  sin_actividad: 'bg-gray-100 text-gray-400',
};

const PatternBadge = ({ pattern }) => {
  if (!pattern || pattern === 'sin_actividad') return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PATTERN_BADGE[pattern] || 'bg-gray-100 text-gray-500'}`}>
      {PATTERN_LABELS[pattern] || pattern}
    </span>
  );
};

// Mini gráfico de barras: horas trabajadas de los últimos 7 días, con referencia a la jornada esperada (8hs, L-V)
const WeekBars = ({ days = [] }) => {
  if (!days.length) return <span className="text-gray-300 text-xs">—</span>;
  const BAR_AREA_HEIGHT = 32;
  const max = Math.max(EXPECTED_DAILY_MINUTES * 1.15, ...days.map((d) => d.minutes || 0));
  const todayKey = new Date().toISOString().split('T')[0];
  const targetLineHeight = Math.round((EXPECTED_DAILY_MINUTES / max) * BAR_AREA_HEIGHT);

  return (
    <div className="flex items-end gap-1.5 relative">
      {/* Línea de referencia: jornada esperada de 8hs */}
      <div
        className="absolute left-0 right-0 border-t border-dashed border-gray-300 pointer-events-none"
        style={{ bottom: `${targetLineHeight + 13}px` }}
        title="Jornada esperada: 8hs"
      />
      {days.map((d) => {
        const isWeekendDay = d.isWeekend;
        const isToday = d.date === todayKey;
        const height = d.minutes > 0 ? Math.max(5, Math.round((d.minutes / max) * BAR_AREA_HEIGHT)) : 2;
        const label = new Date(d.date + 'T12:00:00').toLocaleDateString('es-US', { weekday: 'short' });
        const fullLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('es-US', { weekday: 'long', month: 'short', day: 'numeric' });

        let barColor = 'bg-gray-100';
        if (d.minutes > 0) {
          if (isWeekendDay) barColor = 'bg-violet-400 group-hover:bg-violet-500';
          else if (isToday) barColor = 'bg-blue-500';
          else barColor = 'bg-blue-200 group-hover:bg-blue-400';
        }

        return (
          <div key={d.date} className="flex flex-col items-center gap-1 group relative">
            <div className="h-8 flex items-end">
              <div
                className={`w-2 rounded-t-sm transition-colors ${barColor}`}
                style={{ height: `${height}px` }}
              />
            </div>
            <span className={`text-[9px] leading-none ${isToday ? 'text-blue-600 font-bold' : isWeekendDay ? 'text-violet-400 font-semibold' : 'text-gray-300'}`}>
              {label[0].toUpperCase()}
            </span>
            <div className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-[11px] rounded-md px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg space-y-0.5">
              <div className="capitalize font-semibold">{fullLabel}</div>
              <div>⏱ {formatMinutes(d.minutes)}{isWeekendDay && d.minutes > 0 ? ' · Fin de semana' : ''}</div>
              {d.minutes > 0 && <div className="text-gray-300">{PATTERN_LABELS[d.pattern] || ''}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Línea de tiempo del día (0-24h) mostrando bloques de sesión, para ver si las horas
// se trabajaron seguidas o repartidas en distintos momentos del día.
const DayTimeline = ({ sessions = [] }) => {
  const minutesOfDay = (date) => {
    const d = new Date(date);
    return d.getHours() * 60 + d.getMinutes();
  };

  return (
    <div className="px-4 py-2.5 bg-white">
      <div className="relative h-4 bg-gray-50 rounded-md overflow-hidden border border-gray-100">
        {/* Banda de horario laboral de referencia 8am-5pm */}
        <div
          className="absolute inset-y-0 bg-gray-100/80"
          style={{ left: `${(8 * 60 / 1440) * 100}%`, width: `${((17 - 8) * 60 / 1440) * 100}%` }}
        />
        {sessions.map((session, i) => {
          const startMin = minutesOfDay(session.start);
          const endMin = Math.max(startMin + 3, minutesOfDay(session.end));
          const left = (startMin / 1440) * 100;
          const width = Math.max(0.8, ((endMin - startMin) / 1440) * 100);
          return (
            <div
              key={i}
              className="absolute inset-y-0 bg-blue-500 rounded-sm hover:bg-blue-600 transition-colors group"
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${formatTime(session.start)} - ${formatTime(session.end)} (${formatMinutes(session.minutes)})`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-gray-300 mt-0.5">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>12am</span>
      </div>
    </div>
  );
};

const DetailPanel = ({ staffId, staffName, onClose }) => {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7');

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const from = new Date(Date.now() - parseInt(range) * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await api.get(`/staff-activity/${staffId}?from=${from}`);
        setDays(data.days || []);
      } catch (_) {}
      setLoading(false);
    };
    fetchDetail();
  }, [staffId, range]);

  const totalMinutes = days.reduce((a, d) => a + (d.minutes || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{staffName}</h2>
            <p className="text-sm text-gray-500">
              Actividad detallada
              {days.length > 0 && (
                <span className="ml-2 font-medium text-blue-600">· {formatHoursDecimal(totalMinutes)} en total</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="7">Últimos 7 días</option>
              <option value="14">Últimos 14 días</option>
              <option value="30">Últimos 30 días</option>
            </select>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light leading-none">✕</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400">
              <div className="animate-spin w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full mx-auto mb-3" />
              Cargando...
            </div>
          ) : days.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📊</p>
              <p>Sin actividad en este período</p>
            </div>
          ) : (
            <div className="space-y-4">
              {days.map((day) => (
                <div key={day.date} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700 text-sm capitalize">
                        {new Date(day.date + 'T12:00:00').toLocaleDateString('es-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </span>
                      {day.isWeekend && (
                        <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full font-medium">Fin de semana</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {day.expectedMinutes > 0 && (
                        <span className={`font-medium ${day.complianceRatio >= 1 ? 'text-emerald-600' : day.complianceRatio >= 0.5 ? 'text-amber-600' : 'text-red-500'}`}>
                          {Math.round((day.complianceRatio || 0) * 100)}% de 8hs
                        </span>
                      )}
                      <span className="font-semibold text-blue-600">⏱ {formatMinutes(day.minutes)}</span>
                      <span>{day.actions} acciones</span>
                    </div>
                  </div>

                  {day.sessions.length > 0 && <DayTimeline sessions={day.sessions} />}

                  <div className="px-4 pb-2 flex items-center justify-between">
                    <PatternBadge pattern={day.pattern} />
                  </div>

                  {day.sections.length > 0 && (
                    <div className="px-4 py-2 flex flex-wrap gap-1.5 border-y border-gray-50">
                      {day.sections.map((s) => (
                        <span key={s} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  )}

                  <div className="divide-y divide-gray-50">
                    {day.sessions.map((session, i) => (
                      <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <span className="text-gray-400 font-mono text-xs">{formatTime(session.start)}</span>
                          <span className="text-gray-300">→</span>
                          <span className="text-gray-400 font-mono text-xs">{formatTime(session.end)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{session.actions} acciones</span>
                          <span className="font-medium text-emerald-600">{formatMinutes(session.minutes)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub, accent, icon }) => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100/80 flex items-start gap-3 hover:shadow-md transition-shadow">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent.bg} shadow-sm`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 leading-none ${accent.text}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  </div>
);

export default function StaffActivityDashboard() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState('lastSeen');
  const [onlineIds, setOnlineIds] = useState(null);
  const [showReport, setShowReport] = useState(false);

  // isBackground = true en los refrescos automáticos: evita el spinner de pantalla completa
  // para que la tabla no "parpadee" cada 2 minutos si ya hay datos en pantalla.
  const fetchSummary = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const { data } = await api.get('/staff-activity/summary');
      setStaff(data.data || []);
      setLastRefresh(new Date());
    } catch (_) {}
    if (!isBackground) setLoading(false);
  }, []);

  useEffect(() => { fetchSummary(false); }, [fetchSummary]);

  // Presencia en tiempo real vía Socket.IO (misma conexión que ya usa la app para notificaciones,
  // sin polling extra: el servidor solo emite cuando alguien entra/sale).
  useEffect(() => {
    const handleOnlineUpdate = (ids) => setOnlineIds(new Set(ids));
    socket.on('onlineStaffUpdate', handleOnlineUpdate);
    return () => socket.off('onlineStaffUpdate', handleOnlineUpdate);
  }, []);

  // Refresco periódico de las métricas históricas (horas, patrones, etc.). El estado "online"
  // ya no depende de este intervalo, se actualiza al instante por socket.
  useEffect(() => {
    const interval = setInterval(() => fetchSummary(true), 120000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  const staffWithPresence = useMemo(
    () => staff.map((s) => ({ ...s, isOnline: onlineIds ? onlineIds.has(s.id) : s.isOnline })),
    [staff, onlineIds]
  );

  const activeNow = staffWithPresence.filter((s) => s.isOnline).length;
  const activeToday = staffWithPresence.filter((s) => s.todayMinutes > 0).length;
  const totalTodayMin = staffWithPresence.reduce((a, s) => a + (s.todayMinutes || 0), 0);
  const avgPerActive = activeToday > 0 ? Math.round(totalTodayMin / activeToday) : 0;

  const withCompliance = staffWithPresence.filter((s) => s.weekComplianceRatio != null);
  const avgCompliance = withCompliance.length
    ? Math.round((withCompliance.reduce((a, s) => a + s.weekComplianceRatio, 0) / withCompliance.length) * 100)
    : null;
  const weekendWorkersCount = staffWithPresence.filter((s) => s.workedWeekend).length;

  const roles = useMemo(
    () => [...new Set(staffWithPresence.map((s) => s.role))].sort((a, b) => roleSortIndex(a) - roleSortIndex(b)),
    [staffWithPresence]
  );

  const filtered = useMemo(() => {
    let result = staffWithPresence.filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || s.role === roleFilter;
      return matchesSearch && matchesRole;
    });
    result = [...result].sort((a, b) => {
      if (sortBy === 'todayMinutes') return (b.todayMinutes || 0) - (a.todayMinutes || 0);
      if (sortBy === 'weekMinutes') return (b.weekMinutes || 0) - (a.weekMinutes || 0);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      // default: online primero, luego por rol (Owner, Admin, Finance, Recept, Capataz... al final Sales Rep/Finance Viewer), luego última actividad
      if (sortBy === 'lastSeen') {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        const roleDiff = roleSortIndex(a.role) - roleSortIndex(b.role);
        if (roleDiff !== 0) return roleDiff;
      }
      return new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0);
    });
    return result;
  }, [staffWithPresence, search, roleFilter, sortBy]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">

      {/* Gradient header banner */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-blue-900 shadow-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20 shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Monitor de Actividad del Equipo</h1>
              <p className="text-sm text-white/60 mt-0.5">
                Horas trabajadas e interacción con el sistema
                {lastRefresh && <span className="ml-2">· Actualizado {formatTime(lastRefresh)}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 rounded-xl text-sm font-semibold hover:bg-blue-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Reporte PDF</span>
            </button>
            <button
              onClick={() => fetchSummary(false)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 text-white rounded-xl text-sm hover:bg-white/20 transition-colors disabled:opacity-40"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

        <InfoSection />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard
            label="Conectados ahora"
            value={activeNow}
            sub={`de ${staff.length} usuarios`}
            accent={{ bg: 'bg-green-50', text: 'text-green-600' }}
            icon={<span className="relative flex w-2.5 h-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-green-500" /></span>}
          />
          <StatCard
            label="Activos hoy"
            value={activeToday}
            sub={`de ${staff.length} usuarios`}
            accent={{ bg: 'bg-blue-50', text: 'text-blue-600' }}
            icon={<svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4" /></svg>}
          />
          <StatCard
            label="Tiempo total hoy"
            value={formatMinutes(totalTodayMin)}
            sub="suma del equipo"
            accent={{ bg: 'bg-indigo-50', text: 'text-indigo-600' }}
            icon={<svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard
            label="Promedio activo hoy"
            value={formatMinutes(avgPerActive)}
            sub="por usuario"
            accent={{ bg: 'bg-amber-50', text: 'text-amber-600' }}
            icon={<svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          />
          <StatCard
            label="Cumplimiento semanal"
            value={avgCompliance != null ? `${avgCompliance}%` : '—'}
            sub="vs. 40hs (L-V)"
            accent={avgCompliance == null ? { bg: 'bg-gray-50', text: 'text-gray-400' } : avgCompliance >= 90 ? { bg: 'bg-emerald-50', text: 'text-emerald-600' } : { bg: 'bg-red-50', text: 'text-red-500' }}
            icon={<svg className={`w-5 h-5 ${avgCompliance == null ? 'text-gray-300' : avgCompliance >= 90 ? 'text-emerald-500' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard
            label="Trabajaron el finde"
            value={weekendWorkersCount}
            sub="últimos 7 días"
            accent={{ bg: 'bg-violet-50', text: 'text-violet-600' }}
            icon={<svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          />
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 text-gray-600"
          >
            <option value="all">Todos los roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 text-gray-600"
          >
            <option value="lastSeen">Ordenar: Última actividad</option>
            <option value="todayMinutes">Ordenar: Horas hoy</option>
            <option value="weekMinutes">Ordenar: Horas semana</option>
            <option value="name">Ordenar: Nombre</option>
          </select>
          {(search || roleFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setRoleFilter('all'); }}
              className="text-xs text-red-500 hover:text-red-700 font-medium underline"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading && staff.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full mx-auto mb-3" />
              <p className="text-sm">Cargando actividad...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm">No se encontraron usuarios</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gradient-to-r from-slate-50 to-blue-50/40">
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Usuario</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3.5">Última actividad</th>
                    <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3.5">Hoy</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3.5">Patrón hoy</th>
                    <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3.5">Semana</th>
                    <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3.5">Últimos 7 días</th>
                    <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">Acciones hoy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar name={s.name} role={s.role} />
                            <span className="absolute -bottom-0.5 -right-0.5">
                              <StatusDot isOnline={s.isOnline} lastSeen={s.lastSeen} />
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm group-hover:text-blue-700 transition-colors">{s.name}</p>
                            <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${ROLE_BADGE[s.role] || 'bg-gray-100 text-gray-600'}`}>
                              {ROLE_LABELS[s.role] || s.role}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="text-sm text-gray-600">{formatRelative(s.lastSeen)}</div>
                        {s.lastSection && (
                          <span className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full mt-1 inline-block font-medium">{s.lastSection}</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <span className={`text-sm font-bold ${s.todayMinutes > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                          {formatMinutes(s.todayMinutes)}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <PatternBadge pattern={s.todayPattern} />
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <div className="text-sm font-medium text-gray-600">{formatMinutes(s.weekMinutes)}</div>
                        {s.workedWeekend && (
                          <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full font-semibold">Trabajó finde</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex justify-center">
                          <WeekBars days={s.last7Days} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-medium text-gray-500">
                        {s.todayActions > 0 ? s.todayActions : <span className="text-gray-200">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Conectado ahora (tiempo real)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Activo hoy, sesión cerrada</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Sin actividad reciente</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> Actividad en fin de semana</span>
        </div>
      </div>

      {selected && (
        <DetailPanel
          staffId={selected.id}
          staffName={selected.name}
          onClose={() => setSelected(null)}
        />
      )}
      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
    </div>
  );
}
