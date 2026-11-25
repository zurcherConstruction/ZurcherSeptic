import React, { useEffect, useState } from 'react';
import api from '../../utils/axios';
import { useDispatch, useSelector } from 'react-redux';
import {
  XMarkIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserGroupIcon,
  CalendarIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { fetchCampaignById } from '../../Redux/Actions/marketingCampaignsActions';
import { clearCurrentCampaign } from '../../Redux/Reducer/marketingCampaignsReducer';

const CampaignDetailsModal = ({ campaignId, onClose }) => {
  const dispatch = useDispatch();
  const { currentCampaign: selectedCampaign, loading } = useSelector((state) => state.marketingCampaigns);
  const [retryTitle, setRetryTitle] = useState("Season's Greetings!");
  const [retrying, setRetrying] = useState(false);

  // 🔁 Reenvía solo a los fallidos (en segundo plano, de a uno, para que Gmail no bloquee)
  const handleRetry = async () => {
    if (!window.confirm(`¿Reenviar la campaña a ${selectedCampaign.failedEmails.length} emails que fallaron?`)) return;
    setRetrying(true);
    try {
      const { data } = await api.post(`/company-emails/campaigns/${campaignId}/retry-failed`, { emailTitle: retryTitle.trim() });
      alert(`✅ ${data.message}\nPodés cerrar esta ventana; el avance se ve en el listado de campañas.`);
      dispatch(fetchCampaignById(campaignId));
    } catch (err) {
      alert(`No se pudo reintentar: ${err.response?.data?.error || err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (campaignId) {
      dispatch(fetchCampaignById(campaignId));
    }
    
    // Cleanup al desmontar
    return () => {
      dispatch(clearCurrentCampaign());
    };
  }, [campaignId, dispatch]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || !selectedCampaign) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-12 text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando detalles...</p>
        </div>
      </div>
    );
  }

  const campaign = selectedCampaign;
  const successRate = campaign.recipientCount > 0 
    ? Math.round((campaign.sentCount / campaign.recipientCount) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a3a5c] to-[#2563a8] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-xl">📧 Detalles de Campaña</h2>
            <p className="text-blue-200 text-sm mt-1">{campaign.campaignName || campaign.subject}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Campaign Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Asunto</label>
                <p className="text-base text-gray-900 font-medium mt-1">{campaign.subject}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Tipo de Campaña</label>
                <p className="text-base text-gray-900 mt-1">{campaign.campaignType}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Creada por</label>
                <p className="text-base text-gray-900 mt-1">
                  {campaign.sentBy?.name || 'N/A'} ({campaign.sentBy?.email || ''})
                </p>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Fecha de Creación</label>
                <p className="text-base text-gray-900 mt-1 flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-gray-400" />
                  {formatDate(campaign.createdAt)}
                </p>
              </div>

              {campaign.startedAt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Inicio de Envío</label>
                  <p className="text-base text-gray-900 mt-1 flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-gray-400" />
                    {formatDate(campaign.startedAt)}
                  </p>
                </div>
              )}

              {campaign.completedAt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Completada</label>
                  <p className="text-base text-gray-900 mt-1 flex items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    {formatDate(campaign.completedAt)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Estadísticas de Envío</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{campaign.recipientCount}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{campaign.sentCount}</div>
                <div className="text-sm text-gray-600">Enviados</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{campaign.failedCount}</div>
                <div className="text-sm text-gray-600">Fallidos</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{successRate}%</div>
                <div className="text-sm text-gray-600">Tasa de éxito</div>
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">💬 Mensaje Enviado</h3>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{campaign.message}</pre>
            </div>
          </div>

          {/* Image */}
          {campaign.imageUrl && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3">🖼️ Imagen de la Campaña</h3>
              <img 
                src={campaign.imageUrl} 
                alt="Campaign" 
                className="max-h-64 rounded-lg border border-gray-200 shadow-sm"
              />
            </div>
          )}

          {/* Recipients List */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <UserGroupIcon className="h-6 w-6" />
              📧 Destinatarios ({campaign.uniqueEmails?.length || 0})
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                {campaign.uniqueEmails && campaign.uniqueEmails.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {campaign.uniqueEmails.map((email, index) => (
                      <div key={index} className="px-4 py-3 hover:bg-gray-50 flex items-center gap-3">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{email}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    No hay destinatarios registrados
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Failed Emails */}
          {campaign.failedEmails && campaign.failedEmails.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-red-600 mb-3 flex items-center gap-2">
                <XCircleIcon className="h-6 w-6" />
                ❌ Emails Fallidos ({campaign.failedEmails.length})
              </h3>
              {campaign.status !== 'sending' && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Título del email (el que usaste en la campaña)
                    </label>
                    <input
                      value={retryTitle}
                      onChange={e => setRetryTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <button
                    onClick={handleRetry}
                    disabled={retrying || !retryTitle.trim()}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-60 whitespace-nowrap"
                  >
                    {retrying ? 'Iniciando…' : `🔁 Reintentar fallidos (${campaign.failedEmails.length})`}
                  </button>
                </div>
              )}
              <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <div className="divide-y divide-red-100">
                    {campaign.failedEmails.map((failed, index) => (
                      <div key={index} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <XCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{failed.email}</p>
                            <p className="text-xs text-red-600 mt-1">{failed.error}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-[#1a3a5c] to-[#2563a8] text-white px-4 py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignDetailsModal;
