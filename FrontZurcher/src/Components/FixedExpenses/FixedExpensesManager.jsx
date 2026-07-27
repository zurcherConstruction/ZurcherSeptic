import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  PlusIcon,
  ChevronRightIcon,
  XMarkIcon,
  DocumentArrowDownIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ChevronLeftIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import api from '../../utils/axios';
import { fetchStaff } from '../../Redux/Actions/adminActions';
import {
  PAYMENT_METHODS,
  FIXED_EXPENSE_CATEGORIES,
  FIXED_EXPENSE_FREQUENCIES
} from '../../utils/paymentConstants';

const EMPTY_FORM = {
  name: '', description: '', category: '', totalAmount: '',
  frequency: 'monthly', paymentMethod: '', paymentAccount: '',
  startDate: '', endDate: '', staffId: '', variableAmount: false
};

// ─────────────────────────────────────────────
// Helpers (fuera del componente)
// ─────────────────────────────────────────────
const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const s = typeof dateString === 'string' && dateString.includes('T')
    ? dateString.split('T')[0] : String(dateString);
  const [year, month, day] = s.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  return new Date(Date.UTC(year, month - 1, day))
    .toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
};

const getMonthLabel = (yyyyMm) => {
  const [year, month] = yyyyMm.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1))
    .toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
};

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

// ─────────────────────────────────────────────
// Sub-componentes (fuera del componente padre)
// ─────────────────────────────────────────────

