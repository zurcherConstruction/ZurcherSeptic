import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supplierInvoiceActions } from '../../Redux/Actions/supplierInvoiceActions';
import {
  fetchSupplierInvoicesRequest,
  fetchSupplierInvoicesSuccess,
  fetchSupplierInvoicesFailure,
  setFilters,
  clearFilters,
  setCurrentInvoice,
  clearCurrentInvoice,
} from '../../Redux/Reducer/supplierInvoiceReducer';
import SimpleInvoiceForm from './SimpleInvoiceForm'; // 🆕 NUEVO formulario simplificado
import SupplierInvoiceList from './SupplierInvoiceList';
import SupplierInvoiceDetail from './SupplierInvoiceDetail';
import AccountsPayableSummary from './AccountsPayableSummary';
import VendorsSummary from './VendorsSummary'; // 🆕 NUEVO
import ChaseCreditCard from './ChaseCreditCard'; // 💳 NUEVO Chase Credit Card
import AmexCreditCard from './AmexCreditCard'; // 💳 NUEVO AMEX Credit Card
import CommissionsManager from './CommissionsManager'; // 💰 NUEVO Comisiones
import { FaFileInvoiceDollar, FaPlus, FaFilter, FaTimes, FaBuilding, FaList, FaCreditCard, FaUserTie } from 'react-icons/fa'; // 💳 Agregado FaCreditCard, FaUserTie

const SupplierInvoiceManager = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { supplierInvoices, loading, error, filters } = useSelector(
    (state) => state.supplierInvoice
  );

  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const activeTab = searchParams.get('tab') || 'list';
  const setActiveTab = (v) => setSearchParams(prev => { prev.set('tab', v); return prev; });

  // 🆕 Detectar si se debe abrir un invoice específico desde la URL
  useEffect(() => {
    const openInvoiceId = searchParams.get('openInvoice');
    if (openInvoiceId) {
      // Cambiar a tab de vendors y limpiar el parámetro en un solo setSearchParams
      setSearchParams(prev => {
        prev.set('tab', 'vendors');
        prev.delete('openInvoice');
        return prev;
      });
      
      // Guardar el ID para que VendorsSummary lo use
      sessionStorage.setItem('openInvoiceId', openInvoiceId);
    }
  }, [searchParams]);

  // Cargar facturas al montar el componente
  useEffect(() => {
    loadInvoices();
  }, [filters]);

  const loadInvoices = async () => {
    dispatch(fetchSupplierInvoicesRequest());
    const response = await supplierInvoiceActions.getAll(filters);
    
    if (response.error) {
      dispatch(fetchSupplierInvoicesFailure(response.message));
      console.error('Error al cargar facturas:', response);
    } else {
      // Asegurar que response sea un array
      const invoicesArray = Array.isArray(response) ? response : [];
      
      dispatch(fetchSupplierInvoicesSuccess(invoicesArray));
    }
  };

  const handleCreateNew = () => {
    setSelectedInvoice(null);
    dispatch(clearCurrentInvoice());
    setShowForm(true);
    setShowDetail(false);
  };

  const handleEdit = async (invoice) => {
    try {
      // 🆕 Fetch del invoice completo con linkedWorks
      const response = await supplierInvoiceActions.getById(invoice.idSupplierInvoice);
      
      if (response.error) {
        console.error('Error al cargar invoice completo:', response);
        // Fallback: usar el invoice que tenemos
        setSelectedInvoice(invoice);
        dispatch(setCurrentInvoice(invoice));
      } else {
        // Usar el invoice completo del backend que incluye linkedWorks
        setSelectedInvoice(response.invoice);
        dispatch(setCurrentInvoice(response.invoice));
      }
      
      setShowForm(true);
      setShowDetail(false);
    } catch (error) {
      console.error('Error al abrir invoice para editar:', error);
      // Fallback: usar el invoice que tenemos
      setSelectedInvoice(invoice);
      dispatch(setCurrentInvoice(invoice));
      setShowForm(true);
      setShowDetail(false);
    }
  };

  const handleView = (invoice) => {
    setSelectedInvoice(invoice);
    dispatch(setCurrentInvoice(invoice));
    setShowDetail(true);
    setShowForm(false);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedInvoice(null);
    dispatch(clearCurrentInvoice());
    loadInvoices(); // Recargar lista
  };

  const handleDetailClose = () => {
    setShowDetail(false);
    setSelectedInvoice(null);
    dispatch(clearCurrentInvoice());
    
    // 🆕 Si llegamos desde otra página (ej: WorkDetail), volver atrás
    // Verificar si hay un referrer guardado en sessionStorage
    const cameFromExternal = sessionStorage.getItem('openInvoiceId');
    
    if (cameFromExternal) {
      // Limpiar el flag
      sessionStorage.removeItem('openInvoiceId');
      // Volver a la página anterior
      navigate(-1);
    }
    // 🆕 NO recargamos la lista al cerrar el detalle
    // Solo mantener el estado actual para preservar filtros y vistas expandidas
  };

  const handleFilterChange = (field, value) => {
    dispatch(setFilters({ [field]: value }));
  };

  const handleClearFilters = () => {
    dispatch(clearFilters());
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaFileInvoiceDollar className="text-3xl text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Cuentas por Pagar
                </h1>
                <p className="text-sm text-gray-600">
                  Gestión de invoices y pagos a proveedores
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <FaFilter />
                Filtros
              </button>
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FaPlus />
                Nuevo Invoice
              </button>
            </div>
          </div>
        </div>

        {/* Tabs: Lista vs Vista por Proveedores */}
        {!showForm && !showDetail && (
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('list')}
                className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === 'list'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <FaList />
                <span>Lista de Invoices</span>
              </button>
              <button
                onClick={() => setActiveTab('vendors')}
                className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === 'vendors'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <FaBuilding />
                <span>Vista por Proveedores</span>
              </button>
              <button
                onClick={() => setActiveTab('credit-card')}
                className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === 'credit-card'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <FaCreditCard />
                <span>Chase Credit Card</span>
              </button>
              <button
                onClick={() => setActiveTab('amex')}
                className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === 'amex'
                    ? 'border-b-2 border-blue-900 text-blue-900'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <FaCreditCard />
                <span>AMEX</span>
              </button>
              <button
                onClick={() => setActiveTab('commissions')}
                className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === 'commissions'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <FaUserTie />
                <span>Comisiones</span>
              </button>
            </div>
          </div>
        )}

        {/* Filtros */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado de Pago
                </label>
                <select
                  value={filters.paymentStatus}
                  onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Todos</option>
                  <option value="pending">Pendiente</option>
                  <option value="partial">Pago Parcial</option>
                  <option value="paid">Pagado</option>
                  <option value="overdue">Vencido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedor
                </label>
                <input
                  type="text"
                  value={filters.vendorName}
                  onChange={(e) => handleFilterChange('vendorName', e.target.value)}
                  placeholder="Nombre del proveedor"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Desde
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hasta
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Content */}
        {showForm ? (
          <SimpleInvoiceForm
            invoice={selectedInvoice}
            onClose={handleFormClose}
            onSuccess={loadInvoices}
          />
        ) : showDetail ? (
          <SupplierInvoiceDetail
            invoice={selectedInvoice}
            onClose={handleDetailClose}
            onEdit={handleEdit}
          />
        ) : activeTab === 'vendors' ? (
          // 🆕 NUEVA VISTA: Proveedores Agrupados
          <VendorsSummary onRefreshParent={loadInvoices} />
        ) : activeTab === 'credit-card' ? (
          // 💳 NUEVA VISTA: Chase Credit Card
          <ChaseCreditCard token={localStorage.getItem('token')} />
        ) : activeTab === 'amex' ? (
          // 💳 NUEVA VISTA: AMEX Credit Card
          <AmexCreditCard token={localStorage.getItem('token')} />
        ) : activeTab === 'commissions' ? (
          // 💰 NUEVA VISTA: Comisiones
          <CommissionsManager />
        ) : (
          // Vista original de lista
          <SupplierInvoiceList
            invoices={supplierInvoices}
            loading={loading}
            onView={handleView}
            onEdit={handleEdit}
            onRefresh={loadInvoices}
          />
        )}
      </div>
    </div>
  );
};

export default SupplierInvoiceManager;
