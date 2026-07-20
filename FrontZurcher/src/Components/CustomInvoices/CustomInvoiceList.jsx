import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { toast } from 'react-toastify';

const TYPE_LABELS = { INV: 'Invoice', QUO: 'Quote', PRO: 'Proforma', CRN: 'Credit Note', REC: 'Receipt' };
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
};

export default function CustomInvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState([]);
  const [filters, setFilters] = useState({ invoiceType: '', status: '', year: '', search: '' });
  const [deleting, setDeleting] = useState(null);

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
  }, [filters]);

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

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Facturas, cotizaciones y documentos personalizados</p>
        </div>
        <button
          onClick={() => navigate('/custom-invoices/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition"
        >
          + Nuevo Documento
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Buscar cliente, número..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={filters.invoiceType}
            onChange={e => setFilters(f => ({ ...f, invoiceType: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            {Object.keys(STATUS_COLORS).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select
            value={filters.year}
            onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Fecha</th>
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
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[inv.invoiceType]}`}>
                        {inv.invoiceType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{inv.clientName}</p>
                      {inv.clientEmail && (
                        <p className="text-xs text-gray-400">{inv.clientEmail}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {new Date(inv.issueDate).toLocaleDateString('en-US')}
                    </td>
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
    </div>
  );
}
