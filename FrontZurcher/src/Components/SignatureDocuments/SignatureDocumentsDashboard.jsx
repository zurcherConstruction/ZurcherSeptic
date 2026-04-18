import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
  FaFileSignature,
  FaPlus,
  FaFilter,
  FaDownload,
  FaEye,
  FaTrash,
  FaTimes,
  FaBan,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaLink,
  FaSearch,
  FaSync
} from 'react-icons/fa';
import {
  getSignatureDocuments,
  getSignatureDocument,
  createSignatureDocument,
  checkDocumentStatus,
  downloadSignedDocument,
  cancelSignatureDocument,
  deleteSignatureDocument,
  testSignatureConnection
} from '../../Redux/Actions/signatureDocumentActions';

/**
 * Dashboard de Documentos para Firma Electrónica
 * Soporta SignNow (desarrollo) y DocuSign (producción)
 */
const SignatureDocumentsDashboard = () => {
  const dispatch = useDispatch();

  // Estados principales
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // Filtros
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  });

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewDocumentName, setPreviewDocumentName] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);

  // Form data para crear documento
  const [formData, setFormData] = useState({
    documentName: '',
    documentType: '',
    description: '',
    signerName: '',
    signerEmail: '',
    signerPhone: '',
    linkedContactId: '',
    pdfFile: null
  });

  // Estados de operaciones
  const [creating, setCreating] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState({});

  // Cargar documentos al montar
  useEffect(() => {
    loadDocuments();
  }, [pagination.page, filters.status]);

  /**
   * Cargar documentos con filtros
   */
  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await dispatch(getSignatureDocuments({
        page: pagination.page,
        limit: pagination.limit,
        status: filters.status
      }));

      setDocuments(response.documents || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0,
        totalPages: response.pagination?.totalPages || 0
      }));
    } catch (error) {
      console.error('Error cargando documentos:', error);
      alert('Error cargando documentos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Crear y enviar documento
   */
  const handleCreateDocument = async (e) => {
    e.preventDefault();

    if (!formData.pdfFile) {
      alert('Debes seleccionar un archivo PDF');
      return;
    }

    try {
      setCreating(true);

      const data = new FormData();
      data.append('pdfFile', formData.pdfFile);
      data.append('documentName', formData.documentName);
      data.append('signerName', formData.signerName);
      data.append('signerEmail', formData.signerEmail);
      
      if (formData.documentType) data.append('documentType', formData.documentType);
      if (formData.description) data.append('description', formData.description);
      if (formData.signerPhone) data.append('signerPhone', formData.signerPhone);
      if (formData.linkedContactId) data.append('linkedContactId', formData.linkedContactId);

      await dispatch(createSignatureDocument(data));

      alert('✅ Documento enviado exitosamente para firma');
      setShowCreateModal(false);
      resetForm();
      loadDocuments();
    } catch (error) {
      console.error('Error creando documento:', error);
      alert('❌ Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setCreating(false);
    }
  };

  /**
   * Verificar estado de firma
   */
  const handleCheckStatus = async (doc) => {
    try {
      setCheckingStatus(prev => ({ ...prev, [doc.id]: true }));
      
      const result = await dispatch(checkDocumentStatus(doc.id));
      
      if (result.isSigned && doc.status !== 'signed') {
        alert(`✅ ¡Documento firmado! Firmado el ${new Date(result.signedAt).toLocaleString('es-AR')}\n\nDescargando PDF firmado...`);
        
        // Descargar automáticamente el PDF firmado (solo obtener URL, NO abrir ventana)
        try {
          await dispatch(downloadSignedDocument(doc.id, false)); // false = no abrir ventana
          
          // Actualizar lista de documentos
          await loadDocuments();
          
          // Si el modal de detalles está abierto con este documento, actualizarlo
          if (selectedDocument && selectedDocument.id === doc.id) {
            const updatedDoc = await dispatch(getSignatureDocument(doc.id));
            setSelectedDocument(updatedDoc.document || updatedDoc);
          }
          
          alert('✅ Documento firmado listo. Puedes verlo con el botón "Ver Firmado"');
        } catch (downloadError) {
          console.error('Error descargando PDF firmado:', downloadError);
          alert('⚠️ Documento firmado pero error al obtener PDF. Intenta descargar manualmente.');
          loadDocuments(); // Actualizar estado aunque falle la descarga
          
          // Intentar actualizar selectedDocument de todos modos
          if (selectedDocument && selectedDocument.id === doc.id) {
            try {
              const updatedDoc = await dispatch(getSignatureDocument(doc.id));
              setSelectedDocument(updatedDoc.document || updatedDoc);
            } catch (e) {
              console.error('Error actualizando documento en modal:', e);
            }
          }
        }
      } else if (result.isSigned) {
        alert('✅ Documento ya está firmado');
        
        // Actualizar datos frescos del backend
        await loadDocuments();
        
        // Si el modal está abierto, actualizar con datos frescos
        if (selectedDocument && selectedDocument.id === doc.id) {
          const updatedDoc = await dispatch(getSignatureDocument(doc.id));
          setSelectedDocument(updatedDoc.document || updatedDoc);
        }
      } else {
        alert(`⏳ Documento pendiente de firma (Estado: ${result.status})`);
      }
    } catch (error) {
      console.error('Error verificando estado:', error);
      alert('❌ Error verificando estado: ' + error.message);
    } finally {
      setCheckingStatus(prev => ({ ...prev, [doc.id]: false }));
    }
  };

  /**
   * Descargar documento firmado
   */
  const handleDownloadSigned = async (doc) => {
    try {
      const result = await dispatch(downloadSignedDocument(doc.id));
      alert('✅ PDF firmado descargado y guardado');
      
      // Actualizar lista de documentos
      await loadDocuments();
      
      // Si el modal de detalles está abierto con este documento, actualizarlo
      if (selectedDocument && selectedDocument.id === doc.id) {
        // Obtener el documento actualizado del backend
        const updatedDoc = await dispatch(getSignatureDocument(doc.id));
        setSelectedDocument(updatedDoc.document || updatedDoc);
      }
    } catch (error) {
      console.error('Error descargando:', error);
      alert('❌ Error: ' + (error.response?.data?.message || error.message));
    }
  };

  /**
   * Cancelar documento
   */
  const handleCancelDocument = async (doc) => {
    if (!window.confirm(`¿Cancelar documento "${doc.documentName}"?`)) return;

    try {
      await dispatch(cancelSignatureDocument(doc.id));
      alert('✅ Documento cancelado');
      loadDocuments();
    } catch (error) {
      console.error('Error cancelando:', error);
      alert('❌ Error: ' + error.message);
    }
  };

  /**
   * Eliminar documento
   */
  const handleDeleteDocument = async (doc) => {
    if (!window.confirm(`¿Eliminar documento "${doc.documentName}"? Esta acción no se puede deshacer.`)) return;

    try {
      await dispatch(deleteSignatureDocument(doc.id));
      alert('✅ Documento eliminado');
      loadDocuments();
    } catch (error) {
      console.error('Error eliminando:', error);
      alert('❌ Error: ' + error.message);
    }
  };

  /**
   * Ver detalles del documento
   */
  const handleViewDetails = async (doc) => {
    try {
      // Obtener datos frescos del backend en lugar de usar los de la lista en memoria
      const freshDoc = await dispatch(getSignatureDocument(doc.id));
      const documentData = freshDoc.document || freshDoc;
      
      console.log('📄 [Signature Document] Datos del documento:', {
        id: documentData.id,
        status: documentData.status,
        hasOriginalPdf: !!documentData.originalPdfUrl,
        hasSignedPdf: !!documentData.signedPdfUrl,
        signedPdfUrl: documentData.signedPdfUrl
      });
      
      setSelectedDocument(documentData);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error cargando detalles:', error);
      // Fallback: usar datos de la lista si falla la petición
      setSelectedDocument(doc);
      setShowDetailsModal(true);
    }
  };

  /**
   * Vista previa del PDF original
   */
  const handlePreviewOriginal = (doc) => {
    if (!doc.originalPdfUrl) {
      alert('⚠️ PDF original no disponible');
      return;
    }
    setPreviewPdfUrl(doc.originalPdfUrl);
    setPreviewDocumentName(`${doc.documentName} (Original)`);
    setShowPreviewModal(true);
  };

  /**
   * Vista previa del PDF firmado
   */
  const handlePreviewSigned = (doc) => {
    if (!doc.signedPdfUrl) {
      alert('⚠️ PDF firmado no disponible todavía');
      return;
    }
    setPreviewPdfUrl(doc.signedPdfUrl);
    setPreviewDocumentName(`${doc.documentName} (Firmado)`);
    setShowPreviewModal(true);
  };

  /**
   * Reset form
   */
  const resetForm = () => {
    setFormData({
      documentName: '',
      documentType: '',
      description: '',
      signerName: '',
      signerEmail: '',
      signerPhone: '',
      linkedContactId: '',
      pdfFile: null
    });
  };

  /**
   * Obtener badge de estado
   */
  const getStatusBadge = (status) => {
    const badges = {
      draft: { color: 'bg-gray-500', icon: FaClock, text: 'Borrador' },
      pending: { color: 'bg-yellow-500', icon: FaClock, text: 'Pendiente' },
      signed: { color: 'bg-green-500', icon: FaCheckCircle, text: 'Firmado' },
      declined: { color: 'bg-red-500', icon: FaBan, text: 'Rechazado' },
      failed: { color: 'bg-red-600', icon: FaExclamationTriangle, text: 'Error' },
      cancelled: { color: 'bg-gray-400', icon: FaBan, text: 'Cancelado' }
    };

    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;

    return (
      <span className={`${badge.color} text-white px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1`}>
        <Icon size={10} />
        {badge.text}
      </span>
    );
  };

  /**
   * Obtener badge de proveedor
   */
  const getProviderBadge = (provider) => {
    const colors = {
      signnow: 'bg-blue-100 text-blue-800 border-blue-300',
      docusign: 'bg-purple-100 text-purple-800 border-purple-300'
    };

    return (
      <span className={`${colors[provider]} px-2 py-1 rounded-full text-xs font-semibold border`}>
        {provider === 'signnow' ? 'SignNow' : 'DocuSign'}
      </span>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FaFileSignature className="text-customGreen" />
              Documentos para Firma
            </h1>
            <p className="text-gray-600 mt-1">
              Sistema de firma electrónica con SignNow y DocuSign
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-customGreen text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 shadow-md"
          >
            <FaPlus />
            Nuevo Documento
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <FaFilter className="text-gray-500" />
            <span className="font-semibold text-gray-700">Filtros:</span>
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-customGreen"
          >
            <option value="">Todos los estados</option>
            <option value="draft">Borrador</option>
            <option value="pending">Pendiente</option>
            <option value="signed">Firmado</option>
            <option value="declined">Rechazado</option>
            <option value="failed">Error</option>
            <option value="cancelled">Cancelado</option>
          </select>

          <button
            onClick={loadDocuments}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <FaSync className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>

          <div className="ml-auto text-sm text-gray-600">
            Total: <strong>{pagination.total}</strong> documentos
          </div>
        </div>
      </div>

      {/* Lista de Documentos */}
      {loading && documents.length === 0 ? (
        <div className="text-center py-12">
          <FaSync className="animate-spin text-4xl text-customGreen mx-auto mb-4" />
          <p className="text-gray-600">Cargando documentos...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <FaFileSignature className="text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No hay documentos
          </h3>
          <p className="text-gray-500 mb-4">
            Comienza creando tu primer documento para firma electrónica
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-customGreen text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors inline-flex items-center gap-2"
          >
            <FaPlus />
            Crear Primer Documento
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Documento</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Firmante</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Estado</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Proveedor</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Fecha</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-gray-900">{doc.documentName}</p>
                      {doc.documentType && (
                        <p className="text-sm text-gray-500 capitalize">{doc.documentType}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">{doc.signerName}</p>
                      <p className="text-gray-500 flex items-center gap-1">
                        <FaEnvelope size={10} />
                        {doc.signerEmail}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(doc.status)}
                  </td>
                  <td className="px-6 py-4">
                    {getProviderBadge(doc.signatureProvider)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {doc.sentAt ? (
                      <>
                        <p>Enviado:</p>
                        <p className="font-medium">{new Date(doc.sentAt).toLocaleDateString('es-AR')}</p>
                      </>
                    ) : (
                      <span className="text-gray-400">No enviado</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 justify-center flex-wrap">
                      {/* Ver Original */}
                      <button
                        onClick={() => handlePreviewOriginal(doc)}
                        className="text-purple-600 hover:text-purple-800 p-2"
                        title="Ver PDF Original"
                      >
                        <FaEye />
                      </button>

                      {/* Ver Firmado (si está firmado) */}
                      {doc.status === 'signed' && doc.signedPdfUrl && (
                        <button
                          onClick={() => handlePreviewSigned(doc)}
                          className="text-green-600 hover:text-green-800 p-2"
                          title="Ver PDF Firmado"
                        >
                          <FaCheckCircle />
                        </button>
                      )}

                      {/* Ver detalles */}
                      <button
                        onClick={() => handleViewDetails(doc)}
                        className="text-blue-600 hover:text-blue-800 p-2"
                        title="Ver detalles"
                      >
                        <FaSearch />
                      </button>

                      {/* Verificar estado (si está pendiente) */}
                      {doc.status === 'pending' && (
                        <button
                          onClick={() => handleCheckStatus(doc)}
                          disabled={checkingStatus[doc.id]}
                          className="text-yellow-600 hover:text-yellow-800 p-2 disabled:opacity-50"
                          title="Verificar estado"
                        >
                          <FaSync className={checkingStatus[doc.id] ? 'animate-spin' : ''} />
                        </button>
                      )}

                      {/* Descargar firmado (si está firmado) */}
                      {doc.status === 'signed' && (
                        <button
                          onClick={() => handleDownloadSigned(doc)}
                          className="text-teal-600 hover:text-teal-800 p-2"
                          title="Descargar PDF firmado"
                        >
                          <FaDownload />
                        </button>
                      )}

                      {/* Cancelar (si está pendiente) */}
                      {doc.status === 'pending' && (
                        <button
                          onClick={() => handleCancelDocument(doc)}
                          className="text-orange-600 hover:text-orange-800 p-2"
                          title="Cancelar"
                        >
                          <FaBan />
                        </button>
                      )}

                      {/* Eliminar */}
                      <button
                        onClick={() => handleDeleteDocument(doc)}
                        className="text-red-600 hover:text-red-800 p-2"
                        title="Eliminar"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page === 1}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
            disabled={pagination.page === pagination.totalPages}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal Crear Documento */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FaFileSignature className="text-customGreen" />
                Nuevo Documento para Firma
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="text-gray-600 hover:text-gray-800"
                disabled={creating}
              >
                <FaTimes size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="space-y-4">
              {/* Archivo PDF */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Archivo PDF *
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) => setFormData(prev => ({ ...prev, pdfFile: e.target.files[0] }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-customGreen"
                  disabled={creating}
                />
                {formData.pdfFile && (
                  <p className="text-sm text-gray-600 mt-1">
                    Archivo: {formData.pdfFile.name} ({(formData.pdfFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {/* Nombre del documento */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Nombre del Documento *
                </label>
                <input
                  type="text"
                  required
                  value={formData.documentName}
                  onChange={(e) => setFormData(prev => ({ ...prev, documentName: e.target.value }))}
                  placeholder="Ej: Contrato de Servicios 2026"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-customGreen"
                  disabled={creating}
                />
              </div>

              {/* Tipo de documento */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Tipo de Documento
                </label>
                <select
                  value={formData.documentType}
                  onChange={(e) => setFormData(prev => ({ ...prev, documentType: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-customGreen"
                  disabled={creating}
                >
                  <option value="">Seleccionar tipo...</option>
                  <option value="contract">Contrato</option>
                  <option value="nda">NDA / Confidencialidad</option>
                  <option value="agreement">Acuerdo</option>
                  <option value="release">Release / Autorización</option>
                  <option value="waiver">Renuncia</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción o notas sobre el documento"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-customGreen"
                  disabled={creating}
                />
              </div>

              <hr className="my-4" />

              {/* Información del firmante */}
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FaUser className="text-customGreen" />
                Información del Firmante
              </h3>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.signerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, signerName: e.target.value }))}
                  placeholder="Juan Pérez"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-customGreen"
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.signerEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, signerEmail: e.target.value }))}
                  placeholder="juan@example.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-customGreen"
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.signerPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, signerPhone: e.target.value }))}
                  placeholder="+1 234 567 8900"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-customGreen"
                  disabled={creating}
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-customGreen text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <FaSync className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <FaFileSignature />
                      Enviar para Firma
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                El firmante recibirá un email con un link para firmar el documento electrónicamente
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalles */}
      {showDetailsModal && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Detalles del Documento</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedDocument(null);
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                <FaTimes size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Estado y Proveedor */}
              <div className="flex gap-4 items-center">
                <div>
                  <span className="text-sm text-gray-600">Estado:</span>
                  <div className="mt-1">{getStatusBadge(selectedDocument.status)}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Proveedor:</span>
                  <div className="mt-1">{getProviderBadge(selectedDocument.signatureProvider)}</div>
                </div>
              </div>

              <hr />

              {/* Información del documento */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Información del Documento</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Nombre:</span>
                    <p className="font-medium">{selectedDocument.documentName}</p>
                  </div>
                  {selectedDocument.documentType && (
                    <div>
                      <span className="text-gray-600">Tipo:</span>
                      <p className="font-medium capitalize">{selectedDocument.documentType}</p>
                    </div>
                  )}
                  {selectedDocument.description && (
                    <div className="col-span-2">
                      <span className="text-gray-600">Descripción:</span>
                      <p className="font-medium">{selectedDocument.description}</p>
                    </div>
                  )}
                </div>
              </div>

              <hr />

              {/* Información del firmante */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Firmante</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <FaUser className="text-gray-500" />
                    <span className="font-medium">{selectedDocument.signerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaEnvelope className="text-gray-500" />
                    <span>{selectedDocument.signerEmail}</span>
                  </div>
                  {selectedDocument.signerPhone && (
                    <div className="flex items-center gap-2">
                      <FaPhone className="text-gray-500" />
                      <span>{selectedDocument.signerPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              <hr />

              {/* Fechas */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Fechas</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Creado:</span>
                    <p className="font-medium">{new Date(selectedDocument.createdAt).toLocaleString('es-AR')}</p>
                  </div>
                  {selectedDocument.sentAt && (
                    <div>
                      <span className="text-gray-600">Enviado:</span>
                      <p className="font-medium">{new Date(selectedDocument.sentAt).toLocaleString('es-AR')}</p>
                    </div>
                  )}
                  {selectedDocument.signedAt && (
                    <div>
                      <span className="text-gray-600">Firmado:</span>
                      <p className="font-medium text-green-600">{new Date(selectedDocument.signedAt).toLocaleString('es-AR')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* PDF Links */}
              {(selectedDocument.originalPdfUrl || selectedDocument.signedPdfUrl) && (
                <>
                  <hr />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Archivos</h3>
                    <div className="space-y-2">
                      {selectedDocument.originalPdfUrl && (
                        <a
                          href={selectedDocument.originalPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-2 text-sm"
                        >
                          <FaDownload />
                          Descargar PDF Original
                        </a>
                      )}
                      {selectedDocument.signedPdfUrl && (
                        <a
                          href={selectedDocument.signedPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-800 flex items-center gap-2 text-sm font-semibold"
                        >
                          <FaDownload />
                          Descargar PDF Firmado
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Acciones rápidas */}
              <div className="flex gap-3 pt-4">
                {/* Botones de vista previa */}
                <button
                  onClick={() => handlePreviewOriginal(selectedDocument)}
                  className="flex-1 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
                  disabled={!selectedDocument.originalPdfUrl}
                >
                  <FaEye />
                  Ver Original
                </button>
                
                {selectedDocument.status === 'signed' && selectedDocument.signedPdfUrl && (
                  <button
                    onClick={() => handlePreviewSigned(selectedDocument)}
                    className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <FaCheckCircle />
                    Ver Firmado
                  </button>
                )}

                {selectedDocument.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleCheckStatus(selectedDocument)}
                      className="flex-1 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2"
                      disabled={checkingStatus[selectedDocument.id]}
                    >
                      <FaSync className={checkingStatus[selectedDocument.id] ? 'animate-spin' : ''} />
                      Verificar Estado
                    </button>
                    <button
                      onClick={() => {
                        handleCancelDocument(selectedDocument);
                        setShowDetailsModal(false);
                      }}
                      className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <FaBan />
                      Cancelar
                    </button>
                  </>
                )}
                {selectedDocument.status === 'signed' && (
                  <button
                    onClick={() => {
                      handleDownloadSigned(selectedDocument);
                    }}
                    className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <FaDownload />
                    Descargar Firmado
                  </button>
                )}
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Vista Previa PDF */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
            {/* Header del Modal */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FaEye className="text-customGreen" />
                {previewDocumentName}
              </h2>
              <div className="flex gap-2">
                <a
                  href={previewPdfUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-customGreen text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <FaDownload />
                  Descargar
                </a>
                <button
                  onClick={() => {
                    setShowPreviewModal(false);
                    setPreviewPdfUrl('');
                    setPreviewDocumentName('');
                  }}
                  className="text-gray-600 hover:text-gray-800 p-2"
                >
                  <FaTimes size={24} />
                </button>
              </div>
            </div>

            {/* Visor PDF con Google Docs Viewer */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewPdfUrl)}&embedded=true`}
                className="w-full h-full"
                title={previewDocumentName}
                frameBorder="0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignatureDocumentsDashboard;
