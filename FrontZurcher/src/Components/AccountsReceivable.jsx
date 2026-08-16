import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  FaDollarSign,
  FaFileInvoiceDollar,
  FaMoneyBillWave,
  FaHandHoldingUsd,
  FaChartLine,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaUserTie
} from 'react-icons/fa';
import { PAYMENT_METHODS_GROUPED } from '../utils/paymentConstants'; // 🆕 Importar métodos de pago

const AccountsReceivable = () => {
  const token = useSelector((state) => state.auth.token);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'invoices';
  const setActiveTab = (v) => setSearchParams(prev => { prev.set('tab', v); return prev; });
  const [commissionFilter, setCommissionFilter] = useState('all'); // all, paid, pending
  const [invoiceFilter, setInvoiceFilter] = useState({
    status: 'all', // all, pending_payment, partial, initial_only, completed
    startDate: '',
    endDate: '',
    salesRepId: '',
    searchTerm: ''
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [paymentFile, setPaymentFile] = useState(null);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(''); // 🆕 Método de pago
  const [paymentDetails, setPaymentDetails] = useState(''); // 🆕 Detalles adicionales
  const [uploadingPayment, setUploadingPayment] = useState(false);
  const [data, setData] = useState({
    summary: {},
    details: {
      worksInProgress: [],
      pendingFinalInvoices: [],
      approvedChangeOrders: []
    }
  });
  const [invoicesData, setInvoicesData] = useState({
    summary: {},
    invoices: []
  });
  const [commissionsData, setCommissionsData] = useState({
    summary: {},
    bySalesRep: [],
    byExternalReferral: [],
    allBudgets: []
  });
  const [incomeData, setIncomeData] = useState({
    summary: {},
    income: []
  });

  useEffect(() => {
    fetchAccountsReceivable();
    fetchPendingCommissions();
    fetchActiveInvoices();
    fetchIncome();
  }, []);

  const fetchAccountsReceivable = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/accounts-receivable/summary`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setData(response.data);
    } catch (error) {
      console.error('Error fetching accounts receivable:', error);
      alert('Error al cargar cuentas por cobrar');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingCommissions = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/accounts-receivable/pending-commissions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCommissionsData(response.data);
    } catch (error) {
      console.error('Error fetching pending commissions:', error);
    }
  };

  const fetchActiveInvoices = async () => {
    try {
      // Build query params from filters
      const params = new URLSearchParams();
      if (invoiceFilter.status !== 'all') params.append('status', invoiceFilter.status);
      if (invoiceFilter.startDate) params.append('startDate', invoiceFilter.startDate);
      if (invoiceFilter.endDate) params.append('endDate', invoiceFilter.endDate);
      if (invoiceFilter.salesRepId) params.append('salesRepId', invoiceFilter.salesRepId);
      if (invoiceFilter.searchTerm) params.append('searchTerm', invoiceFilter.searchTerm);

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/accounts-receivable/active-invoices?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInvoicesData(response.data);
    } catch (error) {
      console.error('Error fetching active invoices:', error);
      alert('Error al cargar invoices activos');
    }
  };

  const fetchIncome = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/accounts-receivable/income`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIncomeData(response.data);
    } catch (error) {
      console.error('Error fetching income:', error);
      alert('Error al cargar ingresos');
    }
  };

  // 🔥 Filtrado de Invoices en Frontend
  const filteredInvoices = useMemo(() => {
    if (!invoicesData.invoices || invoicesData.invoices.length === 0) {
      return [];
    }

    return invoicesData.invoices.filter(invoice => {
      // Filtro por estado de pago
      if (invoiceFilter.status !== 'all' && invoice.paymentStatus !== invoiceFilter.status) {
        return false;
      }

      // Filtro por fecha inicio
      if (invoiceFilter.startDate) {
        const invoiceDate = new Date(invoice.budgetDate);
        const startDate = new Date(invoiceFilter.startDate);
        if (invoiceDate < startDate) return false;
      }

      // Filtro por fecha fin
      if (invoiceFilter.endDate) {
        const invoiceDate = new Date(invoice.budgetDate);
        const endDate = new Date(invoiceFilter.endDate);
        if (invoiceDate > endDate) return false;
      }

      // Filtro por búsqueda (dirección o cliente)
      if (invoiceFilter.searchTerm) {
        const searchLower = invoiceFilter.searchTerm.toLowerCase();
        const addressMatch = invoice.propertyAddress?.toLowerCase().includes(searchLower);
        const clientMatch = invoice.clientName?.toLowerCase().includes(searchLower);
        if (!addressMatch && !clientMatch) return false;
      }

      return true;
    });
  }, [invoicesData.invoices, invoiceFilter]);

  const handleToggleCommissionPaid = async (budgetId, currentStatus, workId) => {
    // Validar que exista Work antes de permitir marcar como pagada
    if (!currentStatus && !workId) {
      alert('❌ No se puede pagar la comisión porque este presupuesto no se ha convertido en Work (proyecto confirmado). Solo se pagan comisiones de presupuestos aprobados que se convirtieron en trabajos activos.');
      return;
    }
    
    // Abrir modal para subir comprobante
    const budget = commissionsData.allBudgets.find(b => b.budgetId === budgetId);
    setSelectedCommission({ budgetId, currentStatus, ...budget });
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedCommission(null);
    setPaymentFile(null);
    setPaymentNotes('');
    setPaymentMethod(''); // 🆕 Limpiar método de pago
    setPaymentDetails(''); // 🆕 Limpiar detalles
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    
    if (!selectedCommission) return;
    
    const newStatus = !selectedCommission.currentStatus;
    
    // Si está marcando como pagada, requiere archivo y método de pago
    if (newStatus) {
      if (!paymentFile) {
        alert('⚠️ Por favor adjunta el comprobante de pago de la comisión');
        return;
      }
      if (!paymentMethod) {
        alert('⚠️ Por favor selecciona el método de pago');
        return;
      }
    }
    
    setUploadingPayment(true);
    
    try {
      // ✅ NUEVO FLUJO AUTOMÁTICO: Un solo endpoint hace todo
      const formData = new FormData();
      formData.append('paid', newStatus);
      
      // Usar fecha local sin conversión UTC (evita restar un día)
      const today = new Date();
      const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      formData.append('paidDate', localDate);
      
      if (newStatus) {
        // Solo para marcar como pagada
        formData.append('paymentMethod', paymentMethod);
        if (paymentDetails) formData.append('paymentDetails', paymentDetails);
        if (paymentNotes) formData.append('notes', paymentNotes);
        if (paymentFile) formData.append('file', paymentFile);
      }

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/accounts-receivable/${selectedCommission.budgetId}/commission-paid`,
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );

      if (response.data.success) {
        const message = newStatus 
          ? `✅ Comisión pagada correctamente!\n\n` +
            `💰 Expense creado: $${response.data.expense?.amount || 0}\n` +
            `📄 Método: ${response.data.expense?.paymentMethod || 'N/A'}\n` +
            `${response.data.receipt ? '📎 Comprobante adjuntado\n' : ''}` +
            `🏢 Proveedor: ${response.data.expense?.vendor || 'N/A'}`
          : 'Comisión marcada como pendiente';
        
        alert(message);
      }
      
      // Refrescar datos
      await fetchAccountsReceivable();
      await fetchPendingCommissions();
      
      handleClosePaymentModal();
    } catch (error) {
      console.error('Error updating commission status:', error);
      const errorMsg = error.response?.data?.message || error.message;
      alert(`❌ Error al actualizar el estado de la comisión:\n${errorMsg}`);
    } finally {
      setUploadingPayment(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Debug: Ver los datos completos que llegan del backend
  useEffect(() => {
    if (data.details?.pendingFinalInvoices) {
      console.log('🔍 [Frontend] Datos completos recibidos:', {
        count: data.details.pendingFinalInvoices.length,
        invoices: data.details.pendingFinalInvoices.map(inv => ({
          id: inv.finalInvoiceId,
          wasSent: inv.wasSent,
          sentAt: inv.sentAt,
          invoiceDate: inv.invoiceDate
        }))
      });
    }
  }, [data.details?.pendingFinalInvoices]);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    let d;
    
    // Si es un string en formato YYYY-MM-DD, parsearlo sin conversión UTC
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = date.split('-').map(Number);
      d = new Date(year, month - 1, day);
    } 
    // Si es un string ISO o cualquier otro formato válido de fecha
    else if (typeof date === 'string' || date instanceof Date) {
      d = new Date(date);
    } 
    else {
      return 'Formato inválido';
    }
    
    // Verificar que la fecha sea válida
    if (isNaN(d.getTime())) {
      return 'Fecha inválida';
    }
    
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}-${dd}-${yyyy}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FaDollarSign className="text-green-600" />
          Accounts Receivable - Cuentas por Cobrar
        </h1>
        <p className="text-gray-600 mt-2">
          Seguimiento completo de dinero pendiente por cobrar
        </p>
      </div>

      {/* Summary Cards - Solo lo esencial */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        {/* Total por Cobrar - LO MÁS IMPORTANTE */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-4 md:p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-xs md:text-sm font-medium">Total Por Cobrar</p>
              <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">
                {formatCurrency(invoicesData.summary?.totalRemaining || 0)}
              </p>
              <p className="text-orange-100 text-xs mt-1">
                {invoicesData.summary?.totalInvoices || 0} works activos
              </p>
            </div>
            <FaMoneyBillWave className="text-3xl md:text-5xl text-orange-200 opacity-50" />
          </div>
        </div>

        {/* Total Works */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 md:p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs md:text-sm font-medium">Total Works</p>
              <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">
                {filteredInvoices.length}
              </p>
              <p className="text-blue-100 text-xs mt-1">
                Works activos
              </p>
            </div>
            <FaFileInvoiceDollar className="text-3xl md:text-5xl text-blue-200 opacity-50" />
          </div>
        </div>

        {/* Trabajos Listos para Cobrar */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-4 md:p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-xs md:text-sm font-medium">Trabajos Listos</p>
              <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">
                {formatCurrency(
                  filteredInvoices
                    .filter(inv => {
                      const status = inv.workStatus;
                      return status === 'coverPending' || 
                             status === 'covered' || 
                             status === 'invoiceFinal';
                    })
                    .reduce((sum, inv) => sum + (inv.remainingAmount || 0), 0)
                )}
              </p>
              <p className="text-green-100 text-xs mt-1">
                {filteredInvoices.filter(inv => {
                  const status = inv.workStatus;
                  return status === 'coverPending' || 
                         status === 'covered' || 
                         status === 'invoiceFinal';
                }).length} trabajos terminados
              </p>
            </div>
            <FaCheckCircle className="text-3xl md:text-5xl text-green-200 opacity-50" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'invoices'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FaFileInvoiceDollar className="inline mr-2" />
              Invoices Activos
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'overview'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FaChartLine className="inline mr-2" />
              Invoice Final Por Cobrar
            </button>
            <button
              onClick={() => setActiveTab('income')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'income'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FaDollarSign className="inline mr-2" />
              Ingresos
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtros
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Estado de Pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado de Pago
                </label>
                <select
                  value={invoiceFilter.status}
                  onChange={(e) => setInvoiceFilter({...invoiceFilter, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos</option>
                  <option value="pending_payment">Sin Pagos</option>
                  <option value="initial_only">Solo Initial Payment</option>
                  <option value="partial">Pago Parcial</option>
                  <option value="completed">Completado</option>
                </select>
              </div>

              {/* Fecha Inicio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Desde
                </label>
                <input
                  type="date"
                  value={invoiceFilter.startDate}
                  onChange={(e) => setInvoiceFilter({...invoiceFilter, startDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Fecha Fin */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hasta
                </label>
                <input
                  type="date"
                  value={invoiceFilter.endDate}
                  onChange={(e) => setInvoiceFilter({...invoiceFilter, endDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Búsqueda */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar (Cliente o Propiedad)
                </label>
                <input
                  type="text"
                  value={invoiceFilter.searchTerm}
                  onChange={(e) => setInvoiceFilter({...invoiceFilter, searchTerm: e.target.value})}
                  placeholder="Buscar por dirección o nombre de cliente..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Botón de Limpiar Filtros */}
            <div className="mt-4">
              <button
                onClick={() => setInvoiceFilter({
                  status: 'all',
                  startDate: '',
                  endDate: '',
                  salesRepId: '',
                  searchTerm: ''
                })}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Limpiar Filtros
              </button>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white rounded-lg shadow-md p-3 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
              <FaFileInvoiceDollar className="text-blue-500 text-lg md:text-xl" />
              <span className="truncate">Invoices Activos - Detalle</span>
            </h2>
            <div className="overflow-x-auto -mx-3 md:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Invoice #
                      </th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Propiedad
                      </th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Fecha
                      </th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Budget
                      </th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        C.O.
                      </th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Cobrado
                      </th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Restante
                      </th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Estado
                      </th>
                    </tr>
                  </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvoices && filteredInvoices.length > 0 ? (
                    filteredInvoices.map((invoice) => (
                      <tr key={invoice.budgetId} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          #{invoice.invoiceNumber || invoice.budgetId}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {invoice.propertyAddress}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(invoice.budgetDate)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                          {formatCurrency(invoice.budgetTotal)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {invoice.changeOrdersCount > 0 ? (
                            <div className="flex flex-col">
                              <span className="text-blue-600 font-semibold">
                                +{formatCurrency(invoice.changeOrdersTotal)}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({invoice.changeOrdersCount} C.O.)
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                          {formatCurrency(invoice.totalCollected)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-bold">
                          <span className={invoice.remainingAmount > 0 ? 'text-orange-600' : 'text-green-600'}>
                            {formatCurrency(invoice.remainingAmount)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            invoice.paymentStatus === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : invoice.paymentStatus === 'partial'
                              ? 'bg-blue-100 text-blue-800'
                              : invoice.paymentStatus === 'initial_only'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {invoice.paymentStatus === 'completed' ? 'Completo' :
                             invoice.paymentStatus === 'partial' ? 'Parcial' :
                             invoice.paymentStatus === 'initial_only' ? 'Solo Initial' :
                             'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                        No hay invoices activos con los filtros seleccionados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Pending Final Invoices */}
          {data.details.pendingFinalInvoices.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <FaClock className="text-orange-500" />
                  Final Invoices Pendientes ({data.details.pendingFinalInvoices.length})
                </h2>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total por Cobrar:</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(
                      data.details.pendingFinalInvoices.reduce(
                        (sum, invoice) => {
                          const amount = parseFloat(invoice.finalAmountDue || 0);
                          return sum + Math.abs(amount); // Usar valor absoluto para evitar negativos
                        },
                        0
                      )
                    )}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Invoice ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Propiedad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Monto Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Extras
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado Envío
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.details.pendingFinalInvoices.map((invoice) => (
                      <tr key={invoice.finalInvoiceId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={() => window.open(`/work/${invoice.workId}?section=final-invoice`, '_blank')}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                            title="Ver Final Invoice de esta obra"
                          >
                            #{invoice.invoiceNumber || String(invoice.finalInvoiceId).substring(0, 8)}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {invoice.propertyAddress}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {invoice.clientName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                          {formatCurrency(invoice.finalAmountDue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatCurrency(invoice.subtotalExtras)}
                          <span className="text-xs text-gray-400 ml-1">
                            ({invoice.extraItemsCount} items)
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            invoice.wasSent ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {invoice.wasSent ? 'Enviado' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {(() => {
                            if (invoice.wasSent && invoice.sentAt && invoice.sentAt !== null && !isNaN(new Date(invoice.sentAt))) {
                              return formatDate(invoice.sentAt);
                            } else if (invoice.invoiceDate && !isNaN(new Date(invoice.invoiceDate))) {
                              return formatDate(invoice.invoiceDate);
                            } else {
                              return 'Fecha no disponible';
                            }
                          })()} 
                          {invoice.wasSent && invoice.sentAt && invoice.sentAt !== null && !isNaN(new Date(invoice.sentAt)) && (
                            <div className="text-xs text-green-600 font-medium">Enviado</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'works' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FaChartLine className="text-blue-500" />
            Works en Progreso - Detalle Financiero
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Work ID
                  </th> */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Work
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Change Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Extras
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total por Cobrar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Comisión
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Vendedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado Work
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado Final Invoice
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.details.worksInProgress.map((work) => (
                  <tr key={work.workId} className="hover:bg-gray-50">
                    {/* <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {work.workId}
                    </td> */}
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {work.propertyAddress}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {work.clientName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(work.budgetTotal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {work.changeOrdersTotal > 0 ? (
                        <span className="text-blue-600 font-semibold">
                          +{formatCurrency(work.changeOrdersTotal)}
                          <span className="text-xs text-gray-400 ml-1">
                            ({work.changeOrdersCount})
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {work.finalInvoiceExtras > 0 ? (
                        <span className="text-purple-600 font-semibold">
                          +{formatCurrency(work.finalInvoiceExtras)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                      {formatCurrency(work.amountPending)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-purple-600">
                          {formatCurrency(work.commissionAmount)}
                        </span>
                        {work.commissionPaid && (
                          <FaCheckCircle className="text-green-500" title={`Pagada: ${formatDate(work.commissionPaidDate)}`} />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {work.salesRepName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        work.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : work.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : work.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : work.status === 'on_hold'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {work.status === 'in_progress' ? 'En Progreso' :
                         work.status === 'completed' ? 'Completado' :
                         work.status === 'pending' ? 'Pendiente' :
                         work.status === 'on_hold' ? 'En Espera' : work.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        work.finalInvoiceStatus === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : work.finalInvoiceStatus === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {work.finalInvoiceStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'income' && (
        <div className="space-y-6">
          {/* Income Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg p-4 md:p-6 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <FaDollarSign className="text-3xl md:text-4xl" />
                <div>
                  <p className="text-sm opacity-90">Total Ingresos</p>
                  <p className="text-2xl md:text-3xl font-bold">
                    {formatCurrency(incomeData.summary.totalIncome || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 md:p-6 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <FaMoneyBillWave className="text-3xl md:text-4xl" />
                <div>
                  <p className="text-sm opacity-90">Initial Payments</p>
                  <p className="text-2xl md:text-3xl font-bold">
                    {formatCurrency(incomeData.summary.totalInitialPayments || 0)}
                  </p>
                  <p className="text-xs opacity-75">
                    {incomeData.summary.initialPaymentsCount || 0} pagos
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 md:p-6 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <FaCheckCircle className="text-3xl md:text-4xl" />
                <div>
                  <p className="text-sm opacity-90">Final Payments</p>
                  <p className="text-2xl md:text-3xl font-bold">
                    {formatCurrency(incomeData.summary.totalFinalPayments || 0)}
                  </p>
                  <p className="text-xs opacity-75">
                    {incomeData.summary.finalPaymentsCount || 0} pagos
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Income Table */}
          <div className="bg-white rounded-lg shadow-md p-3 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
              <FaDollarSign className="text-green-500 text-lg md:text-xl" />
              <span className="truncate">Historial de Ingresos</span>
              <span className="ml-auto text-sm text-gray-500">
                {incomeData.income?.length || 0} transacciones
              </span>
            </h2>
            <div className="overflow-x-auto -mx-3 md:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Fecha
                      </th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Tipo
                      </th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Propiedad
                      </th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Invoice #
                      </th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Método de Pago
                      </th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Monto
                      </th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Estado Work
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {incomeData.income && incomeData.income.length > 0 ? (
                      incomeData.income.map((income) => (
                        <tr key={income.id} className="hover:bg-gray-50">
                          <td className="px-3 md:px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(income.date)}
                          </td>
                          <td className="px-3 md:px-4 py-3 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              income.type === 'initial_payment'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {income.type === 'initial_payment' ? 'Initial' : 'Final'}
                            </span>
                          </td>
                          <td className="px-3 md:px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                            {income.propertyAddress}
                          </td>
                          <td className="px-3 md:px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                            #{income.budgetNumber}
                          </td>
                          <td className="px-3 md:px-4 py-3 text-sm text-gray-700">
                            {income.paymentMethod}
                          </td>
                          <td className="px-3 md:px-4 py-3 whitespace-nowrap text-sm font-bold text-green-600">
                            {formatCurrency(income.amount)}
                          </td>
                          <td className="px-3 md:px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              income.workStatus === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : income.workStatus === 'in_progress'
                                ? 'bg-blue-100 text-blue-800'
                                : income.workStatus === 'Sin Work'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {income.workStatus === 'in_progress' ? 'En Progreso' :
                               income.workStatus === 'completed' ? 'Completado' :
                               income.workStatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                          No hay ingresos registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AccountsReceivable;
