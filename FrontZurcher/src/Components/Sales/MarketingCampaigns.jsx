import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  EnvelopeIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserGroupIcon,
  CalendarIcon,
  EyeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { fetchCampaigns } from '../../Redux/Actions/marketingCampaignsActions';
import SendCampaignModal from './SendCampaignModal';
import CampaignDetailsModal from './CampaignDetailsModal';

const STATUS_LABELS = {
  draft: 'Borrador',
  sending: 'Enviando',
  completed: 'Completado',
  failed: 'Fallido'
};

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  sending: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800'
};

const CAMPAIGN_TYPE_LABELS = {
  holiday: '🎄 Festivo',
  promotional: '🎁 Promocional',
  seasonal: '🍂 Estacional',
  informational: 'ℹ️ Informativo',
  other: '📋 Otro'
};

const MarketingCampaigns = () => {
  const dispatch = useDispatch();
  const { currentStaff } = useSelector((state) => state.auth);
  const { campaigns, loading, total, totalPages } = useSelector((state) => state.marketingCampaigns);
  const userRole = currentStaff?.role || '';

  // Solo admin y owner pueden acceder
  const canAccess = ['admin', 'owner'].includes(userRole);

  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (canAccess) {
      loadCampaigns();
    }
  }, [canAccess, page, statusFilter, dispatch]);

  const loadCampaigns = () => {
    const params = { page, pageSize: 20 };
    if (statusFilter !== 'all') {
      params.status = statusFilter;
    }
    dispatch(fetchCampaigns(params));
  };

  const handleNewCampaign = () => {
    setShowModal(true);
  };

  const handleCampaignSent = () => {
    setShowModal(false);
    loadCampaigns(); // Recargar lista
  };

  const handleViewDetails = (campaignId) => {
    setSelectedCampaignId(campaignId);
    setShowDetailsModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSuccessRate = (campaign) => {
    if (campaign.recipientCount === 0) return 0;
    return Math.round((campaign.sentCount / campaign.recipientCount) * 100);
  };

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">
            Solo administradores pueden acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <EnvelopeIcon className="h-8 w-8 text-blue-600" />
                Email Marketing
              </h1>
              <p className="text-gray-600 mt-1">
                Envía emails masivos a tus clientes en fechas especiales
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/marketing-campaigns/newsletter"
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-lg"
              >
                <EnvelopeIcon className="h-5 w-5" />
                Newsletter
              </Link>
              <button
                onClick={handleNewCampaign}
                className="flex items-center gap-2 bg-gradient-to-r from-[#1a3a5c] to-[#2563a8] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-lg"
              >
                <PlusIcon className="h-5 w-5" />
                Nueva Campaña
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <label className="text-sm font-medium text-gray-700">Estado:</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === 'completed'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completados
              </button>
              <button
                onClick={() => setStatusFilter('sending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === 'sending'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                En Proceso
              </button>
              <button
                onClick={() => setStatusFilter('failed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === 'failed'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Fallidos
              </button>
            </div>
            <button
              onClick={loadCampaigns}
              className="ml-auto flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Campaign List */}
        {loading && campaigns.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <ArrowPathIcon className="h-12 w-12 text-blue-600 mx-auto animate-spin mb-4" />
            <p className="text-gray-600">Cargando campañas...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <EnvelopeIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No hay campañas todavía
            </h3>
            <p className="text-gray-500 mb-6">
              Crea tu primera campaña de email para comenzar
            </p>
            <button
              onClick={handleNewCampaign}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Nueva Campaña
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    
                    {/* Left: Campaign Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex-shrink-0 mt-1">
                          {CAMPAIGN_TYPE_LABELS[campaign.campaignType] || '📧'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">
                            {campaign.campaignName || campaign.subject}
                          </h3>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                            {campaign.subject}
                          </p>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <UserGroupIcon className="h-4 w-4" />
                              {campaign.recipientCount} destinatarios
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-4 w-4" />
                              {formatDate(campaign.createdAt)}
                            </span>
                            {campaign.sentBy && (
                              <span>Por: {campaign.sentBy.name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Stats & Status */}
                    <div className="flex flex-col items-end gap-3">
                      <button
                        onClick={() => handleViewDetails(campaign.id)}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
                      >
                        <EyeIcon className="h-5 w-5" />
                        Ver detalles
                      </button>
                      
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[campaign.status]}`}>
                        {STATUS_LABELS[campaign.status]}
                      </span>
                      
                      {campaign.status === 'completed' && (
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            {getSuccessRate(campaign)}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {campaign.sentCount} enviados · {campaign.failedCount} fallidos
                          </div>
                        </div>
                      )}

                      {campaign.status === 'sending' && (
                        <div className="text-blue-600 text-sm font-medium animate-pulse">
                          Enviando...
                        </div>
                      )}

                      {campaign.status === 'failed' && (
                        <div className="text-red-600 text-sm font-medium">
                          Error en el envío
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Image preview if exists */}
                  {campaign.imageUrl && (
                    <div className="mt-4 border-t pt-4">
                      <img
                        src={campaign.imageUrl}
                        alt="Campaign"
                        className="max-h-32 rounded-lg border border-gray-200"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* New Campaign Modal */}
      {showModal && (
        <SendCampaignModal
          onClose={() => setShowModal(false)}
          onSent={handleCampaignSent}
        />
      )}

      {/* Campaign Details Modal */}
      {showDetailsModal && selectedCampaignId && (
        <CampaignDetailsModal
          campaignId={selectedCampaignId}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedCampaignId(null);
          }}
        />
      )}
    </div>
  );
};

export default MarketingCampaigns;
