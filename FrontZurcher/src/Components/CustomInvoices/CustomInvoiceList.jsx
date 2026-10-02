import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../utils/axios';
import { toast } from 'react-toastify';
import { parseDateOnly } from '../../utils/dateHelpers';

const TYPE_LABELS = { INV: 'Invoice', QUO: 'Quote', PRO: 'Proforma', CRN: 'Credit Note', REC: 'Receipt', PMP: 'Pump-Out' };
const STATUS_COLORS = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  viewed:   'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
  signed:   'bg-emerald-100 text-emerald-700',
  paid:     'bg-teal-100 text-teal-700',
  void:     'bg-red-100 text-red-600',
};
const TYPE_BADGE = {
  INV: 'bg-blue-50 text-blue-700 border border-blue-200',
  QUO: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  PRO: 'bg-purple-50 text-purple-700 border border-purple-200',
  CRN: 'bg-red-50 text-red-700 border border-red-200',
  REC: 'bg-green-50 text-green-700 border border-green-200',
  PMP: 'bg-teal-50 text-teal-700 border border-teal-200',
};
// 🚽 Métodos de pago permitidos para Pump-Out (deben coincidir con el backend/mobile)
const PUMP_OUT_PAYMENT_METHODS = ['Efectivo', 'Zelle', 'Chase Bank', 'Cheque'];

