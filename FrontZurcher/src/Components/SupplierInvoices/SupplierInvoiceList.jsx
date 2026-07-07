import React, { useState, useMemo, useEffect } from 'react';
import { FaEye, FaEdit, FaTrash, FaClock, FaCheckCircle, FaExclamationTriangle, FaChevronDown, FaChevronUp, FaCreditCard } from 'react-icons/fa';
import { useSelector } from 'react-redux';
import LoadingSpinner from '../LoadingSpinner';
import PayInvoiceModal from './PayInvoiceModal';

const SupplierInvoiceList = ({ invoices, loading, onView, onEdit, onRefresh }) => {
  // ========== HOOKS (SIEMPRE AL INICIO) ==========
  const token = useSelector((state) => state.auth.token);
  
  // 🆕 Restaurar filtro desde sessionStorage
  const [paymentFilter, setPaymentFilter] = useState(() => {
    return sessionStorage.getItem('supplierInvoice_paymentFilter') || 'all';
  });
  
  const [groupByVendor, setGroupByVendor] = useState(true);
  
  // 🆕 Restaurar vendors expandidos desde sessionStorage
  const [expandedVendors, setExpandedVendors] = useState(() => {
    const saved = sessionStorage.getItem('supplierInvoice_expandedVendors');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);

  // 🆕 Guardar filtro cuando cambie
  useEffect(() => {
    sessionStorage.setItem('supplierInvoice_paymentFilter', paymentFilter);
  }, [paymentFilter]);

  // 🆕 Guardar vendors expandidos cuando cambien
  useEffect(() => {
    sessionStorage.setItem('supplierInvoice_expandedVendors', JSON.stringify(expandedVendors));
  }, [expandedVendors]);

  // Asegurar que invoices sea un array
  const invoicesArray = Array.isArray(invoices) ? invoices : [];

  // Filtrar por estado de pago
  const filteredInvoices = useMemo(() => {
    if (paymentFilter === 'all') return invoicesArray;
    if (paymentFilter === 'pending') {
      return invoicesArray.filter(inv => ['pending', 'partial', 'overdue'].includes(inv.paymentStatus));
    }
    if (paymentFilter === 'paid') {
      return invoicesArray.filter(inv => inv.paymentStatus === 'paid');
    }
    return invoicesArray;
  }, [invoicesArray, paymentFilter]);

  // Agrupar por proveedor
  const groupedByVendor = useMemo(() => {
    if (!groupByVendor) return null;

    const grouped = {};
    filteredInvoices.forEach(invoice => {
      const vendor = invoice.vendor || 'Sin proveedor';
      if (!grouped[vendor]) {
        grouped[vendor] = {
          invoices: [],
          totalAmount: 0,
          totalPaid: 0,
          totalPending: 0,
          countPending: 0,
          countPaid: 0
        };
      }
      grouped[vendor].invoices.push(invoice);
      grouped[vendor].totalAmount += parseFloat(invoice.totalAmount || 0);
      grouped[vendor].totalPaid += parseFloat(invoice.paidAmount || 0);
      
      const pending = parseFloat(invoice.totalAmount || 0) - parseFloat(invoice.paidAmount || 0);
      grouped[vendor].totalPending += pending;
      
      if (invoice.paymentStatus === 'paid') {
        grouped[vendor].countPaid++;
      } else {
        grouped[vendor].countPending++;
      }
    });

    // Convertir a array y ordenar por nombre de vendor
    return Object.entries(grouped)
      .map(([vendor, data]) => ({ vendor, ...data }))
      .sort((a, b) => a.vendor.localeCompare(b.vendor));
  }, [filteredInvoices, groupByVendor]);

  const toggleVendor = (vendor) => {
    setExpandedVendors(prev => ({
      ...prev,
      [vendor]: !prev[vendor]
    }));
  };

  const handlePayInvoice = async (invoice) => {
    try {
      // Buscar el invoice completo para obtener el invoicePdfPath
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/supplier-invoices/${invoice.idSupplierInvoice}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Error al cargar invoice');

      const data = await response.json();
      setSelectedInvoice(data.invoice);
      setShowPayModal(true);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar el invoice para pago');
    }
  };

  const handlePaymentSuccess = () => {
    setShowPayModal(false);
    setSelectedInvoice(null);
    // Recargar la lista usando la función del padre con delay para asegurar commit
    if (onRefresh) {
      setTimeout(() => {
        onRefresh();
      }, 300);
    } else {
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  };

  // ========== RENDERS CONDICIONALES (DESPUÉS DE LOS HOOKS) ==========
  if (loading) {
    return <LoadingSpinner />;
  }

  if (invoicesArray.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <div className="text-gray-400 text-6xl mb-4">📄</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          No hay invoices registrados
        </h3>
        <p className="text-gray-500">
          Comienza creando un nuevo invoice de proveedor
        </p>
      </div>
    );
  }

  const getStatusIcon = (status) => {
    const icons = {
      pending: <FaClock className="text-yellow-500" />,
      partial: <FaClock className="text-blue-500" />,
      paid: <FaCheckCircle className="text-green-500" />,
      overdue: <FaExclamationTriangle className="text-red-500" />,
      cancelled: <FaTrash className="text-gray-500" />,
    };
    return icons[status] || <FaClock className="text-gray-500" />;
  };

  const getStatusText = (status) => {
    const texts = {
      pending: 'Pendiente',
      partial: 'Pago Parcial',
      paid: 'Pagado',
      overdue: 'Vencido',
      cancelled: 'Cancelado',
    };
    return texts[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}-${day}-${year}`;
  };

  // Renderizar fila de invoice
  const renderInvoiceRow = (invoice) => (
    <tr key={invoice.idSupplierInvoice} className="hover:bg-gray-50 border-b border-gray-100">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          {getStatusIcon(invoice.paymentStatus)}
          <span className="ml-2 text-sm font-medium text-gray-900">
            {invoice.invoiceNumber}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{invoice.vendor || '-'}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(invoice.issueDate)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(invoice.dueDate)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
        {formatCurrency(invoice.totalAmount)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
        {formatCurrency(invoice.paidAmount)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <div className="flex flex-col items-center gap-1">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.paymentStatus)}`}>
            {getStatusText(invoice.paymentStatus)}
          </span>
          {invoice.verified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Verificado
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={() => handlePayInvoice(invoice)}
            className="text-green-600 hover:text-green-900 transition-colors"
            title="Pagar"
            disabled={invoice.paymentStatus === 'paid'}
          >
            <FaCreditCard className="text-lg" />
          </button>
          <button
            onClick={() => onView(invoice)}
            className="text-blue-600 hover:text-blue-900 transition-colors"
            title="Ver detalles"
          >
            <FaEye className="text-lg" />
          </button>
          <button
            onClick={() => onEdit(invoice)}
            className="text-yellow-600 hover:text-yellow-900 transition-colors"
            title="Editar"
          >
            <FaEdit className="text-lg" />
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      {/* Controles de filtro */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Estado
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => setPaymentFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  paymentFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos ({invoicesArray.length})
              </button>
              <button
                onClick={() => setPaymentFilter('pending')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  paymentFilter === 'pending'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pendientes ({invoicesArray.filter(i => ['pending', 'partial', 'overdue'].includes(i.paymentStatus)).length})
              </button>
              <button
                onClick={() => setPaymentFilter('paid')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  paymentFilter === 'paid'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pagados ({invoicesArray.filter(i => i.paymentStatus === 'paid').length})
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vista
            </label>
            <button
              onClick={() => setGroupByVendor(!groupByVendor)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                groupByVendor
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {groupByVendor ? '✅ Agrupado por Proveedor' : '📋 Vista de Lista'}
            </button>
          </div>
        </div>
      </div>

      {/* Vista Agrupada por Proveedor */}
      {groupByVendor && groupedByVendor ? (
        <div className="space-y-4">
          {groupedByVendor.map(({ vendor, invoices: vendorInvoices, totalAmount, totalPaid, totalPending, countPending, countPaid }) => (
            <div key={vendor} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Header del Proveedor */}
              <div
                className="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white p-4 cursor-pointer hover:from-cyan-700 hover:to-cyan-800 transition-all"
                onClick={() => toggleVendor(vendor)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {expandedVendors[vendor] ? <FaChevronUp /> : <FaChevronDown />}
                    <div>
                      <h3 className="text-xl font-bold">{vendor}</h3>
                      <p className="text-sm text-purple-100">
                        {countPending} pendiente{countPending !== 1 ? 's' : ''} • {countPaid} pagado{countPaid !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-purple-100">Total</div>
                    <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
                    <div className="text-xs text-purple-200">
                      Pagado: {formatCurrency(totalPaid)} • Pendiente: {formatCurrency(totalPending)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoices del Proveedor */}
              {expandedVendors[vendor] && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Número Invoice
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vencimiento
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Monto Total
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pagado
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {vendorInvoices.map(invoice => (
                        <tr key={invoice.idSupplierInvoice} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {getStatusIcon(invoice.paymentStatus)}
                              <span className="ml-2 text-sm font-medium text-gray-900">
                                {invoice.invoiceNumber}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(invoice.issueDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(invoice.dueDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                            {formatCurrency(invoice.totalAmount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                            {formatCurrency(invoice.paidAmount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.paymentStatus)}`}>
                              {getStatusText(invoice.paymentStatus)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => onView(invoice)}
                                className="text-blue-600 hover:text-blue-900 transition-colors"
                                title="Ver detalles"
                              >
                                <FaEye className="text-lg" />
                              </button>
                              <button
                                onClick={() => onEdit(invoice)}
                                className="text-green-600 hover:text-green-900 transition-colors"
                                title="Editar"
                              >
                                <FaEdit className="text-lg" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Vista de Lista Normal */
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Número Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proveedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vencimiento
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pagado
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map(renderInvoiceRow)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No hay resultados */}
      {filteredInvoices.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No se encontraron invoices
          </h3>
          <p className="text-gray-500">
            Intenta cambiar los filtros o crear un nuevo invoice
          </p>
        </div>
      )}

      {/* Modal de Pago */}
      {showPayModal && selectedInvoice && (
        <PayInvoiceModal
          invoice={selectedInvoice}
          onClose={() => setShowPayModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default SupplierInvoiceList;
