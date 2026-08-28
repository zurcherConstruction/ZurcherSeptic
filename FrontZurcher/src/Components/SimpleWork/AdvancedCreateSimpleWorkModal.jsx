import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../../utils/axios';
import { 
  FaPlus, FaMinus, FaTrash, FaSearch, FaTimes,
  FaTools, FaCalculator, FaEdit, FaCheck, FaArrowUp, FaArrowDown
} from 'react-icons/fa';
import { fetchBudgetItems } from "../../Redux/Actions/budgetItemActions";
import { createSimpleWork, updateSimpleWork, fetchClientWorks, clearClientWorks } from '../../Redux/Actions/simpleWorkActions';
import DynamicCategorySection from "../../Components/Budget/DynamicCategorySection";

// Helper para generar IDs temporales
const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const AdvancedCreateSimpleWorkModal = ({ 
  isOpen, 
  onClose, 
  editingWork = null,
  onWorkCreated 
}) => {
  const dispatch = useDispatch();
  
  // Redux state
  const { items: budgetItemsCatalog, loading: itemsLoading } = useSelector(state => state.budgetItems);
  const { clientWorks, simpleWorks } = useSelector(state => state.simpleWork);
  const { staff } = useSelector(state => state.auth);

  // Form state
  const [formData, setFormData] = useState({
    workType: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    description: '',
    descriptionTitle: 'DESCRIPTION',
    notes: '',
    notesTitle: 'NOTES',
    termsAndConditions: '',
    termsTitle: 'TERMS & CONDITIONS',
    linkedWorkId: null,
  });

  // Items state - Now managed by DynamicCategorySection
  const [items, setItems] = useState([]);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  
  // Payment percentage state (like Budget)
  const [initialPaymentPercentage, setInitialPaymentPercentage] = useState(100);
  
  // Attachments state
  const [attachments, setAttachments] = useState([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  // Normalize budget items like in CreateBudget (DEBE IR ANTES de availableCategories)
  const normalizedBudgetItemsCatalog = useMemo(() => {
    if (!budgetItemsCatalog || !Array.isArray(budgetItemsCatalog)) return [];
    
    return budgetItemsCatalog
      .filter(item => item && (item.item || item.name)) // Filter out invalid items
      .map(item => ({
        id: item.id,
        name: item.item || item.name || '', 
        item: item.item || item.name || '',
        category: item.category || '',
        unitPrice: parseFloat(item.unitPrice || 0),
        unit: item.unit || 'ea',
        marca: item.marca,
        capacity: item.capacity,
        description: item.description || item.item || item.name || ''
      }));
  }, [budgetItemsCatalog]);

  // Categories management like CreateBudget
  const customCategoryOrder = [
    'PIPE',
    'FITTINGS',
    'TANK',
    'DISTRIBUTION BOX',
    'ROCK',
    'INSPECTION',
    'LABOR FEE'
  ];

  const availableCategories = useMemo(() => {
    const categories = [...new Set(normalizedBudgetItemsCatalog.map(item => item.category).filter(cat => cat))];
    const filtered = categories.filter(cat => (cat || '').toUpperCase().trim() !== 'MATERIALES');
    return filtered.sort((a, b) => {
      // Safety checks for undefined values
      const categoryA = (a || '').toUpperCase();
      const categoryB = (b || '').toUpperCase();
      const aIdx = customCategoryOrder.indexOf(categoryA);
      const bIdx = customCategoryOrder.indexOf(categoryB);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return categoryA.localeCompare(categoryB);
    });
  }, [normalizedBudgetItemsCatalog]);

  // Dynamic section visibility management
  const [dynamicSectionVisibility, setDynamicSectionVisibility] = useState({});

  // Initialize visibility for all categories
  useEffect(() => {
    const initialVisibility = {};
    availableCategories.forEach(category => {
      initialVisibility[category] = false;
    });
    setDynamicSectionVisibility(prev => ({ ...prev, ...initialVisibility }));
  }, [availableCategories]);

  // Toggle dynamic section
  const toggleDynamicSection = (category) => {
    setDynamicSectionVisibility(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Add item from dynamic section
  const addItemFromDynamicSection = (itemData) => {
    setItems(prevItems => [...prevItems, itemData]);
  };

  // Manual item form state
  const [showManualItemForm, setShowManualItemForm] = useState(false);
  const [manualItem, setManualItem] = useState({
    description: '',
    quantity: 1,
    unitCost: 0,
    category: 'OTHER'
  });

  // Add manual item
  const addManualItem = () => {
    if (!manualItem.description.trim()) {
      alert('Por favor ingrese una descripción para el ítem');
      return;
    }

    const newItem = {
      id: null,
      tempId: generateTempId(),
      category: manualItem.category,
      name: manualItem.description,
      description: manualItem.description,
      quantity: parseFloat(manualItem.quantity) || 1,
      unit: 'ea',
      unitCost: parseFloat(manualItem.unitCost) || 0,
      totalCost: (parseFloat(manualItem.quantity) || 1) * (parseFloat(manualItem.unitCost) || 0),
      discount: 0,
      finalCost: (parseFloat(manualItem.quantity) || 1) * (parseFloat(manualItem.unitCost) || 0),
      budgetItemId: null,
      isFromTemplate: false,
      templateItemId: null
    };

    setItems(prevItems => [...prevItems, newItem]);
    setManualItem({ description: '', quantity: 1, unitCost: 0, category: 'OTHER' });
    setShowManualItemForm(false);
  };

  // Work linking state
  const [showWorkSearch, setShowWorkSearch] = useState(false);
  const [workSearchQuery, setWorkSearchQuery] = useState('');
  const [selectedLinkedWork, setSelectedLinkedWork] = useState(null);

  // Client name autocomplete state
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [nameFilter, setNameFilter] = useState('');

  // UI state
  const [errors, setErrors] = useState({});

  // Load budget items on mount
  useEffect(() => {
    if (isOpen) {
      console.log('🔄 Cargando BudgetItems...');
      dispatch(fetchBudgetItems());
    }
  }, [isOpen, dispatch]);

  // Auto-load ALL client works when work search is opened (solo una vez)
  useEffect(() => {
    // ⚡ Cargar TODOS los Works una vez cuando se abre el search
    if (isOpen && showWorkSearch && (!clientWorks || clientWorks.length === 0)) {
      console.log('🔄 Cargando TODOS los trabajos disponibles...');
      dispatch(fetchClientWorks()); // ⚡ Sin parámetros = cargar todos
    }
  }, [isOpen, showWorkSearch, dispatch]); // ⚡ Removido clientWorks de las dependencias para evitar loop

  // Unique clients from existing SimpleWorks for name autocomplete
  const existingClients = useMemo(() => {
    const seen = new Set();
    const clients = [];
    (simpleWorks || []).forEach(sw => {
      const cd = sw.clientData || {};
      const name = `${cd.firstName || ''} ${cd.lastName || ''}`.trim() || cd.name || '';
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        clients.push({ name, email: cd.email || '', phone: cd.phone || '' });
      }
    });
    return clients.sort((a, b) => a.name.localeCompare(b.name));
  }, [simpleWorks]);

  const filteredNameSuggestions = useMemo(() => {
    if (!nameFilter || nameFilter.length < 2) return [];
    const q = nameFilter.toLowerCase();
    return existingClients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [nameFilter, existingClients]);

  // ⚡ Filtrado local de Works (como ProgressTracker - instantáneo)
  const filteredClientWorks = useMemo(() => {
    if (!clientWorks || clientWorks.length === 0) return [];
    
    if (!workSearchQuery.trim()) {
      return clientWorks; // Sin búsqueda = mostrar todos
    }
    
    const searchLower = workSearchQuery.toLowerCase().trim();
    return clientWorks.filter(work => {
      // 🔍 Buscar en todos los campos relevantes
      const searchableText = [
        work.propertyAddress,
        work.clientData?.name,
        work.clientData?.email,
        work.clientData?.company,
        work.clientData?.address
      ].filter(Boolean).join(' ').toLowerCase();
      
      return searchableText.includes(searchLower);
    });
  }, [clientWorks, workSearchQuery]);

  // Initialize form when editing
  useEffect(() => {
    if (editingWork) {
      const clientData = editingWork.clientData || {};
      // Name can be stored as firstName+lastName, or as a combined "name"/"clientName" field
      const fullName = clientData.name || clientData.clientName || '';
      const derivedFirst = fullName.split(' ')[0] || '';
      const derivedLast = fullName.split(' ').slice(1).join(' ') || '';
      setFormData({
        workType: editingWork.workType || '',
        firstName: clientData.firstName || derivedFirst,
        lastName: clientData.lastName || derivedLast,
        email: clientData.email || '',
        phone: clientData.phone || '',
        address: clientData.address || editingWork.propertyAddress || '',
        description: editingWork.description || '',
        descriptionTitle: editingWork.descriptionTitle || 'DESCRIPTION',
        notes: editingWork.notes || '',
        notesTitle: editingWork.notesTitle || 'NOTES',
        termsAndConditions: editingWork.termsAndConditions || '',
        termsTitle: editingWork.termsTitle || 'TERMS & CONDITIONS',
        linkedWorkId: editingWork.linkedWorkId || null,
      });

      // Load existing items
      if (editingWork.items) {
        setItems(editingWork.items.map(item => ({
          id: item.id,
          tempId: generateTempId(),
          category: item.category,
          description: item.description,
          quantity: parseFloat(item.quantity),
          unit: item.unit || 'ea',
          unitCost: parseFloat(item.unitCost),
          totalCost: parseFloat(item.totalCost),
          discount: parseFloat(item.discount || 0),
          finalCost: parseFloat(item.finalCost),
          isFromTemplate: item.isFromTemplate || false,
          templateItemId: item.templateItemId || null
        })));
      }

      // 🆕 Cargar valores de discount y payment al editar
      setDiscountPercentage(editingWork.discountPercentage || 0);
      setInitialPaymentPercentage(editingWork.initialPaymentPercentage || 100);
    } else {
      // Reset form for new work
      setFormData({
        workType: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        description: '',
        descriptionTitle: 'DESCRIPTION',
        notes: '',
        notesTitle: 'NOTES',
        termsAndConditions: '',
        termsTitle: 'TERMS & CONDITIONS',
        linkedWorkId: null,
      });
      setItems([]);
      setDiscountPercentage(0);
      setInitialPaymentPercentage(100); // 🆕 Reset payment percentage
      setSelectedLinkedWork(null);
      setWorkSearchQuery('');
    }

    setErrors({});
  }, [editingWork, isOpen]);

  // Load attachments when editing work
  useEffect(() => {
    if (editingWork && editingWork.attachments) {
      setAttachments(editingWork.attachments || []);
    } else {
      setAttachments([]);
    }
  }, [editingWork]);

  // Handle form input change
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Search client works (ahora solo filtra localmente, no llama al backend)
  const handleWorkSearch = () => {
    // ⚡ El filtrado se hace automáticamente con useMemo cuando cambia workSearchQuery
    // Esta función ya no es necesaria pero se mantiene por compatibilidad
  };

  // Select linked work
  const selectLinkedWork = (work) => {
    setSelectedLinkedWork(work);
    setFormData(prev => ({
      ...prev,
      linkedWorkId: work.id,
      firstName: work.clientData?.name?.split(' ')[0] || '',
      lastName: work.clientData?.name?.split(' ').slice(1).join(' ') || '',
      email: work.clientData?.email || '',
      phone: '', // No disponible desde Works
      address: work.clientData?.address || work.propertyAddress || '',
    }));
    setShowWorkSearch(false);
  };

  // Clear linked work
  const clearLinkedWork = () => {
    setSelectedLinkedWork(null);
    setFormData(prev => ({ ...prev, linkedWorkId: null }));
    dispatch(clearClientWorks());
  };

  // Attachment functions
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      toast.error('El archivo no puede ser mayor a 100MB');
      return;
    }

    // Allow images, videos, and PDFs
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm',
      'application/pdf'
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Solo se permiten imágenes (JPG, PNG, GIF), videos (MP4, MOV, AVI, MKV, WEBM) y PDFs');
      return;
    }

    setIsUploadingAttachment(true);
    
    try {
      // Upload to temporary location or directly to cloudinary for temporary storage
      const formData = new FormData();
      formData.append('file', file);
      
      // Use a temp upload endpoint that doesn't require work ID
      const { data } = await api.post('/simple-works/temp-attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (data.success) {
        const tempAttachment = {
          id: Date.now().toString(),
          filename: file.name,
          originalName: file.name,
          url: data.url,
          publicId: data.publicId,
          uploadedAt: new Date(),
          size: file.size,
          type: file.type,
          isTemp: true
        };
        
        setAttachments(prev => [...prev, tempAttachment]);
        toast.success('Archivo subido exitosamente');
        // Reset input
        event.target.value = '';
      } else {
        toast.error(data.message || 'Error subiendo archivo');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error.response?.data?.message || 'Error subiendo archivo');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    const attachment = attachments.find(att => att.id === attachmentId);
    if (!attachment) return;

    try {
      // If it's a temporary attachment, delete from cloudinary directly
      if (attachment.isTemp) {
        const { data } = await api.delete(`/simple-works/temp-attachments/${attachmentId}`);
        
        if (data.success) {
          setAttachments(prev => prev.filter(att => att.id !== attachmentId));
          toast.success('Archivo eliminado exitosamente');
        }
      } else if (editingWork?.id) {
        // If it's a saved attachment, use the regular endpoint
        const { data } = await api.delete(`/simple-works/${editingWork.id}/attachments/${attachmentId}`);
        
        if (data.success) {
          setAttachments(prev => prev.filter(att => att.id !== attachmentId));
          toast.success('Archivo eliminado exitosamente');
        }
      } else {
        // Just remove from local state for temp files
        setAttachments(prev => prev.filter(att => att.id !== attachmentId));
        toast.success('Archivo eliminado exitosamente');
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Error eliminando archivo');
    }
  };

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.workType.trim()) newErrors.workType = 'Tipo de trabajo requerido';
    if (!formData.firstName.trim()) newErrors.firstName = 'Nombre requerido';
    // lastName is now optional - no validation needed
    if (!formData.email.trim()) newErrors.email = 'Email requerido';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email debe tener formato válido';
    if (!formData.phone.trim()) newErrors.phone = 'Teléfono requerido';
    if (!formData.address.trim()) newErrors.address = 'Dirección requerida';
    // description, notes y termsAndConditions son opcionales
    
    if (items.length === 0) {
      newErrors.items = 'Debe agregar al menos un item';
    }

    // Validate items
    const itemErrors = [];
    items.forEach((item, index) => {
      const itemError = {};
      if (!item.description?.trim()) itemError.description = 'Descripción requerida';
      if (item.quantity <= 0) itemError.quantity = 'Cantidad debe ser mayor a 0';
      if (item.unitCost <= 0) itemError.unitCost = 'Costo unitario debe ser mayor a 0';
      
      if (Object.keys(itemError).length > 0) {
        itemErrors[index] = itemError;
      }
    });

    if (itemErrors.length > 0) {
      newErrors.itemErrors = itemErrors;
    }

    return newErrors;
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Por favor corrige los errores en el formulario');
      return;
    }

    try {
      // Prepare items for submission
      const itemsForSubmission = items.map((item, index) => ({
        category: item.category,
        description: item.description.trim(),
        quantity: item.quantity,
        unit: item.unit || 'ea',
        unitCost: item.unitCost,
        totalCost: item.totalCost,
        discount: item.discount || 0,
        finalCost: item.finalCost,
        displayOrder: index + 1,
        isFromTemplate: item.isFromTemplate || false,
        templateItemId: item.templateItemId || null
      }));

      // Calculate estimated amount from items
      const itemsTotal = itemsForSubmission.reduce((sum, item) => {
        const itemFinalCost = parseFloat(item.finalCost) || parseFloat(item.totalCost) || 0;
        return sum + itemFinalCost;
      }, 0);

      // Apply discount to get final estimated amount
      const estimatedAmount = discountPercentage > 0 
        ? itemsTotal * (1 - discountPercentage / 100)
        : itemsTotal;

      const workData = {
        workType: formData.workType,
        clientData: {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim()
        },
        propertyAddress: formData.address.trim(),
        description: formData.description.trim(),
        descriptionTitle: formData.descriptionTitle.trim() || 'DESCRIPTION',
        estimatedAmount: estimatedAmount,
        notes: formData.notes.trim(),
        notesTitle: formData.notesTitle.trim() || 'NOTES',
        termsAndConditions: formData.termsAndConditions.trim(),
        termsTitle: formData.termsTitle.trim() || 'TERMS & CONDITIONS',
        linkedWorkId: formData.linkedWorkId,
        items: itemsForSubmission,
        discountPercentage: discountPercentage,
        initialPaymentPercentage: initialPaymentPercentage,
        attachments: attachments // 🆕 Incluir attachments
      };

      if (editingWork) {
        await dispatch(updateSimpleWork(editingWork.id, workData));
        toast.success('Trabajo actualizado exitosamente');
      } else {
        await dispatch(createSimpleWork(workData));
        toast.success('Trabajo creado exitosamente');
      }

      if (onWorkCreated) {
        onWorkCreated();
      }
      onClose();
    } catch (error) {
      console.error('Error submitting SimpleWork:', error);
      toast.error('Error al procesar el trabajo');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FaTools />
              {editingWork ? 'Editar Trabajo Simple' : 'Crear Nuevo Trabajo Simple'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-2"
            >
              <FaTimes size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Work Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Trabajo *
            </label>
            <select
              value={formData.workType}
              onChange={(e) => handleInputChange('workType', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.workType ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            >
              <option value="">-- Seleccione tipo de trabajo --</option>
              <option value="culvert">Culvert</option>
              <option value="drainfield">Drainfield</option>
              <option value="repair">Reparación</option>
              <option value="abandonment">Abandono</option>
              <option value="modification">Modificación</option>
              <option value="pumping">Desagote</option>
              <option value="replacement">Reemplazo</option>
              <option value="plumbing">Plomería</option>
              <option value="inspection">Inspección</option>
              <option value="installation">Instalación</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="other">Otro</option>
            </select>
            {errors.workType && (
              <p className="text-red-500 text-xs mt-1">{errors.workType}</p>
            )}
          </div>

          {/* Link to existing work */}
          {!editingWork && (
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-gray-700">🔗 Vincular con Trabajo Existente (Opcional)</h3>
                <button
                  type="button"
                  onClick={() => setShowWorkSearch(!showWorkSearch)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <FaSearch />
                </button>
              </div>

              {showWorkSearch && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Buscar por dirección, nombre del cliente... (filtrado instantáneo)"
                      value={workSearchQuery}
                      onChange={(e) => setWorkSearchQuery(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                    {workSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setWorkSearchQuery('')}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  {filteredClientWorks && filteredClientWorks.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      <div className="text-xs text-gray-500 mb-2">Mostrando {filteredClientWorks.length} de {clientWorks?.length || 0} trabajos</div>
                      {filteredClientWorks.map(work => (
                        <div
                          key={work.id}
                          onClick={() => selectLinkedWork(work)}
                          className="p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50"
                        >
                          <div className="font-medium text-gray-700">{work.propertyAddress}</div>
                          <div className="text-xs text-gray-500">
                            Cliente: {work.clientData?.name || 'No disponible'} - Status: {work.status}
                          </div>
                          {work.clientData?.email && (
                            <div className="text-xs text-gray-500">Email: {work.clientData.email}</div>
                          )}
                          {work.clientData?.company && (
                            <div className="text-xs text-gray-500">Empresa: {work.clientData.company}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      {workSearchQuery ? 'No se encontraron trabajos con esa búsqueda' : 'No hay trabajos disponibles para vinculación'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Property Address */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-700 mb-4">🏠 Property Address</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Address *
              </label>
              <input
                type="text"
                placeholder="123 Main Street, City, State ZIP"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.address ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {errors.address && (
                <p className="text-red-500 text-xs mt-1">{errors.address}</p>
              )}
            </div>
          </div>

          {/* Customer Client */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-700 mb-4">👤 CUSTOMER CLIENT</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  placeholder="Cliente Name"
                  autoComplete="off"
                  value={`${formData.firstName} ${formData.lastName}`.trim()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNameFilter(val);
                    setShowNameSuggestions(true);
                    const names = val.split(' ');
                    handleInputChange('firstName', names[0] || '');
                    handleInputChange('lastName', names.slice(1).join(' ') || '');
                  }}
                  onFocus={() => {
                    const current = `${formData.firstName} ${formData.lastName}`.trim();
                    setNameFilter(current);
                    setShowNameSuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.firstName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {showNameSuggestions && filteredNameSuggestions.length > 0 && (
                  <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
                    {filteredNameSuggestions.map((client, i) => (
                      <li
                        key={i}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                        onMouseDown={() => {
                          const names = client.name.split(' ');
                          handleInputChange('firstName', names[0] || '');
                          handleInputChange('lastName', names.slice(1).join(' ') || '');
                          if (client.email) handleInputChange('email', client.email);
                          if (client.phone) handleInputChange('phone', client.phone);
                          setShowNameSuggestions(false);
                        }}
                      >
                        <span className="font-medium text-gray-800">{client.name}</span>
                        {client.email && (
                          <span className="text-gray-400 ml-2 text-xs">{client.email}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {errors.phone && (
                  <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Items Section - Using DynamicCategorySection like CreateBudget */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-700 mb-4">📋 Items del Presupuesto</h3>
            
            <div className="space-y-4">
              {/* Tabla inline de items */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="text-left px-3 py-2 rounded-tl-lg w-36">Included</th>
                      <th className="text-left px-3 py-2">Descripción</th>
                      <th className="text-center px-3 py-2 w-20">Cant.</th>
                      <th className="text-center px-3 py-2 w-28">Precio Unit.</th>
                      <th className="text-right px-3 py-2 w-28">Total</th>
                      <th className="text-center px-3 py-2 w-12 rounded-tr-lg"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.tempId || index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={item.category || ''}
                            onChange={(e) => {
                              const updated = [...items];
                              updated[index] = { ...updated[index], category: e.target.value };
                              setItems(updated);
                            }}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            placeholder="Ej: LABOR, PIPE..."
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={item.description || item.name || ''}
                            onChange={(e) => {
                              const updated = [...items];
                              updated[index] = { ...updated[index], description: e.target.value, name: e.target.value };
                              setItems(updated);
                            }}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            placeholder="Descripción del item..."
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            value={item.quantity || 1}
                            onChange={(e) => {
                              const updated = [...items];
                              const qty = parseFloat(e.target.value) || 0;
                              updated[index] = {
                                ...updated[index],
                                quantity: qty,
                                totalCost: qty * (parseFloat(updated[index].unitCost) || 0),
                                finalCost: qty * (parseFloat(updated[index].unitCost) || 0)
                              };
                              setItems(updated);
                            }}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm text-center"
                            min="0.01"
                            step="0.01"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                              type="number"
                              value={item.unitCost || 0}
                              onChange={(e) => {
                                const updated = [...items];
                                const price = parseFloat(e.target.value) || 0;
                                updated[index] = {
                                  ...updated[index],
                                  unitCost: price,
                                  totalCost: (parseFloat(updated[index].quantity) || 1) * price,
                                  finalCost: (parseFloat(updated[index].quantity) || 1) * price
                                };
                                setItems(updated);
                              }}
                              className="w-full pl-5 pr-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm text-right"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-1 text-right font-medium text-gray-800">
                          ${(parseFloat(item.totalCost) || 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => setItems(items.filter((_, i) => i !== index))}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <FaTrash size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Agregar nueva línea */}
              <button
                type="button"
                onClick={() => {
                  setItems([...items, {
                    id: null,
                    tempId: generateTempId(),
                    category: '',
                    name: '',
                    description: '',
                    quantity: 1,
                    unit: 'ea',
                    unitCost: 0,
                    totalCost: 0,
                    discount: 0,
                    finalCost: 0,
                    budgetItemId: null,
                    isFromTemplate: false,
                    templateItemId: null
                  }]);
                }}
                className="w-full px-4 py-2.5 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition-colors font-medium"
              >
                + Agregar Línea
              </button>

              {/* Totales y descuento */}
              {items.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  
                  {/* Subtotal */}
                  <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                    <span>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''}):</span>
                    <span className="font-medium">${items.reduce((sum, item) => sum + (parseFloat(item.totalCost) || 0), 0).toFixed(2)}</span>
                  </div>

                  {/* Discount section */}
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Descuento:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={discountPercentage}
                        onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                    {discountPercentage > 0 && (
                      <span className="text-sm text-red-500">-${(
                        items.reduce((sum, item) => sum + (parseFloat(item.totalCost) || 0), 0) * (discountPercentage / 100)
                      ).toFixed(2)}</span>
                    )}
                  </div>

                  {/* Total final */}
                  <div className="flex justify-between items-center text-lg font-bold text-gray-900 border-t border-gray-300 pt-2 mt-2">
                    <span>Total:</span>
                    <span className="text-green-700">${(
                      items.reduce((sum, item) => sum + (parseFloat(item.totalCost) || 0), 0) * (1 - discountPercentage / 100)
                    ).toFixed(2)}</span>
                  </div>

                  {/* Payment Percentage section - like Budget */}
                  <div className="mt-4 p-3 bg-green-50 rounded">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Porcentaje de Pago Inicial (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={initialPaymentPercentage}
                      onChange={(e) => setInitialPaymentPercentage(parseFloat(e.target.value) || 100)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                    />
                    <span className="ml-2 text-sm text-gray-600">
                      {(() => {
                        const itemsTotal = items.reduce((sum, item) => {
                          const itemTotal = parseFloat(item.totalCost) || 0;
                          return sum + itemTotal;
                        }, 0);
                        const totalAfterDiscount = itemsTotal * (1 - discountPercentage/100);
                        const initialPayment = totalAfterDiscount * (initialPaymentPercentage/100);
                        const remainingAmount = totalAfterDiscount - initialPayment;
                        
                        return (
                          <>
                            {initialPaymentPercentage === 100 
                              ? `Pago completo: $${totalAfterDiscount.toFixed(2)}`
                              : (
                                <>
                                  Pago inicial: ${initialPayment.toFixed(2)}
                                  <span className="ml-2 text-orange-600">
                                    (Restante: ${remainingAmount.toFixed(2)})
                                  </span>
                                </>
                              )
                            }
                          </>
                        );
                      })()}
                    </span>
                  </div>
                </div>
              )}
              
              {errors.items && (
                <p className="text-red-500 text-xs mt-1">{errors.items}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-blue-600">Título PDF:</span>
              <input
                type="text"
                value={formData.descriptionTitle}
                onChange={(e) => handleInputChange('descriptionTitle', e.target.value)}
                className="px-2 py-1 border border-blue-300 rounded text-sm font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1"
                placeholder="DESCRIPTION"
              />
            </div>
            <textarea
              placeholder="Describe el trabajo a realizar... (dejar vacío para no imprimir en PDF)"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.description && (
              <p className="text-red-500 text-xs mt-1">{errors.description}</p>
            )}
          </div>

          {/* Notes */}
          <div className="border border-green-200 rounded-lg p-4 bg-green-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-green-600">Título PDF:</span>
              <input
                type="text"
                value={formData.notesTitle}
                onChange={(e) => handleInputChange('notesTitle', e.target.value)}
                className="px-2 py-1 border border-green-300 rounded text-sm font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-green-500 flex-1"
                placeholder="NOTES"
              />
            </div>
            <textarea
              placeholder="Notas adicionales (dejar vacío para no imprimir en PDF)..."
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Terms and Conditions */}
          <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-amber-600">Título PDF:</span>
              <input
                type="text"
                value={formData.termsTitle}
                onChange={(e) => handleInputChange('termsTitle', e.target.value)}
                className="px-2 py-1 border border-amber-300 rounded text-sm font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 flex-1"
                placeholder="TERMS & CONDITIONS"
              />
            </div>
            <textarea
              placeholder="Ej: Payment is due upon completion. Materials are guaranteed for 1 year... (dejar vacío para no imprimir)"
              value={formData.termsAndConditions}
              onChange={(e) => handleInputChange('termsAndConditions', e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            />
            <p className="text-xs text-amber-600 mt-1">
              Este texto se imprimirá al final del presupuesto, debajo de los totales
            </p>
          </div>

          {/* Attachments Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📎 Archivos Adjuntos (Planos, Documentos)
            </label>
            
            {/* Upload button */}
            <div className="mb-4">
              <label className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 inline-block">
                {isUploadingAttachment ? 'Subiendo...' : 'Subir Archivo'}
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.mkv,.webm,.pdf"
                  disabled={isUploadingAttachment}
                />
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Formatos permitidos: JPG, PNG, GIF, MP4, MOV, AVI, MKV, WEBM, PDF (máx. 100MB)
              </p>
            </div>

              {/* Attachments list */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((attachment) => {
                    const isImage = attachment.type?.includes('image');
                    const isVideo = attachment.type?.includes('video') || attachment.filename?.match(/\.(mp4|mov|avi|mkv|webm)$/i);
                    return (
                      <div key={attachment.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {isImage ? (
                              <img
                                src={attachment.url}
                                alt={attachment.filename}
                                className="w-10 h-10 object-cover rounded"
                              />
                            ) : isVideo ? (
                              <div className="relative w-10 h-10 bg-black rounded">
                                <video src={attachment.url} className="w-10 h-10 object-cover rounded" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </div>
                              </div>
                            ) : (
                              <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                                <span className="text-blue-600 text-xs font-bold">
                                  {attachment.filename?.split('.').pop()?.toUpperCase() || 'DOC'}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{attachment.filename}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(attachment.uploadedAt).toLocaleDateString()} - 
                              {attachment.size ? ` ${(attachment.size / 1024).toFixed(0)}KB` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Ver
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(attachment.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {attachments.length === 0 && (
                <p className="text-gray-500 text-sm italic">No hay archivos adjuntos</p>
              )}
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <FaCheck />
              {editingWork ? 'Actualizar Trabajo' : 'Crear Trabajo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdvancedCreateSimpleWorkModal;