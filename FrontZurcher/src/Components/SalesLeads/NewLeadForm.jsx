import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createLead, createLeadNote } from '../../Redux/Actions/salesLeadActions';
import { UserCircleIcon, BellIcon } from '@heroicons/react/24/outline';
import MentionTextarea from '../Common/MentionTextarea';
import DuplicateWarning from '../Common/DuplicateWarning';
import api from '../../utils/axios';

const NewLeadForm = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const { currentStaff } = useSelector((state) => state.auth);
  
  // 🔍 Estado validación dirección (legacy, se mantiene para compatibilidad)
  const [addressCheck, setAddressCheck] = useState({ status: 'idle', permit: null });
  // 🔍 Estado verificación duplicados
  const [duplicates, setDuplicates] = useState({ email: { found: false, matches: [] }, phone: { found: false, matches: [] }, address: { found: false, matches: [] } });
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const dupTimerRef = useRef(null);
  
  const [formData, setFormData] = useState({
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    propertyAddress: '',
    source: 'website',
    tags: [],
    notes: '',
    hasReminder: false,
    reminderDate: '',
    reminderStaff: []
  });

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

  const toggleTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  // Cargar lista de staff
  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const response = await api.get('/budget-notes/staff/active');
      setStaffList(response.data || []);
    } catch (error) {
      console.error('Error al cargar staff:', error);
    }
  };

  const checkAddress = async (address) => {
    if (!address || address.trim().length < 5) {
      setAddressCheck({ status: 'idle', permit: null });
      return;
    }
    setAddressCheck({ status: 'checking', permit: null });
    try {
      const response = await api.get(`/permit/check-by-address?propertyAddress=${encodeURIComponent(address.trim())}`);
      const { exists, hasBudget, permit } = response.data;
      if (exists && hasBudget) {
        setAddressCheck({ status: 'has_budget', permit });
      } else {
        setAddressCheck({ status: 'clear', permit: null });
      }
    } catch {
      setAddressCheck({ status: 'idle', permit: null });
    }
  };

  const checkDuplicates = async (data) => {
    const { applicantEmail, applicantPhone, propertyAddress } = data;
    const hasAny = (applicantEmail?.trim().length > 3) || (applicantPhone?.trim().length > 5) || (propertyAddress?.trim().length > 5);
    if (!hasAny) return;
    setCheckingDuplicates(true);
    try {
      const params = new URLSearchParams();
      if (applicantEmail?.trim()) params.set('email', applicantEmail.trim());
      if (applicantPhone?.trim()) params.set('phone', applicantPhone.trim());
      if (propertyAddress?.trim()) params.set('address', propertyAddress.trim());
      const res = await api.get(`/sales-leads/check-duplicates?${params.toString()}`);
      setDuplicates(res.data);
    } catch {
      // silencioso, no bloquear flujo
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (name === 'propertyAddress') {
      checkAddress(value);
    }
    // Verificar duplicados con debounce para email, teléfono y dirección
    if (['applicantEmail', 'applicantPhone', 'propertyAddress'].includes(name)) {
      clearTimeout(dupTimerRef.current);
      const updated = { ...formData, [name]: value };
      dupTimerRef.current = setTimeout(() => checkDuplicates(updated), 800);
    }
  };

  const handleStaffToggle = (staffId) => {
    setFormData(prev => ({
      ...prev,
      reminderStaff: prev.reminderStaff.includes(staffId)
        ? prev.reminderStaff.filter(id => id !== staffId)
        : [...prev.reminderStaff, staffId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar que el usuario esté logueado
    if (!currentStaff?.id) {
      alert('Error: Sesión no válida. Por favor, inicia sesión nuevamente.');
      return;
    }
    
    if (!formData.applicantName.trim()) {
      alert('El nombre del cliente es obligatorio');
      return;
    }

    if (formData.hasReminder && (!formData.notes?.trim() || !formData.reminderDate)) {
      alert('Para crear un recordatorio necesitas agregar notas y fecha');
      return;
    }

    setLoading(true);
    try {
      // 1. Crear el lead
      const leadData = {
        applicantName: formData.applicantName,
        applicantEmail: formData.applicantEmail,
        applicantPhone: formData.applicantPhone,
        propertyAddress: formData.propertyAddress,
        source: formData.source,
        tags: formData.tags,
      };
      
      const leadResult = await dispatch(createLead(leadData));
      
      console.log('🔍 Lead Result:', leadResult);
      console.log('🔍 Lead Result Type:', leadResult.type);
      console.log('🔍 Lead Result Payload:', leadResult.payload);
      
      if (!leadResult.type.includes('fulfilled')) {
        alert('Error creating the lead');
        return;
      }

      const createdLead = leadResult.payload?.lead;
      console.log('🔍 Created Lead:', createdLead);
      
      if (!createdLead?.id) {
        console.error('❌ Lead structure:', leadResult.payload);
        alert('Error: Could not get the created lead ID');
        return;
      }

      // 2. Si hay notas iniciales, crear la nota
      if (formData.notes?.trim()) {
        const noteData = {
          leadId: createdLead.id,
          message: formData.notes,
          noteType: 'initial_contact',
          priority: 'medium'
        };

        const noteResult = await dispatch(createLeadNote(noteData));
        
        if (noteResult.type.includes('fulfilled') && formData.hasReminder) {
          const createdNote = noteResult.payload?.note;
          
          // 3. Si tiene recordatorio, configurarlo
          if (createdNote?.id && formData.reminderDate) {
            const [year, month, day] = formData.reminderDate.split('-');
            // Usar hora por defecto: 09:00
            const reminderDateTime = new Date(`${year}-${month}-${day}T09:00:00`);
            
            // Si no hay staff seleccionado, usar el usuario actual como default
            const reminderStaffIds = formData.reminderStaff.length > 0 
              ? formData.reminderStaff 
              : [currentStaff.id]; // ✅ Siempre asignar al usuario logueado si no hay selección

            await api.patch(`/lead-notes/${createdNote.id}/reminder`, {
              reminderDate: reminderDateTime.toISOString(),
              reminderFor: reminderStaffIds
            });
          }
        }
      }

      alert('✅ Lead created successfully');
      navigate('/sales-leads');
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error creating lead: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/sales-leads')}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
          >
            ← Back to Leads
          </button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UserCircleIcon className="h-8 w-8" />
            New Sales Lead
          </h1>
          <p className="text-gray-600 mt-1">Register basic lead information. Additional details can be added during follow-up.</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          {/* Lead Data */}
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  name="applicantName"
                  value={formData.applicantName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
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
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    duplicates.phone.found ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  }`}
                  placeholder="(555) 123-4567"
                />
                <DuplicateWarning field="phone" data={duplicates.phone} label="Teléfono" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección de la Propiedad
                </label>
                <input
                  type="text"
                  name="propertyAddress"
                  value={formData.propertyAddress}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    duplicates.address.found || addressCheck.status === 'has_budget' ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  }`}
                  placeholder="123 Main St, City, FL 12345"
                />
                {checkingDuplicates && (
                  <p className="text-xs text-gray-400 mt-1">🔍 Verificando...</p>
                )}
                <DuplicateWarning field="address" data={duplicates.address} label="Dirección" />
                {!duplicates.address.found && addressCheck.status === 'has_budget' && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                    <p className="text-sm font-semibold text-amber-800">⚠️ Esta dirección ya tiene un presupuesto activo</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Cliente: <strong>{addressCheck.permit?.applicantName}</strong>
                      {addressCheck.permit?.applicantPhone && <> · {addressCheck.permit.applicantPhone}</>}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">Considera usar <strong>Follow-Up Budgets</strong> en lugar de crear un nuevo lead.</p>
                  </div>
                )}
                {!duplicates.address.found && addressCheck.status === 'clear' && formData.propertyAddress.trim().length > 5 && (
                  <p className="text-xs text-green-600 mt-1">✅ Dirección disponible</p>
                )}
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas Iniciales
                </label>
                <MentionTextarea
                  value={formData.notes}
                  onChange={(value) => setFormData(prev => ({ ...prev, notes: value }))}
                  placeholder="Additional information about the lead... (Use @ to mention someone)"
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* Recordatorio */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="hasReminder"
                name="hasReminder"
                checked={formData.hasReminder}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="hasReminder" className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <BellIcon className="h-5 w-5" />
                Crear recordatorio para seguimiento
              </label>
            </div>

            {formData.hasReminder && (
              <div className="ml-6 space-y-4 bg-blue-50 p-4 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha del recordatorio *
                  </label>
                  <input
                    type="date"
                    name="reminderDate"
                    value={formData.reminderDate}
                    onChange={handleChange}
                    required={formData.hasReminder}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    📅 El recordatorio se creará automáticamente a las 9:00 AM
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notificar a: (opcional - por defecto se notifica al creador)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {staffList.map((staff) => (
                      <div
                        key={staff.id}
                        onClick={() => handleStaffToggle(staff.id)}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          formData.reminderStaff.includes(staff.id)
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.reminderStaff.includes(staff.id)}
                          onChange={() => {}}
                          className="pointer-events-none"
                        />
                        <span className="text-sm truncate">{staff.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Creating...' : 'Create Lead'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/sales-leads')}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewLeadForm;
