import React, { useState, useEffect } from 'react';
import { 
  PencilIcon, 
  XMarkIcon, 
  CheckIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  DocumentTextIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import api from '../../utils/axios';
import CountyInput from '../Common/CountyInput';

const LegacyMaintenanceEditor = () => {
  const [legacyWorks, setLegacyWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Estado para edición
  const [editingWork, setEditingWork] = useState(null);
  const [editFormData, setEditFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    systemType: '',
    isPBTS: false,
    county: '',
    permitId: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Estados para upload de PDFs - Ahora se guardan en memoria hasta hacer submit
  const [permitPdfFile, setPermitPdfFile] = useState(null);
  const [optionalDocsFile, setOptionalDocsFile] = useState(null);

  // Cargar trabajos legacy al montar
  useEffect(() => {
    loadLegacyWorks();
  }, []);

  const loadLegacyWorks = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/legacy-maintenance');
      if (response.data && response.data.data) {
        setLegacyWorks(response.data.data);
      }
    } catch (err) {
      console.error('Error al cargar trabajos legacy:', err);
      setError(err.response?.data?.message || 'Error al cargar los trabajos legacy');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (work) => {
    setEditingWork(work);
    setEditFormData({
      clientName: work.Permit?.applicantName || '',
      clientEmail: work.Permit?.applicantEmail || '',
      clientPhone: work.Permit?.applicantPhone || '',
      systemType: work.Permit?.systemType || 'ATU',
      isPBTS: work.Permit?.isPBTS || false,
      county: work.county || work.Permit?.county || '',
      notes: work.notes || ''
    });
    setSaveError('');
    // Resetear archivos seleccionados
    setPermitPdfFile(null);
    setOptionalDocsFile(null);
  };

  const handleCancelEdit = () => {
    setEditingWork(null);
    setEditFormData({
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      systemType: 'ATU',
      isPBTS: false,
      county: '',
      permitId: '',
      notes: ''
    });
    setSaveError('');
    // Resetear archivos seleccionados
    setPermitPdfFile(null);
    setOptionalDocsFile(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');

    const savingSteps = [];
    let allSuccess = true;

    try {
      // 🔵 PASO 1: Guardar datos del cliente y trabajo
      console.log('� [PASO 1/3] Guardando datos del cliente...');
      savingSteps.push('Guardando datos del cliente');

      const response = await api.put(`/legacy-maintenance/${editingWork.idWork}`, {
        clientName: editFormData.clientName,
        clientEmail: editFormData.clientEmail,
        clientPhone: editFormData.clientPhone,
        systemType: editFormData.systemType,
        isPBTS: editFormData.isPBTS,
        county: editFormData.county,
        notes: editFormData.notes
      });

      if (response.data.error) {
        throw new Error(response.data.message || 'Error al guardar datos del cliente');
      }

      console.log('✅ [PASO 1/3] Datos del cliente guardados');

      // 🔵 PASO 2: Subir Permit PDF si fue seleccionado
      if (permitPdfFile && editingWork?.Permit?.idPermit) {
        console.log('🔵 [PASO 2/3] Subiendo Permit PDF...');
        savingSteps.push('Subiendo PDF del Permit');

        const formDataToSend = new FormData();
        formDataToSend.append('pdfData', permitPdfFile);

        try {
          const pdfResponse = await api.put(
            `/permit/${editingWork.Permit.idPermit}/replace-pdf`, 
            formDataToSend,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          );
          console.log('✅ [PASO 2/3] Permit PDF subido exitosamente');
        } catch (pdfError) {
          console.error('❌ [PASO 2/3] Error al subir Permit PDF:', pdfError);
          
          // Manejar error específico de tamaño
          const errorData = pdfError.response?.data;
          if (errorData?.error && errorData?.sizeMB) {
            savingSteps.push(`⚠️ PDF muy grande (${errorData.sizeMB} MB, máx: ${errorData.maxSizeMB} MB)`);
          } else {
            savingSteps.push('⚠️ Error al subir Permit PDF');
          }
          allSuccess = false;
        }
      } else {
        console.log('⏭️ [PASO 2/3] No hay Permit PDF para subir');
      }

      // 🔵 PASO 3: Subir Optional Docs si fueron seleccionados
      if (optionalDocsFile && editingWork?.Permit?.idPermit) {
        console.log('� [PASO 3/3] Subiendo Optional Docs...');
        savingSteps.push('Subiendo documentos opcionales');

        const formDataToSend = new FormData();
        formDataToSend.append('optionalDocs', optionalDocsFile);

        try {
          const docsResponse = await api.put(
            `/permit/${editingWork.Permit.idPermit}/replace-optional-docs`,
            formDataToSend,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          );
          console.log('✅ [PASO 3/3] Optional Docs subidos exitosamente');
        } catch (docsError) {
          console.error('❌ [PASO 3/3] Error al subir Optional Docs:', docsError);
          
          // Manejar error específico de tamaño
          const errorData = docsError.response?.data;
          if (errorData?.error && errorData?.sizeMB) {
            savingSteps.push(`⚠️ Documento muy grande (${errorData.sizeMB} MB, máx: ${errorData.maxSizeMB} MB)`);
          } else {
            savingSteps.push('⚠️ Error al subir documentos opcionales');
          }
          allSuccess = false;
        }
      } else {
        console.log('⏭️ [PASO 3/3] No hay Optional Docs para subir');
      }

      // 🟢 RECARGAR datos y mostrar confirmación
      await loadLegacyWorks();

      // Actualizar la lista local
      setLegacyWorks(prev => prev.map(work => 
        work.idWork === editingWork.idWork ? response.data.data : work
      ));

      // Mensaje de confirmación detallado
      let successMessage = '';
      
      if (allSuccess) {
        successMessage = '✅ Todos los cambios se guardaron correctamente:\n\n' + 
          `• Datos del cliente actualizados\n` +
          (permitPdfFile ? '• PDF del Permit subido\n' : '') +
          (optionalDocsFile ? '• Documentos opcionales subidos\n' : '');
      } else {
        // Mostrar qué archivos fallaron específicamente
        const failedSteps = savingSteps.filter(step => step.includes('⚠️'));
        successMessage = '⚠️ Los datos del cliente se guardaron correctamente.\n\n' +
          'Sin embargo, hubo problemas al subir los siguientes archivos:\n\n' +
          failedSteps.join('\n') + 
          '\n\nPor favor, comprime los archivos PDF y vuelve a intentarlo.';
      }

      alert(successMessage);
      
      // Cerrar el formulario de edición
      handleCancelEdit();

    } catch (err) {
      console.error('🔴 Error al guardar:', err);
      setSaveError(err.response?.data?.message || err.message || 'Error al guardar los cambios');
      alert('❌ Error: ' + (err.response?.data?.message || err.message || 'No se pudieron guardar los cambios'));
    } finally {
      setSaving(false);
    }
  };

  // Seleccionar Permit PDF (NO se sube automáticamente)
  const handlePermitPdfChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('⚠️ Solo se permiten archivos PDF');
        e.target.value = '';
        return;
      }
      console.log('📎 Permit PDF seleccionado:', file.name, '(', (file.size / 1024).toFixed(2), 'KB)');
      setPermitPdfFile(file);
    }
  };

  // Seleccionar Optional Docs (NO se suben automáticamente)
  const handleOptionalDocsChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('⚠️ Solo se permiten archivos PDF');
        e.target.value = '';
        return;
      }
      console.log('📎 Optional Docs seleccionado:', file.name, '(', (file.size / 1024).toFixed(2), 'KB)');
      setOptionalDocsFile(file);
    }
  };

  const isPlaceholder = (value) => {
    return value?.includes('⚠️') || value?.includes('editar@') || value?.includes('000-000');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando trabajos legacy...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center mb-2">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-2" />
            <h2 className="text-lg font-semibold text-red-800">Error</h2>
          </div>
          <p className="text-red-700">{error}</p>
          <button
            onClick={loadLegacyWorks}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Editor de Trabajos de Mantenimiento
          </h1>
          <p className="text-blue-100">
            Gestiona todos los trabajos de mantenimiento ({legacyWorks.length} total)
          </p>
          <div className="mt-4 flex items-center gap-4 text-sm text-blue-100">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 mr-1" />
              <span>            Con placeholder: {legacyWorks.filter(w => isPlaceholder(w.Permit?.applicantName)).length}</span>
            </div>
            <div className="flex items-center">
              <CheckIcon className="h-5 w-5 mr-1" />
              <span>            Completados: {legacyWorks.filter(w => !isPlaceholder(w.Permit?.applicantName)).length}</span>
            </div>
            <div className="flex items-center text-yellow-200">
              🏷️ Legacy: {legacyWorks.filter(w => w.isLegacy).length}
            </div>
          </div>
        </div>
      </div>

      {/* Lista de trabajos */}
      <div className="max-w-7xl mx-auto space-y-4">
        {legacyWorks.map((work) => {
          const isEditing = editingWork?.idWork === work.idWork;
          const needsEditing = isPlaceholder(work.Permit?.applicantName); // ✅ Leer del Permit

          return (
            <div
              key={work.idWork}
              className={`bg-white rounded-lg shadow-md overflow-hidden transition-all ${
                needsEditing ? 'border-2 border-orange-400' : 'border border-gray-200'
              }`}
            >
              {/* Header del trabajo */}
              <div className={`px-6 py-4 flex items-center justify-between ${
                needsEditing ? 'bg-orange-50' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-3">
                  <HomeIcon className="h-6 w-6 text-gray-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {work.propertyAddress}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <span className="flex items-center">
                        <CalendarDaysIcon className="h-4 w-4 mr-1" />
                        Visita: {work.scheduledDate ? new Date(work.scheduledDate + 'T12:00:00').toLocaleDateString('es-ES') : 'N/A'}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Work #{work.idWork}
                      </span>
                      {work.isLegacy && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded font-medium">
                          🏷️ Legacy
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {needsEditing && (
                  <div className="flex items-center text-orange-600 text-sm font-medium">
                    <ExclamationTriangleIcon className="h-5 w-5 mr-1" />
                    Requiere edición
                  </div>
                )}

                {!isEditing && (
                  <button
                    onClick={() => handleEdit(work)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <PencilIcon className="h-4 w-4" />
                    Editar
                  </button>
                )}
              </div>

              {/* Contenido */}
              {isEditing ? (
                // Formulario de edición
                <form onSubmit={handleSave} className="p-6 space-y-4">
                  {saveError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{saveError}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Nombre del cliente */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <UserIcon className="h-4 w-4 inline mr-1" />
                        Nombre del Cliente *
                      </label>
                      <input
                        type="text"
                        name="clientName"
                        value={editFormData.clientName}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nombre completo"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <EnvelopeIcon className="h-4 w-4 inline mr-1" />
                        Email *
                      </label>
                      <input
                        type="email"
                        name="clientEmail"
                        value={editFormData.clientEmail}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="email@ejemplo.com"
                      />
                    </div>

                    {/* Teléfono */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <PhoneIcon className="h-4 w-4 inline mr-1" />
                        Teléfono *
                      </label>
                      <input
                        type="tel"
                        name="clientPhone"
                        value={editFormData.clientPhone}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="239-555-1234"
                      />
                    </div>

                    {/* County */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        County
                      </label>
                      <CountyInput
                        value={editFormData.county}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Tipo de Sistema - Solo ATU para mantenimiento */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ⚙️ Tipo de Sistema *
                      </label>
                      <select
                        name="systemType"
                        value={editFormData.systemType || 'ATU'}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50"
                      >
                        <option value="ATU">ATU</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Los trabajos de mantenimiento solo aplican a sistemas ATU
                      </p>
                    </div>

                  </div>

                  {/* Checkbox PBTS */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="isPBTS"
                        checked={editFormData.isPBTS}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, isPBTS: e.target.checked }))}
                        className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm font-medium text-purple-900">
                        🔬 Este sistema es PBTS
                      </span>
                    </label>
                    <p className="text-xs text-purple-600 mt-2 ml-8">
                      Marca esta opción si el sistema requiere muestreo de well points
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Permit Info - SOLO LECTURA */}
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <DocumentTextIcon className="h-4 w-4 inline mr-1" />
                      Permit Vinculado (por dirección)
                    </label>
                    <p className="text-sm text-gray-700">
                      <strong>Permit #:</strong> {work.Permit?.permitNumber || 'No disponible'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      ID: {work.Permit?.idPermit || 'No vinculado'}
                    </p>
                    <p className="text-xs text-gray-500">
                      ℹ️ El Permit está vinculado automáticamente por la dirección de la propiedad
                    </p>
                  </div>
                  </div>

                  {/* Notas */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <DocumentTextIcon className="h-4 w-4 inline mr-1" />
                      Notas
                    </label>
                    <textarea
                      name="notes"
                      value={editFormData.notes}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Notas adicionales sobre este trabajo..."
                    />
                  </div>

                  {/* Upload de PDFs del Permit - Se guardan TODO junto */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-md font-semibold text-gray-800 mb-3">📄 Documentos del Permit</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Seleccionar Permit PDF (pdfData) */}
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          📋 PDF del Permit (Site Plan)
                        </label>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handlePermitPdfChange}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                        />
                        {permitPdfFile && (
                          <div className="mt-2 flex items-center text-blue-700 text-sm font-medium bg-blue-100 p-2 rounded-lg">
                            <CheckIcon className="h-5 w-5 mr-2" />
                            Seleccionado: {permitPdfFile.name} ({(permitPdfFile.size / 1024).toFixed(2)} KB)
                          </div>
                        )}
                        {!permitPdfFile && work.Permit?.pdfDataUrl && (
                          <a
                            href={work.Permit.pdfDataUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block mt-2 text-xs text-blue-600 hover:underline"
                          >
                            📄 Ver PDF actual
                          </a>
                        )}
                      </div>

                      {/* Seleccionar Optional Docs */}
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          📎 Documentos Opcionales
                        </label>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handleOptionalDocsChange}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"
                        />
                        {optionalDocsFile && (
                          <div className="mt-2 flex items-center text-green-700 text-sm font-medium bg-green-100 p-2 rounded-lg">
                            <CheckIcon className="h-5 w-5 mr-2" />
                            Seleccionado: {optionalDocsFile.name} ({(optionalDocsFile.size / 1024).toFixed(2)} KB)
                          </div>
                        )}
                        {!optionalDocsFile && work.Permit?.optionalDocsUrl && (
                          <a
                            href={work.Permit.optionalDocsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block mt-2 text-xs text-green-600 hover:underline"
                          >
                            📄 Ver docs actuales
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Instrucciones claras */}
                    <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">
                        💡 <strong>Instrucciones:</strong>
                      </p>
                      <ul className="text-xs text-yellow-700 mt-2 space-y-1 ml-4 list-disc">
                        <li>Selecciona los PDFs que quieras actualizar</li>
                        <li>Completa o modifica los datos del cliente</li>
                        <li>Presiona <strong>"Guardar Todo"</strong> para subir los cambios juntos</li>
                        <li>Los archivos NO se suben hasta que presiones el botón</li>
                      </ul>
                    </div>
                  </div>

                  {/* Botones */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span className="font-semibold">Guardando Todo...</span>
                        </>
                      ) : (
                        <>
                          <CheckIcon className="h-5 w-5" />
                          <span className="font-semibold">
                            Guardar Todo {(permitPdfFile || optionalDocsFile) && '(Datos + PDFs)'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                // Vista de datos actuales
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Cliente</label>
                    <p className={`mt-1 text-sm ${isPlaceholder(work.Permit?.applicantName) ? 'text-orange-600 font-medium' : 'text-gray-900'}`}>
                      {work.Permit?.applicantName || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                    <p className={`mt-1 text-sm ${isPlaceholder(work.Permit?.applicantEmail) ? 'text-orange-600 font-medium' : 'text-gray-900'}`}>
                      {work.Permit?.applicantEmail || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Teléfono</label>
                    <p className={`mt-1 text-sm ${isPlaceholder(work.Permit?.applicantPhone) ? 'text-orange-600 font-medium' : 'text-gray-900'}`}>
                      {work.Permit?.applicantPhone || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Tipo de Sistema</label>
                    <p className={`mt-1 text-sm ${!work.Permit?.systemType ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                      {work.Permit?.systemType || '⚠️ NO DEFINIDO'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">¿Es PBTS?</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {work.Permit?.isPBTS ? '✅ Sí' : '❌ No'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Permit</label>
                    <p className="mt-1 text-sm text-gray-900">
                      #{work.Permit?.idPermit} - {work.Permit?.permitNumber}
                    </p>
                  </div>
                  {work.notes && (
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-gray-500 uppercase">Notas</label>
                      <p className="mt-1 text-sm text-gray-900">{work.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {legacyWorks.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <HomeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No hay trabajos de mantenimiento cargados</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LegacyMaintenanceEditor;