const PaymentHistoryRow = ({ payment }) => {
  const [showReceipt, setShowReceipt] = useState(false);
  const receipt = payment.receipts?.[0] || null;
  const receiptUrl = receipt?.fileUrl || payment.fileUrl;
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <CalendarIcon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold">{formatDate(payment.periodStart)} – {formatDate(payment.periodEnd)}</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <CurrencyDollarIcon className="h-4 w-4 text-green-600" />
            <span className="text-green-700 font-bold">{formatCurrency(payment.amount)}</span>
            <span className="text-xs text-gray-500">• {formatDate(payment.paymentDate)} • {payment.paymentMethod || '-'}</span>
          </div>
          {payment.notes && <p className="text-xs text-gray-500 italic">"{payment.notes}"</p>}
        </div>
        {receiptUrl && (
          <button onClick={() => setShowReceipt(!showReceipt)}
            className="ml-3 bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 flex items-center gap-1">
            <DocumentArrowDownIcon className="h-3 w-3" />
            {showReceipt ? 'Ocultar' : 'Ver'}
          </button>
        )}
      </div>
      {showReceipt && receiptUrl && (
        <div className="mt-3 border-t pt-3">
          {receipt?.mimeType === 'application/pdf' ? (
            <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(receiptUrl)}&embedded=true`}
              title="PDF" width="100%" height="350px" />
          ) : receipt?.mimeType?.startsWith('image/') ? (
            <img src={receiptUrl} alt="Comprobante" className="w-full max-h-80 object-contain" />
          ) : (
            <p className="text-sm text-gray-500">Archivo: {receipt?.originalName || 'comprobante'}</p>
          )}
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
            className="text-blue-600 text-xs mt-1 inline-block">Descargar →</a>
        </div>
      )}
    </div>
  );
};

const ChecklistRow = ({ expense, onPay, onDetail, onEdit }) => (
  <div className={`flex items-center gap-3 p-3 rounded-lg border transition ${
    expense.isPaidThisMonth
      ? 'bg-green-50 border-green-200'
      : expense.isPartiallyPaid
        ? 'bg-yellow-50 border-yellow-200'
        : 'bg-white border-gray-200 hover:border-orange-200'
  }`}>
    {expense.isPaidThisMonth
      ? <CheckCircleSolid className="h-6 w-6 text-green-500 flex-shrink-0" />
      : <div className="h-6 w-6 rounded-full border-2 border-gray-300 flex-shrink-0" />
    }
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900 truncate">{expense.name}</span>
        {expense.variableAmount && (
          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">variable</span>
        )}
        <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline">{expense.category}</span>
      </div>
      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
        <span className="text-sm font-medium text-gray-700">
          {formatCurrency(expense.totalAmount)}
          {expense.variableAmount && <span className="text-xs text-gray-400 ml-1">(ref)</span>}
        </span>
        {expense.isPartiallyPaid && !expense.isPaidThisMonth && (
          <span className="text-xs text-yellow-700">Parcial: {formatCurrency(expense.monthPaidAmount)}</span>
        )}
        {expense.isPaidThisMonth && expense.monthPaidAmount > 0 && (
          <span className="text-xs text-green-600">Pagado: {formatCurrency(expense.monthPaidAmount)}</span>
        )}
      </div>
    </div>
    <div className="flex items-center gap-1 flex-shrink-0">
      {!expense.isPaidThisMonth && (
        <button onClick={onPay}
          className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition">
          Pagar
        </button>
      )}
      {expense.isPaidThisMonth && (
        <button onClick={onPay}
          className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition">
          + pago
        </button>
      )}
      <button onClick={onDetail} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Historial">
        <ClockIcon className="h-4 w-4" />
      </button>
      <button onClick={onEdit} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Editar">
        <PencilIcon className="h-4 w-4" />
      </button>
    </div>
  </div>
);

const ExpenseForm = ({ formData, onChange, onSubmit, onCancel, submitLabel, staffList }) => (
  <form onSubmit={onSubmit} className="p-6 space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre <span className="text-red-500">*</span>
        </label>
        <input type="text" name="name" value={formData.name} onChange={onChange} required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="Ej: Renta oficina" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {formData.variableAmount ? 'Monto de referencia' : 'Monto Total'} <span className="text-red-500">*</span>
        </label>
        <input type="number" name="totalAmount" value={formData.totalAmount} onChange={onChange} required
          step="0.01" placeholder="0.00"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
        {formData.variableAmount && (
          <p className="text-xs text-blue-600 mt-1">Este monto es referencia. El monto real se carga al pagar.</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
        <select name="category" value={formData.category} onChange={onChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
          <option value="">Seleccionar...</option>
          {FIXED_EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Frecuencia <span className="text-red-500">*</span>
        </label>
        <select name="frequency" value={formData.frequency} onChange={onChange} required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
          {FIXED_EXPENSE_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      {formData.category === 'Salarios' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Staff / Empleado</label>
          <select name="staffId" value={formData.staffId} onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
            <option value="">Seleccionar...</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fecha de Inicio <span className="text-red-500">*</span>
        </label>
        <input type="date" name="startDate" value={formData.startDate} onChange={onChange} required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Fin (Opcional)</label>
        <input type="date" name="endDate" value={formData.endDate} onChange={onChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
      </div>
    </div>

    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <input type="checkbox" id="variableAmount" name="variableAmount"
        checked={formData.variableAmount} onChange={onChange}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
      <label htmlFor="variableAmount" className="cursor-pointer">
        <span className="text-sm font-medium text-blue-900">Monto variable</span>
        <p className="text-xs text-blue-700">El monto cambia cada período (combustible, servicios, etc.)</p>
      </label>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
      <textarea name="description" value={formData.description} onChange={onChange} rows="2"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        placeholder="Notas adicionales..." />
    </div>

    <div className="flex gap-3 pt-4 border-t">
      <button type="button" onClick={onCancel}
        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
        Cancelar
      </button>
      <button type="submit"
        className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
        {submitLabel}
      </button>
    </div>
  </form>
);

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
const FixedExpensesManager = () => {
  const dispatch = useDispatch();
  const staff = useSelector((state) => state.auth.currentStaff);
  const staffList = useSelector((state) => state.admin.staffList || []);

  const [view, setView] = useState('checklist');
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());

  const [checklist, setChecklist] = useState([]);
  const [checklistSummary, setChecklistSummary] = useState(null);
  const [loadingChecklist, setLoadingChecklist] = useState(false);

  const [expenses, setExpenses] = useState([]);
  const [inactiveExpenses, setInactiveExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [showPayModal, setShowPayModal] = useState(false);
  const [payingExpense, setPayingExpense] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', paymentDate: '', paymentMethod: '', notes: '', receiptFile: null });
  const [payLoading, setPayLoading] = useState(false);

  useEffect(() => { dispatch(fetchStaff()); }, [dispatch]);

  const loadChecklist = useCallback(async () => {
    try {
      setLoadingChecklist(true);
      const res = await api.get(`/fixed-expenses/monthly-checklist?month=${currentMonth}`);
      setChecklist(res.data.checklist || []);
      setChecklistSummary(res.data.summary || null);
    } catch (err) {
      console.error('Error cargando checklist:', err);
      toast.error('Error cargando checklist mensual');
    } finally {
      setLoadingChecklist(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    if (view === 'checklist') loadChecklist();
  }, [currentMonth, view, loadChecklist]);

  const loadAllExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const [activeRes, inactiveRes] = await Promise.all([
        api.get('/fixed-expenses'),
        api.get('/fixed-expenses?isActive=false')
      ]);
      setExpenses(activeRes.data.fixedExpenses || activeRes.data || []);
      setInactiveExpenses(inactiveRes.data.fixedExpenses || inactiveRes.data || []);
    } catch {
      toast.error('Error cargando gastos fijos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'all') loadAllExpenses();
  }, [view, loadAllExpenses]);

  const navigateMonth = (delta) => {
    const [y, m] = currentMonth.split('-').map(Number);
    let nm = m + delta, ny = y;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1)  { nm = 12; ny--; }
    setCurrentMonth(`${ny}-${String(nm).padStart(2, '0')}`);
  };

  // ── Pay modal ──
  const openPayModal = (expense) => {
    const realMonth = new Date().toISOString().slice(0, 7);
    let defaultDate;
    if (currentMonth < realMonth) {
      // Mes anterior: usar el último día de ese mes para que el período se calcule correctamente
      const [y, m] = currentMonth.split('-').map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      defaultDate = `${currentMonth}-${String(lastDay).padStart(2, '0')}`;
    } else {
      defaultDate = new Date().toISOString().split('T')[0];
    }
    setPayingExpense(expense);
    setPayForm({
      amount: expense.totalAmount?.toString() || '',
      paymentDate: defaultDate,
      paymentMethod: expense.paymentMethod || '',
      notes: '',
      receiptFile: null
    });
    setShowPayModal(true);
  };

  const handlePayFormChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'receipt' && files?.[0]) {
      setPayForm(prev => ({ ...prev, receiptFile: files[0] }));
    } else {
      setPayForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (!payForm.amount || !payForm.paymentDate || !payForm.paymentMethod) {
      toast.error('Completa todos los campos requeridos');
      return;
    }
    try {
      setPayLoading(true);
      const fd = new FormData();
      fd.append('amount', payForm.amount);
      fd.append('paymentDate', payForm.paymentDate);
      fd.append('paymentMethod', payForm.paymentMethod);
      if (payForm.notes) fd.append('notes', payForm.notes);
      if (staff?.id) fd.append('staffId', staff.id);
      if (payForm.receiptFile) fd.append('receipt', payForm.receiptFile);
      await api.post(`/fixed-expenses/${payingExpense.idFixedExpense}/payments`, fd);
      toast.success(`${payingExpense.name} marcado como pagado`);
      setShowPayModal(false);
      setPayingExpense(null);
      await loadChecklist();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error registrando pago');
    } finally {
      setPayLoading(false);
    }
  };

  // ── Detail modal ──
  const openDetailModal = async (expense) => {
    setSelectedExpense(expense);
    setShowDetailModal(true);
    try {
      setLoadingDetails(true);
      const res = await api.get(`/fixed-expenses/${expense.idFixedExpense}/payments`);
      setPaymentHistory(res.data.payments || []);
    } catch {
      toast.error('Error cargando historial');
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedExpense(null);
    setPaymentHistory([]);
  };

  // ── Form handlers ──
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const openCreateModal = () => { setFormData(EMPTY_FORM); setShowCreateModal(true); };

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
      staffId: expense.staffId || '',
      variableAmount: expense.variableAmount || false
    });
    setShowEditModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.totalAmount || !formData.frequency || !formData.startDate) {
      toast.error('Completa los campos requeridos');
      return;
    }
    try {
      await api.post('/fixed-expenses', {
        ...formData,
        totalAmount: parseFloat(formData.totalAmount),
        endDate: formData.endDate || null,
        createdByStaffId: staff?.id,
        staffId: formData.category === 'Salarios' && formData.staffId ? formData.staffId : null
      });
      toast.success('Gasto fijo creado');
      setShowCreateModal(false);
      view === 'checklist' ? loadChecklist() : loadAllExpenses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error creando gasto fijo');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedExpense || !formData.name || !formData.totalAmount || !formData.frequency) {
      toast.error('Completa los campos requeridos');
      return;
    }
    try {
      await api.patch(`/fixed-expenses/${selectedExpense.idFixedExpense}`, {
        ...formData,
        totalAmount: parseFloat(formData.totalAmount),
        staffId: formData.category === 'Salarios' && formData.staffId ? formData.staffId : null
      });
      toast.success('Gasto fijo actualizado');
      setShowEditModal(false);
      setSelectedExpense(null);
      view === 'checklist' ? loadChecklist() : loadAllExpenses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error actualizando gasto fijo');
    }
  };

  const handleDelete = async (expenseId) => {
    if (!window.confirm('¿Desactivar este gasto fijo?\n\n✅ El histórico se conserva\n✅ Puedes reactivarlo después')) return;
    try {
      await api.delete(`/fixed-expenses/${expenseId}`);
      toast.success('Gasto fijo desactivado');
      view === 'checklist' ? loadChecklist() : loadAllExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error desactivando gasto fijo');
    }
  };

  const groupByCategory = (list) => {
    const map = {};
    list.forEach(e => {
      const cat = e.category || 'Otros';
      if (!map[cat]) map[cat] = [];
      map[cat].push(e);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  };

  // ── Checklist view ──
  const renderChecklist = () => {
    const paidList   = checklist.filter(e => e.isPaidThisMonth);
    const unpaidList = checklist.filter(e => !e.isPaidThisMonth);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigateMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900">{getMonthLabel(currentMonth)}</h2>
            {currentMonth !== getCurrentMonth() && (
              <button onClick={() => setCurrentMonth(getCurrentMonth())}
                className="text-xs text-orange-600 hover:text-orange-700 mt-1">
                Volver al mes actual
              </button>
            )}
          </div>
          <button onClick={() => navigateMonth(1)} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ChevronRightIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {checklistSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{checklistSummary.total}</p>
              <p className="text-xs text-gray-500 mt-1">Total gastos</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{checklistSummary.paid}</p>
              <p className="text-xs text-green-600 mt-1">Pagados</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{checklistSummary.unpaid}</p>
              <p className="text-xs text-red-600 mt-1">Pendientes</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
              <p className="text-lg font-bold text-orange-700">{formatCurrency(checklistSummary.pendingAmount)}</p>
              <p className="text-xs text-orange-600 mt-1">Monto pendiente</p>
            </div>
          </div>
        )}

        {loadingChecklist ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
          </div>
        ) : checklist.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No hay gastos fijos activos</p>
            <button onClick={openCreateModal}
              className="mt-4 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 text-sm">
              Crear uno nuevo
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {unpaidList.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-3">
                  ⏳ Pendientes de pago ({unpaidList.length})
                </h3>
                <div className="space-y-2">
                  {unpaidList.map(expense => (
                    <ChecklistRow
                      key={expense.idFixedExpense}
                      expense={expense}
                      onPay={() => openPayModal(expense)}
                      onDetail={() => openDetailModal(expense)}
                      onEdit={() => openEditModal(expense)}
                    />
                  ))}
                </div>
              </div>
            )}
            {paidList.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-3">
                  ✅ Pagados este mes ({paidList.length})
                </h3>
                <div className="space-y-2">
                  {paidList.map(expense => (
                    <ChecklistRow
                      key={expense.idFixedExpense}
                      expense={expense}
                      onPay={() => openPayModal(expense)}
                      onDetail={() => openDetailModal(expense)}
                      onEdit={() => openEditModal(expense)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── All expenses view ──
  const renderAllExpenses = () => {
    const list   = showHistorical ? inactiveExpenses : expenses;
    const groups = groupByCategory(list);

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <button onClick={() => setShowHistorical(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              !showHistorical ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}>
            Activos ({expenses.length})
          </button>
          <button onClick={() => setShowHistorical(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              showHistorical ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}>
            Histórico ({inactiveExpenses.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">{showHistorical ? 'No hay gastos históricos' : 'No hay gastos fijos activos'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Desktop table */}
            <table className="w-full divide-y divide-gray-200 hidden md:table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto ref.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frecuencia</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Próx. vto.</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {groups.map(([cat, catExpenses]) => (
                  <React.Fragment key={cat}>
                    <tr className="bg-gray-100">
                      <td colSpan={7} className="px-4 py-2 text-xs font-bold text-gray-700 uppercase">{cat}</td>
                    </tr>
                    {catExpenses.map(expense => (
                      <tr key={expense.idFixedExpense} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {expense.name}
                          {expense.variableAmount && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">variable</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{expense.category}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(expense.totalAmount)}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            expense.paymentStatus === 'paid' || expense.paymentStatus === 'paid_via_invoice'
                              ? 'bg-green-100 text-green-800'
                              : expense.paymentStatus === 'paid_via_credit_card'
                                ? 'bg-blue-100 text-blue-800'
                                : expense.paymentStatus === 'partial'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                          }`}>
                            {expense.paymentStatus === 'paid' ? '✅ Pagado'
                              : expense.paymentStatus === 'paid_via_credit_card' ? '💳 Tarjeta'
                              : expense.paymentStatus === 'paid_via_invoice'    ? '✅ Invoice'
                              : expense.paymentStatus === 'partial'             ? '⚠️ Parcial'
                              : '❌ Pendiente'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {FIXED_EXPENSE_FREQUENCIES.find(f => f.value === expense.frequency)?.label || expense.frequency}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(expense.nextDueDate)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => openDetailModal(expense)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1">
                              <ChevronRightIcon className="h-3 w-3" /> Ver
                            </button>
                            <button onClick={() => openEditModal(expense)}
                              className="text-amber-600 hover:text-amber-800 text-xs font-medium flex items-center gap-1">
                              <PencilIcon className="h-3 w-3" /> Editar
                            </button>
                            <button onClick={() => handleDelete(expense.idFixedExpense)}
                              className="text-red-600 hover:text-red-800 text-xs font-medium flex items-center gap-1">
                              <TrashIcon className="h-3 w-3" /> Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {groups.map(([cat, catExpenses]) => (
                <div key={cat}>
                  <div className="px-4 py-2 bg-gray-100">
                    <span className="text-xs font-bold text-gray-700 uppercase">{cat}</span>
                  </div>
                  {catExpenses.map(expense => (
                    <div key={expense.idFixedExpense} className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-sm font-semibold text-gray-900">{expense.name}</span>
                          {expense.variableAmount && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">variable</span>
                          )}
                        </div>
                        <span className="text-sm font-bold">{formatCurrency(expense.totalAmount)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openDetailModal(expense)}
                          className="flex-1 py-1.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">Ver</button>
                        <button onClick={() => openEditModal(expense)}
                          className="flex-1 py-1.5 bg-amber-50 text-amber-600 rounded text-xs font-medium">Editar</button>
                        <button onClick={() => handleDelete(expense.idFixedExpense)}
                          className="flex-1 py-1.5 bg-red-50 text-red-600 rounded text-xs font-medium">Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────
  // Render principal
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gastos Fijos</h1>
          <p className="text-gray-500 text-sm mt-1">Control mensual de gastos recurrentes</p>
        </div>
        <button onClick={openCreateModal}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm md:text-base">
          <PlusIcon className="h-4 w-4 md:h-5 md:w-5" />
          <span className="hidden sm:inline">Nuevo Gasto</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* View tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button onClick={() => setView('checklist')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
            view === 'checklist' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          📋 Este Mes
        </button>
        <button onClick={() => setView('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
            view === 'all' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          📁 Todos los Gastos
        </button>
      </div>

      {view === 'checklist' ? renderChecklist() : renderAllExpenses()}

      {/* ── Pay modal ── */}
      {showPayModal && payingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-5 border-b flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Registrar pago</h2>
                <p className="text-sm text-gray-600 mt-0.5">{payingExpense.name}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handlePay} className="p-5 space-y-4">
              {payingExpense.variableAmount && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  Monto de referencia: <span className="font-bold">{formatCurrency(payingExpense.totalAmount)}</span>
                  <br /><span className="text-xs text-blue-600">Podés ajustar el monto real abajo.</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto a pagar <span className="text-red-500">*</span>
                </label>
                <input type="number" name="amount" value={payForm.amount} onChange={handlePayFormChange}
                  step="0.01" required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de pago <span className="text-red-500">*</span>
                </label>
                <input type="date" name="paymentDate" value={payForm.paymentDate} onChange={handlePayFormChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de pago <span className="text-red-500">*</span>
                </label>
                <select name="paymentMethod" value={payForm.paymentMethod} onChange={handlePayFormChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                  <option value="">Seleccionar...</option>
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (Opcional)</label>
                <input type="text" name="notes" value={payForm.notes} onChange={handlePayFormChange}
                  placeholder="Opcional..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comprobante (Opcional)
                </label>
                <input type="file" name="receipt" onChange={handlePayFormChange}
                  accept="image/*,application/pdf"
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer" />
                {payForm.receiptFile && (
                  <p className="text-xs text-green-600 mt-1">📎 {payForm.receiptFile.name}</p>
                )}
              </div>
              <div className="flex gap-3 pt-2 border-t">
                <button type="button" onClick={() => setShowPayModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={payLoading}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
                  {payLoading ? 'Registrando...' : 'Confirmar pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail modal ── */}
      {showDetailModal && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-5 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{selectedExpense.name}</h2>
                <p className="text-orange-100 text-sm">{selectedExpense.category}</p>
              </div>
              <button onClick={closeDetailModal} className="text-white hover:text-orange-100">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            {loadingDetails ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
              </div>
            ) : (
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-600 font-medium">
                      {selectedExpense.variableAmount ? 'Monto de referencia' : 'Monto Total'}
                    </p>
                    <p className="text-xl font-bold text-blue-900">{formatCurrency(selectedExpense.totalAmount)}</p>
                    {selectedExpense.variableAmount && <p className="text-xs text-blue-500 mt-1">Monto variable</p>}
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <p className="text-xs text-purple-600 font-medium">Próx. Vencimiento</p>
                    <p className="text-lg font-bold text-purple-900">{formatDate(selectedExpense.nextDueDate)}</p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h3 className="text-base font-bold text-gray-900 mb-3">
                    📜 Historial de Pagos ({paymentHistory.length})
                  </h3>
                  {paymentHistory.length === 0 ? (
                    <p className="text-gray-500 text-center py-6 text-sm">No hay pagos registrados</p>
                  ) : (
                    <div className="space-y-2">
                      {paymentHistory.map((payment, idx) => (
                        <PaymentHistoryRow key={payment.idPayment || idx} payment={payment} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t pt-4">
                  <button onClick={closeDetailModal}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300">
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-5 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Crear Gasto Fijo</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <ExpenseForm
              formData={formData}
              onChange={handleFormChange}
              onSubmit={handleCreate}
              onCancel={() => setShowCreateModal(false)}
              submitLabel="Crear Gasto"
              staffList={staffList}
            />
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {showEditModal && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-5 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Editar Gasto Fijo</h2>
              <button onClick={() => { setShowEditModal(false); setSelectedExpense(null); }}
                className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <ExpenseForm
              formData={formData}
              onChange={handleFormChange}
              onSubmit={handleUpdate}
              onCancel={() => { setShowEditModal(false); setSelectedExpense(null); }}
              submitLabel="Guardar Cambios"
              staffList={staffList}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedExpensesManager;