export default function CustomInvoiceList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const view = searchParams.get('view') === 'pumpout' ? 'pumpout' : 'all';
  const filters = {
    invoiceType: view === 'pumpout' ? 'PMP' : (searchParams.get('type') || ''),
    status:      searchParams.get('status') || '',
    year:        searchParams.get('year')   || '',
    search:      searchInput,
  };
  const setView = (nextView) => {
    setSearchParams(p => {
      if (nextView === 'pumpout') { p.set('view', 'pumpout'); p.delete('type'); }
      else { p.delete('view'); }
      return p;
    });
  };
  const setFilters = (updater) => {
    const next = typeof updater === 'function' ? updater(filters) : updater;
    setSearchParams(p => {
      if (next.invoiceType) p.set('type',   next.invoiceType); else p.delete('type');
      if (next.status)      p.set('status', next.status);      else p.delete('status');
      if (next.year)        p.set('year',   next.year);        else p.delete('year');
      return p;
    }, { replace: next.search !== filters.search });
    if (next.search !== filters.search) setSearchInput(next.search);
  };
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [payingInvoice, setPayingInvoice] = useState(null); // invoice object being marked as paid
  const [payForm, setPayForm] = useState({ paidAmount: '', paymentMethod: '', paymentDetails: '' });
  const [payingSubmitting, setPayingSubmitting] = useState(false);

  const fetchYears = useCallback(async () => {
    try {
      const { data } = await api.get('/custom-invoices/available-years');
      setYears(data.data || []);
    } catch {}
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.invoiceType) params.set('invoiceType', filters.invoiceType);
      if (filters.status) params.set('status', filters.status);
      if (filters.year) params.set('year', filters.year);
      if (filters.search) params.set('search', filters.search);
      const { data } = await api.get(`/custom-invoices?${params}`);
      setInvoices(data.data || []);
    } catch (err) {
      toast.error('Error cargando invoices');
    } finally {
      setLoading(false);
    }
  }, [filters.invoiceType, filters.status, filters.year, filters.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchYears(); }, [fetchYears]);
  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleDelete = async (id, number) => {
    if (!window.confirm(`¿Eliminar ${number}? Esta acción no se puede deshacer.`)) return;
    setDeleting(id);
    try {
      await api.delete(`/custom-invoices/${id}`);
      toast.success(`${number} eliminado`);
      fetchInvoices();
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = async (id, number) => {
    try {
      const response = await api.get(`/custom-invoices/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${number}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error descargando PDF');
    }
  };

  const handleSend = async (id, number) => {
    if (!window.confirm(`¿Enviar ${number} al cliente por email?`)) return;
    try {
      await api.post(`/custom-invoices/${id}/send`);
      toast.success('Enviado exitosamente');
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al enviar');
    }
  };

  const openPayModal = (inv) => {
    setPayingInvoice(inv);
    setPayForm({
      paidAmount: inv.total,
      // Prefiere el método que ya cargó el empleado en la app (Pump-Out), si existe
      paymentMethod: PUMP_OUT_PAYMENT_METHODS.includes(inv.paymentMethod) ? inv.paymentMethod : '',
      paymentDetails: '',
    });
  };

  const closePayModal = () => {
    setPayingInvoice(null);
    setPayForm({ paidAmount: '', paymentMethod: '', paymentDetails: '' });
  };

  const handleConfirmPayment = async () => {
    if (!payForm.paymentMethod) {
      toast.error('Seleccioná un método de pago');
      return;
    }
    setPayingSubmitting(true);
    try {
      await api.post(`/custom-invoices/${payingInvoice.id}/mark-paid`, {
        paidAmount: payForm.paidAmount,
        paymentMethod: payForm.paymentMethod,
        paymentDetails: payForm.paymentDetails || undefined,
      });
      toast.success(`${payingInvoice.invoiceNumber} marcado como pagado`);
      closePayModal();
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al confirmar el pago');
    } finally {
      setPayingSubmitting(false);
    }
  };

  // 🚽 Resumen mensual de desagotes (solo relevante en la vista Pump-Out)
  const monthlySummary = useMemo(() => {
    if (view !== 'pumpout') return [];
    const map = {};
    invoices.forEach(inv => {
      const monthKey = (inv.issueDate || '').slice(0, 7); // YYYY-MM
      if (!monthKey) return;
      if (!map[monthKey]) map[monthKey] = { month: monthKey, count: 0, total: 0, paid: 0, pending: 0 };
      map[monthKey].count += 1;
      map[monthKey].total += parseFloat(inv.total || 0);
      if (inv.status === 'paid') map[monthKey].paid += parseFloat(inv.total || 0);
      else map[monthKey].pending += parseFloat(inv.total || 0);
    });
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
  }, [invoices, view]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Custom Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Facturas, cotizaciones y documentos personalizados</p>
        </div>
        <button
          onClick={() => navigate('/custom-invoices/new')}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition"
        >
          + Nuevo Documento
        </button>
      </div>

      {/* Tabs: Todos / Desagotadora */}
      <div className="flex gap-2 mb-6 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
        <button
          onClick={() => setView('all')}
          className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
            view === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Todos los Documentos
        </button>
        <button
          onClick={() => setView('pumpout')}
          className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
            view === 'pumpout' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          🚽 Desagotadora
        </button>
      </div>

      {/* 🚽 Resumen mensual (solo en vista Desagotadora) */}
      {view === 'pumpout' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Resumen Mensual de Desagotes</p>
          {monthlySummary.length === 0 ? (
            <p className="text-sm text-gray-400">No hay desagotes registrados todavía.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {monthlySummary.map(m => (
                <div key={m.month} className="border border-gray-100 rounded-lg p-3 min-w-0">
                  <p className="text-xs font-semibold text-gray-500">{m.month}</p>
                  <p className="text-lg font-bold text-gray-800 truncate">${m.total.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{m.count} desagote{m.count !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-teal-600 truncate">Pagado: ${m.paid.toFixed(2)}</p>
                  {m.pending > 0 && <p className="text-xs text-amber-600 truncate">Pendiente: ${m.pending.toFixed(2)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${view === 'pumpout' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          <input
            type="text"
            placeholder="Buscar cliente, número..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
          />
          {view === 'all' && (
            <select
              value={filters.invoiceType}
              onChange={e => setFilters(f => ({ ...f, invoiceType: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">Todos los tipos</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          )}
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
          >
            <option value="">Todos los estados</option>
            {Object.keys(STATUS_COLORS).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select
            value={filters.year}
            onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
          >
            <option value="">Todos los años</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No hay documentos todavía</p>
            <button
              onClick={() => navigate('/custom-invoices/new')}
              className="mt-3 text-blue-600 hover:underline text-sm"
            >
              Crear el primero
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Número</th>
                  {view === 'all' && <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>}
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Fecha</th>
                  {view === 'pumpout' && (
                    <>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Galones</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Método de Pago</th>
                    </>
                  )}
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-gray-800">{inv.invoiceNumber}</span>
                      {inv.title && (
                        <p className="text-xs text-gray-400 truncate max-w-[150px]">{inv.title}</p>
                      )}
                    </td>
                    {view === 'all' && (
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[inv.invoiceType]}`}>
                          {inv.invoiceType}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{inv.clientName}</p>
                      {inv.clientEmail ? (
                        <p className="text-xs text-gray-400">{inv.clientEmail}</p>
                      ) : inv.clientAddress ? (
                        <p className="text-xs text-gray-400 truncate max-w-[200px]">{inv.clientAddress}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {parseDateOnly(inv.issueDate)?.toLocaleDateString('en-US') || '-'}
                    </td>
                    {view === 'pumpout' && (
                      <>
                        <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">
                          {inv.tankGallons ? `${inv.tankGallons} gal` : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                          {inv.paymentMethod || '—'}
                          {inv.paymentMethod === 'Efectivo' && (
                            <p className="text-[10px] text-amber-600 font-medium">No ingresa a caja</p>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">
                      ${parseFloat(inv.total || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status] || ''}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {view === 'pumpout' && !['paid', 'void'].includes(inv.status) && (
                          <button
                            onClick={() => openPayModal(inv)}
                            className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded transition"
                            title="Confirmar pago"
                          >
                            💰
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/custom-invoices/${inv.id}`)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Ver / Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDownload(inv.id, inv.invoiceNumber)}
                          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition"
                          title="Descargar PDF"
                        >
                          📄
                        </button>
                        {inv.clientEmail && inv.status === 'draft' && (
                          <button
                            onClick={() => handleSend(inv.id, inv.invoiceNumber)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                            title="Enviar al cliente"
                          >
                            📤
                          </button>
                        )}
                        {!['signed', 'paid', 'void'].includes(inv.status) && (
                          <button
                            onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                            disabled={deleting === inv.id}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition disabled:opacity-40"
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Confirmar pago (Desagotadora) */}
      {payingInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Confirmar Pago</h2>
            <p className="text-sm text-gray-500 mb-4">
              {payingInvoice.invoiceNumber} · {payingInvoice.clientName}
            </p>

            <label className="block text-xs font-semibold text-gray-500 mb-1">Monto Pagado</label>
            <input
              type="number"
              step="0.01"
              value={payForm.paidAmount}
              onChange={e => setPayForm(f => ({ ...f, paidAmount: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
            />

            <label className="block text-xs font-semibold text-gray-500 mb-1">Método de Pago *</label>
            <select
              value={payForm.paymentMethod}
              onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
            >
              <option value="">Seleccionar...</option>
              {PUMP_OUT_PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {payingInvoice.paymentMethod && (
              <p className="text-xs text-gray-400 -mt-2 mb-3">
                El empleado cargó "{payingInvoice.paymentMethod}" al crear el invoice desde la app.
              </p>
            )}

            <label className="block text-xs font-semibold text-gray-500 mb-1">Detalles (opcional)</label>
            <input
              type="text"
              placeholder="Ej: Cheque #1234, últimos 4 dígitos..."
              value={payForm.paymentDetails}
              onChange={e => setPayForm(f => ({ ...f, paymentDetails: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-5"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={closePayModal}
                disabled={payingSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={payingSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white transition disabled:opacity-40"
              >
                {payingSubmitting ? 'Confirmando...' : 'Confirmar Pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

