import React, { useState, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import DuplicateWarning from '../Common/DuplicateWarning';
import api from '../../utils/axios';

const SOURCE_OPTIONS = [
  { value: 'website',      label: '🌐 Web / Online' },
  { value: 'walk_in',      label: '🚶 Recorrido (Field)' },
  { value: 'phone_call',   label: '📞 Llamada' },
  { value: 'referral',     label: '🤝 Referido' },
  { value: 'social_media', label: '📱 Redes Sociales' },
  { value: 'email',        label: '✉️ Email' },
  { value: 'other',        label: '🔹 Otro' },
];

const PRESET_TAGS = [
  { value: 'large-account',    label: '⭐ Large Account',    color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'new-construction', label: '🏗️ New Construction',  color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'commercial',       label: '🏢 Commercial',        color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'residential',      label: '🏠 Residential',       color: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'contractor',       label: '👷 Contractor',        color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'urgent',           label: '⚡ Urgent',            color: 'bg-red-100 text-red-800 border-red-300' },
];

const EditLeadModal = ({ lead, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    applicantName: lead.applicantName || '',
    applicantEmail: lead.applicantEmail || '',
    applicantPhone: lead.applicantPhone || '',
    propertyAddress: lead.propertyAddress || '',
    source: lead.source || 'website',
    tags: lead.tags || [],
  });

  const toggleTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [duplicates, setDuplicates] = useState({ email: { found: false, matches: [] }, phone: { found: false, matches: [] }, address: { found: false, matches: [] } });
  const dupTimerRef = useRef(null);

  const checkDuplicates = async (data) => {
    const { applicantEmail, applicantPhone, propertyAddress } = data;
    const hasAny = (applicantEmail?.trim().length > 3) || (applicantPhone?.trim().length > 5) || (propertyAddress?.trim().length > 5);
    if (!hasAny) return;
    try {
      const params = new URLSearchParams();
      if (applicantEmail?.trim()) params.set('email', applicantEmail.trim());
      if (applicantPhone?.trim()) params.set('phone', applicantPhone.trim());
      if (propertyAddress?.trim()) params.set('address', propertyAddress.trim());
      if (lead?.id) params.set('excludeLeadId', lead.id);
      const res = await api.get(`/sales-leads/check-duplicates?${params.toString()}`);
      setDuplicates(res.data);
    } catch {
      // silencioso
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (['applicantEmail', 'applicantPhone', 'propertyAddress'].includes(name)) {
      clearTimeout(dupTimerRef.current);
      const updated = { ...formData, [name]: value };
      dupTimerRef.current = setTimeout(() => checkDuplicates(updated), 800);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.applicantName.trim()) {
      setError('El nombre del cliente es obligatorio');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSave(lead.id, formData);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al actualizar lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Editar Lead
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Información Básica del Lead */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Información del Lead
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  name="applicantName"
                  value={formData.applicantName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="applicantEmail"
                  value={formData.applicantEmail}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    duplicates.email.found ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  }`}
                  placeholder="john@example.com"
                />
                <DuplicateWarning field="email" data={duplicates.email} label="Email" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="applicantPhone"
                  value={formData.applicantPhone}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    duplicates.phone.found ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  }`}
                  placeholder="(555) 123-4567"
                />
                <DuplicateWarning field="phone" data={duplicates.phone} label="Teléfono" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección de la Propiedad
                </label>
                <input
                  type="text"
                  name="propertyAddress"
                  value={formData.propertyAddress}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    duplicates.address.found ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  }`}
                  placeholder="123 Main St, City, State ZIP"
                />
                <DuplicateWarning field="address" data={duplicates.address} label="Dirección" />
              </div>

              {/* Origen del Lead */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Origen del contacto
                </label>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {SOURCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Tags predefinidos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de cliente
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_TAGS.map(tag => (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() => toggleTag(tag.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        formData.tags.includes(tag.value)
                          ? tag.color + ' ring-2 ring-offset-1 ring-current'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLeadModal;
