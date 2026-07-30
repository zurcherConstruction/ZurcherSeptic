import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';

const EditPermitFieldsModal = ({ permitId, onClose, onSuccess }) => {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const token = useSelector((state) => state.auth.token);

  const [formData, setFormData] = useState({
    permitNumber: '',
    lot: '',
    block: '',
    systemType: '',
    isPBTS: false,
    drainfieldDepth: '',
    gpdCapacity: '',
    excavationRequired: '',
    squareFeetSystem: '',
    pump: '',
    expirationDate: '',
    applicant: '',
    applicantName: '',
    applicantPhone: '',
    applicantEmail: '',
    propertyAddress: '',
    notificationEmails: [],
    // 🆕 Campos PPI Part 1
    ppiPropertyOwnerEmail: 'admin@zurcherseptic.com',
    ppiPropertyOwnerPhone: '(954) 636-8200',
    // 🆕 Campos PPI Part 2
    city: '',
    state: 'FL',
    zipCode: '',
    ppiStreetAddress: '',
    subdivision: '',
    unit: '',
    section: '',
    township: '',
    range: '',
    parcelNo: '',
    applicationNo: '',
    // 🆕 Campos PPI Part 3
    ppiAuthorizationType: 'initial',
    // 🆕 Campos PPI Part 4 - Inspector Data
    ppiInspectorName: '',
    ppiInspectorBusiness: '',
    ppiInspectorEmail: '',
    ppiInspectorPhone: '',
    ppiInspectorMailingAddress: '',
    ppiInspectorCity: '',
    ppiInspectorState: 'FL',
    ppiInspectorZipCode: '',
    ppiInspectorQualificationType: '',
    ppiInspectorLicenseNumber: '',
  });

  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [generatingPPI, setGeneratingPPI] = useState(false); // 🆕 Estado para generar PPI
  
  // 🆕 Estados para validación en tiempo real
  const [permitNumberValidation, setPermitNumberValidation] = useState({ 
    status: 'idle', // idle, checking, valid, duplicate, error
    message: '' 
  });
  const [propertyAddressValidation, setPropertyAddressValidation] = useState({ 
    status: 'idle',
    message: '' 
  });
  const [permitNumberCheckTimeout, setPermitNumberCheckTimeout] = useState(null);
  const [propertyAddressCheckTimeout, setPropertyAddressCheckTimeout] = useState(null);
  const [originalPermitNumber, setOriginalPermitNumber] = useState('');
  const [originalPropertyAddress, setOriginalPropertyAddress] = useState('');

  // Cargar datos actuales del Permit
  useEffect(() => {
    loadPermitData();
  }, [permitId]);

  const loadPermitData = async () => {
    setLoadingData(true);
    setError('');

    try {
      const response = await axios.get(`${API_URL}/permit/${permitId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const permit = response.data;

      // Guardar valores originales para comparación
      setOriginalPermitNumber(permit.permitNumber || '');
      setOriginalPropertyAddress(permit.propertyAddress || '');

      setFormData({
        permitNumber: permit.permitNumber || '',
        lot: permit.lot || '',
        block: permit.block || '',
        systemType: permit.systemType || '',
        isPBTS: permit.isPBTS || false,
        drainfieldDepth: permit.drainfieldDepth || '',
        gpdCapacity: permit.gpdCapacity || '',
        excavationRequired: permit.excavationRequired || '',
        squareFeetSystem: permit.squareFeetSystem || '',
        pump: permit.pump || '',
        expirationDate: permit.expirationDate || '',
        applicant: permit.applicant || '',
        applicantName: permit.applicantName || '',
        applicantPhone: permit.applicantPhone || '',
        applicantEmail: permit.applicantEmail || '',
        propertyAddress: permit.propertyAddress || '',
        notificationEmails: permit.notificationEmails || [],
        // 🆕 Campos PPI Part 1
        ppiPropertyOwnerEmail: permit.ppiPropertyOwnerEmail || 'admin@zurcherseptic.com',
        ppiPropertyOwnerPhone: permit.ppiPropertyOwnerPhone || '(941) 505-5104',
        // 🆕 Campos PPI Part 2
        city: permit.city || '',
        state: permit.state || 'FL',
        zipCode: permit.zipCode || '',
        ppiStreetAddress: permit.ppiStreetAddress || '',
        subdivision: permit.subdivision || '',
        unit: permit.unit || '',
        section: permit.section || '',
        township: permit.township || '',
        range: permit.range || '',
        parcelNo: permit.parcelNo || '',
        applicationNo: permit.applicationNo || '',
        // 🆕 Campos PPI Part 3
        ppiAuthorizationType: permit.ppiAuthorizationType || 'initial',
        // 🆕 Campos PPI Part 4 - Inspector Data
        ppiInspectorName: permit.ppiInspectorName || '',
        ppiInspectorBusiness: permit.ppiInspectorBusiness || '',
        ppiInspectorEmail: permit.ppiInspectorEmail || '',
        ppiInspectorPhone: permit.ppiInspectorPhone || '',
        ppiInspectorMailingAddress: permit.ppiInspectorMailingAddress || '',
        ppiInspectorCity: permit.ppiInspectorCity || '',
        ppiInspectorState: permit.ppiInspectorState || 'FL',
        ppiInspectorZipCode: permit.ppiInspectorZipCode || '',
        ppiInspectorQualificationType: permit.ppiInspectorQualificationType || '',
        ppiInspectorLicenseNumber: permit.ppiInspectorLicenseNumber || '',
      });
    } catch (err) {
      console.error('Error loading permit:', err);
      setError('Error al cargar datos del Permit');
    } finally {
      setLoadingData(false);
    }
  };

  // 🆕 Validar Permit Number en tiempo real
  const validatePermitNumber = async (permitNumber) => {
    // Si está vacío o es igual al original, no validar
    if (!permitNumber || permitNumber.trim() === '' || permitNumber.trim() === originalPermitNumber) {
      setPermitNumberValidation({ status: 'idle', message: '' });
      return;
    }

    setPermitNumberValidation({ status: 'checking', message: '🔍 Verificando...' });

    try {
      const response = await axios.get(
        `${API_URL}/permit/check-permit-number/${encodeURIComponent(permitNumber.trim())}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.exists) {
        setPermitNumberValidation({ 
          status: 'duplicate', 
          message: `❌ Este número ya existe` 
        });
      } else {
        setPermitNumberValidation({ 
          status: 'valid', 
          message: '✅ Número disponible' 
        });
      }
    } catch (err) {
      console.error('Error validating permit number:', err);
      setPermitNumberValidation({ 
        status: 'error', 
        message: '⚠️ Error al verificar' 
      });
    }
  };

  // 🆕 Validar Property Address en tiempo real
  const validatePropertyAddress = async (propertyAddress) => {
    // Si está vacío o es igual al original, no validar
    if (!propertyAddress || propertyAddress.trim() === '' || propertyAddress.trim() === originalPropertyAddress) {
      setPropertyAddressValidation({ status: 'idle', message: '' });
      return;
    }

    setPropertyAddressValidation({ status: 'checking', message: '🔍 Verificando...' });

    try {
      const response = await axios.get(
        `${API_URL}/permit/check-by-address?propertyAddress=${encodeURIComponent(propertyAddress.trim())}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.exists) {
        setPropertyAddressValidation({ 
          status: 'duplicate', 
          message: `❌ Esta dirección ya existe` 
        });
      } else {
        setPropertyAddressValidation({ 
          status: 'valid', 
          message: '✅ Dirección disponible' 
        });
      }
    } catch (err) {
      // Si es 404, la dirección no existe (disponible)
      if (err.response?.status === 404) {
        setPropertyAddressValidation({ 
          status: 'valid', 
          message: '✅ Dirección disponible' 
        });
      } else {
        console.error('Error validating property address:', err);
        setPropertyAddressValidation({ 
          status: 'error', 
          message: '⚠️ Error al verificar' 
        });
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // 🆕 Validar Permit Number con debounce
    if (name === 'permitNumber') {
      // Cancelar timeout anterior
      if (permitNumberCheckTimeout) {
        clearTimeout(permitNumberCheckTimeout);
      }
      
      // Crear nuevo timeout
      const timeoutId = setTimeout(() => {
        validatePermitNumber(value);
      }, 800);
      
      setPermitNumberCheckTimeout(timeoutId);
    }

    // 🆕 Validar Property Address con debounce
    if (name === 'propertyAddress') {
      // Cancelar timeout anterior
      if (propertyAddressCheckTimeout) {
        clearTimeout(propertyAddressCheckTimeout);
      }
      
      // Crear nuevo timeout
      const timeoutId = setTimeout(() => {
        validatePropertyAddress(value);
      }, 800);
      
      setPropertyAddressCheckTimeout(timeoutId);
    }
  };

  const handleAddEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!newEmail.trim()) {
      setError('Por favor ingrese un email');
      return;
    }

    if (!emailRegex.test(newEmail)) {
      setError('Por favor ingrese un email válido');
      return;
    }

    if (formData.notificationEmails.includes(newEmail.trim())) {
      setError('Este email ya está en la lista');
      return;
    }

    setFormData(prev => ({
      ...prev,
      notificationEmails: [...prev.notificationEmails, newEmail.trim()]
    }));
    setNewEmail('');
    setError('');
  };

  const handleRemoveEmail = (emailToRemove) => {
    setFormData(prev => ({
      ...prev,
      notificationEmails: prev.notificationEmails.filter(e => e !== emailToRemove)
    }));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    // 🆕 Validar duplicados antes de enviar
    if (permitNumberValidation.status === 'duplicate') {
      setError('❌ No se puede usar un número de permit duplicado');
      setLoading(false);
      return;
    }

    if (propertyAddressValidation.status === 'duplicate') {
      setError('❌ No se puede usar una dirección duplicada');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.patch(
        `${API_URL}/permit/${permitId}/fields`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setSuccessMessage('✅ Permit actualizado correctamente');
        setTimeout(() => {
          onSuccess(response.data.permit);
        }, 1000);
      }
    } catch (err) {
      console.error('Error updating permit:', err);
      
      // Mostrar mensaje específico según el campo
      const errorMsg = err.response?.data?.message || 'Error al actualizar Permit';
      const errorField = err.response?.data?.field;
      
      if (errorField === 'permitNumber') {
        setError('❌ ' + errorMsg + ' - Por favor use otro número de permit.');
      } else if (errorField === 'propertyAddress') {
        setError('❌ ' + errorMsg + ' - Esta dirección ya existe en otro permit.');
      } else {
        setError('❌ ' + errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // 🆕 Generar PPI
  const handleGeneratePPI = async () => {
    if (!window.confirm('¿Generar Pre-Permit Inspection (PPI) para este permit?')) {
      return;
    }

    setGeneratingPPI(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await axios.post(
        `${API_URL}/permit/${permitId}/ppi/generate`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setSuccessMessage(`✅ PPI generado exitosamente: ${response.data.fileName}`);
        alert(`✅ PPI generado exitosamente\n\nArchivo: ${response.data.fileName}\n\nEl PPI ha sido guardado en Cloudinary.`);
        
        // 🆕 Recargar datos para mostrar el PPI generado
        await loadPermitData();
        
        // 🆕 Notificar al componente padre para refrescar (con anti-caché)
        if (onSuccess) {
          onSuccess({ timestamp: Date.now() });
        }
      }
    } catch (err) {
      console.error('Error al generar PPI:', err);
      const errorMsg = err.response?.data?.message || 'Error al generar PPI';
      setError('❌ ' + errorMsg);
      alert(`❌ Error al generar PPI: ${errorMsg}`);
    } finally {
      setGeneratingPPI(false);
    }
  };

  if (loadingData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p className="text-gray-600">Cargando datos del Permit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-xl font-semibold">Editar Campos del Permit</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl"
            disabled={loading}
          >
            ×
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {successMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Identificación */}
          <section className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">📋 Identificación</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permit Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="permitNumber"
                  value={formData.permitNumber}
                  onChange={handleInputChange}
                  onBlur={() => {
                    // Validar al perder el foco
                    if (formData.permitNumber && formData.permitNumber.trim() !== originalPermitNumber) {
                      validatePermitNumber(formData.permitNumber);
                    }
                  }}
                  required
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    permitNumberValidation.status === 'duplicate'
                      ? 'border-red-500 bg-red-50 focus:ring-red-500'
                      : permitNumberValidation.status === 'valid'
                      ? 'border-green-500 bg-green-50 focus:ring-green-500'
                      : permitNumberValidation.status === 'checking'
                      ? 'border-blue-500 bg-blue-50 focus:ring-blue-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {permitNumberValidation.message && (
                  <p className={`mt-1 text-xs ${
                    permitNumberValidation.status === 'duplicate'
                      ? 'text-red-600'
                      : permitNumberValidation.status === 'valid'
                      ? 'text-green-600'
                      : permitNumberValidation.status === 'checking'
                      ? 'text-blue-600'
                      : 'text-gray-600'
                  }`}>
                    {permitNumberValidation.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lot
                </label>
                <input
                  type="text"
                  name="lot"
                  value={formData.lot}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Block
                </label>
                <input
                  type="text"
                  name="block"
                  value={formData.block}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          {/* Datos Técnicos */}
          <section className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">🔧 Datos Técnicos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  System Type
                </label>
                <select
                  name="systemType"
                  value={formData.systemType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="ATU">ATU</option>
                  <option value="GRVT">GRVT</option>
                  <option value="PBTS">PBTS</option>
                  <option value="AEROBIC">AEROBIC</option>
                </select>
              </div>

              {formData.systemType === 'ATU' && (
                <div className="flex items-center">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isPBTS"
                      checked={formData.isPBTS}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Is PBTS?</span>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Drainfield Depth
                </label>
                <input
                  type="text"
                  name="drainfieldDepth"
                  value={formData.drainfieldDepth}
                  onChange={handleInputChange}
                  placeholder="e.g., 36 inches"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GPD Capacity
                </label>
                <input
                  type="text"
                  name="gpdCapacity"
                  value={formData.gpdCapacity}
                  onChange={handleInputChange}
                  placeholder="e.g., 500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Excavation Required
                </label>
                <input
                  type="text"
                  name="excavationRequired"
                  value={formData.excavationRequired}
                  onChange={handleInputChange}
                  placeholder="e.g., 24 inches"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Square Feet System
                </label>
                <input
                  type="text"
                  name="squareFeetSystem"
                  value={formData.squareFeetSystem}
                  onChange={handleInputChange}
                  placeholder="e.g., 450"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pump
                </label>
                <input
                  type="text"
                  name="pump"
                  value={formData.pump}
                  onChange={handleInputChange}
                  placeholder="e.g., Effluent pump required"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          {/* Fechas */}
          <section className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">📅 Fechas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration Date
                </label>
                <input
                  type="date"
                  name="expirationDate"
                  value={formData.expirationDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          {/* Contacto */}
          <section className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">👤 Información de Contacto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applicant (para PPI) <span className="text-orange-600">★</span>
                </label>
                <input
                  type="text"
                  name="applicant"
                  value={formData.applicant}
                  onChange={handleInputChange}
                  placeholder="Ej: (Kargabi LLC)"
                  className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50"
                />
                <p className="mt-1 text-xs text-orange-600">
                  Este campo se usa en el documento PPI. Formato recomendado: (Nombre o Empresa)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applicant Name
                </label>
                <input
                  type="text"
                  name="applicantName"
                  value={formData.applicantName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="applicantPhone"
                  value={formData.applicantPhone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Address
                </label>
                <input
                  type="text"
                  name="propertyAddress"
                  value={formData.propertyAddress}
                  onChange={handleInputChange}
                  onBlur={() => {
                    // Validar al perder el foco
                    if (formData.propertyAddress && formData.propertyAddress.trim() !== originalPropertyAddress) {
                      validatePropertyAddress(formData.propertyAddress);
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    propertyAddressValidation.status === 'duplicate'
                      ? 'border-red-500 bg-red-50 focus:ring-red-500'
                      : propertyAddressValidation.status === 'valid'
                      ? 'border-green-500 bg-green-50 focus:ring-green-500'
                      : propertyAddressValidation.status === 'checking'
                      ? 'border-blue-500 bg-blue-50 focus:ring-blue-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {propertyAddressValidation.message && (
                  <p className={`mt-1 text-xs ${
                    propertyAddressValidation.status === 'duplicate'
                      ? 'text-red-600'
                      : propertyAddressValidation.status === 'valid'
                      ? 'text-green-600'
                      : propertyAddressValidation.status === 'checking'
                      ? 'text-blue-600'
                      : 'text-gray-600'
                  }`}>
                    {propertyAddressValidation.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Emails */}
          <section>
            <h3 className="text-lg font-semibold mb-4 text-gray-700">📧 Configuración de Emails</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Principal <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="applicantEmail"
                value={formData.applicantEmail}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Este email recibirá invoices y documentos para firma (SignNow)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Emails Adicionales (Notificaciones)
              </label>
              
              {/* Lista de emails */}
              {formData.notificationEmails.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 p-3 bg-gray-50 rounded-md">
                  {formData.notificationEmails.map((email, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(email)}
                        className="text-blue-600 hover:text-blue-800 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input para agregar email */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="nuevo@email.com"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddEmail}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Agregar
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Estos emails recibirán copias de las notificaciones (vendedores, managers, etc)
              </p>
            </div>
          </section>

          {/* 🆕 Sección PPI Part 1 - Applicant Information */}
          <section>
            <h3 className="text-lg font-semibold mb-4 text-gray-700">📋 PPI Part 1 - Applicant Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Owner Email (Zurcher)
                </label>
                <input
                  type="email"
                  name="ppiPropertyOwnerEmail"
                  value={formData.ppiPropertyOwnerEmail}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Owner Phone (Zurcher)
                </label>
                <input
                  type="tel"
                  name="ppiPropertyOwnerPhone"
                  value={formData.ppiPropertyOwnerPhone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Estos datos aparecen en Part 1 del PPI como Property Owner (Zurcher como empresa)
            </p>
          </section>

          {/* 🆕 Sección PPI Part 2 - Property Information */}
          <section>
            <h3 className="text-lg font-semibold mb-4 text-gray-700">🏠 PPI Part 2 - Property Information</h3>
            
            {/* Street Address para PPI */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Street Address (PPI)
                <span className="text-xs text-gray-500 ml-2">
                  (Se auto-parsea de Property Address, edita si es necesario)
                </span>
              </label>
              <input
                type="text"
                name="ppiStreetAddress"
                value={formData.ppiStreetAddress}
                onChange={handleInputChange}
                placeholder="Ej: 2607 49th St"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="Ej: Fort Myers"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  placeholder="FL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleInputChange}
                  placeholder="33976"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subdivision</label>
                <input
                  type="text"
                  name="subdivision"
                  value={formData.subdivision}
                  onChange={handleInputChange}
                  placeholder="N/A si no aplica"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  name="unit"
                  value={formData.unit}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                <input
                  type="text"
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Township</label>
                <input
                  type="text"
                  name="township"
                  value={formData.township}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Range</label>
                <input
                  type="text"
                  name="range"
                  value={formData.range}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parcel No.</label>
                <input
                  type="text"
                  name="parcelNo"
                  value={formData.parcelNo}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Application No. (if known)</label>
                <input
                  type="text"
                  name="applicationNo"
                  value={formData.applicationNo}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="PPI-2026-001"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Información de la propiedad para Part 2 del PPI
            </p>
          </section>

          {/* 🆕 Sección PPI Part 3 - Authorization Type */}
          <section>
            <h3 className="text-lg font-semibold mb-4 text-gray-700">✅ PPI Part 3 - Request Type</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Autorización
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-3 p-3 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="ppiAuthorizationType"
                    value="initial"
                    checked={formData.ppiAuthorizationType === 'initial'}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">
                    <strong>Initial:</strong> Autorización inicial para usar Inspector Privado (requiere fee)
                  </span>
                </label>
                <label className="flex items-center space-x-3 p-3 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="ppiAuthorizationType"
                    value="rescind"
                    checked={formData.ppiAuthorizationType === 'rescind'}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">
                    <strong>Rescind:</strong> Revocar autorización previa (inspección por Department, sin fee)
                  </span>
                </label>
                <label className="flex items-center space-x-3 p-3 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="ppiAuthorizationType"
                    value="amend"
                    checked={formData.ppiAuthorizationType === 'amend'}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">
                    <strong>Amend:</strong> Cambiar a diferente Inspector Privado (sin fee)
                  </span>
                </label>
              </div>
            </div>
          </section>

          {/* 🆕 Sección PPI Part 4 - Inspector Information */}
          <section>
            <h3 className="text-lg font-semibold mb-1 text-gray-700">🔍 PPI Part 4 - Private Provider Inspector</h3>
            <p className="text-xs text-gray-500 mb-4">
              Opcional — dejá vacío si el inspector lo completará. Estos datos se imprimen en la Sección 4 del PPI.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inspector Name</label>
                <input
                  type="text"
                  name="ppiInspectorName"
                  value={formData.ppiInspectorName}
                  onChange={handleInputChange}
                  placeholder="Full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business / Company</label>
                <input
                  type="text"
                  name="ppiInspectorBusiness"
                  value={formData.ppiInspectorBusiness}
                  onChange={handleInputChange}
                  placeholder="Business name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="ppiInspectorEmail"
                  value={formData.ppiInspectorEmail}
                  onChange={handleInputChange}
                  placeholder="inspector@email.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="ppiInspectorPhone"
                  value={formData.ppiInspectorPhone}
                  onChange={handleInputChange}
                  placeholder="(555) 000-0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mailing Address</label>
              <input
                type="text"
                name="ppiInspectorMailingAddress"
                value={formData.ppiInspectorMailingAddress}
                onChange={handleInputChange}
                placeholder="Street address"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  name="ppiInspectorCity"
                  value={formData.ppiInspectorCity}
                  onChange={handleInputChange}
                  placeholder="Fort Myers"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  name="ppiInspectorState"
                  value={formData.ppiInspectorState}
                  onChange={handleInputChange}
                  placeholder="FL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                <input
                  type="text"
                  name="ppiInspectorZipCode"
                  value={formData.ppiInspectorZipCode}
                  onChange={handleInputChange}
                  placeholder="33901"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualification Type</label>
                <select
                  name="ppiInspectorQualificationType"
                  value={formData.ppiInspectorQualificationType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select --</option>
                  <option value="CEHP">Certified Environmental Health Professional</option>
                  <option value="PE">Professional Engineer</option>
                  <option value="MSTC">Master Septic Tank Contractor</option>
                  <option value="PES">Professional Engineer Staff</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                <input
                  type="text"
                  name="ppiInspectorLicenseNumber"
                  value={formData.ppiInspectorLicenseNumber}
                  onChange={handleInputChange}
                  placeholder="PE12345"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || generatingPPI}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancelar
            </button>
            
            {/* 🆕 Botón Generar PPI */}
            <button
              type="button"
              onClick={handleGeneratePPI}
              disabled={loading || generatingPPI}
              className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 flex items-center gap-2"
            >
              {generatingPPI ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generando...
                </>
              ) : (
                '📋 Generar PPI'
              )}
            </button>
            
            <button
              type="submit"
              disabled={loading || generatingPPI}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPermitFieldsModal;
