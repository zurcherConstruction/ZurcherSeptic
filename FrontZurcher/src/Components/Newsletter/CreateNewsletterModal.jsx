import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaTimes, FaPaperPlane, FaEye, FaClock, FaUsers, FaImage, FaPlus, FaTrash } from 'react-icons/fa';
import { getAllTemplates, getAllSubscribers, createNewsletter, uploadNewsletterImage, getNewsletterImages, deleteNewsletterImage } from '../../Redux/Actions/newsletterActions';

const CreateNewsletterModal = ({ onClose, onCreated }) => {
  const dispatch = useDispatch();
  const [step, setStep] = useState(1); // 1: Form, 2: Preview, 3: Schedule
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  const { templates = { data: [] }, subscribers = { data: [] } } = useSelector(state => state.newsletter || {});

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    preheader: '',
    content: '',
    templateId: null,
    recipientFilter: 'all', // 'all', 'active', 'tags'
    selectedTags: [],
    // Programación
    sendType: 'now', // 'now', 'scheduled', 'recurring'
    scheduledDate: '',
    scheduledTime: '',
    // Recurrencia
    recurringFrequency: 'weekly', // 'daily', 'weekly', 'monthly'
    recurringDay: 1, // 1-7 para semanal, 1-31 para mensual
    recurringTime: '09:00',
    recurringEnabled: true
  });

  const [customContent, setCustomContent] = useState({
    greeting: true,
    title: '',
    subtitle: '',
    images: [],
    message: '',
    footerText: 'Gracias por ser parte de nuestra comunidad'
  });

  const [newImageUrl, setNewImageUrl] = useState('');
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { images = { data: [] } } = useSelector(state => state.newsletter || {});

  useEffect(() => {
    dispatch(getAllTemplates());
    dispatch(getAllSubscribers());
    // NO cargar imágenes automáticamente - solo cuando se abre la galería
  }, [dispatch]);

  // Obtener plantilla seleccionada
  const currentTemplate = templates.data?.find(t => t.id === formData.templateId);

  // Calcular destinatarios
  const getRecipients = () => {
    let filtered = subscribers.data || [];
    
    if (formData.recipientFilter === 'active') {
      filtered = filtered.filter(s => s.status === 'active');
    } else if (formData.recipientFilter === 'tags' && formData.selectedTags.length > 0) {
      filtered = filtered.filter(s => 
        s.tags && s.tags.some(tag => formData.selectedTags.includes(tag))
      );
    }
    
    return filtered;
  };

  const recipients = getRecipients();

  // Renderizar contenido para preview
  const renderPreviewContent = () => {
    if (currentTemplate) {
      // Usar plantilla seleccionada
      let html = currentTemplate.htmlContent || '';
      html = html.replace(/{{firstName}}/g, 'Juan');
      html = html.replace(/{{lastName}}/g, 'Pérez');
      html = html.replace(/{{email}}/g, 'ejemplo@email.com');
      return html;
    } else {
      // Usar contenido personalizado con formato visual
      let html = `
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; }
            .content { padding: 30px 20px; }
            .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
            .title { font-size: 28px; font-weight: bold; color: #1a3a5c; margin-bottom: 10px; }
            .subtitle { font-size: 18px; color: #666; margin-bottom: 30px; }
            .message { font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 30px; white-space: pre-wrap; }
            .image-block { margin: 20px 0; text-align: center; }
            .image-block img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
            .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
      `;

      if (customContent.greeting) {
        html += `<div class="greeting">Hola Juan,</div>`;
      }

      if (customContent.title) {
        html += `<div class="title">${customContent.title}</div>`;
      }

      if (customContent.subtitle) {
        html += `<div class="subtitle">${customContent.subtitle}</div>`;
      }

      if (customContent.images && customContent.images.length > 0) {
        customContent.images.forEach(imageUrl => {
          html += `<div class="image-block"><img src="${imageUrl}" alt="Newsletter image" /></div>`;
        });
      }

      if (customContent.message) {
        html += `<div class="message">${customContent.message}</div>`;
      }

      html += `
            </div>
            <div class="footer">
              ${customContent.footerText}
              <br/><br/>
              <a href="#">Desuscribirse</a>
            </div>
          </div>
        </body>
        </html>
      `;

      return html;
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5MB');
      return;
    }

    try {
      setUploadingImage(true);
      const result = await dispatch(uploadNewsletterImage(file));
      setCustomContent({
        ...customContent,
        images: [...customContent.images, result.url]
      });
      alert('Imagen subida exitosamente');
    } catch (error) {
      alert('Error al subir imagen: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSelectFromGallery = (imageUrl) => {
    if (!customContent.images.includes(imageUrl)) {
      setCustomContent({
        ...customContent,
        images: [...customContent.images, imageUrl]
      });
    }
    setShowImageGallery(false);
  };

  const handleOpenGallery = async () => {
    setShowImageGallery(true);
    // Cargar imágenes solo cuando se abre la galería
    if (!images.data || images.data.length === 0) {
      await dispatch(getNewsletterImages());
    }
  };

  const handleDeleteImage = async (publicId) => {
    if (window.confirm('¿Eliminar esta imagen de la galería?')) {
      try {
        await dispatch(deleteNewsletterImage(publicId));
        alert('Imagen eliminada');
      } catch (error) {
        alert('Error al eliminar imagen');
      }
    }
  };

  const handleSubmit = async () => {
    try {
      const newsletterData = {
        name: formData.name,
        subject: formData.subject,
        htmlContent: currentTemplate ? currentTemplate.htmlContent : renderPreviewContent(),
        textContent: currentTemplate ? currentTemplate.textContent : customContent.message,
        templateId: formData.templateId,
        recipientCount: recipients.length,
        // Programación - Convertir hora de Florida a UTC
        scheduledAt: formData.sendType === 'scheduled' 
          ? (() => {
              // Crear fecha en hora local de Florida
              const dateStr = `${formData.scheduledDate}T${formData.scheduledTime}:00`;
              const localDate = new Date(dateStr);
              // Convertir a UTC (JavaScript ya maneja esto automáticamente)
              return localDate.toISOString();
            })()
          : null,
        // Metadata para recurrencia y filtros
        metadata: {
          ...(formData.sendType === 'recurring' ? {
            recurring: true,
            frequency: formData.recurringFrequency,
            day: formData.recurringDay,
            time: formData.recurringTime,
            enabled: formData.recurringEnabled
          } : {}),
          recipientFilters: {
            filter: formData.recipientFilter,
            tags: formData.selectedTags
          }
        }
      };

      await dispatch(createNewsletter(newsletterData));
      onCreated?.();
      onClose();
    } catch (error) {
      alert('Error al crear newsletter: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">Crear Newsletter</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Steps */}
        <div className="flex border-b">
          <button
            onClick={() => setStep(1)}
            className={`flex-1 py-4 px-6 text-center border-b-2 transition-colors ${
              step === 1 ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-600'
            }`}
          >
            1. Contenido
          </button>
          <button
            onClick={() => setStep(2)}
            className={`flex-1 py-4 px-6 text-center border-b-2 transition-colors ${
              step === 2 ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-600'
            }`}
          >
            <FaEye className="inline mr-2" />
            2. Preview
          </button>
          <button
            onClick={() => setStep(3)}
            className={`flex-1 py-4 px-6 text-center border-b-2 transition-colors ${
              step === 3 ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-600'
            }`}
          >
            <FaClock className="inline mr-2" />
            3. Programar
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Contenido */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Nombre de la campaña *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="Ej: Newsletter Semanal - Enero 2026"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Asunto del email *</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="Ej: Novedades de la semana"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Preheader (texto previo)</label>
                <input
                  type="text"
                  value={formData.preheader}
                  onChange={(e) => setFormData({ ...formData, preheader: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="Texto que aparece después del asunto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Plantilla</label>
                <select
                  value={formData.templateId || ''}
                  onChange={(e) => setFormData({ ...formData, templateId: e.target.value || null })}
                  className="w-full border rounded-lg px-4 py-2"
                >
                  <option value="">Diseño personalizado</option>
                  {(templates.data || []).map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} - {template.subject}
                    </option>
                  ))}
                </select>
              </div>

              {!formData.templateId && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold mb-4">Diseño Personalizado</h3>
                  
                  <div className="space-y-4">
                    {/* Saludo personalizado */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customContent.greeting}
                          onChange={(e) => setCustomContent({ ...customContent, greeting: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">Incluir saludo personalizado</span>
                      </label>
                      <p className="text-xs text-gray-600 mt-1 ml-6">
                        Muestra: "Hola {'{'}firstName{'}'}," al inicio
                      </p>
                    </div>

                    {/* Título */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Título (opcional)</label>
                      <input
                        type="text"
                        value={customContent.title}
                        onChange={(e) => setCustomContent({ ...customContent, title: e.target.value })}
                        className="w-full border rounded-lg px-4 py-2"
                        placeholder="Título principal del newsletter"
                      />
                    </div>

                    {/* Subtítulo */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Subtítulo (opcional)</label>
                      <input
                        type="text"
                        value={customContent.subtitle}
                        onChange={(e) => setCustomContent({ ...customContent, subtitle: e.target.value })}
                        className="w-full border rounded-lg px-4 py-2"
                        placeholder="Subtítulo o descripción"
                      />
                    </div>

                    {/* Imágenes */}
                    <div className="border rounded-lg p-3">
                      <label className="block text-sm font-medium mb-2">Imágenes (una debajo de otra)</label>
                      
                      {customContent.images.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {customContent.images.map((img, index) => (
                            <div key={index} className="flex items-center gap-2 bg-white p-2 rounded">
                              <img src={img} alt={`Preview ${index}`} className="w-12 h-12 object-cover rounded" />
                              <span className="text-xs flex-1 truncate">{img}</span>
                              <button
                                type="button"
                                onClick={() => setCustomContent({...customContent, images: customContent.images.filter((_, i) => i !== index)})}
                                className="text-red-600 hover:text-red-800"
                              >
                                <FaTrash size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={uploadingImage}
                          />
                          <div className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2 text-sm">
                            {uploadingImage ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                Subiendo...
                              </>
                            ) : (
                              <>
                                <FaPlus /> Subir
                              </>
                            )}
                          </div>
                        </label>
                        
                        <button
                          type="button"
                          onClick={handleOpenGallery}
                          className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 flex items-center justify-center gap-2 text-sm"
                        >
                          <FaImage /> Galería
                        </button>
                      </div>
                    </div>

                    {/* Mensaje */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Mensaje</label>
                      <textarea
                        rows="5"
                        value={customContent.message}
                        onChange={(e) => setCustomContent({ ...customContent, message: e.target.value })}
                        className="w-full border rounded-lg px-4 py-2"
                        placeholder="Contenido principal del newsletter..."
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div>
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <FaEye className="inline mr-2" />
                  Vista previa de cómo recibirán el email los suscriptores
                </p>
              </div>
              
              <div className="border rounded-lg p-4 bg-white overflow-auto max-h-[500px]">
                <div dangerouslySetInnerHTML={{ __html: renderPreviewContent() }} />
              </div>
            </div>
          )}

          {/* Step 3: Programación */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Destinatarios */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FaUsers /> Destinatarios
                  </h3>
                  <span className="text-2xl font-bold text-blue-600">{recipients.length}</span>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recipientFilter"
                      value="all"
                      checked={formData.recipientFilter === 'all'}
                      onChange={(e) => setFormData({ ...formData, recipientFilter: e.target.value })}
                    />
                    <span>Todos los suscriptores ({(subscribers.data || []).length})</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recipientFilter"
                      value="active"
                      checked={formData.recipientFilter === 'active'}
                      onChange={(e) => setFormData({ ...formData, recipientFilter: e.target.value })}
                    />
                    <span>Solo activos ({(subscribers.data || []).filter(s => s.status === 'active').length})</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recipientFilter"
                      value="tags"
                      checked={formData.recipientFilter === 'tags'}
                      onChange={(e) => setFormData({ ...formData, recipientFilter: e.target.value })}
                    />
                    <span>Por tags</span>
                  </label>

                  {formData.recipientFilter === 'tags' && (
                    <div className="ml-6 space-y-2">
                      {['budget', 'work', 'sales_lead', 'permit'].map(tag => (
                        <label key={tag} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.selectedTags.includes(tag)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, selectedTags: [...formData.selectedTags, tag] });
                              } else {
                                setFormData({ ...formData, selectedTags: formData.selectedTags.filter(t => t !== tag) });
                              }
                            }}
                          />
                          <span className="text-sm">{tag}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Envío */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FaClock /> Cuándo enviar
                </h3>

                <div className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sendType"
                      value="now"
                      checked={formData.sendType === 'now'}
                      onChange={(e) => setFormData({ ...formData, sendType: e.target.value })}
                    />
                    <span>Enviar ahora (guardar como borrador)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sendType"
                      value="scheduled"
                      checked={formData.sendType === 'scheduled'}
                      onChange={(e) => setFormData({ ...formData, sendType: e.target.value })}
                    />
                    <span>Programar envío único</span>
                  </label>

                  {formData.sendType === 'scheduled' && (
                    <div className="ml-6 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-1">Fecha</label>
                        <input
                          type="date"
                          value={formData.scheduledDate}
                          onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Hora (Orlando, FL)</label>
                        <select
                          value={formData.scheduledTime}
                          onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        >
                          <option value="">Seleccionar hora</option>
                          <option value="09:00">9:00 AM</option>
                          <option value="12:00">12:00 PM (Mediodía)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sendType"
                      value="recurring"
                      checked={formData.sendType === 'recurring'}
                      onChange={(e) => setFormData({ ...formData, sendType: e.target.value })}
                    />
                    <span className="font-semibold text-purple-600">Envío recurrente automático</span>
                  </label>

                  {formData.sendType === 'recurring' && (
                    <div className="ml-6 space-y-4 border-l-4 border-purple-500 pl-4 bg-purple-50 p-4 rounded">
                      <div>
                        <label className="block text-sm font-medium mb-2">Frecuencia</label>
                        <select
                          value={formData.recurringFrequency}
                          onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        >
                          <option value="daily">Diario</option>
                          <option value="weekly">Semanal</option>
                          <option value="monthly">Mensual</option>
                        </select>
                      </div>

                      {formData.recurringFrequency === 'weekly' && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Día de la semana</label>
                          <select
                            value={formData.recurringDay}
                            onChange={(e) => setFormData({ ...formData, recurringDay: parseInt(e.target.value) })}
                            className="w-full border rounded px-3 py-2"
                          >
                            <option value="1">Lunes</option>
                            <option value="2">Martes</option>
                            <option value="3">Miércoles</option>
                            <option value="4">Jueves</option>
                            <option value="5">Viernes</option>
                            <option value="6">Sábado</option>
                            <option value="7">Domingo</option>
                          </select>
                        </div>
                      )}

                      {formData.recurringFrequency === 'monthly' && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Día del mes</label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={formData.recurringDay}
                            onChange={(e) => setFormData({ ...formData, recurringDay: parseInt(e.target.value) })}
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium mb-2">Hora de envío</label>
                        <input
                          type="time"
                          value={formData.recurringTime}
                          onChange={(e) => setFormData({ ...formData, recurringTime: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>

                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <p className="text-sm text-yellow-800">
                          ⚡ Este newsletter se enviará automáticamente según la programación. 
                          Puedes pausarlo o cancelarlo desde la lista de newsletters.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 border rounded-lg hover:bg-gray-100"
          >
            Cancelar
          </button>

          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-2 border rounded-lg hover:bg-gray-100"
              >
                Anterior
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={!formData.name || !formData.subject}
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <FaPaperPlane />
                {formData.sendType === 'recurring' ? 'Activar Envíos Automáticos' : 
                 formData.sendType === 'scheduled' ? 'Programar Envío' : 
                 'Guardar Borrador'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Galería de Imágenes */}
      {showImageGallery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-bold">Galería de Imágenes</h3>
              <button onClick={() => setShowImageGallery(false)}>
                <FaTimes className="text-gray-600 hover:text-gray-800" size={24} />
              </button>
            </div>

            <div className="p-6">
              {images.loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : images.data.length === 0 ? (
                <div className="text-center py-12">
                  <FaImage className="text-6xl text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No hay imágenes en la galería</p>
                  <p className="text-sm text-gray-500 mt-2">Sube tu primera imagen usando el botón "Subir"</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {images.data.map((image) => (
                    <div key={image.publicId} className="relative group">
                      <img
                        src={image.url}
                        alt="Gallery"
                        className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-75 transition"
                        onClick={() => handleSelectFromGallery(image.url)}
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImage(image.publicId);
                          }}
                          className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 rounded-b-lg opacity-0 group-hover:opacity-100 transition">
                        <p className="text-xs truncate">{image.width}x{image.height}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowImageGallery(false)}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateNewsletterModal;
