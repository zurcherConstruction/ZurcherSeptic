import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  FaUsers, 
  FaEnvelope, 
  FaPlus,
  FaTrash,
  FaTimes,
  FaPaperPlane,
  FaClock,
  FaCheckCircle,
  FaImage,
  FaBan,
  FaEdit,
  FaRedo
} from 'react-icons/fa';
import { 
  getAllSubscribers, 
  getAllNewsletters,
  createSubscriber,
  deleteSubscriber,
  unsubscribeSubscriber,
  deleteNewsletter,
  resendNewsletter,
  getNewsletterImages,
  uploadNewsletterImage,
  deleteNewsletterImage
} from '../../Redux/Actions/newsletterActions';
import CreateNewsletterProModal from './CreateNewsletterProModal';

const NewsletterDashboard = () => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('subscribers');
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Estados de paginación
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20); // 20 suscriptores por página
  
  // Modales
  const [showSubscriberModal, setShowSubscriberModal] = useState(false);
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  const [newsletterToEdit, setNewsletterToEdit] = useState(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Formularios
  const [subscriberForm, setSubscriberForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: ''
  });
  
  const { 
    subscribers = { data: [], pagination: null }, 
    newsletters = { data: [] }, 
    images = { data: [] } 
  } = useSelector(state => state.newsletter || {});

  // Extraer datos de paginación
  const total = subscribers.pagination?.total || 0;
  const totalPages = subscribers.pagination?.totalPages || 1;

  // Cargar datos cuando cambia la página
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          dispatch(getAllSubscribers({ page, limit: pageSize })),
          dispatch(getAllNewsletters())
        ]);
        setDataLoaded(true);
      } catch (error) {
        console.error('Error loading newsletter data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [page, dispatch]);

  const stats = [
    {
      title: 'Suscriptores Activos',
      value: total, // Total de suscriptores (paginación)
      icon: FaUsers,
      color: 'blue'
    },
    {
      title: 'Newsletters Enviados',
      value: (newsletters.data || []).filter(n => n.status === 'sent').length,
      icon: FaEnvelope,
      color: 'purple'
    }
  ];

  const handleCreateSubscriber = async (e) => {
    e.preventDefault();
    try {
      await dispatch(createSubscriber(subscriberForm));
      setShowSubscriberModal(false);
      setSubscriberForm({ email: '', firstName: '', lastName: '', phone: '' });
      setPage(1); // Volver a la primera página para ver el nuevo suscriptor
      await dispatch(getAllSubscribers({ page: 1, limit: pageSize }));
      alert('Suscriptor creado exitosamente');
    } catch (error) {
      alert('Error al crear suscriptor: ' + (error.response?.data?.message || error.message));
    }
  };



  const handleDeleteSubscriber = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este suscriptor?')) {
      try {
        console.log('🗑️ Eliminando suscriptor ID:', id);
        await dispatch(deleteSubscriber(id));
        console.log('✅ Suscriptor eliminado, recargando lista...');
        await dispatch(getAllSubscribers({ page, limit: pageSize }));
        console.log('✅ Lista actualizada');
      } catch (error) {
        console.error('❌ Error al eliminar suscriptor:', error);
        alert('Error al eliminar suscriptor: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleUnsubscribeSubscriber = async (id) => {
    if (window.confirm('¿Desuscribir este usuario? No recibirá más newsletters y NO se volverá a suscribir automáticamente.')) {
      try {
        console.log('📧 Desuscribiendo ID:', id);
        await dispatch(unsubscribeSubscriber(id));
        console.log('✅ Usuario desuscrito, recargando lista...');
        await dispatch(getAllSubscribers({ page, limit: pageSize }));
        console.log('✅ Lista actualizada');
      } catch (error) {
        console.error('❌ Error al desuscribir:', error);
        alert('Error al desuscribir: ' + (error.response?.data?.message || error.message));
      }
    }
  };



  const handleDeleteNewsletter = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este newsletter?')) {
      try {
        await dispatch(deleteNewsletter(id));
        await dispatch(getAllNewsletters());
      } catch (error) {
        alert('Error al eliminar newsletter');
      }
    }
  };

  const handleEditNewsletter = (newsletter) => {
    setNewsletterToEdit(newsletter);
    setShowNewsletterModal(true);
  };

  const handleResendNewsletter = async (id, name) => {
    if (window.confirm(`¿Reenviar el newsletter "${name}" a todos los suscriptores activos?`)) {
      try {
        await dispatch(resendNewsletter(id));
        alert('Newsletter reenviándose...');
        setTimeout(() => {
          dispatch(getAllNewsletters());
        }, 2000);
      } catch (error) {
        alert('Error al reenviar newsletter: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleNewsletterCreated = async () => {
    await dispatch(getAllNewsletters());
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { color: 'bg-gray-100 text-gray-800', text: 'Borrador' },
      scheduled: { color: 'bg-blue-100 text-blue-800', text: 'Programado' },
      sending: { color: 'bg-yellow-100 text-yellow-800', text: 'Enviando' },
      sent: { color: 'bg-green-100 text-green-800', text: 'Enviado' },
      failed: { color: 'bg-red-100 text-red-800', text: 'Fallido' }
    };
    const badge = badges[status] || badges.draft;
    return <span className={`px-2 py-1 rounded text-xs ${badge.color}`}>{badge.text}</span>;
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validar que sea imagen
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen');
      return;
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5MB');
      return;
    }

    try {
      setUploadingImage(true);
      const result = await dispatch(uploadNewsletterImage(file));
      
      // Agregar la URL a las imágenes de la plantilla
      setTemplateForm({
        ...templateForm,
        images: [...templateForm.images, result.url]
      });
      
      alert('Imagen subida exitosamente');
    } catch (error) {
      alert('Error al subir imagen: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSelectFromGallery = (imageUrl) => {
    if (!templateForm.images.includes(imageUrl)) {
      setTemplateForm({
        ...templateForm,
        images: [...templateForm.images, imageUrl]
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Newsletter</h1>
          <p className="text-gray-600 mt-2">Gestiona tus campañas de email marketing</p>
        </div>

        {/* Stats Cards */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                const colorClasses = {
                  blue: 'bg-blue-100 text-blue-600',
                  green: 'bg-green-100 text-green-600',
                  purple: 'bg-purple-100 text-purple-600'
                };

                return (
                  <div
                    key={index}
                    className="bg-white rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      if (stat.color === 'blue') setActiveTab('subscribers');

                      if (stat.color === 'purple') setActiveTab('newsletters');
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm font-medium">{stat.title}</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                      </div>
                      <div className={`p-3 rounded-full ${colorClasses[stat.color]}`}>
                        <Icon className="text-2xl" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('subscribers')}
                    className={`py-4 px-6 text-sm font-medium ${
                      activeTab === 'subscribers'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FaUsers className="inline mr-2" />
                    Suscriptores ({(subscribers.data || []).length})
                  </button>

                  <button
                    onClick={() => setActiveTab('newsletters')}
                    className={`py-4 px-6 text-sm font-medium ${
                      activeTab === 'newsletters'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FaEnvelope className="inline mr-2" />
                    Newsletters ({(newsletters.data || []).length})
                  </button>
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {/* Subscribers Tab */}
                {activeTab === 'subscribers' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold">Lista de Suscriptores</h2>
                      <button
                        onClick={() => setShowSubscriberModal(true)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        <FaPlus /> Agregar Suscriptor
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">Nombre</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">Tags</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(subscribers.data || []).map((sub) => (
                            <tr key={sub.id} className="border-b hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm">{sub.email}</td>
                              <td className="px-4 py-3 text-sm">
                                {sub.firstName} {sub.lastName}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  sub.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {sub.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {(sub.tags || []).map(tag => (
                                  <span key={tag} className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded mr-1 text-xs">
                                    {tag}
                                  </span>
                                ))}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleUnsubscribeSubscriber(sub.id)}
                                    className="text-yellow-600 hover:text-yellow-800"
                                    title="Desuscribir (no se volverá a suscribir automáticamente)"
                                  >
                                    <FaBan />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSubscriber(sub.id)}
                                    className="text-red-600 hover:text-red-800"
                                    title="Eliminar (puede volver a suscribirse automáticamente)"
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

                    {/* Paginación */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
                        {/* Primera + Anterior */}
                        <button
                          onClick={() => setPage(1)}
                          disabled={page === 1}
                          className="px-2 py-2 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                          title="Primera página"
                        >
                          «
                        </button>
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                        >
                          ‹ Anterior
                        </button>

                        {/* Números de página */}
                        {(() => {
                          const pages = [];
                          const delta = 2; // Mostrar 2 páginas a cada lado de la actual
                          const left = Math.max(1, page - delta);
                          const right = Math.min(totalPages, page + delta);

                          if (left > 1) {
                            pages.push(
                              <button key={1} onClick={() => setPage(1)}
                                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                                1
                              </button>
                            );
                            if (left > 2) pages.push(<span key="left-ellipsis" className="px-2 py-2 text-gray-400">…</span>);
                          }

                          for (let i = left; i <= right; i++) {
                            pages.push(
                              <button key={i} onClick={() => setPage(i)}
                                className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                                  i === page
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'border-gray-300 hover:bg-gray-50'
                                }`}>
                                {i}
                              </button>
                            );
                          }

                          if (right < totalPages) {
                            if (right < totalPages - 1) pages.push(<span key="right-ellipsis" className="px-2 py-2 text-gray-400">…</span>);
                            pages.push(
                              <button key={totalPages} onClick={() => setPage(totalPages)}
                                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                                {totalPages}
                              </button>
                            );
                          }

                          return pages;
                        })()}

                        {/* Siguiente + Última */}
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                        >
                          Siguiente ›
                        </button>
                        <button
                          onClick={() => setPage(totalPages)}
                          disabled={page === totalPages}
                          className="px-2 py-2 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                          title="Última página"
                        >
                          »
                        </button>

                        <span className="px-3 py-2 text-sm text-gray-500">
                          {total} suscriptores totales
                        </span>
                      </div>
                    )}
                  </div>
                )}



                {/* Newsletters Tab */}
                {activeTab === 'newsletters' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold">Newsletters</h2>
                      <button
                        onClick={() => setShowNewsletterModal(true)}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                      >
                        <FaPlus /> Crear Newsletter
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {(newsletters.data || []).length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                          <FaEnvelope className="text-6xl text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-600 mb-4">No hay newsletters creados aún</p>
                          <button
                            onClick={() => setShowNewsletterModal(true)}
                            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
                          >
                            Crear tu primer Newsletter
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="px-4 py-3 text-left text-sm font-semibold">Nombre</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Asunto</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Destinatarios</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Enviados</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Abiertos</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Programado</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {newsletters.data.map((newsletter) => {
                                const isRecurring = newsletter.metadata && newsletter.metadata.recurring;
                                return (
                                  <tr key={newsletter.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm">
                                      <div>
                                        {newsletter.name}
                                        {isRecurring && (
                                          <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                                            Recurrente
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm">{newsletter.subject}</td>
                                    <td className="px-4 py-3 text-sm">{getStatusBadge(newsletter.status)}</td>
                                    <td className="px-4 py-3 text-sm">{newsletter.recipientCount || 0}</td>
                                    <td className="px-4 py-3 text-sm">{newsletter.sentCount || 0}</td>
                                    <td className="px-4 py-3 text-sm">
                                      {newsletter.openedCount || 0} 
                                      {newsletter.recipientCount > 0 && (
                                        <span className="text-xs text-gray-500 ml-1">
                                          ({Math.round((newsletter.openedCount || 0) / newsletter.recipientCount * 100)}%)
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                      {isRecurring ? (
                                        <div className="text-xs">
                                          <div className="font-semibold text-purple-600">
                                            {newsletter.metadata.frequency === 'daily' && 'Diario'}
                                            {newsletter.metadata.frequency === 'weekly' && `Semanal - Día ${newsletter.metadata.day}`}
                                            {newsletter.metadata.frequency === 'monthly' && `Mensual - Día ${newsletter.metadata.day}`}
                                          </div>
                                          <div className="text-gray-500">
                                            {newsletter.metadata.time}
                                          </div>
                                        </div>
                                      ) : newsletter.scheduledAt ? (
                                        <span className="text-xs">
                                          {new Date(newsletter.scheduledAt).toLocaleString('es-AR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400 text-xs">-</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleEditNewsletter(newsletter)}
                                          className="text-blue-600 hover:text-blue-800"
                                          title="Editar"
                                        >
                                          <FaEdit />
                                        </button>
                                        <button
                                          onClick={() => handleResendNewsletter(newsletter.id, newsletter.name)}
                                          className="text-green-600 hover:text-green-800"
                                          title="Reenviar"
                                        >
                                          <FaRedo />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteNewsletter(newsletter.id)}
                                          className="text-red-600 hover:text-red-800"
                                          title="Eliminar"
                                        >
                                          <FaTrash />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Modal Crear Suscriptor */}
        {showSubscriberModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Agregar Suscriptor</h3>
                <button onClick={() => setShowSubscriberModal(false)}>
                  <FaTimes className="text-gray-600 hover:text-gray-800" />
                </button>
              </div>
              <form onSubmit={handleCreateSubscriber}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={subscriberForm.email}
                      onChange={(e) => setSubscriberForm({...subscriberForm, email: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre</label>
                    <input
                      type="text"
                      value={subscriberForm.firstName}
                      onChange={(e) => setSubscriberForm({...subscriberForm, firstName: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Apellido</label>
                    <input
                      type="text"
                      value={subscriberForm.lastName}
                      onChange={(e) => setSubscriberForm({...subscriberForm, lastName: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={subscriberForm.phone}
                      onChange={(e) => setSubscriberForm({...subscriberForm, phone: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowSubscriberModal(false)}
                    className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Crear
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Crear Plantilla */}


        {/* Modal Crear/Editar Newsletter Profesional */}
        {showNewsletterModal && (
          <CreateNewsletterProModal
            isOpen={showNewsletterModal}
            onClose={() => {
              setShowNewsletterModal(false);
              setNewsletterToEdit(null);
            }}
            onSuccess={handleNewsletterCreated}
            newsletterToEdit={newsletterToEdit}
          />
        )}

        {/* Modal Galería de Imágenes */}
        {showImageGallery && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                    <p className="text-sm text-gray-500 mt-2">Sube tu primera imagen usando el botón "Subir Imagen"</p>
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
    </div>
  );
};

export default NewsletterDashboard;
