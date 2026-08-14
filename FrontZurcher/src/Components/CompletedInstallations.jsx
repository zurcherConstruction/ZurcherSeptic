import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import api from '../utils/axios';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const formatDate = (dateString) => {
  const dateStr = (dateString || '').split('T')[0];
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year) return dateString;
  return new Date(year, month - 1, day).toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
};

const invoiceLabel = (s) => {
  const map = {
    paid: { label: 'Invoice Pagado', cls: 'bg-green-100 text-green-700' },
    partially_paid: { label: 'Invoice Parcial', cls: 'bg-yellow-100 text-yellow-700' },
    pending: { label: 'Invoice Pendiente', cls: 'bg-red-100 text-red-700' }
  };
  return map[s] || null;
};

const CompletedInstallations = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const now = new Date();
  const [selectedYear, setSelectedYear]   = useState(location.state?.year  || now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(location.state?.month || (now.getMonth() + 1));
  const [availableYears, setAvailableYears] = useState([]);
  const [works, setWorks]         = useState([]);
  const [yearTotals, setYearTotals] = useState({});
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [viewMode, setViewMode]   = useState('monthly');
  // yearly summary: array of { month, monthName, count, profit }
  const [yearlySummary, setYearlySummary] = useState([]);

  // Load available years
  useEffect(() => {
    api.get('/completed-installations/available-years')
      .then(r => setAvailableYears(r.data?.availableYears || []))
      .catch(() => {});
  }, []);

  const fetchMonth = useCallback(async (year, month) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get(`/completed-installations?year=${year}&month=${month}`);
      setWorks(r.data?.works || []);
      setYearTotals(r.data?.yearTotals || {});
    } catch {
      setError('Error cargando los datos');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchYear = useCallback(async (year) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all 12 months to build yearly summary
      const r = await api.get(`/completed-installations?year=${year}`);
      // Backend returns works[] for the full year when no month param — but we need monthly breakdown
      // We'll group by installedDate month client-side
      const allWorks = r.data?.works || [];
      const byMonth = {};
      allWorks.forEach(w => {
        const m = parseInt((w.installedDate || '').split('-')[1]);
        if (!m) return;
        if (!byMonth[m]) byMonth[m] = { month: m, monthName: MONTH_NAMES[m - 1], count: 0, profit: 0 };
        byMonth[m].count++;
        byMonth[m].profit += w.profit;
      });
      setYearlySummary(Object.values(byMonth).sort((a, b) => a.month - b.month));
      setYearTotals(r.data?.yearTotals || {});
    } catch {
      setError('Error cargando los datos anuales');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'monthly') fetchMonth(selectedYear, selectedMonth);
    else fetchYear(selectedYear);
  }, [selectedYear, selectedMonth, viewMode, fetchMonth, fetchYear]);

  const handleYearChange = (year) => {
    setSelectedYear(year);
    if (viewMode === 'monthly') fetchMonth(year, selectedMonth);
    else fetchYear(year);
  };

  const handleMonthChange = (month) => {
    setSelectedMonth(month);
    fetchMonth(selectedYear, month);
  };

  const goToWork = (workId) => {
    navigate(`/work/${workId}`, {
      state: { from: '/completed-installations', year: selectedYear, month: selectedMonth }
    });
  };

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  const okCount = works.filter(w => w.finalReviewCompleted).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <ChartBarIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Control de Instalaciones</h1>
                <p className="text-slate-600">Instalados por mes · Ganancia neta · Estado OK Final</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Año */}
              <select
                value={selectedYear}
                onChange={e => handleYearChange(parseInt(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {(availableYears.length ? availableYears : [selectedYear]).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {/* Mes (solo en vista mensual) */}
              {viewMode === 'monthly' && (
                <select
                  value={selectedMonth}
                  onChange={e => handleMonthChange(parseInt(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name} {selectedYear}</option>
                  ))}
                </select>
              )}

              {/* Toggle Mensual / Anual */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('monthly')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Mensual
                </button>
                <button
                  onClick={() => setViewMode('yearly')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'yearly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Anual
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Vista Mensual ───────────────────────────────────────────── */}
        {viewMode === 'monthly' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                <div className="flex items-center gap-3">
                  <BuildingOfficeIcon className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-600">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
                    <p className="text-3xl font-bold text-slate-900">{works.length}</p>
                    <p className="text-sm text-slate-500">{works.length === 1 ? 'instalación' : 'instalaciones'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                <div className="flex items-center gap-3">
                  <CheckCircleIcon className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-600">OK Final</p>
                    <p className="text-3xl font-bold text-slate-900">{okCount}<span className="text-lg text-slate-400"> / {works.length}</span></p>
                    <p className="text-sm text-slate-500">{works.length - okCount > 0 ? `${works.length - okCount} pendiente${works.length - okCount > 1 ? 's' : ''}` : 'Todos completos'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-sky-500">
                <div className="flex items-center gap-3">
                  <CurrencyDollarIcon className="h-8 w-8 text-sky-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-600">Cobrado</p>
                    <p className="text-2xl font-bold text-slate-900">{fmt(works.reduce((s, w) => s + w.totalIncome, 0))}</p>
                    <p className="text-sm text-slate-500">Gastos: {fmt(works.reduce((s, w) => s + w.totalExpenses, 0))}</p>
                  </div>
                </div>
              </div>

              <div className={`bg-white rounded-xl shadow-lg p-6 border-l-4 ${
                works.reduce((s, w) => s + w.profit, 0) >= 0 ? 'border-emerald-500' : 'border-rose-500'
              }`}>
                <div className="flex items-center gap-3">
                  <ChartBarIcon className={`h-8 w-8 ${works.reduce((s, w) => s + w.profit, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-600">Ganancia neta</p>
                    <p className={`text-2xl font-bold ${works.reduce((s, w) => s + w.profit, 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {fmt(works.reduce((s, w) => s + w.profit, 0))}
                    </p>
                    <p className="text-sm text-slate-500">Contratos: {fmt(works.reduce((s, w) => s + w.contractTotal, 0))}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Work list */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-blue-600 text-white p-4">
                <h2 className="text-xl font-bold">
                  Instalaciones – {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </h2>
                <p className="text-sm opacity-90">
                  {works.length} {works.length === 1 ? 'trabajo instalado' : 'trabajos instalados'}
                </p>
              </div>

              {works.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {works.map(work => {
                    const inv = invoiceLabel(work.finalInvoiceStatus);
                    const profitPos = work.profit >= 0;

                    return (
                      <div
                        key={work.workId}
                        onClick={() => goToWork(work.workId)}
                        className="p-4 hover:bg-blue-50 transition-colors cursor-pointer group"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">

                          {/* Left: address + badges + financial */}
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="font-semibold text-slate-800 group-hover:text-blue-700">
                                {work.propertyAddress}
                              </h3>
                              {/* OK Final badge */}
                              {work.finalReviewCompleted ? (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                                  ✅ OK Final
                                </span>
                              ) : (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                  ⏳ Pendiente OK
                                </span>
                              )}
                              {inv && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.cls}`}>
                                  {inv.label}
                                </span>
                              )}
                            </div>

                            {work.applicantName && (
                              <p className="text-sm text-slate-500 mb-2">👤 {work.applicantName}</p>
                            )}

                            {/* Financial row */}
                            <div className="flex flex-wrap gap-4 mt-1 text-xs">
                              <span className="text-slate-500">
                                Contrato: <strong className="text-slate-700">{fmt(work.contractTotal)}</strong>
                              </span>
                              <span className="text-slate-500">
                                Cobrado: <strong className="text-sky-700">{fmt(work.totalIncome)}</strong>
                              </span>
                              <span className="text-slate-500">
                                Gastos: <strong className="text-red-600">{fmt(work.totalExpenses)}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Right: profit + date */}
                          <div className="flex flex-col sm:items-end gap-1 shrink-0">
                            <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
                              profitPos ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                            }`}>
                              {profitPos ? '▲' : '▼'} {fmt(Math.abs(work.profit))}
                            </span>
                            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                              Instalado: {formatDate(work.installedDate)}
                            </span>
                            <span className="text-xs text-slate-500">
                              Estado: {work.currentStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <BuildingOfficeIcon className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-600 text-lg font-medium">
                    No hay instalaciones en {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    Los trabajos aparecen aquí cuando cambian a estado "Installed"
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Vista Anual ─────────────────────────────────────────────── */}
        {viewMode === 'yearly' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <ChartBarIcon className="h-8 w-8 text-purple-600" />
              <div>
                <h2 className="text-xl font-bold text-slate-800">Resumen Anual {selectedYear}</h2>
                <p className="text-slate-600">
                  Total: {yearTotals.count || 0} instalaciones · Ganancia: {fmt(yearTotals.profit || 0)}
                </p>
              </div>
            </div>

            {yearlySummary.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {yearlySummary.map(m => (
                  <div
                    key={m.month}
                    onClick={() => { setSelectedMonth(m.month); setViewMode('monthly'); }}
                    className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                      m.month === selectedMonth
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-600">{m.monthName}</p>
                      <p className="text-2xl font-bold text-slate-900">{m.count}</p>
                      <p className="text-xs text-slate-500">{m.count === 1 ? 'instalación' : 'instalaciones'}</p>
                      <p className={`text-xs font-semibold mt-1 ${m.profit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {fmt(m.profit)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ChartBarIcon className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-600 text-lg font-medium">No hay datos para {selectedYear}</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default CompletedInstallations;
