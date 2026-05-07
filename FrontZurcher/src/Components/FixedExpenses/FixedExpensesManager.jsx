import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  PlusIcon,
  ChevronRightIcon,
  XMarkIcon,
  DocumentArrowDownIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ClockIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../utils/axios';
import { fetchStaff } from '../../Redux/Actions/adminActions';

const FixedExpensesManager = () => {
  const dispatch = useDispatch();
  const staff = useSelector((state) => state.auth.currentStaff);
  const staffList = useSelector((state) => state.admin.staffList || []);
  
  // Estados principales
  const [expenses, setExpenses] = useState([]);
  const [inactiveExpenses, setInactiveExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingInactive, setLoadingInactive] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [pendingPeriods, setPendingPeriods] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Estados del formulario
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    totalAmount: '',
    frequency: 'monthly',
    paymentMethod: '',
    paymentAccount: '',
    startDate: '',
    endDate: '',
    staffId: ''
  });

  // Cargar gastos fijos y staff al montar
  useEffect(() => {
    loadFixedExpenses();
    dispatch(fetchStaff());
  }, [dispatch]);

  const loadFixedExpenses = async () => {
    try {
      setLoading(true);
      // Cargar gastos activos (por defecto)
      const response = await api.get('/fixed-expenses');
      const data = response.data.fixedExpenses || response.data;
      setExpenses(Array.isArray(data) ? data : []);
      
      // Cargar gastos inactivos/histórico en segundo plano
      loadInactiveExpenses();
    } catch (error) {
      console.error('Error cargando gastos fijos:', error);
      toast.error('Error cargando gastos fijos');
    } finally {
      setLoading(false);
    }
  };

  const loadInactiveExpenses = async () => {
    try {
      setLoadingInactive(true);
      const response = await api.get('/fixed-expenses?isActive=false');
      const data = response.data.fixedExpenses || response.data;
      setInactiveExpenses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando gastos inactivos:', error);
      // No mostrar error toast para datos secundarios
    } finally {
      setLoadingInactive(false);
    }
  };

  const loadExpenseDetails = async (expenseId) => {
    try {
      setLoadingDetails(true);
      
      // Cargar historial de pagos - devuelve { fixedExpense: {}, payments: [] }
      const paymentsRes = await api.get(`/fixed-expenses/${expenseId}/payments`);
      console.log('💰 Pagos cargados en FixedExpensesManager:', paymentsRes.data.payments);
      console.log('📎 Receipts en pagos:', paymentsRes.data.payments?.map(p => ({
        idPayment: p.idPayment,
        receipts: p.receipts,
        fileUrl: p.fileUrl
      })));
      setPaymentHistory(paymentsRes.data.payments || []);
      
      // Cargar períodos pendientes
      const periodsRes = await api.get(`/fixed-expenses/${expenseId}/pending-periods`);
      setPendingPeriods(periodsRes.data.pendingPeriods || []);
    } catch (error) {
      console.error('Error cargando detalles:', error);
      toast.error('Error cargando detalles del gasto');
    } finally {
      setLoadingDetails(false);
    }
  };

  const openDetailModal = async (expense) => {
    setSelectedExpense(expense);
    setShowDetailModal(true);
    await loadExpenseDetails(expense.idFixedExpense);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedExpense(null);
    setPaymentHistory([]);
    setPendingPeriods([]);
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      totalAmount: '',
      frequency: 'monthly',
      paymentMethod: '',
      paymentAccount: '',
      startDate: '',
      endDate: '',
      staffId: ''
    });
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

  const openEditModal = (expense) => {
    setSelectedExpense(expense);
    setFormData({
      name: expense.name || '',
      description: expense.description || '',
      category: expense.category || '',
      totalAmount: expense.totalAmount?.toString() || '',
      frequency: expense.frequency || 'monthly',
      paymentMethod: expense.paymentMethod || '',
      paymentAccount: expense.paymentAccount || '',
      startDate: expense.startDate || '',
      endDate: expense.endDate || '',
      staffId: expense.staffId || ''
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedExpense(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.totalAmount || !formData.frequency || !formData.startDate) {
      toast.error('Por favor completa los campos requeridos (incluyendo Fecha de Inicio)');
      return;
    }

    try {
      const payload = {
        ...formData,
        totalAmount: parseFloat(formData.totalAmount),
        startDate: formData.startDate, // Ya debe venir en formato YYYY-MM-DD del input type="date"
        endDate: formData.endDate || null,
        createdByStaffId: staff?.id,
        staffId: formData.category === 'Salarios' && formData.staffId ? formData.staffId : null
      };

      await api.post('/fixed-expenses', payload);
      toast.success('Gasto fijo creado exitosamente');
      closeCreateModal();
      await loadFixedExpenses();
    } catch (error) {
      console.error('Error creando gasto:', error);
      toast.error(error.response?.data?.error || 'Error creando gasto fijo');
    }
  };

  const handleUpdateExpense = async (e) => {
    e.preventDefault();
    
    if (!selectedExpense) return;
    if (!formData.name || !formData.totalAmount || !formData.frequency) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }

    try {
      const payload = {
        ...formData,
        totalAmount: parseFloat(formData.totalAmount),
        staffId: formData.category === 'Salarios' && formData.staffId ? formData.staffId : null
      };

      await api.patch(`/fixed-expenses/${selectedExpense.idFixedExpense}`, payload);
      toast.success('Gasto fijo actualizado exitosamente');
      closeEditModal();
      await loadFixedExpenses();
    } catch (error) {
      console.error('Error actualizando gasto:', error);
      toast.error(error.response?.data?.error || 'Error actualizando gasto fijo');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    const message = '¿Desactivar este gasto fijo?\n\n✅ El histórico de pagos se conserva\n✅ No genera nuevos gastos a futuro\n✅ Puedes reactivarlo después si lo necesitas';
    if (!window.confirm(message)) {
      return;
    }

    try {
      await api.delete(`/fixed-expenses/${expenseId}`);
      toast.success('Gasto fijo desactivado. El histórico se conserva.');
      await loadFixedExpenses();
    } catch (error) {
      console.error('Error desactivando gasto:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Error desactivando gasto fijo';
      toast.error(errorMessage);
    }
  };

  const getStatusColor = (expense) => {
    if (expense.paymentStatus === 'paid') return 'bg-green-100 border-green-300';
    if (expense.paymentStatus === 'paid_via_credit_card') return 'bg-blue-100 border-blue-300';
    if (expense.paymentStatus === 'paid_via_invoice') return 'bg-green-100 border-green-300';
    if (expense.paymentStatus === 'partial') return 'bg-yellow-100 border-yellow-300';
    return 'bg-red-100 border-red-300';
  };

  const getStatusText = (expense) => {
    if (expense.paymentStatus === 'paid') return '✅ Pagado';
    if (expense.paymentStatus === 'paid_via_credit_card') return '💳 Tarjeta (pendiente)';
    if (expense.paymentStatus === 'paid_via_invoice') return '✅ Pagado vía invoice';
    if (expense.paymentStatus === 'partial') return '⚠️ Parcial';
    return '❌ Pendiente';
  };

  // 🆕 Función para capitalizar nombres
  const capitalize = (text) => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  // 🆕 AGRUPACIÓN: Agrupar por Categoría, luego por Staff/Nombre
  const groupExpensesByCategory = (expensesList) => {
    const categories = {};
    
    expensesList.forEach(expense => {
      const category = expense.category || 'Sin Categoría';
      
      if (!categories[category]) {
        categories[category] = {};
      }
      
      // Dentro de cada categoría, sub-agrupar por staff o nombre
      let subGroupKey, subGroupLabel;
      
      if (expense.staffId) {
        // Por staff
        const staffMember = staffList.find(s => s.id === expense.staffId);
        subGroupLabel = staffMember?.name || 'Sin Nombre';
        subGroupKey = `staff_${expense.staffId}`;
      } else {
        // Por nombre del gasto
        subGroupLabel = capitalize(expense.name);
        subGroupKey = `name_${expense.name}`;
      }
      
      if (!categories[category][subGroupKey]) {
        categories[category][subGroupKey] = {
          label: subGroupLabel,
          expenses: []
        };
      }
      
      categories[category][subGroupKey].expenses.push(expense);
    });
    
    // Convertir a estructura de grupos para renderizado
    const result = [];
    
    // Ordenar categorías: Salarios primero, luego alfabético
    const sortedCategories = Object.keys(categories).sort((a, b) => {
      if (a === 'Salarios') return -1;
      if (b === 'Salarios') return 1;
      return a.localeCompare(b);
    });
    
    sortedCategories.forEach(categoryName => {
      const categorySubGroups = categories[categoryName];
      
      // Ordenar sub-grupos alfabéticamente
      const sortedSubGroups = Object.entries(categorySubGroups)
        .sort(([, a], [, b]) => a.label.localeCompare(b.label));
      
      // Crear entrada para cada sub-grupo
      sortedSubGroups.forEach(([, subGroup]) => {
        result.push({
          label: `${categoryName} - ${subGroup.label}`,
          categoryLabel: categoryName,
          subLabel: subGroup.label,
          priority: categoryName === 'Salarios' ? 0 : 1,
          expenses: subGroup.expenses.sort((a, b) => a.name.localeCompare(b.name))
        });
      });
    });
    
    // Ordenar por prioridad
    return result.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.categoryLabel !== b.categoryLabel) return a.categoryLabel.localeCompare(b.categoryLabel);
      return a.subLabel.localeCompare(b.subLabel);
    });
  };

  // 🆕 Calcular estado de vencimiento del gasto
  const getPaymentStatus = (nextDueDate) => {
    if (!nextDueDate) return { label: 'Sin fecha', color: 'gray', badge: '?' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(nextDueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      // Vencido
      return { 
        label: `Vencido hace ${Math.abs(diffDays)} días`, 
        color: 'red', 
        badge: '⚠️' 
      };
    } else if (diffDays === 0) {
      // Vence hoy
      return { 
        label: 'Vence hoy', 
        color: 'orange', 
        badge: '⏰' 
      };
    } else if (diffDays <= 7) {
      // Próximo a vencer (7 días)
      return { 
        label: `Vence en ${diffDays} días`, 
        color: 'yellow', 
        badge: '⏱️' 
      };
    } else {
      // Al día
      return { 
        label: `Al día (${diffDays} días)`, 
        color: 'green', 
        badge: '✓' 
      };
    }
  };

  // 🆕 Ordenar gastos: primero con staffId, luego sin staffId
  const sortedExpenses = [...expenses].sort((a, b) => {
    const aHasStaff = !!a.staffId;
    const bHasStaff = !!b.staffId;

    if (aHasStaff && !bHasStaff) return -1;
    if (!aHasStaff && bHasStaff) return 1;
    return 0;
  });

  // 🆕 Agrupar los gastos por categoría y sub-grupo
  const groupedExpenses = groupExpensesByCategory(sortedExpenses);
  const groupedInactiveExpenses = groupExpensesByCategory([...inactiveExpenses].sort((a, b) => {
    const aHasStaff = !!a.staffId;
    const bHasStaff = !!b.staffId;
    if (aHasStaff && !bHasStaff) return -1;
    if (!aHasStaff && bHasStaff) return 1;
    return 0;
  }));

  // Mantener sortedInactiveExpenses por compatibilidad
  const sortedInactiveExpenses = [...inactiveExpenses].sort((a, b) => {
    const aHasStaff = !!a.staffId;
    const bHasStaff = !!b.staffId;
    if (aHasStaff && !bHasStaff) return -1;
    if (!aHasStaff && bHasStaff) return 1;
    return 0;
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    // 🔴 CRITICAL: NO usar new Date(dateString) porque interpreta en timezone local
    // Primero, limpiar la fecha
    let cleanDateStr = dateString;
    // Si incluye 'T' (ISO format), tomar solo la parte de fecha
    if (typeof cleanDateStr === 'string' && cleanDateStr.includes('T')) {
      cleanDateStr = cleanDateStr.split('T')[0];
    }
    // Convertir a string si no lo es
    if (typeof cleanDateStr !== 'string') {
      cleanDateStr = cleanDateStr.toISOString().split('T')[0];
    }
    // Parsear manualmente: YYYY-MM-DD
    const [year, month, day] = cleanDateStr.split('-').map(Number);
    if (!year || !month || !day) return dateString; // Fallback
    // Crear Date en UTC para que no descuente un día
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString('es-AR', { timeZone: 'UTC' });
  };

  // 🆕 Componente para fila de pago con preview de comprobante
  const PaymentHistoryRow = ({ payment, formatDate, formatCurrency }) => {
    const [showReceipt, setShowReceipt] = React.useState(false);

    console.log(`🔍 PaymentHistoryRow para pago ${payment.idPayment}:`, {
      hasFileUrl: !!payment.fileUrl,
      hasReceipts: !!payment.receipts,
      receiptsLength: payment.receipts?.length,
      payment
    });

    // Obtener el primer receipt si existe
    const receipt = payment.receipts && payment.receipts.length > 0 ? payment.receipts[0] : null;
    const receiptUrl = receipt?.fileUrl || payment.fileUrl;

    console.log(`  📎 Pago ${payment.idPayment} - Receipt:`, {
      receipt,
      receiptUrl,
      isPDF: receiptUrl?.toLowerCase().includes('/pdf/') || receiptUrl?.toLowerCase().endsWith('.pdf'),
      isCloudinayRaw: receiptUrl?.includes('/raw/'),
      mimeType: receipt?.mimeType
    });

    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CalendarIcon className="h-4 w-4 text-gray-600" />
              <span className="font-semibold text-gray-900">
                {formatDate(payment.periodStart)} al {formatDate(payment.periodEnd)}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <CurrencyDollarIcon className="h-4 w-4 text-green-600" />
              <span className="text-green-700 font-bold">{formatCurrency(payment.amount)}</span>
            </div>
            <div className="text-xs text-gray-600">
              Pagado: {formatDate(payment.paymentDate)} • {payment.paymentMethod || '-'}
            </div>
            {payment.notes && (
              <p className="text-sm text-gray-600 mt-2 italic">"{payment.notes}"</p>
            )}
          </div>
          {receiptUrl && (
            <button
              onClick={() => setShowReceipt(!showReceipt)}
              className="ml-4 bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-1 text-sm whitespace-nowrap"
              title="Ver comprobante"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              {showReceipt ? 'Ocultar' : 'Ver'}
            </button>
          )}
          {!receiptUrl && (
            <div className="ml-4 text-xs text-gray-500 italic">
              Sin comprobante
            </div>
          )}
        </div>

        {/* Preview de comprobante */}
        {showReceipt && receiptUrl && (
          <div className="mt-4 border-t pt-4">
            <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
              {/* Detectar si es PDF o imagen usando mimeType */}
              {receipt?.mimeType === 'application/pdf' ? (
                <iframe
                  src={`https://docs.google.com/gview?url=${encodeURIComponent(receiptUrl)}&embedded=true`}
                  title="Vista previa PDF"
                  width="100%"
                  height="400px"
                />
              ) : receipt?.mimeType?.startsWith('image/') ? (
                <img
                  src={receiptUrl}
                  alt="Comprobante de pago"
                  className="w-full h-auto max-h-96 object-contain"
                />
              ) : (
                <div className="p-4 text-center text-gray-600">
                  <DocumentArrowDownIcon className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Archivo: {receipt?.originalName || 'comprobante'}</p>
                  <p className="text-xs text-gray-500 mt-1">Tipo: {receipt?.mimeType || 'desconocido'}</p>
                </div>
              )}
            </div>
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Descargar comprobante →
            </a>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gastos Fijos</h1>
            <p className="text-gray-600 mt-2">Gestiona tus gastos recurrentes</p>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition"
          >
            <PlusIcon className="h-5 w-5" />
            Nuevo Gasto
          </button>
        </div>

        {/* Toggle de histórico */}
        {expenses.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistorical(false)}
              disabled={showHistorical && inactiveExpenses.length === 0}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                !showHistorical
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              } ${showHistorical && inactiveExpenses.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              📋 Activos ({expenses.length})
            </button>
            <button
              onClick={() => setShowHistorical(true)}
              disabled={inactiveExpenses.length === 0}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                showHistorical
                  ? 'bg-orange-500 text-white'
                  : `${inactiveExpenses.length === 0 ? 'opacity-50 cursor-not-allowed' : ''} bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`
              }`}
            >
              📜 Histórico ({inactiveExpenses.length})
            </button>
          </div>
        )}
      </div>

      {/* Listado de gastos */}
      {loading || (showHistorical && loadingInactive) ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      ) : !showHistorical && expenses.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">No hay gastos fijos activos</p>
          <button
            onClick={openCreateModal}
            className="mt-4 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
          >
            Crear uno nuevo
          </button>
        </div>
      ) : showHistorical && inactiveExpenses.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">No hay gastos completados/histórico</p>
          <button
            onClick={() => setShowHistorical(false)}
            className="mt-4 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
          >
            Ver activos
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Vista de tabla - Desktop */}
          <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Categoría</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Monto Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Próx. Vencimiento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Frecuencia</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(showHistorical ? groupedInactiveExpenses : groupedExpenses).map((group, groupIdx) => (
                  <React.Fragment key={`group_${groupIdx}`}>
                    {/* Encabezado del grupo */}
                    <tr className="bg-gray-100 hover:bg-gray-100">
                      <td colSpan="6" className="px-6 py-3">
                        <span className="text-sm font-bold text-gray-800">
                          {group.label}
                        </span>
                      </td>
                    </tr>
                    
                    {/* Filas de gastos dentro del grupo */}
                    {group.expenses.map((expense) => {
                      const status = getPaymentStatus(expense.nextDueDate);
                      const statusColors = {
                        green: 'bg-green-100 text-green-800',
                        yellow: 'bg-yellow-100 text-yellow-800',
                        orange: 'bg-orange-100 text-orange-800',
                        red: 'bg-red-100 text-red-800',
                        gray: 'bg-gray-100 text-gray-800'
                      };
                      return (
                        <tr key={expense.idFixedExpense} className={`hover:bg-gray-50 transition ${showHistorical ? 'bg-gray-50' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">{capitalize(expense.name)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{expense.category || '-'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(expense.totalAmount)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColors[status.color]}`}>
                              {status.badge} {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{formatDate(expense.nextDueDate)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600 capitalize">{expense.frequency}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => openDetailModal(expense)}
                                title="Ver detalles"
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 text-sm font-medium"
                              >
                                <ChevronRightIcon className="h-4 w-4" />
                                Ver
                              </button>
                              <button
                                onClick={() => openEditModal(expense)}
                                title="Editar"
                                className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-900 text-sm font-medium"
                              >
                                <PencilIcon className="h-4 w-4" />
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(expense.idFixedExpense)}
                                title="Eliminar"
                                className="inline-flex items-center gap-1 text-red-600 hover:text-red-900 text-sm font-medium"
                              >
                                <TrashIcon className="h-4 w-4" />
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vista de cards - Mobile */}
          <div className="md:hidden space-y-4">
            {(showHistorical ? groupedInactiveExpenses : groupedExpenses).map((group, groupIdx) => (
              <div key={`group_${groupIdx}`} className="space-y-2">
                {/* Encabezado del grupo */}
                <div className="px-4 py-2 bg-gray-100 rounded-lg">
                  <h2 className="text-sm font-bold text-gray-800">{group.label}</h2>
                </div>
                
                {/* Cards del grupo */}
                <div className="grid grid-cols-1 gap-3">
                  {group.expenses.map((expense) => {
                    const status = getPaymentStatus(expense.nextDueDate);
                    const statusColors = {
                      green: 'bg-green-100 text-green-800 border-green-200',
                      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                      orange: 'bg-orange-100 text-orange-800 border-orange-200',
                      red: 'bg-red-100 text-red-800 border-red-200',
                      gray: 'bg-gray-100 text-gray-800 border-gray-200'
                    };
                    return (
                      <div key={expense.idFixedExpense} className={`rounded-lg border border-gray-200 p-4 space-y-3 ${showHistorical ? 'bg-gray-50' : 'bg-white'}`}>
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <h3 className="text-sm font-bold text-gray-900">{capitalize(expense.name)}</h3>
                            <p className="text-xs text-gray-500">{expense.category || '-'}</p>
                          </div>
                          <span className="text-lg font-bold text-gray-900">{formatCurrency(expense.totalAmount)}</span>
                        </div>
                        
                        {/* Badge de estado */}
                        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${statusColors[status.color]}`}>
                          {status.badge} {status.label}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-gray-500">Próx. Vencimiento</p>
                            <p className="font-semibold text-gray-900">{formatDate(expense.nextDueDate)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Frecuencia</p>
                            <p className="font-semibold text-gray-900 capitalize">{expense.frequency}</p>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t">
                          <button
                            onClick={() => openDetailModal(expense)}
                            className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded text-xs font-medium hover:bg-blue-100 transition"
                          >
                            Ver
                          </button>
                          <button
                            onClick={() => openEditModal(expense)}
                            className="flex-1 px-3 py-2 bg-amber-50 text-amber-600 rounded text-xs font-medium hover:bg-amber-100 transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.idFixedExpense)}
                            className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100 transition"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de crear gasto */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Crear Gasto Fijo</h2>
              <button
                onClick={closeCreateModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleCreateExpense} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ej: Salario"
                    required
                  />
                </div>

                {/* Monto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto Total <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="totalAmount"
                    value={formData.totalAmount}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="0.00"
                    step="0.01"
                    required
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Renta">Renta</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Seguros">Seguros</option>
                    <option value="Salarios">Salarios</option>
                    <option value="Equipamiento">Equipamiento</option>
                    <option value="Software/Subscripciones">Software/Subscripciones</option>
                    <option value="Mantenimiento Vehicular">Mantenimiento Vehicular</option>
                    <option value="Combustible">Combustible</option>
                    <option value="Impuestos">Impuestos</option>
                    <option value="Contabilidad/Legal">Contabilidad/Legal</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Telefonía">Telefonía</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                {/* Frecuencia */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frecuencia <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="frequency"
                    value={formData.frequency}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quincenal</option>
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="semiannual">Semestral</option>
                    <option value="annual">Anual</option>
                    <option value="one_time">Una sola vez</option>
                  </select>
                </div>

                {/* Staff (solo para Salarios) */}
                {formData.category === 'Salarios' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Staff / Empleado
                    </label>
                    <select
                      name="staffId"
                      value={formData.staffId}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Seleccionar...</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Fecha de inicio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Fecha de fin */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Fin (Opcional)
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows="3"
                  placeholder="Notas adicionales..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Crear Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de editar gasto */}
      {showEditModal && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Editar Gasto Fijo</h2>
              <button
                onClick={closeEditModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleUpdateExpense} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ej: Salario"
                    required
                  />
                </div>

                {/* Monto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto Total <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="totalAmount"
                    value={formData.totalAmount}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="0.00"
                    step="0.01"
                    required
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Renta">Renta</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Seguros">Seguros</option>
                    <option value="Salarios">Salarios</option>
                    <option value="Equipamiento">Equipamiento</option>
                    <option value="Software/Subscripciones">Software/Subscripciones</option>
                    <option value="Mantenimiento Vehicular">Mantenimiento Vehicular</option>
                    <option value="Combustible">Combustible</option>
                    <option value="Impuestos">Impuestos</option>
                    <option value="Contabilidad/Legal">Contabilidad/Legal</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Telefonía">Telefonía</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                {/* Frecuencia */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frecuencia <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="frequency"
                    value={formData.frequency}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quincenal</option>
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="semiannual">Semestral</option>
                    <option value="annual">Anual</option>
                    <option value="one_time">Una sola vez</option>
                  </select>
                </div>

                {/* Método de pago */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Método de Pago (Opcional)
                  </label>
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Proyecto Septic BOFA">Proyecto Septic BOFA</option>
                    <option value="Chase Bank">Chase Bank</option>
                    <option value="AMEX">AMEX</option>
                    <option value="Chase Credit Card">Chase Credit Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  </select>
                </div>

                {/* Staff (solo para Salarios) */}
                {formData.category === 'Salarios' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Staff / Empleado
                    </label>
                    <select
                      name="staffId"
                      value={formData.staffId}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Seleccionar...</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Fecha de inicio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Fecha de fin */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Fin (Opcional)
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows="3"
                  placeholder="Notas adicionales..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showDetailModal && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">{selectedExpense.name}</h2>
                <p className="text-orange-100">{selectedExpense.category || '-'}</p>
              </div>
              <button
                onClick={closeDetailModal}
                className="text-white hover:text-orange-100"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Resumen - Solo Monto Total y Próx. Vencimiento */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-blue-600 text-sm font-medium">Monto Total</p>
                    <p className="text-2xl font-bold text-blue-900">{formatCurrency(selectedExpense.totalAmount)}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <p className="text-purple-600 text-sm font-medium">Próx. Vencimiento</p>
                    <p className="text-lg font-bold text-purple-900">{formatDate(selectedExpense.nextDueDate)}</p>
                  </div>
                </div>

                {/* Historial de pagos */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    📜 Historial de Pagos ({paymentHistory.length})
                  </h3>
                  {paymentHistory.length === 0 ? (
                    <p className="text-gray-500 text-center py-6">No hay pagos registrados</p>
                  ) : (
                    <div className="space-y-3">
                      {paymentHistory.map((payment, idx) => (
                        <PaymentHistoryRow
                          key={payment.idPayment || idx}
                          payment={payment}
                          formatDate={formatDate}
                          formatCurrency={formatCurrency}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Botón cerrar */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={closeDetailModal}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedExpensesManager;
