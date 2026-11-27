import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  XMarkIcon,
  PaperAirplaneIcon,
  UserGroupIcon,
  PhotoIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import { fetchUniqueRecipients, sendCampaign } from '../../Redux/Actions/marketingCampaignsActions';
import api from '../../utils/axios';

// Galería de imágenes predefinidas para fechas especiales
const PREDEFINED_IMAGES = [
  {
    id: 'christmas',
    name: 'Christmas',
    url: 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1733500000/christmas_campaign.jpg',
    category: 'holiday'
  },
  {
    id: 'newyear',
    name: 'New Year',
    url: 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1733500000/newyear_campaign.jpg',
    category: 'holiday'
  },
  {
    id: 'thanksgiving',
    name: 'Thanksgiving',
    url: 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1733500000/thanksgiving_campaign.jpg',
    category: 'holiday'
  },
  {
    id: 'independence',
    name: '4th of July',
    url: 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1733500000/july4_campaign.jpg',
    category: 'holiday'
  },
  {
    id: 'promo',
    name: 'Promotional',
    url: 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1774963095/flayer1_c1hnl4.jpg',
    category: 'promotional'
  }
];

const DEFAULT_MESSAGE = `Dear {{NAME}},

Season's greetings from Zurcher Septic!

As we celebrate this special time of year, we want to take a moment to thank you for choosing us for your septic system needs. Your trust means the world to us.

We wish you and your family a wonderful holiday season filled with joy and happiness.

If you need any septic services in the future, we're always here to help!

Best regards,
The Zurcher Septic Team`;

const SendCampaignModal = ({ onClose, onSent }) => {
  const dispatch = useDispatch();
  const { recipients, recipientsCount, loading: loadingRecipients } = useSelector((state) => state.marketingCampaigns);
  
  const [step, setStep] = useState(1); // 1: Form, 2: Preview, 3: Sending, 4: Complete
  const [loading, setLoading] = useState(false);
  const [excludedEmails, setExcludedEmails] = useState(new Set());
  const [showRecipientsList, setShowRecipientsList] = useState(false);
  const [imageSource, setImageSource] = useState('predefined'); // 'predefined' | 'upload' | 'none'
  const [selectedPredefinedImage, setSelectedPredefinedImage] = useState(PREDEFINED_IMAGES[4].url);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    campaignName: '',
    subject: 'Special Message from Zurcher Septic',
    emailTitle: 'Season\'s Greetings!',
    message: DEFAULT_MESSAGE,
    campaignType: 'holiday',
    titleColor: '#1a3a5c',
    titleFont: 'Playfair Display'
  });

  const [error, setError] = useState('');
  const [sendProgress, setSendProgress] = useState(0);
  
  // Estados para Google Fonts
  const [googleFonts, setGoogleFonts] = useState([]);
  const [fontSearchTerm, setFontSearchTerm] = useState('');
  const [loadingFonts, setLoadingFonts] = useState(false);
  const [showCustomColor, setShowCustomColor] = useState(false);

  // Cargar destinatarios únicos al montar
  useEffect(() => {
    dispatch(fetchUniqueRecipients());
  }, [dispatch]);

  // Cargar Google Fonts desde la API
  useEffect(() => {
    const loadGoogleFonts = async () => {
      setLoadingFonts(true);
      
      // Lista curada de fuentes populares de Google Fonts (sin necesidad de API key)
      const popularFonts = [
        // Serif
        { family: 'Playfair Display', category: 'serif' },
        { family: 'Lora', category: 'serif' },
        { family: 'Merriweather', category: 'serif' },
        { family: 'Crimson Text', category: 'serif' },
        { family: 'PT Serif', category: 'serif' },
        { family: 'Libre Baskerville', category: 'serif' },
        { family: 'Bitter', category: 'serif' },
        { family: 'Cardo', category: 'serif' },
        { family: 'EB Garamond', category: 'serif' },
        { family: 'Vollkorn', category: 'serif' },
        
        // Sans-serif
        { family: 'Montserrat', category: 'sans-serif' },
        { family: 'Raleway', category: 'sans-serif' },
        { family: 'Poppins', category: 'sans-serif' },
        { family: 'Roboto', category: 'sans-serif' },
        { family: 'Open Sans', category: 'sans-serif' },
        { family: 'Oswald', category: 'sans-serif' },
        { family: 'Nunito', category: 'sans-serif' },
        { family: 'Quicksand', category: 'sans-serif' },
        { family: 'Work Sans', category: 'sans-serif' },
        { family: 'Rubik', category: 'sans-serif' },
        { family: 'Inter', category: 'sans-serif' },
        { family: 'Manrope', category: 'sans-serif' },
        { family: 'DM Sans', category: 'sans-serif' },
        { family: 'Archivo', category: 'sans-serif' },
        
        // Display
        { family: 'Bebas Neue', category: 'display' },
        { family: 'Anton', category: 'display' },
        { family: 'Lobster', category: 'display' },
        { family: 'Pacifico', category: 'display' },
        { family: 'Dancing Script', category: 'handwriting' },
        { family: 'Great Vibes', category: 'handwriting' },
        
        // Monospace
        { family: 'Roboto Mono', category: 'monospace' },
        { family: 'Source Code Pro', category: 'monospace' }
      ];
      
      setGoogleFonts(popularFonts);
      setLoadingFonts(false);
    };

    loadGoogleFonts();
  }, []);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleExcludeEmail = (email) => {
    setExcludedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(email)) {
        newSet.delete(email);
      } else {
        newSet.add(email);
      }
      return newSet;
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB max
      setError('La imagen no puede superar 5MB');
      return;
    }

    setUploadingImage(true);
    setError('');

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('files', file);
      uploadFormData.append('folder', 'marketing_campaigns'); // Carpeta específica para campañas de marketing

      const response = await api.post('/gallery/upload', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success && response.data.uploaded && response.data.uploaded.length > 0) {
        setUploadedImage(response.data.uploaded[0].url);
        setImageSource('upload');
      } else {
        setError('Error: No se pudo obtener la URL de la imagen subida');
      }
    } catch (error) {
      console.error('Error al subir imagen:', error);
      setError('Error al subir la imagen. Intenta nuevamente.');
    } finally {
      setUploadingImage(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleSubmit = async () => {
    setError('');

    // Validaciones
    if (!formData.subject.trim()) {
      setError('El asunto es requerido');
      return;
    }

    if (!formData.message.trim()) {
      setError('El mensaje es requerido');
      return;
    }

    const finalRecipients = recipients.filter(r => !excludedEmails.has(r.email));
    
    if (finalRecipients.length === 0) {
      setError('Debes incluir al menos un destinatario');
      return;
    }

    if (imageSource === 'upload' && !uploadedImage) {
      setError('Subí una imagen o elegí "Sin imagen"');
      return;
    }

    setStep(3); // Ir a paso de envío
    setLoading(true);

    try {
      const imageUrl = getCurrentImage();

      const campaignPayload = {
        ...formData,
        imageUrl,
        recipients: finalRecipients,
        excludedEmails: Array.from(excludedEmails)
      };

      const result = await dispatch(sendCampaign(campaignPayload)).unwrap();

      if (result.success) {
        // Simular progreso (el envío es en segundo plano)
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          setSendProgress(progress);
          if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setStep(4); // Completado
              setLoading(false);
            }, 500);
          }
        }, 300);
      }
    } catch (error) {
      console.error('Error al enviar campaña:', error);
      setError(error || 'Error al enviar la campaña');
      setLoading(false);
      setStep(1); // Volver al formulario
    }
  };

  const getActiveRecipientCount = () => {
    return recipients.length - excludedEmails.size;
  };

  // Imagen que se va a mandar (null = email sin imagen)
  const getCurrentImage = () => {
    if (imageSource === 'none') return null;
    if (imageSource === 'upload') return uploadedImage || null;
    return selectedPredefinedImage;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a3a5c] to-[#2563a8] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-xl">📧 Nueva Campaña de Email</h2>
            <p className="text-blue-200 text-sm mt-1">
              {step === 1 && 'Paso 1: Editar mensaje'}
              {step === 2 && 'Paso 2: Revisar y confirmar'}
              {step === 3 && 'Enviando campaña...'}
              {step === 4 && 'Campaña enviada'}
            </p>
          </div>
          {step !== 3 && step !== 4 && (
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
              <XMarkIcon className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* STEP 1: Form */}
          {step === 1 && (
            <div className="space-y-6">
              
              {/* Recipients count */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                <UserGroupIcon className="h-8 w-8 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-blue-900">
                    {loadingRecipients ? (
                      'Cargando destinatarios...'
                    ) : (
                      `${getActiveRecipientCount()} destinatarios únicos`
                    )}
                  </p>
                  <p className="text-sm text-blue-700">
                    De Budgets, Works, Sales Leads y Permits
                  </p>
                </div>
              </div>

              {/* Recipients List - Expandible */}
              {!loadingRecipients && recipients.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowRecipientsList(!showRecipientsList)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      👥 Ver lista de destinatarios ({recipients.length})
                    </span>
                    {showRecipientsList ? (
                      <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                    )}
                  </button>

                  {showRecipientsList && (
                    <div className="p-4 bg-white max-h-64 overflow-y-auto">
                      <div className="space-y-2">
                        {recipients.map((recipient, index) => (
                          <label
                            key={index}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                              excludedEmails.has(recipient.email)
                                ? 'bg-red-50 hover:bg-red-100'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={!excludedEmails.has(recipient.email)}
                              onChange={() => toggleExcludeEmail(recipient.email)}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {recipient.name || 'Sin nombre'}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {recipient.email}
                              </p>
                            </div>
                            {excludedEmails.has(recipient.email) && (
                              <span className="text-xs text-red-600 font-medium">Excluido</span>
                            )}
                          </label>
                        ))}
                      </div>
                      
                      {excludedEmails.size > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <button
                            type="button"
                            onClick={() => setExcludedEmails(new Set())}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            ✓ Incluir todos nuevamente
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Campaign Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Campaña <span className="text-gray-400">(Interno)</span>
                </label>
                <input
                  type="text"
                  name="campaignName"
                  value={formData.campaignName}
                  onChange={handleChange}
                  placeholder="ej: Christmas 2026, Spring Promo"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Campaign Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Campaña
                </label>
                <select
                  name="campaignType"
                  value={formData.campaignType}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="holiday">🎄 Festivo</option>
                  <option value="promotional">🎁 Promocional</option>
                  <option value="seasonal">🍂 Estacional</option>
                  <option value="informational">ℹ️ Informativo</option>
                  <option value="other">📋 Otro</option>
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asunto del Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  placeholder="ej: Happy Holidays from Zurcher Septic!"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Email Title (destacado en el email) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ✨ Título Destacado en el Email
                </label>
                <input
                  type="text"
                  name="emailTitle"
                  value={formData.emailTitle}
                  onChange={handleChange}
                  placeholder="ej: Season's Greetings!"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 Este título aparecerá grande y destacado al inicio del email
                </p>
              </div>

              {/* Title Color Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🎨 Color del Título
                </label>
                
                {/* Presets de colores */}
                <div className="flex gap-3 flex-wrap mb-3">
                  {[
                    { name: 'Azul Oscuro', color: '#1a3a5c' },
                    { name: 'Verde', color: '#047857' },
                    { name: 'Rojo', color: '#dc2626' },
                    { name: 'Dorado', color: '#ca8a04' },
                    { name: 'Púrpura', color: '#7c3aed' },
                    { name: 'Negro', color: '#000000' }
                  ].map((colorOption) => (
                    <button
                      key={colorOption.color}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, titleColor: colorOption.color }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                        formData.titleColor === colorOption.color
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full border-2 border-white shadow"
                        style={{ backgroundColor: colorOption.color }}
                      />
                      <span className="text-xs font-medium text-gray-700">{colorOption.name}</span>
                    </button>
                  ))}
                </div>

                {/* Color Picker Personalizado */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="color"
                      value={formData.titleColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, titleColor: e.target.value }))}
                      className="w-12 h-12 rounded cursor-pointer border-2 border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Color personalizado</span>
                  </label>
                  <input
                    type="text"
                    value={formData.titleColor}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(value) || value === '#') {
                        setFormData(prev => ({ ...prev, titleColor: value }));
                      }
                    }}
                    placeholder="#000000"
                    className="px-3 py-2 border border-gray-300 rounded text-sm font-mono uppercase w-28"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Title Font Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🔤 Fuente del Título {loadingFonts && <span className="text-xs text-gray-500">(Cargando...)</span>}
                </label>
                
                {/* Buscador de fuentes */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={fontSearchTerm}
                    onChange={(e) => setFontSearchTerm(e.target.value)}
                    placeholder="🔍 Buscar fuente..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Grid de fuentes filtradas */}
                <div className="max-h-64 overflow-y-auto border rounded-lg p-2 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {googleFonts
                      .filter(font => 
                        font.family.toLowerCase().includes(fontSearchTerm.toLowerCase())
                      )
                      .map((fontOption) => {
                        const isSelected = formData.titleFont === fontOption.family;
                        return (
                          <button
                            key={fontOption.family}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, titleFont: fontOption.family }));
                              // Cargar la fuente dinámicamente
                              if (!document.querySelector(`link[href*="${fontOption.family.replace(/ /g, '+')}"]`)) {
                                const link = document.createElement('link');
                                link.href = `https://fonts.googleapis.com/css2?family=${fontOption.family.replace(/ /g, '+')}:wght@700&display=swap`;
                                link.rel = 'stylesheet';
                                document.head.appendChild(link);
                              }
                            }}
                            className={`px-3 py-2.5 rounded-lg border-2 transition-all text-left ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300 hover:border-gray-400 bg-white'
                            }`}
                          >
                            <div 
                              className="text-sm font-medium text-gray-900 truncate" 
                              style={{ fontFamily: `'${fontOption.family}', ${fontOption.category}` }}
                            >
                              {fontOption.family}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{fontOption.category}</div>
                          </button>
                        );
                      })}
                  </div>
                  {googleFonts.filter(font => 
                    font.family.toLowerCase().includes(fontSearchTerm.toLowerCase())
                  ).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No se encontraron fuentes</p>
                    </div>
                  )}
                </div>
                
                {/* Fuente seleccionada */}
                {formData.titleFont && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700 font-medium mb-1">Fuente seleccionada:</p>
                    <p 
                      className="text-lg font-bold text-blue-900"
                      style={{ fontFamily: `'${formData.titleFont}', serif` }}
                    >
                      {formData.titleFont}
                    </p>
                  </div>
                )}
              </div>

              {/* Message */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Mensaje <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, message: DEFAULT_MESSAGE }))}
                    className="text-xs text-blue-500 hover:text-blue-700 underline"
                  >
                    Restaurar mensaje por defecto
                  </button>
                </div>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={10}
                  placeholder="Escribe tu mensaje aquí... Usa {{NAME}} para insertar el nombre del cliente"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 Tip: Usa <code className="bg-gray-100 px-1 rounded">{'{{NAME}}'}</code> para personalizar con el nombre del cliente
                </p>
              </div>

              {/* Image Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Imagen de la Campaña
                </label>

                {/* Toggle between predefined and upload */}
                <div className="flex gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setImageSource('predefined')}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      imageSource === 'predefined'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <PhotoIcon className="h-5 w-5 inline mr-2" />
                    Galería
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSource('upload')}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      imageSource === 'upload'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Subir Nueva
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSource('none')}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      imageSource === 'none'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    🚫 Sin imagen
                  </button>
                </div>

                {imageSource === 'none' ? (
                  <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    El email se enviará solo con el título y el mensaje, sin imagen.
                  </p>
                ) : imageSource === 'predefined' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {PREDEFINED_IMAGES.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setSelectedPredefinedImage(img.url)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                          selectedPredefinedImage === img.url
                            ? 'border-blue-500 ring-2 ring-blue-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={img.url}
                          alt={img.name}
                          className="w-full h-24 object-cover"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/200x150?text=Image';
                          }}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-xs py-1 px-2 text-center">
                          {img.name}
                        </div>
                        {selectedPredefinedImage === img.url && (
                          <div className="absolute top-1 right-1">
                            <CheckCircleIcon className="h-6 w-6 text-blue-500 bg-white rounded-full" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <ArrowPathIcon className="h-8 w-8 text-blue-600 mx-auto animate-spin mb-2" />
                      ) : (
                        <PhotoIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      )}
                      <p className="text-sm text-gray-600">
                        {uploadingImage ? 'Subiendo...' : 'Click para subir una imagen'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG hasta 5MB</p>
                    </button>

                    {uploadedImage && (
                      <div className="mt-4 relative inline-block">
                        <img
                          src={uploadedImage}
                          alt="Uploaded"
                          className="max-h-32 rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => setUploadedImage(null)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Preview selected image */}
              {getCurrentImage() && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Vista previa de la imagen:</p>
                  <img
                    src={getCurrentImage()}
                    alt="Preview"
                    className="max-h-40 rounded-lg border border-gray-300"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/400x200?text=No+Image';
                    }}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Preview & Confirm */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-yellow-900">Confirma antes de enviar</p>
                  <p className="text-sm text-yellow-700">
                    Esta acción enviará {getActiveRecipientCount()} emails. Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>

              {/* Vista Previa del Email */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">📧 Vista Previa del Email</h3>
                
                {/* Email Preview Container */}
                <div className="border-2 border-gray-300 rounded-xl overflow-hidden shadow-lg bg-gray-50 p-4">
                  <div className="max-w-xl mx-auto bg-white shadow-md rounded-lg overflow-hidden">
                    
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#1a3a5c] to-[#2563a8] px-6 py-8 text-center">
                      <div className="text-white font-bold text-2xl" style={{ fontFamily: 'Georgia, serif' }}>
                        Zurcher Septic
                      </div>
                    </div>

                    {/* Content */}
                    <div className="px-8 py-8">
                      {/* Email Title */}
                      {formData.emailTitle && (
                        <>
                          <h1 
                            className="text-3xl font-bold text-center mb-6"
                            style={{ 
                              color: formData.titleColor,
                              fontFamily: `'${formData.titleFont}', serif`,
                              lineHeight: '1.2'
                            }}
                          >
                            {formData.emailTitle}
                          </h1>
                          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent mb-6"></div>
                        </>
                      )}

                      {/* Message */}
                      <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap mb-6">
                        {formData.message.replace('{{NAME}}', 'John Doe')}
                      </div>

                      {/* Image */}
                      {getCurrentImage() && (
                        <div className="text-center my-6">
                          <img 
                            src={getCurrentImage()} 
                            alt="Campaign" 
                            className="max-h-48 rounded-lg mx-auto shadow-md"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {/* CTA Button */}
                      <div className="text-center mt-8">
                        <button className="bg-gradient-to-r from-[#1a3a5c] to-[#2563a8] text-white px-8 py-3 rounded-lg font-semibold text-sm shadow-md">
                          Visit Our Website
                        </button>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-100 px-6 py-6 text-center text-xs text-gray-600 border-t">
                      <p className="font-semibold text-sm mb-2">Zurcher Septic</p>
                      <p>Septic System Installation & Maintenance</p>
                      <p className="mt-2">📧 admin@zurcherseptic.com | 📞 Contact Us</p>
                      <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent my-3 max-w-xs mx-auto"></div>
                      <p className="text-gray-400 text-xs">
                        You're receiving this email because you're a valued customer.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumen de datos */}
              <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                <h3 className="font-semibold text-gray-900 mb-3">📊 Resumen de la Campaña</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Asunto:</p>
                    <p className="font-semibold text-gray-900">{formData.subject}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Destinatarios:</p>
                    <p className="font-semibold text-gray-900">{getActiveRecipientCount()} contactos</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Tipo:</p>
                    <p className="font-semibold text-gray-900">{formData.campaignType}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Color del título:</p>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full border-2 border-white shadow"
                        style={{ backgroundColor: formData.titleColor }}
                      ></div>
                      <span className="text-xs text-gray-600">{formData.titleColor}</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 mb-1">Fuente del título:</p>
                    <p 
                      className="font-bold text-lg text-gray-900"
                      style={{ fontFamily: `'${formData.titleFont}', serif` }}
                    >
                      {formData.titleFont}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Sending */}
          {step === 3 && (
            <div className="text-center py-12">
              <ArrowPathIcon className="h-16 w-16 text-blue-600 mx-auto animate-spin mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Enviando campaña...</h3>
              <p className="text-gray-600 mb-6">
                Enviando a {getActiveRecipientCount()} destinatarios
              </p>
              <div className="max-w-md mx-auto">
                <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${sendProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2">{sendProgress}%</p>
              </div>
            </div>
          )}

          {/* STEP 4: Complete */}
          {step === 4 && (
            <div className="text-center py-12">
              <CheckCircleIcon className="h-20 w-20 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">¡Campaña Enviada!</h3>
              <p className="text-gray-600 mb-2">
                Los emails están siendo enviados en segundo plano.
              </p>
              <p className="text-sm text-gray-500">
                Puedes revisar el estado en el historial de campañas.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step <= 2 && (
          <div className="border-t px-6 py-4 flex gap-3 bg-gray-50 flex-shrink-0">
            {step === 1 && (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={loadingRecipients || getActiveRecipientCount() === 0}
                  className="flex-1 bg-gradient-to-r from-[#1a3a5c] to-[#2563a8] text-white px-4 py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Continuar →
                </button>
              </>
            )}
            {step === 2 && (
              <>
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                >
                  ← Volver
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                  Enviar Campaña
                </button>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="border-t px-6 py-4 bg-gray-50 flex-shrink-0">
            <button
              onClick={() => {
                onSent();
                onClose();
              }}
              className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SendCampaignModal;
