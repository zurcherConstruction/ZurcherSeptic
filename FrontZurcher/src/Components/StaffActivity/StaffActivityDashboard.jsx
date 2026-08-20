import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../utils/axios';
import socket from '../../utils/io';

const ROLE_LABELS = {
  owner: 'Owner', admin: 'Admin', recept: 'Recept', finance: 'Finance',
  'finance-viewer': 'Finance Viewer', sales_rep: 'Sales Rep', 'follow-up': 'Follow-up',
};

const ROLE_BADGE = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  recept: 'bg-emerald-100 text-emerald-700',
  finance: 'bg-amber-100 text-amber-700',
  'finance-viewer': 'bg-gray-100 text-gray-600',
  sales_rep: 'bg-orange-100 text-orange-700',
  'follow-up': 'bg-pink-100 text-pink-700',
};

const ROLE_AVATAR = {
  owner: 'bg-purple-500', admin: 'bg-blue-500', recept: 'bg-emerald-500', finance: 'bg-amber-500',
  'finance-viewer': 'bg-gray-400', sales_rep: 'bg-orange-500', 'follow-up': 'bg-pink-500',
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
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent.bg}`}>
      {icon}
    </div>
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${accent.text}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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
  const [onlineIds, setOnlineIds] = useState(null); // null = todavía no llegó ningún evento del socket

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

  const roles = useMemo(() => [...new Set(staffWithPresence.map((s) => s.role))], [staffWithPresence]);

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
      // default: online primero, luego última actividad
      if (sortBy === 'lastSeen') {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      }
      return new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0);
    });
    return result;
  }, [staffWithPresence, search, roleFilter, sortBy]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Monitor de Actividad del Equipo</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Horas trabajadas e interacción con el sistema
                {lastRefresh && <span className="ml-2 text-gray-400">· Actualizado {formatTime(lastRefresh)}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchSummary(false)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
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
            label="Promedio por usuario activo"
            value={formatMinutes(avgPerActive)}
            sub="hoy"
            accent={{ bg: 'bg-amber-50', text: 'text-amber-600' }}
            icon={<svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          />
          <StatCard
            label="Cumplimiento semanal"
            value={avgCompliance != null ? `${avgCompliance}%` : '—'}
            sub="vs. 40hs esperadas (L-V)"
            accent={avgCompliance == null ? { bg: 'bg-gray-50', text: 'text-gray-400' } : avgCompliance >= 90 ? { bg: 'bg-emerald-50', text: 'text-emerald-600' } : { bg: 'bg-red-50', text: 'text-red-500' }}
            icon={<svg className={`w-5 h-5 ${avgCompliance == null ? 'text-gray-300' : avgCompliance >= 90 ? 'text-emerald-500' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard
            label="Trabajaron el fin de semana"
            value={weekendWorkersCount}
            sub="últimos 7 días"
            accent={{ bg: 'bg-violet-50', text: 'text-violet-600' }}
            icon={<svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
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
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">Todos los roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="lastSeen">Ordenar: Última actividad</option>
            <option value="todayMinutes">Ordenar: Horas hoy</option>
            <option value="weekMinutes">Ordenar: Horas esta semana</option>
            <option value="name">Ordenar: Nombre</option>
          </select>
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
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Usuario</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3">Última actividad</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3">Hoy</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3">Patrón hoy</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3">Semana</th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3">Últimos 7 días</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Acciones hoy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
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
                            <p className="font-medium text-gray-800 text-sm">{s.name}</p>
                            <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${ROLE_BADGE[s.role] || 'bg-gray-100 text-gray-600'}`}>
                              {ROLE_LABELS[s.role] || s.role}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="text-sm text-gray-600">{formatRelative(s.lastSeen)}</div>
                        {s.lastSection && (
                          <span className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full mt-1 inline-block">{s.lastSection}</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <span className={`text-sm font-semibold ${s.todayMinutes > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                          {formatMinutes(s.todayMinutes)}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <PatternBadge pattern={s.todayPattern} />
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <div className="text-sm text-gray-500">{formatMinutes(s.weekMinutes)}</div>
                        {s.workedWeekend && (
                          <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full font-medium">Trabajó finde</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex justify-center">
                          <WeekBars days={s.last7Days} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm text-gray-500">
                        {s.todayActions > 0 ? s.todayActions : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Conectado ahora (en tiempo real)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Activo hoy, sesión cerrada</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Sin actividad reciente</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> Actividad en fin de semana</span>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          "Conectado ahora" es en vivo (Socket.IO). Las horas trabajadas se estiman según sesiones de actividad
          (pausa de 30+ min = nueva sesión) + 5 min de buffer por lectura. Jornada esperada: 8hs, de lunes a viernes.
        </p>
      </div>

      {selected && (
        <DetailPanel
          staffId={selected.id}
          staffName={selected.name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
