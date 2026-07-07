import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/axios';

const LEAD_SOURCE_COLORS = {
  web:               'bg-blue-100 text-blue-700',
  direct_client:     'bg-green-100 text-green-700',
  social_media:      'bg-pink-100 text-pink-700',
  referral:          'bg-purple-100 text-purple-700',
  sales_rep:         'bg-orange-100 text-orange-700',
  external_referral: 'bg-yellow-100 text-yellow-700',
  unknown:           'bg-gray-100 text-gray-600',
};

const Stat = ({ label, value, color, sub }) => (
  <div className={`rounded-xl p-4 flex flex-col items-center justify-center ${color}`}>
    <p className="text-3xl font-bold">{value}</p>
    <p className="text-sm font-semibold mt-1">{label}</p>
    {sub && <p className="text-xs mt-0.5 opacity-75">{sub}</p>}
  </div>
);

const SalesIndicators = () => {
  const [years, setYears]         = useState([]);
  const [selectedYear, setYear]   = useState(new Date().getFullYear());
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [expanded, setExpanded]   = useState(null); // expanded month index

  const fetchYears = useCallback(async () => {
    try {
      const { data: d } = await api.get('/sales-indicators/available-years');
      setYears(d.years || []);
    } catch { /* silent */ }
  }, []);

  const fetchData = useCallback(async (year) => {
    setLoading(true);
    setError(null);
    try {
      const { data: d } = await api.get(`/sales-indicators/monthly?year=${year}`);
      setData(d);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar indicadores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchYears(); }, [fetchYears]);
  useEffect(() => { fetchData(selectedYear); }, [selectedYear, fetchData]);

  const handleYearChange = (y) => {
    setYear(y);
    setExpanded(null);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">
        {error}
      </div>
    );
  }

  const months = data?.monthlyData || [];
  const totals = data?.totals || {};

  // Max value for mini bars
  const maxVentas    = Math.max(...months.map(m => m.ventas),    1);
  const maxInstall   = Math.max(...months.map(m => m.instalados), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Indicadores de Ventas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ventas · Instalados · Backlog mensual</p>
        </div>
        <div className="flex items-center gap-2">
          {years.map(y => (
            <button
              key={y}
              onClick={() => handleYearChange(y)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                y === selectedYear
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Annual Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Ventas Año" value={totals.ventas}    color="bg-cyan-50 text-cyan-800"  />
          <Stat label="Instalados Año" value={totals.instalados} color="bg-green-50 text-green-800" />
          <Stat
            label="Backlog Actual"
            value={months[months.length - 1]?.backlog ?? 0}
            color="bg-orange-50 text-orange-800"
            sub="al cierre del último mes"
          />
          <Stat
            label="Eficiencia"
            value={totals.ventas > 0 ? `${Math.round((totals.instalados / totals.ventas) * 100)}%` : '—'}
            color="bg-purple-50 text-purple-800"
            sub="instalados / vendidos"
          />
        </div>
      )}

      {/* Monthly Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Mes</th>
                <th className="px-4 py-3 text-center">Ventas</th>
                <th className="px-4 py-3 text-center">Instalados</th>
                <th className="px-4 py-3 text-center">Backlog</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Fuentes</th>
                <th className="px-4 py-3 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {months.map((m, idx) => (
                <React.Fragment key={m.month}>
                  <tr className="transition-colors hover:bg-gray-50">
                    {/* Mes */}
                    <td className="px-4 py-3 font-medium text-gray-800 capitalize">
                      {m.monthName}
                    </td>

                    {/* Ventas */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg font-bold text-cyan-700">{m.ventas}</span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${(m.ventas / maxVentas) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Instalados */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg font-bold text-green-700">{m.instalados}</span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${(m.instalados / maxInstall) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Backlog */}
                    <td className="px-4 py-3 text-center">
                      <span className={`text-lg font-bold ${m.backlog > 10 ? 'text-orange-600' : 'text-gray-700'}`}>
                        {m.backlog}
                      </span>
                    </td>

                    {/* Fuentes (desktop) */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {m.sources.map(s => (
                          <span
                            key={s.key}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              LEAD_SOURCE_COLORS[s.key] || 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {s.label}: {s.count}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Expand button */}
                    <td className="px-4 py-3 text-center">
                      {!m.isFuture && m.sources.length > 0 && (
                        <button
                          onClick={() => setExpanded(expanded === idx ? null : idx)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="Ver detalle"
                        >
                          <svg
                            className={`w-4 h-4 transition-transform ${expanded === idx ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expandable: source detail */}
                  {expanded === idx && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-6 py-3">
                        <div className="flex flex-wrap gap-3">
                          {m.sources.map(s => (
                            <div
                              key={s.key}
                              className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2"
                            >
                              <span
                                className={`w-3 h-3 rounded-full ${
                                  LEAD_SOURCE_COLORS[s.key]?.includes('blue')   ? 'bg-blue-400'   :
                                  LEAD_SOURCE_COLORS[s.key]?.includes('green')  ? 'bg-green-400'  :
                                  LEAD_SOURCE_COLORS[s.key]?.includes('pink')   ? 'bg-pink-400'   :
                                  LEAD_SOURCE_COLORS[s.key]?.includes('purple') ? 'bg-purple-400' :
                                  LEAD_SOURCE_COLORS[s.key]?.includes('orange') ? 'bg-orange-400' :
                                  LEAD_SOURCE_COLORS[s.key]?.includes('yellow') ? 'bg-yellow-400' :
                                  'bg-gray-400'
                                }`}
                              />
                              <span className="text-sm text-gray-700">{s.label}</span>
                              <span className="text-sm font-bold text-gray-900">{s.count}</span>
                              <span className="text-xs text-gray-400">
                                ({Math.round((s.count / m.ventas) * 100)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>

            {/* Totals row */}
            <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-200">
              <tr>
                <td className="px-4 py-3 text-gray-700">Total {selectedYear}</td>
                <td className="px-4 py-3 text-center text-cyan-700 text-lg">{totals.ventas}</td>
                <td className="px-4 py-3 text-center text-green-700 text-lg">{totals.instalados}</td>
                <td className="px-4 py-3 text-center text-gray-600">
                  {months[months.length - 1]?.backlog ?? '—'}
                </td>
                <td className="px-4 py-3 hidden md:table-cell" />
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-cyan-500 inline-block" />
          <span>Ventas: nuevos works confirmados (budget aprobado)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          <span>Instalados: works que llegaron a estado &quot;installed&quot; ese mes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
          <span>Backlog: works vendidos pendientes de instalación al cierre del mes</span>
        </div>
      </div>
    </div>
  );
};

export default SalesIndicators;
