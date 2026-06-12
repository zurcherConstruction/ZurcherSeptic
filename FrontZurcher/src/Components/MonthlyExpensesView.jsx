import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/formatters';
import api from '../utils/apiClient';

const MonthlyExpensesView = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 🆕 Por defecto el mes actual
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados para controlar qué secciones están expandidas
  const [expandedSections, setExpandedSections] = useState({});

  const months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // 🆕 Función para formatear fecha a MM-DD-YYYY
  const formatDateMDY = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${month}-${day}-${year}`;
  };

  const getCompanyLabel = (fleetAssetInfo) => {
    if (!fleetAssetInfo) return 'Sin empresa';
    if (fleetAssetInfo.companyType === 'other') {
      return fleetAssetInfo.companyOtherName || 'OTRA';
    }
    return String(fleetAssetInfo.companyType || '').toUpperCase();
  };

  // Toggle sección expandida/colapsada
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Cargar datos
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.append('year', selectedYear);
      if (selectedMonth) {
        params.append('month', selectedMonth);
      }

      const response = await api.get(`/monthly-expenses?${params.toString()}`);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar datos');
      console.error('Error fetching monthly expenses:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 🆕 Función para refrescar datos manualmente
  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  // 🆕 Función para agrupar gastos fijos por empleado (salarios) y luego por categoría
  const groupFixedExpensesByCategory = (fixedExpenses) => {
    const grouped = {
      payroll: {}, // { "Gaby": [{payroll}, {bono}], "Oscar": [...] }
      other: {}    // { "Renta": [...], "Seguros": [...] }
    };

    fixedExpenses.forEach(expense => {
      // Detectar si es salario (payroll + bonos)
      if (expense.category === 'Salarios') {
        // Extraer nombre del staff del nombre del gasto
        let staffName = expense.name;
        
        // Patrones comunes: "PAYROLL NOMBRE", "Bono NOMBRE", "Payroll NOMBRE"
        const payrollMatch = expense.name.match(/PAYROLL\s+([A-ZÑ]+)/i) || 
                             expense.name.match(/Payroll\s+([A-ZÑ]+)/i);
        const bonoMatch = expense.name.match(/Bono\s+([A-ZÑ]+)/i);
        
        if (payrollMatch) {
          staffName = payrollMatch[1].toUpperCase();
        } else if (bonoMatch) {
          staffName = bonoMatch[1].toUpperCase();
        }

        // Agrupar por nombre del staff (normalizado a mayúsculas)
        if (!grouped.payroll[staffName]) {
          grouped.payroll[staffName] = [];
        }
        grouped.payroll[staffName].push(expense);
      } else {
        // Agrupar otras categorías por categoría
        if (!grouped.other[expense.category]) {
          grouped.other[expense.category] = [];
        }
        grouped.other[expense.category].push(expense);
      }
    });

    return grouped;
  };

  // Cargar datos cuando cambian los filtros (año/mes)
  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth]);

  // Función para obtener el color del estado de pago
  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'paid':
      case 'paid_via_invoice':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'unpaid':
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  // Función para obtener la etiqueta del estado
  const getPaymentStatusLabel = (status) => {
    switch (status) {
      case 'paid':
        return 'Pagado';
      case 'paid_via_invoice':
        return 'Pagado vía Invoice';
      case 'partial':
        return 'Parcial';
      case 'unpaid':
      default:
        return 'No Pagado';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            📊 Gastos Devengados Mensuales
          </h1>
          <p className="text-lg text-gray-600">
            Análisis de gastos generados independientemente del estado de pago
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Año
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mes
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                {months.map(month => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
              {data?.summary && (
                <div className="space-y-1">
                  <p className="font-medium">📈 {data.summary.generalExpensesFound} gastos generales</p>
                  <p className="font-medium">🚚 {data.summary.fleetExpensesFound || 0} gastos flota</p>
                  <p className="font-medium">🔄 {data.summary.fixedExpensesActive} gastos fijos activos</p>
                </div>
              )}
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className={`h-12 px-6 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                refreshing || loading
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
              }`}
            >
              <svg
                className={`w-4 h-4 ${(refreshing || loading) ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {refreshing || loading ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center items-center min-h-96">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 font-medium">Cargando datos...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800 mb-2">Error al cargar datos</h3>
                <p className="text-sm text-red-700">{error}</p>
                <button 
                  onClick={fetchData} 
                  className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-8">
            {/* Mostrar resumen de actualización */}
            {refreshing === false && data && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                ✅ Datos actualizados. Se encontraron {data.summary?.generalExpensesFound || 0} gastos generales, {data.summary?.fleetExpensesFound || 0} gastos de flota y {data.summary?.fixedExpensesActive || 0} gastos fijos activos.
              </div>
            )}

            {/* Datos mensuales */}
            <div className="space-y-6">
              {data.monthlyData.filter(month => month.monthNumber === parseInt(selectedMonth)).map((month) => (
                <div key={month.month} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Header del mes */}
                  <div className="bg-gray-50 px-8 py-6 border-b border-gray-200">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-1">
                          📅 {month.monthName} {data.year || selectedYear}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {month.generalExpenses.count + month.fleetExpenses.count + month.fixedExpenses.count} gastos registrados
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-gray-900 mb-1">
                          {formatCurrency(month.totalMonth)}
                        </div>
                        <p className="text-sm text-gray-500">Total del mes</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-6">
                    {/* Gastos Generales - Sección desplegable */}
                    {month.generalExpenses.count > 0 && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleSection(`general-${month.month}`)}
                          className="w-full bg-blue-50 hover:bg-blue-100 px-6 py-4 flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="bg-blue-500 text-white rounded-lg p-2">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 11-4 0 2 2 0 014 0zm2-2a2 2 0 100 4h8a2 2 0 100-4H8z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <h4 className="text-lg font-semibold text-gray-900">
                                Gastos Generales ({month.generalExpenses.count})
                              </h4>
                              <p className="text-sm text-gray-600">
                                Pagados: {formatCurrency(month.generalExpenses.paid)} • 
                                Parciales: {formatCurrency(month.generalExpenses.partial)} • 
                                Pendientes: {formatCurrency(month.generalExpenses.unpaid)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <div className="text-xl font-bold text-blue-600">
                                {formatCurrency(month.generalExpenses.total)}
                              </div>
                            </div>
                            <div className={`transform transition-transform ${expandedSections[`general-${month.month}`] ? 'rotate-180' : ''}`}>
                              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        </button>
                        
                        {expandedSections[`general-${month.month}`] && (
                          <div className="border-t border-gray-200 bg-white">
                            <div className="p-6 space-y-3">
                              {month.generalExpenses.items.map((item, index) => (
                                <div key={index} className="flex items-start justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                                  <div className="flex-1">
                                    {/* Fila 1: Monto y Fecha */}
                                    <div className="flex items-center gap-4 mb-3">
                                      <span className="text-xl font-bold text-gray-900 min-w-max">
                                        {formatCurrency(item.amount)}
                                      </span>
                                      <span className="text-xs text-gray-500 px-2 py-1 bg-white rounded">
                                        📅 {formatDateMDY(item.date)}
                                      </span>
                                    </div>

                                    {/* Fila 2: Quién lo generó */}
                                    {item.createdByName && (
                                      <div className="text-sm text-gray-700 mb-2 flex items-center gap-2">
                                        <span className="font-medium">👤 Cargado por:</span>
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                          {item.createdByName}
                                        </span>
                                      </div>
                                    )}

                                    {/* Fila 3: Proveedor y Notas */}
                                    <div className="text-sm text-gray-700 space-y-1">
                                      {item.vendor && (
                                        <p className="flex items-center gap-2">
                                          <span>🏢</span>
                                          <span className="font-medium">Proveedor:</span>
                                          <span>{item.vendor}</span>
                                        </p>
                                      )}
                                      {item.notes && (
                                        <p className="flex items-start gap-2">
                                          <span className="mt-0.5">📝</span>
                                          <span className="font-medium">Nota:</span>
                                          <span className="text-gray-600">{item.notes}</span>
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Gastos Flota - Sección desplegable */}
                    {month.fleetExpenses.count > 0 && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleSection(`fleet-${month.month}`)}
                          className="w-full bg-amber-50 hover:bg-amber-100 px-6 py-4 flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="bg-amber-500 text-white rounded-lg p-2">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v6a2 2 0 002 2h1a3 3 0 106 0h2a3 3 0 106 0h1a2 2 0 002-2V8a2 2 0 00-2-2h-2l-2-2H4zm3 10a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <h4 className="text-lg font-semibold text-gray-900">
                                Gasto Vehículos/Máquinas ({month.fleetExpenses.count})
                              </h4>
                              <p className="text-sm text-gray-600">
                                Monto total de flota del mes
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <div className="text-xl font-bold text-amber-600">
                                {formatCurrency(month.fleetExpenses.total)}
                              </div>
                            </div>
                            <div className={`transform transition-transform ${expandedSections[`fleet-${month.month}`] ? 'rotate-180' : ''}`}>
                              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        </button>

                        {expandedSections[`fleet-${month.month}`] && (
                          <div className="border-t border-gray-200 bg-white">
                            <div className="p-6 space-y-3">
                              {month.fleetExpenses.items.map((item, index) => (
                                <div key={index} className="flex items-start justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-100">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-4 mb-3">
                                      <span className="text-xl font-bold text-gray-900 min-w-max">
                                        {formatCurrency(item.amount)}
                                      </span>
                                      <span className="text-xs text-gray-500 px-2 py-1 bg-white rounded">
                                        📅 {formatDateMDY(item.date)}
                                      </span>
                                      {item.fleetAssetInfo?.companyLabel && (
                                        <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded font-semibold">
                                          {item.fleetAssetInfo.companyLabel}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-700 space-y-1">
                                      <p className="flex items-center gap-2">
                                        <span>🚛</span>
                                        <span className="font-medium">Activo:</span>
                                        <span>{item.fleetAssetInfo?.name || 'Sin activo'}</span>
                                      </p>
                                      {item.fleetAssetInfo?.licensePlate && (
                                        <p className="flex items-center gap-2">
                                          <span>🔖</span>
                                          <span className="font-medium">Placa:</span>
                                          <span>{item.fleetAssetInfo.licensePlate}</span>
                                        </p>
                                      )}
                                      {item.fleetAssetInfo?.serialNumber && (
                                        <p className="flex items-center gap-2">
                                          <span>🔢</span>
                                          <span className="font-medium">Serie:</span>
                                          <span>{item.fleetAssetInfo.serialNumber}</span>
                                        </p>
                                      )}
                                      <p className="flex items-center gap-2">
                                        <span>🏢</span>
                                        <span className="font-medium">Empresa:</span>
                                        <span>{getCompanyLabel(item.fleetAssetInfo)}</span>
                                      </p>
                                      {item.notes && (
                                        <p className="flex items-start gap-2">
                                          <span className="mt-0.5">📝</span>
                                          <span className="font-medium">Nota:</span>
                                          <span className="text-gray-600">{item.notes}</span>
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Gastos Fijos - Sección desplegable REORGANIZADA */}
                    {month.fixedExpenses.count > 0 && (() => {
                      const groupedExpenses = groupFixedExpensesByCategory(month.fixedExpenses.items);
                      const payrollStaff = Object.keys(groupedExpenses.payroll).sort();
                      const otherCategories = Object.keys(groupedExpenses.other).sort();
                      
                      return (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => toggleSection(`fixed-${month.month}`)}
                            className="w-full bg-purple-50 hover:bg-purple-100 px-6 py-4 flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="bg-purple-500 text-white rounded-lg p-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="text-left">
                                <h4 className="text-lg font-semibold text-gray-900">
                                  Gastos Fijos ({month.fixedExpenses.count})
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {payrollStaff.length > 0 && `${payrollStaff.length} empleado(s)`}
                                  {payrollStaff.length > 0 && otherCategories.length > 0 && ' • '}
                                  {otherCategories.length > 0 && `${otherCategories.length} categoría(s) adicional(es)`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="text-right">
                                <div className="text-xl font-bold text-purple-600">
                                  {formatCurrency(month.fixedExpenses.total)}
                                </div>
                              </div>
                              <div className={`transform transition-transform ${expandedSections[`fixed-${month.month}`] ? 'rotate-180' : ''}`}>
                                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          </button>
                          
                          {expandedSections[`fixed-${month.month}`] && (
                            <div className="border-t border-gray-200 bg-white">
                              <div className="p-6 space-y-6">
                                {/* SECCIÓN 1: SALARIOS POR EMPLEADO */}
                                {payrollStaff.length > 0 && (
                                  <div className="space-y-4">
                                    <h5 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                      <span>👥 Salarios</span>
                                      <span className="text-sm font-normal text-gray-500">({payrollStaff.length} empleados)</span>
                                    </h5>
                                    <div className="space-y-4">
                                      {payrollStaff.map(staffName => {
                                        const staffExpenses = groupedExpenses.payroll[staffName];
                                        const staffTotal = staffExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
                                        return (
                                          <div key={staffName} className="border border-blue-100 rounded-lg p-4 bg-blue-50">
                                            <div className="flex items-center justify-between mb-3">
                                              <h6 className="text-base font-semibold text-gray-900">{staffName}</h6>
                                              <span className="text-lg font-bold text-blue-600">{formatCurrency(staffTotal)}</span>
                                            </div>
                                            <div className="space-y-2">
                                              {staffExpenses.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-blue-100">
                                                  <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-800">{item.name}</p>
                                                    {item.description && (
                                                      <p className="text-xs text-gray-500">{item.description}</p>
                                                    )}
                                                  </div>
                                                  <div className="text-right ml-4">
                                                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</p>
                                                    <p className="text-xs text-gray-500">{item.frequency}</p>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* SEPARADOR */}
                                {payrollStaff.length > 0 && otherCategories.length > 0 && (
                                  <div className="border-t border-gray-300"></div>
                                )}

                                {/* SECCIÓN 2: OTRAS CATEGORÍAS */}
                                {otherCategories.length > 0 && (
                                  <div className="space-y-4">
                                    <h5 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                      <span>📦 Otras Categorías</span>
                                      <span className="text-sm font-normal text-gray-500">({otherCategories.length})</span>
                                    </h5>
                                    <div className="space-y-4">
                                      {otherCategories.map(category => {
                                        const categoryExpenses = groupedExpenses.other[category];
                                        const categoryTotal = categoryExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
                                        return (
                                          <div key={category} className="border border-orange-100 rounded-lg p-4 bg-orange-50">
                                            <div className="flex items-center justify-between mb-3">
                                              <h6 className="text-base font-semibold text-gray-900">{category}</h6>
                                              <span className="text-lg font-bold text-orange-600">{formatCurrency(categoryTotal)}</span>
                                            </div>
                                            <div className="space-y-2">
                                              {categoryExpenses.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-orange-100">
                                                  <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-800">{item.name}</p>
                                                    {item.description && (
                                                      <p className="text-xs text-gray-500">{item.description}</p>
                                                    )}
                                                  </div>
                                                  <div className="text-right ml-4">
                                                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</p>
                                                    <p className="text-xs text-gray-500">{item.frequency}</p>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && (!data || data.monthlyData.filter(m => m.monthNumber === parseInt(selectedMonth)).length === 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-16 w-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-blue-900 mb-2">No hay gastos registrados</h3>
            <p className="text-blue-700">No se encontraron gastos para el mes seleccionado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyExpensesView;