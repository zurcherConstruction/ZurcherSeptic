import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaTimes, FaImage, FaEye, FaCalendar, FaPlus, FaTrash, FaClock, FaMobileAlt, FaTabletAlt, FaDesktop } from 'react-icons/fa';
import { 
  createNewsletter, 
  getAllSubscribers,
  uploadNewsletterImage,
  getNewsletterImages,
  deleteNewsletterImage
} from '../../Redux/Actions/newsletterActions';

const CreateNewsletterProModal = ({ isOpen, onClose, onSuccess, newsletterToEdit = null }) => {
  const dispatch = useDispatch();
  const { subscribers = { data: [] }, images = { data: [] } } = useSelector(state => state.newsletter || {});

  const isEditMode = !!newsletterToEdit;

  // Wizard steps
  const [currentStep, setCurrentStep] = useState(1);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    layout: '', // 'hero', 'magazine', 'gallery'
    backgroundColor: '#0f766e', // Verde por defecto
    titleColor: '#ffffff', // Color del título (blanco por defecto)
    titleFont: 'Playfair Display', // Fuente del título
    content: {
      title: '',
      subtitle: '',
      bodyText: '',
      images: [], // URLs de Cloudinary
      ctaText: 'Ver Más',
      ctaUrl: 'https://zurcherseptic.com'
    },
    recipientFilter: 'all', // 'all', 'active'
    scheduling: 'now', // 'now', 'scheduled', 'recurring'
    scheduledAt: '',
    recurringConfig: {
      frequency: 'daily', // 'daily', 'weekly', 'monthly'
      day: '1',
      time: '09:00'
    }
  });

  // UI state
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewDevice, setPreviewDevice] = useState('desktop'); // 'mobile', 'tablet', 'desktop'
  
  // Estados para Google Fonts
  const [googleFonts, setGoogleFonts] = useState([]);
  const [fontSearchTerm, setFontSearchTerm] = useState('');
  const [loadingFonts, setLoadingFonts] = useState(false);

  // Cargar Google Fonts al montar
  useEffect(() => {
    const loadGoogleFonts = () => {
      setLoadingFonts(true);
      
      // Lista curada de fuentes populares de Google Fonts
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

  useEffect(() => {
    if (isOpen) {
      dispatch(getAllSubscribers());
      
      // Si estamos editando, cargar los datos del newsletter
      if (newsletterToEdit) {
        const metadata = newsletterToEdit.metadata || {};
        setFormData({
          name: newsletterToEdit.name,
          subject: newsletterToEdit.subject,
          layout: metadata.layout || '',
          backgroundColor: metadata.backgroundColor || '#0f766e',
          titleColor: metadata.titleColor || '#ffffff',
          titleFont: metadata.titleFont || 'Playfair Display',
          content: metadata.content || {
            title: '',
            subtitle: '',
            bodyText: '',
            images: [],
            ctaText: 'Ver Más',
            ctaUrl: 'https://zurcherseptic.com'
          },
          recipientFilter: 'all',
          scheduling: metadata.recurring ? 'recurring' : (newsletterToEdit.scheduledAt ? 'scheduled' : 'now'),
          scheduledAt: newsletterToEdit.scheduledAt || '',
          recurringConfig: {
            frequency: metadata.frequency || 'daily',
            day: metadata.day || '1',
            time: metadata.time || '09:00'
          }
        });
      }
    }
  }, [isOpen, newsletterToEdit, dispatch]);

  // Generar HTML profesional del email
  const generateEmailHTML = () => {
    const { layout, backgroundColor, titleColor, titleFont, content } = formData;
    const { title, subtitle, bodyText, images, ctaText, ctaUrl } = content;

    // Convertir saltos de línea en <br> para respetar formato
    const formattedBodyText = bodyText ? bodyText.replace(/\n/g, '<br>') : '';

    // Colores corporativos
    const colors = {
      '#0f766e': { bg: '#0f766e', text: '#ffffff', button: '#059669' },
      '#445868': { bg: '#445868', text: '#ffffff', button: '#6b7280' },
      '#49465a': { bg: '#49465a', text: '#ffffff', button: '#6b7280' },
      '#f6d02c': { bg: '#f6d02c', text: '#000000', button: '#d4b929' },
      '#ffffff': { bg: '#ffffff', text: '#000000', button: '#0f766e' }
    };

    const colorScheme = colors[backgroundColor] || colors['#0f766e'];

    let contentHTML = '';

    if (layout === 'hero') {
      // Layout Hero: Imagen grande + Título + Texto + CTA
      contentHTML = `
        ${images[0] ? `
          <tr>
            <td style="padding: 20px; background-color: ${colorScheme.bg}; text-align: center;">
              <img src="${images[0]}" alt="Hero Image" style="width: 100%; max-width: 560px; height: auto; display: block; border-radius: 8px; margin: 0 auto;">
            </td>
          </tr>
        ` : ''}
        <tr>
          <td class="mobile-padding" style="padding: 40px 30px; background-color: ${colorScheme.bg};">
            ${title ? `<h1 style="margin: 0 0 16px 0; font-size: 32px; font-weight: bold; color: ${titleColor}; font-family: '${titleFont}', Arial, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</h1>` : ''}
            ${subtitle ? `<h2 style="margin: 0 0 24px 0; font-size: 20px; font-weight: normal; color: ${colorScheme.text}; opacity: 0.9; font-family: Arial, sans-serif;">${subtitle}</h2>` : ''}
            ${formattedBodyText ? `<p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: ${colorScheme.text}; font-family: Arial, sans-serif;">${formattedBodyText}</p>` : ''}
            ${ctaText && ctaUrl ? `
              <a href="${ctaUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${colorScheme.button}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; font-family: Arial, sans-serif;">${ctaText}</a>
            ` : ''}
          </td>
        </tr>
      `;
    } else if (layout === 'magazine') {
      // Layout Magazine: Texto arriba + 2 imágenes lado a lado
      contentHTML = `
        <tr>
          <td class="mobile-padding" style="padding: 40px 30px; background-color: ${colorScheme.bg};">
            ${title ? `<h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: bold; color: ${titleColor}; font-family: '${titleFont}', Arial, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</h1>` : ''}
            ${subtitle ? `<h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: normal; color: ${colorScheme.text}; opacity: 0.9; font-family: Arial, sans-serif;">${subtitle}</h2>` : ''}
            ${formattedBodyText ? `<p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: ${colorScheme.text}; font-family: Arial, sans-serif;">${formattedBodyText}</p>` : ''}
          </td>
        </tr>
        ${images.length > 0 ? `
          <tr>
            <td class="mobile-padding" style="padding: 0 30px 30px 30px; background-color: ${colorScheme.bg};">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0;">
                <tr>
                  ${images.slice(0, 2).map((img, idx) => `
                    <td style="width: ${images.length === 1 ? '100%' : '50%'}; padding: ${idx === 0 ? '0 8px 0 0' : '0 0 0 8px'};">
                      <img src="${img}" alt="Image ${idx + 1}" style="width: 100%; height: auto; display: block; border-radius: 6px;">
                    </td>
                  `).join('')}
                </tr>
              </table>
            </td>
          </tr>
        ` : ''}
        ${ctaText && ctaUrl ? `
          <tr>
            <td class="mobile-padding" style="padding: 0 30px 40px 30px; background-color: ${colorScheme.bg}; text-align: center;">
              <a href="${ctaUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${colorScheme.button}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; font-family: Arial, sans-serif;">${ctaText}</a>
            </td>
          </tr>
        ` : ''}
      `;
    } else if (layout === 'gallery') {
      // Layout Gallery: Grilla de imágenes 2x2 o 3x3
      const imagesPerRow = images.length <= 4 ? 2 : 3;
      const rows = [];
      
      for (let i = 0; i < images.length; i += imagesPerRow) {
        rows.push(images.slice(i, i + imagesPerRow));
      }

      contentHTML = `
        <tr>
          <td class="mobile-padding" style="padding: 40px 30px 24px 30px; background-color: ${colorScheme.bg}; text-align: center;">
            ${title ? `<h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: bold; color: ${titleColor}; font-family: '${titleFont}', Arial, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</h1>` : ''}
            ${subtitle ? `<h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: normal; color: ${colorScheme.text}; opacity: 0.9; font-family: Arial, sans-serif;">${subtitle}</h2>` : ''}
            ${formattedBodyText ? `<p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: ${colorScheme.text}; font-family: Arial, sans-serif;">${formattedBodyText}</p>` : ''}
          </td>
        </tr>
        ${rows.map(row => `
          <tr>
            <td class="mobile-padding" style="padding: 0 30px 16px 30px; background-color: ${colorScheme.bg};">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  ${row.map((img, idx) => `
                    <td style="width: ${100 / imagesPerRow}%; padding: ${idx === 0 ? '0 8px 0 0' : idx === row.length - 1 ? '0 0 0 8px' : '0 8px'};">
                      <img src="${img}" alt="Gallery Image" style="width: 100%; height: auto; display: block; border-radius: 6px;">
                    </td>
                  `).join('')}
                </tr>
              </table>
            </td>
          </tr>
        `).join('')}
        ${ctaText && ctaUrl ? `
          <tr>
            <td class="mobile-padding" style="padding: 16px 30px 40px 30px; background-color: ${colorScheme.bg}; text-align: center;">
              <a href="${ctaUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${colorScheme.button}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; font-family: Arial, sans-serif;">${ctaText}</a>
            </td>
          </tr>
        ` : ''}
      `;
    }

    // HTML completo
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${formData.subject}</title>
        <link href="https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@700&display=swap" rel="stylesheet">
        <style>
          @media only screen and (max-width: 600px) {
            .email-container {
              width: 100% !important;
              max-width: 100% !important;
            }
            .mobile-padding {
              padding: 20px 15px !important;
            }
            td[style*="padding"] {
              padding-left: 15px !important;
              padding-right: 15px !important;
            }
            h1 {
              font-size: 22px !important;
              line-height: 1.3 !important;
              white-space: normal !important;
            }
            h2 {
              font-size: 16px !important;
              line-height: 1.4 !important;
            }
            p {
              font-size: 14px !important;
              line-height: 1.5 !important;
            }
            a[style*="inline-block"] {
              padding: 12px 24px !important;
              font-size: 14px !important;
            }
            img[alt="Zurcher Septic Logo"] {
              height: 40px !important;
            }
            img {
              max-width: 100% !important;
              height: auto !important;
            }
            table[width="600"] {
              width: 100% !important;
            }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" class="email-container" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                ${contentHTML}
                
                <!-- Footer -->
                <tr>
                  <td class="mobile-padding" style="padding: 30px; background-color: #1f2937; text-align: center;">
                    <img src="https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751206826/logo_zlxdhw.png" alt="Zurcher Septic Logo" style="height: 50px; margin-bottom: 16px;" />
                    <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #ffffff; font-family: Arial, sans-serif;">Zurcher Septic</p>
                    <p style="margin: 0 0 20px 0; font-size: 14px; color: #9ca3af; font-family: Arial, sans-serif;">
                      <a href="mailto:admin@zurcherseptic.com" style="color: #60a5fa; text-decoration: none;">admin@zurcherseptic.com</a>
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 10px; color: #6b7280; font-family: Arial, sans-serif; opacity: 0.7;">If you no longer want to receive our updates, you can unsubscribe anytime.</p>
                    <a href="http://localhost:3001/newsletter/public-unsubscribe/{{subscriberId}}" style="display: inline-block; padding: 4px 12px; background-color: transparent; color: #6b7280; text-decoration: underline; font-size: 9px; font-family: Arial, sans-serif; opacity: 0.6;">Unsubscribe</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  };

  // Actualizar preview cuando cambie el contenido
  useEffect(() => {
    if (formData.layout) {
      setPreviewHtml(generateEmailHTML());
    }
  }, [formData]);

  const handleOpenGallery = async () => {
    setShowImageGallery(true);
    if (!images.data || images.data.length === 0) {
      await dispatch(getNewsletterImages());
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
      alert('La imagen debe ser menor a 5MB');
      return;
    }

    try {
      setUploadingImage(true);
      const result = await dispatch(uploadNewsletterImage(file));
      
      setFormData(prev => ({
        ...prev,
        content: {
          ...prev.content,
          images: [...prev.content.images, result.url]
        }
      }));
    } catch (error) {
      alert('Error al subir imagen: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSelectFromGallery = (imageUrl) => {
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        images: [...prev.content.images, imageUrl]
      }
    }));
    setShowImageGallery(false);
  };

  const handleRemoveImage = (index) => {
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        images: prev.content.images.filter((_, i) => i !== index)
      }
    }));
  };

  const handleDeleteImage = async (publicId) => {
    if (window.confirm('¿Eliminar esta imagen de la galería?')) {
      try {
        await dispatch(deleteNewsletterImage(publicId));
      } catch (error) {
        alert('Error al eliminar imagen');
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.subject || !formData.layout) {
      alert('Complete todos los campos requeridos');
      return;
    }

    try {
      const htmlContent = generateEmailHTML();
      const textContent = `${formData.content.title}\n\n${formData.content.subtitle}\n\n${formData.content.bodyText}`;

      const newsletterData = {
        name: formData.name,
        subject: formData.subject,
        htmlContent,
        textContent,
        recipientFilter: formData.recipientFilter,
        scheduledAt: formData.scheduling === 'scheduled' ? formData.scheduledAt : null,
        sendNow: false, // 🔧 NUNCA enviar automáticamente al crear - siempre guardar como borrador
        metadata: {
          layout: formData.layout,
          backgroundColor: formData.backgroundColor,
          titleColor: formData.titleColor,
          titleFont: formData.titleFont,
          content: formData.content,
          recurring: formData.scheduling === 'recurring',
          enabled: formData.scheduling === 'recurring',
          ...formData.recurringConfig
        }
      };

      if (isEditMode) {
        // Modo edición: usar updateNewsletter
        const { updateNewsletter } = await import('../../Redux/Actions/newsletterActions');
        await dispatch(updateNewsletter(newsletterToEdit.id, newsletterData));
        alert('Newsletter actualizado exitosamente');
      } else {
        // Modo creación: usar createNewsletter
        await dispatch(createNewsletter(newsletterData));
        
        alert('✅ Newsletter guardado como borrador. Ahora puedes:\n• Enviar email de prueba para revisión\n• Enviarlo inmediatamente\n• Programar envío');
        
        onSuccess?.();
      }
      
      if (isEditMode) {
        onSuccess?.();
      }
      
      onClose();
      
      // Reset
      setFormData({
        name: '',
        subject: '',
        layout: '',
        backgroundColor: '#0f766e',
        titleColor: '#ffffff',
        titleFont: 'Playfair Display',
        content: { title: '', subtitle: '', bodyText: '', images: [], ctaText: 'Ver Más', ctaUrl: 'https://zurcherseptic.com' },
        recipientFilter: 'all',
        scheduling: 'now',
        scheduledAt: '',
        recurringConfig: { frequency: 'daily', day: '1', time: '09:00' }
      });
      setCurrentStep(1);
    } catch (error) {
      alert('Error al crear newsletter: ' + (error.response?.data?.message || error.message));
    }
  };

  if (!isOpen) return null;

  const Layout = ({ type, name, description, icon, minImages, maxImages }) => (
    <button
      onClick={() => setFormData(prev => ({ ...prev, layout: type }))}
      className={`p-6 border-2 rounded-lg text-left transition-all ${
        formData.layout === type
          ? 'border-customGreen bg-green-50'
          : 'border-gray-300 hover:border-customGreen hover:bg-gray-50'
      }`}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-bold text-lg mb-2">{name}</h3>
      <p className="text-sm text-gray-600 mb-2">{description}</p>
      <p className="text-xs text-gray-500">Imágenes: {minImages}-{maxImages}</p>
    </button>
  );

  const ColorPicker = ({ color, label }) => (
    <button
      onClick={() => setFormData(prev => ({ ...prev, backgroundColor: color }))}
      className={`w-16 h-16 rounded-lg border-4 transition-all ${
        formData.backgroundColor === color ? 'border-gray-800 scale-110' : 'border-gray-300'
      }`}
      style={{ backgroundColor: color }}
      title={label}
    />
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between bg-customGreen text-white">
          <h2 className="text-2xl font-bold">{isEditMode ? 'Editar Newsletter' : '📝 Crear Newsletter (Borrador)'}</h2>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {[
              { step: 1, label: 'Información' },
              { step: 2, label: 'Layout' },
              { step: 3, label: 'Contenido' },
              { step: 4, label: 'Envío' }
            ].map(({ step, label }) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  currentStep >= step ? 'bg-customGreen text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {step}
                </div>
                <span className={`ml-2 font-medium ${currentStep >= step ? 'text-customGreen' : 'text-gray-500'}`}>
                  {label}
                </span>
                {step < 4 && <div className="w-12 h-0.5 bg-gray-300 mx-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Información básica */}
          {currentStep === 1 && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Nombre del Newsletter *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="Ej: Promoción Verano 2026"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Asunto del Email *</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="Ej: ¡Ofertas exclusivas de verano!"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Destinatarios</label>
                <select
                  value={formData.recipientFilter}
                  onChange={(e) => setFormData(prev => ({ ...prev, recipientFilter: e.target.value }))}
                  className="w-full border rounded-lg px-4 py-2"
                >
                  <option value="all">Todos los suscriptores ({subscribers.data?.length || 0})</option>
                  <option value="active">Solo suscriptores activos</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Seleccionar Layout */}
          {currentStep === 2 && (
            <div className="max-w-4xl mx-auto">
              <h3 className="text-xl font-bold mb-6 text-center">Selecciona un Layout Profesional</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Layout
                  type="hero"
                  name="Hero Banner"
                  description="Imagen grande destacada con título, texto y botón. Ideal para anuncios importantes."
                  icon="🎯"
                  minImages={1}
                  maxImages={1}
                />
                <Layout
                  type="magazine"
                  name="Magazine"
                  description="Texto principal con 1-2 imágenes lado a lado. Perfecto para promociones."
                  icon="📰"
                  minImages={1}
                  maxImages={2}
                />
                <Layout
                  type="gallery"
                  name="Galería"
                  description="Grilla de imágenes 2x2 o 3x3. Ideal para mostrar múltiples productos."
                  icon="🖼️"
                  minImages={4}
                  maxImages={9}
                />
              </div>
            </div>
          )}

          {/* Step 3: Contenido */}
          {currentStep === 3 && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Color de fondo */}
              <div>
                <label className="block text-sm font-medium mb-3">Color de Fondo</label>
                <div className="flex gap-4">
                  <ColorPicker color="#0f766e" label="Verde Corporativo" />
                  <ColorPicker color="#445868" label="Azul" />
                  <ColorPicker color="#49465a" label="Oscuro" />
                  <ColorPicker color="#f6d02c" label="Amarillo" />
                  <ColorPicker color="#ffffff" label="Blanco" />
                </div>
              </div>

              {/* Color del Título */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🎨 Color del Título
                </label>
                
                {/* Presets de colores */}
                <div className="flex gap-3 flex-wrap mb-3">
                  {[
                    { name: 'Blanco', color: '#ffffff' },
                    { name: 'Negro', color: '#000000' },
                    { name: 'Azul Oscuro', color: '#1a3a5c' },
                    { name: 'Verde', color: '#047857' },
                    { name: 'Rojo', color: '#dc2626' },
                    { name: 'Dorado', color: '#ca8a04' }
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
                        className="w-6 h-6 rounded-full border-2 border-gray-300 shadow"
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

              {/* Fuente del Título */}
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

              {/* Título */}
              <div>
                <label className="block text-sm font-medium mb-2">Título Principal</label>
                <input
                  type="text"
                  value={formData.content.title}
                  onChange={(e) => {
                    const capitalized = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
                    setFormData(prev => ({
                      ...prev,
                      content: { ...prev.content, title: capitalized }
                    }));
                  }}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="Ej: ¡Oferta Especial de Verano!"
                />
              </div>

              {/* Subtítulo */}
              <div>
                <label className="block text-sm font-medium mb-2">Subtítulo (opcional)</label>
                <input
                  type="text"
                  value={formData.content.subtitle}
                  onChange={(e) => {
                    const capitalized = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
                    setFormData(prev => ({
                      ...prev,
                      content: { ...prev.content, subtitle: capitalized }
                    }));
                  }}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="Ej: Aprovecha descuentos de hasta 30%"
                />
              </div>

              {/* Texto del cuerpo */}
              <div>
                <label className="block text-sm font-medium mb-2">Texto del Mensaje</label>
                <textarea
                  value={formData.content.bodyText}
                  onChange={(e) => {
                    const capitalized = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
                    setFormData(prev => ({
                      ...prev,
                      content: { ...prev.content, bodyText: capitalized }
                    }));
                  }}
                  className="w-full border rounded-lg px-4 py-2 h-32"
                  placeholder="Escribe el mensaje principal de tu newsletter..."
                />
              </div>

              {/* Imágenes */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Imágenes {formData.layout === 'hero' && '(1 imagen)'} 
                  {formData.layout === 'magazine' && '(1-2 imágenes)'}
                  {formData.layout === 'gallery' && '(4-9 imágenes)'}
                </label>
                
                {/* Lista de imágenes */}
                {formData.content.images.length > 0 && (
                  <div className="mb-4 grid grid-cols-4 gap-3">
                    {formData.content.images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img} alt={`Image ${idx + 1}`} className="w-full h-24 object-cover rounded border" />
                        <button
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Botones subir/galería */}
                <div className="flex gap-3">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    <div className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 cursor-pointer flex items-center justify-center gap-2">
                      {uploadingImage ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <FaPlus /> Subir Imagen
                        </>
                      )}
                    </div>
                  </label>
                  
                  <button
                    type="button"
                    onClick={handleOpenGallery}
                    className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <FaImage /> Galería
                  </button>
                </div>
              </div>

              {/* CTA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Texto del Botón</label>
                  <input
                    type="text"
                    value={formData.content.ctaText}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      content: { ...prev.content, ctaText: e.target.value }
                    }))}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">URL del Botón</label>
                  <input
                    type="url"
                    value={formData.content.ctaUrl}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      content: { ...prev.content, ctaUrl: e.target.value }
                    }))}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Programación y Preview */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {/* Configuración de envío ARRIBA */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-xl font-bold mb-2">Opciones de Envío</h3>
                <p className="text-sm text-gray-600 mb-4">
                  💡 El newsletter se guardará como borrador. Luego podrás enviarlo manualmente o dejarlo programado.
                </p>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Tipo de envío</label>
                    <select
                      value={formData.scheduling}
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduling: e.target.value }))}
                      className="w-full border rounded-lg px-4 py-2"
                    >
                      <option value="now">Sin Programar (Borrador)</option>
                      <option value="scheduled">Programar Fecha Específica</option>
                      <option value="recurring">Envío Recurrente Automático</option>
                    </select>
                  </div>

                  {formData.scheduling === 'scheduled' && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-2">
                        <FaCalendar className="inline mr-2" />
                        Fecha y Hora
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.scheduledAt}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduledAt: e.target.value }))}
                        className="w-full border rounded-lg px-4 py-2"
                      />
                    </div>
                  )}

                  {formData.scheduling === 'recurring' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2">Frecuencia</label>
                        <select
                          value={formData.recurringConfig.frequency}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            recurringConfig: { ...prev.recurringConfig, frequency: e.target.value }
                          }))}
                          className="w-full border rounded-lg px-4 py-2"
                        >
                          <option value="daily">Diario</option>
                          <option value="weekly">Semanal</option>
                          <option value="monthly">Mensual</option>
                        </select>
                      </div>

                      {formData.recurringConfig.frequency !== 'daily' && (
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            {formData.recurringConfig.frequency === 'weekly' ? 'Día de la Semana' : 'Día del Mes'}
                          </label>
                          <select
                            value={formData.recurringConfig.day}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              recurringConfig: { ...prev.recurringConfig, day: e.target.value }
                            }))}
                            className="w-full border rounded-lg px-4 py-2"
                          >
                            {formData.recurringConfig.frequency === 'weekly' ? (
                              <>
                                <option value="1">Lunes</option>
                                <option value="2">Martes</option>
                                <option value="3">Miércoles</option>
                                <option value="4">Jueves</option>
                                <option value="5">Viernes</option>
                                <option value="6">Sábado</option>
                                <option value="7">Domingo</option>
                              </>
                            ) : (
                              Array.from({ length: 31 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>Día {i + 1}</option>
                              ))
                            )}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          <FaClock className="inline mr-2" />
                          Hora de Envío
                        </label>
                        <input
                          type="time"
                          value={formData.recurringConfig.time}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            recurringConfig: { ...prev.recurringConfig, time: e.target.value }
                          }))}
                          className="w-full border rounded-lg px-4 py-2"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Preview ABAJO - MÁS GRANDE */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <FaEye /> Vista Previa
                  </h3>
                  
                  {/* Selector de Dispositivos */}
                  <div className="flex gap-2 bg-gray-200 rounded-lg p-1">
                    <button
                      onClick={() => setPreviewDevice('mobile')}
                      className={`flex items-center gap-2 px-3 py-2 rounded transition ${
                        previewDevice === 'mobile' 
                          ? 'bg-customGreen text-white shadow' 
                          : 'bg-transparent text-gray-700 hover:bg-gray-300'
                      }`}
                      title="Vista Móvil (375px)"
                    >
                      <FaMobileAlt size={16} />
                      <span className="text-sm font-medium">Móvil</span>
                    </button>
                    
                    <button
                      onClick={() => setPreviewDevice('tablet')}
                      className={`flex items-center gap-2 px-3 py-2 rounded transition ${
                        previewDevice === 'tablet' 
                          ? 'bg-customGreen text-white shadow' 
                          : 'bg-transparent text-gray-700 hover:bg-gray-300'
                      }`}
                      title="Vista Tablet (768px)"
                    >
                      <FaTabletAlt size={16} />
                      <span className="text-sm font-medium">Tablet</span>
                    </button>
                    
                    <button
                      onClick={() => setPreviewDevice('desktop')}
                      className={`flex items-center gap-2 px-3 py-2 rounded transition ${
                        previewDevice === 'desktop' 
                          ? 'bg-customGreen text-white shadow' 
                          : 'bg-transparent text-gray-700 hover:bg-gray-300'
                      }`}
                      title="Vista Desktop (100%)"
                    >
                      <FaDesktop size={16} />
                      <span className="text-sm font-medium">Desktop</span>
                    </button>
                  </div>
                </div>
                
                <div className="border rounded-lg p-4 bg-gray-50 flex justify-center" style={{ height: '70vh', overflowY: 'auto' }}>
                  <iframe
                    srcDoc={previewHtml}
                    className="border-0 bg-white rounded shadow-lg"
                    style={{ 
                      width: previewDevice === 'mobile' ? '375px' : 
                             previewDevice === 'tablet' ? '768px' : 
                             '100%',
                      maxWidth: '100%',
                      height: '100%', 
                      minHeight: '800px'
                    }}
                    title="Preview"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="p-6 border-t bg-gray-50 flex justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="px-6 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border rounded-lg hover:bg-gray-100"
            >
              Cancelar
            </button>
            
            {currentStep < 4 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={
                  (currentStep === 1 && (!formData.name || !formData.subject)) ||
                  (currentStep === 2 && !formData.layout)
                }
                className="px-6 py-2 bg-customGreen text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-customGreen text-white rounded-lg hover:bg-green-700"
              >
                {isEditMode ? 'Guardar Cambios' : '💾 Guardar como Borrador'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Galería Modal */}
      {showImageGallery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-customGreen text-white">
              <h3 className="font-bold text-lg">Galería de Imágenes</h3>
              <button onClick={() => setShowImageGallery(false)} className="text-white hover:text-gray-200">
                <FaTimes size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {images.loading ? (
                <div className="text-center py-12">Cargando...</div>
              ) : images.data && images.data.length > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  {images.data.map((image) => (
                    <div
                      key={image.publicId}
                      className="relative group cursor-pointer border rounded-lg overflow-hidden hover:shadow-lg transition"
                      onClick={() => handleSelectFromGallery(image.url)}
                    >
                      <img
                        src={image.url}
                        alt=""
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition space-y-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteImage(image.publicId);
                            }}
                            className="block w-full bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                          >
                            <FaTrash className="inline mr-2" />
                            Eliminar
                          </button>
                          <p className="text-white text-xs text-center">
                            {image.width} x {image.height}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FaImage size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No hay imágenes en la galería</p>
                  <p className="text-sm mt-2">Sube tu primera imagen usando el botón "Subir Imagen"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateNewsletterProModal;
