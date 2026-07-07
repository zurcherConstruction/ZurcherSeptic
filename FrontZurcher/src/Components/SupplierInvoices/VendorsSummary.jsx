import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  FaChevronDown, 
  FaChevronUp, 
  FaDollarSign, 
  FaFileInvoiceDollar,
  FaExclamationCircle,
  FaCreditCard
} from 'react-icons/fa';
import LoadingSpinner from '../LoadingSpinner';
import PayInvoiceModal from './PayInvoiceModal';

const VendorsSummary = ({ onRefreshParent }) => {
  const token = useSelector((state) => state.auth.token);
  const [loading, setLoading] = useState(true);
  const [vendorsData, setVendorsData] = useState([]);
  const [expandedVendor, setExpandedVendor] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [totalPending, setTotalPending] = useState(0);
  const [totalInvoices, setTotalInvoices] = useState(0);

  useEffect(() => {
    fetchVendorsSummary();
  }, []);

  // 🆕 Detectar si se debe abrir un invoice específico desde sessionStorage
  useEffect(() => {
    const openInvoiceId = sessionStorage.getItem('openInvoiceId');
    if (openInvoiceId && vendorsData.length > 0) {
      // Buscar el invoice en vendorsData
      let foundInvoice = null;
      for (const vendor of vendorsData) {
        foundInvoice = vendor.invoices?.find(inv => inv.idSupplierInvoice === openInvoiceId);
        if (foundInvoice) break;
      }
      
      if (foundInvoice) {
        handlePayInvoice(foundInvoice);
        sessionStorage.removeItem('openInvoiceId');
      }
    }
  }, [vendorsData]);

  const fetchVendorsSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/supplier-invoices/vendors/summary`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Error al cargar resumen de proveedores');

      const data = await response.json();
      setVendorsData(data.vendors || []);
      setTotalPending(data.totalPendingAmount || 0);
      setTotalInvoices(data.totalInvoicesPending || 0);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar el resumen de proveedores');
    } finally {
      setLoading(false);
    }
  };

  const toggleVendor = (vendor) => {
    setExpandedVendor(expandedVendor === vendor ? null : vendor);
  };

  const handlePayInvoice = async (invoiceSummary) => {
    try {
      // Buscar el invoice completo para obtener el invoicePdfPath
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/supplier-invoices/${invoiceSummary.idSupplierInvoice}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Error al cargar invoice');

      const data = await response.json();
      console.log('📄 Invoice completo recibido:', data.invoice); // Debug
      console.log('📎 invoicePdfPath:', data.invoice?.invoicePdfPath); // Debug
      setSelectedInvoice(data.invoice); // El backend devuelve { invoice: {...} }
      setShowPayModal(true);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar el invoice completo');
    }
  };

  const handlePaymentSuccess = () => {
    setShowPayModal(false);
    setSelectedInvoice(null);
    // Pequeño delay para asegurar que la DB se actualice
    setTimeout(() => {
      fetchVendorsSummary();
      // 🆕 Notificar al padre (SupplierInvoiceManager) para que actualice la lista de invoices
      if (onRefreshParent) {
        onRefreshParent();
      }
    }, 300);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-blue-100 text-blue-800',
      overdue: 'bg-red-100 text-red-800',
    };
    const texts = {
      pending: 'Pendiente',
      partial: 'Parcial',
      overdue: 'Vencido',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {texts[status] || status}
      </span>
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Lista de Proveedores */}
      <div className="space-y-4">
        {vendorsData.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">✅</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              ¡Todo al día!
            </h3>
            <p className="text-gray-500">
              No hay cuentas por pagar pendientes
            </p>
          </div>
        ) : (
          vendorsData.map((vendor) => (
            <div key={vendor.vendor} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Header del Proveedor */}
              <div
                onClick={() => toggleVendor(vendor.vendor)}
                className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="bg-cyan-100 p-3 rounded-full">
                    <FaFileInvoiceDollar className="text-cyan-600 text-xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{vendor.vendor}</h3>
                    <p className="text-sm text-gray-500">
                      {vendor.invoiceCount} invoice{vendor.invoiceCount !== 1 ? 's' : ''} pendiente{vendor.invoiceCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Deuda Total</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(vendor.totalPending)}
                    </p>
                  </div>
                  
                  <button className="text-gray-400 hover:text-gray-600 transition-colors">
                    {expandedVendor === vendor.vendor ? (
                      <FaChevronUp className="text-xl" />
                    ) : (
                      <FaChevronDown className="text-xl" />
                    )}
                  </button>
                </div>
              </div>

              {/* Invoices del Proveedor (Expandible) */}
              {expandedVendor === vendor.vendor && (
                <div className="border-t border-gray-200 bg-gray-50">
                  <div className="p-6 space-y-3">
                    {vendor.invoices.map((invoice) => (
                      <div
                        key={invoice.idSupplierInvoice}
                        className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2 flex-wrap gap-y-1">
                              <span className="font-semibold text-gray-800">
                                Invoice #{invoice.invoiceNumber}
                              </span>
                              {getStatusBadge(invoice.paymentStatus)}
                              {invoice.verified && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Verificado
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Fecha Emisión</p>
                                <p className="font-medium">{formatDate(invoice.issueDate)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Vencimiento</p>
                                <p className="font-medium">{formatDate(invoice.dueDate)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Monto Total</p>
                                <p className="font-medium">{formatCurrency(invoice.totalAmount)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Pendiente</p>
                                <p className="font-bold text-red-600">
                                  {formatCurrency(invoice.pendingAmount)}
                                </p>
                              </div>
                            </div>

                            {invoice.notes && (
                              <div className="mt-2 text-sm text-gray-600">
                                <p className="italic">"{invoice.notes}"</p>
                              </div>
                            )}
                          </div>

                          <div className="ml-4">
                            <button
                              onClick={() => handlePayInvoice(invoice)}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                            >
                              <FaCreditCard />
                              <span>Pagar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

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

export default VendorsSummary;
