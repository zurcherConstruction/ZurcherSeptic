import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { fetchBudgets, fetchBudgetById, updateBudget, fetchContactCompanies } from "../../Redux/Actions/budgetActions";
import { fetchWorks } from "../../Redux/Actions/workActions"; // 🆕 Para refrescar works cuando se actualiza permit
import { toast } from 'react-toastify'; // 🆕 Para notificaciones
// ✅ AGREGAR ESTAS IMPORTACIONES:
import { fetchBudgetItems } from "../../Redux/Actions/budgetItemActions";
import { fetchStaff } from "../../Redux/Actions/adminActions"; // 🆕 Para cargar sales reps
import DynamicCategorySection from './DynamicCategorySection';
import EditClientDataModal from './EditClientDataModal';
import EditPermitFieldsModal from './EditPermitFieldsModal'; // 🆕 NUEVO
import PdfModal from './PdfModal'; // 🆕 Para vista previa de PDFs
import { parseISO, format } from 'date-fns';
import { unwrapResult } from '@reduxjs/toolkit';
import { ArrowTopRightOnSquareIcon, PencilIcon, EyeIcon } from '@heroicons/react/24/outline';
import api from "../../utils/axios";

// --- Helper para generar IDs temporales ---
const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// 🆕 Helper para normalizar contactCompany a Title Case
const normalizeCompanyName = (name) => {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const EditBudget = () => {
  
  // ✅ Función para formatear fechas de YYYY-MM-DD a MM-DD-YYYY
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    
    // dateString viene como "YYYY-MM-DD" del backend
    const [year, month, day] = dateString.split('-');
    
    if (!year || !month || !day) {
      console.error("Invalid date format:", dateString);
      return "Invalid Date";
    }
    
    // Retornar en formato MM-DD-YYYY
    return `${month}-${day}-${year}`;
  };

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { budgetId } = useParams(); // ✅ Obtener budgetId de la URL

  // --- Selectores de Redux ---
  const {
    budgets = [],
    currentBudget,
    loading: loadingList,
    error: listError,
    loadingCurrent: loadingCurrentBudget,
    errorCurrent: currentBudgetError,
  } = useSelector(state => state.budget);

  // ✅ AGREGAR SELECTOR PARA BUDGET ITEMS:
  const {
    items: budgetItemsCatalog = [],
    loading: loadingCatalog,
    error: catalogError
  } = useSelector(state => state.budgetItems);

  // ✅ AGREGAR SELECTOR PARA STAFF (Sales Reps):
  const { staffList = [], loading: loadingStaff } = useSelector(state => state.admin) || {};
  const salesReps = staffList.filter(s => (s.role === 'sales_rep' || s.role === 'recept') && s.isActive);
 

 

  // --- Estados Locales ---
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState(null);
  const [formData, setFormData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingFile, setViewingFile] = useState(false);
  const [showClientDataModal, setShowClientDataModal] = useState(false);
  const [showEditPermitFieldsModal, setShowEditPermitFieldsModal] = useState(false); // 🆕 NUEVO
  const [forceFormDataRefresh, setForceFormDataRefresh] = useState(0); // 🆕 Para forzar actualización

  // Estados para reemplazar PDFs del Permit
  const [showReplacePermitPdfModal, setShowReplacePermitPdfModal] = useState(false);
  const [showReplaceOptionalDocsModal, setShowReplaceOptionalDocsModal] = useState(false);
  const [newPermitPdfFile, setNewPermitPdfFile] = useState(null);
  const [newOptionalDocsFile, setNewOptionalDocsFile] = useState(null);
  const [uploadingPermitPdf, setUploadingPermitPdf] = useState(false);
  const [uploadingOptionalDocs, setUploadingOptionalDocs] = useState(false);

  // 🆕 Estados para carga manual de PDF firmado
  const [showManualSignatureUpload, setShowManualSignatureUpload] = useState(false);
  const [manualSignedPdfFile, setManualSignedPdfFile] = useState(null);
  const [uploadingManualSignedPdf, setUploadingManualSignedPdf] = useState(false);

  // 🆕 Estados para carga manual de PPI firmado
  const [showPPIManualSignatureUpload, setShowPPIManualSignatureUpload] = useState(false);
  const [ppiManualSignedPdfFile, setPpiManualSignedPdfFile] = useState(null);
  const [uploadingPPIManualSignedPdf, setUploadingPPIManualSignedPdf] = useState(false);

  // 🆕 Estados para vista previa de PDFs
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalUrl, setPdfModalUrl] = useState('');
  const [pdfModalTitle, setPdfModalTitle] = useState('');
  const [loadingPdfType, setLoadingPdfType] = useState(null); // 'budget', 'permit', 'optional', o null

  const [manualItemData, setManualItemData] = useState({
    category: "",
    customCategory: "",
    name: "",
    unitPrice: "", // Usar string para el input
    quantity: "1", // Default a 1 como string
    notes: "",
    description: "", // ✅ AGREGAR DESCRIPTION
  });

  // ✅ AGREGAR ESTADOS PARA SISTEMA DINÁMICO:
  const [dynamicSectionVisibility, setDynamicSectionVisibility] = useState({});

  // 🆕 Estado para información de referidos externos
  const [externalReferralInfo, setExternalReferralInfo] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    commissionAmount: ''
  });

  // 🆕 Comisión manual editable para staff interno (sales_rep / recept)
  const [staffCommissionOverride, setStaffCommissionOverride] = useState('');

  // 🆕 Lista de contactCompany existentes para autocomplete
  const [contactCompanies, setContactCompanies] = useState([]);
  const [showContactDropdown, setShowContactDropdown] = useState(false); // 🆕 Control dropdown contactCompany
  const [contactSearchTerm, setContactSearchTerm] = useState(''); // 🆕 Término de búsqueda para filtrar

  // --- Cargar Lista de Budgets para Búsqueda ---
  useEffect(() => {
    // Cargar TODOS los presupuestos disponibles (hasta 1000)
    dispatch(fetchBudgets({ pageSize: 1000, page: 1 }));
  }, [dispatch]);

  // ✅ AGREGAR EFECTO PARA CARGAR CATÁLOGO:
  useEffect(() => {
    dispatch(fetchBudgetItems());
  }, [dispatch]);

  // 🆕 Cargar lista de staff al montar
  useEffect(() => {
    dispatch(fetchStaff()); // Usar la acción correcta
  }, [dispatch]);

  // 🆕 Cargar contactCompanies para autocomplete
  useEffect(() => {
    const loadContactCompanies = async () => {
      try {
        const result = await dispatch(fetchContactCompanies());
        if (result.payload) {
          setContactCompanies(result.payload);
          console.log(`✅ ${result.payload.length} contactCompanies cargados`);
        }
      } catch (error) {
        console.error('❌ Error cargando contactCompanies:', error);
      }
    };
    loadContactCompanies();
  }, [dispatch]);

  // ✅ NUEVO: Cargar presupuesto automáticamente si viene budgetId en la URL
  useEffect(() => {
    if (budgetId && !selectedBudgetId) {
      console.log('🔍 Cargando presupuesto desde URL:', budgetId);
      const numericId = Number(budgetId);
      setSelectedBudgetId(numericId);
      dispatch(fetchBudgetById(numericId));
    }
  }, [budgetId, selectedBudgetId, dispatch]);

  // Actualiza el filtro en la línea ~45:
const editableBudgets = useMemo(() => {
  // ✅ ESTADOS EDITABLES (alineados con el modelo Budget)
  const allowedStatus = [
    "draft",              // Borrador inicial
    "pending_review",     // En revisión del cliente
    "client_approved",    // Cliente aprobó
    "created",            // Recién creado (default)
    "send",               // Marcado para enviar
    "sent",               // Ya enviado por email
    "pending",            // Pendiente de respuesta
    "sent_for_signature", // Enviado para firma
    "rejected",           // Rechazado (para reenvío)
    "notResponded",       // Sin respuesta
    // ⚠️ EDICIÓN LIMITADA: Permitir editar solo datos del Permit (NO del Budget)
    // isBudgetLocked protege contra cambios en Budget cuando tiene pago registrado
    "signed",             // ⚠️ Firmado (editable solo Permit, Budget bloqueado si tiene pago)
    "approved"            // ⚠️ Aprobado (editable solo Permit, Budget bloqueado por isBudgetLocked)
  ];
  return (budgets || []).filter(budget => allowedStatus.includes(budget.status));
}, [budgets]);
  // ✅ AGREGAR LÓGICA PARA NORMALIZAR CATÁLOGO:
  const normalizedBudgetItemsCatalog = useMemo(() => {
    return (budgetItemsCatalog || [])
      .filter(item => item.isActive)
      .map(item => ({
        id: item.id,
        name: item.name || '',
        category: item.category || '',
        marca: item.marca || '',
        capacity: item.capacity || '',
        unitPrice: parseFloat(item.unitPrice) || 0,
        description: item.description || '',
        supplierName: item.supplierName || '', // ✅ Incluir supplierName
        imageUrl: item.imageUrl || item.imageurl || '', // ✅ Incluir imageUrl
      }));
  }, [budgetItemsCatalog]);

  // ✅ AGREGAR CATEGORÍAS DISPONIBLES:
  const availableCategories = useMemo(() => {
    const categories = normalizedBudgetItemsCatalog.map(item => item.category).filter(Boolean);
    return [...new Set(categories)].sort();
  }, [normalizedBudgetItemsCatalog]);

  // --- Obtener Direcciones Únicas para Datalist (desde los editables) ---
  const uniqueAddresses = useMemo(() => {
    if (!editableBudgets || editableBudgets.length === 0) return [];
    const addresses = editableBudgets
      .map(budget => budget.propertyAddress?.trim())
      .filter(Boolean);
    return [...new Set(addresses)].sort();
  }, [editableBudgets]);

  // ⚠️ Determinar si el Budget tiene comprobante de pago cargado
  // Solo bloquear si ya tiene paymentInvoice o paymentProofAmount (se convirtió en Work)
  const isBudgetLocked = useMemo(() => {
    if (!currentBudget) return false;
    
    // Bloquear si tiene URL de comprobante
    if (currentBudget.paymentInvoice && currentBudget.paymentInvoice.trim() !== '') return true;
    
    // Bloquear si tiene monto de comprobante registrado
    if (currentBudget.paymentProofAmount && parseFloat(currentBudget.paymentProofAmount) > 0) return true;
    
    // Permitir edición en todos los demás casos
    return false;
  }, [currentBudget]);

  // --- Filtrar Budgets basado en searchTerm (desde los editables) ---
  useEffect(() => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = editableBudgets.filter(budget =>
      budget.propertyAddress?.toLowerCase().includes(lowerCaseSearchTerm) ||
      budget.Permit?.permitNumber?.toLowerCase().includes(lowerCaseSearchTerm) ||
      budget.applicantName?.toLowerCase().includes(lowerCaseSearchTerm)
    );
    setSearchResults(filtered);
  }, [searchTerm, editableBudgets]);

  // --- Cargar Datos del Budget Seleccionado ---
  useEffect(() => {
    // Solo cargar si selectedBudgetId cambió y NO viene de la URL inicial
    if (selectedBudgetId && !budgetId) {
      console.log(`Dispatching fetchBudgetById for ID: ${selectedBudgetId}`);
      setFormData(null);
      dispatch(fetchBudgetById(selectedBudgetId));
    } else if (!selectedBudgetId) {
      setFormData(null);
    }
  }, [selectedBudgetId, budgetId, dispatch]);

  // --- Poblar Estado Local (formData) cuando currentBudget cambia ---
  useEffect(() => {
    // 🔄 SIEMPRE recrear formData si:
    // 1. currentBudget existe y coincide con selectedBudgetId
    // 2. Y (formData no existe OR forceFormDataRefresh está activo)
    // Nota: forceFormDataRefresh > 0 fuerza la recreación incluso si formData ya existe
    const shouldRecreateFormData = currentBudget && 
                                    currentBudget.idBudget === selectedBudgetId && 
                                    (!formData || formData.idBudget !== selectedBudgetId || forceFormDataRefresh > 0);
    
    if (shouldRecreateFormData) {
      try {
        const permitData = currentBudget.Permit || {};
        const lineItemsData = currentBudget.lineItems || [];

        console.log('🔄 Recreando formData con datos actualizados del Permit:', permitData);

        const newFormData = {
          idBudget: currentBudget.idBudget,
          permitNumber: permitData.permitNumber || "",
          propertyAddress: permitData.propertyAddress || currentBudget.propertyAddress || "",
          applicantName: permitData.applicantName || currentBudget.applicantName || "",
          applicantEmail: permitData.applicantEmail || currentBudget.applicantEmail || "", // 🆕 Email
          contactCompany: currentBudget.contactCompany || "", // 🆕 Empresa/contacto
          applicantPhone: permitData.applicantPhone || "",
          lot: permitData.lot || "",
          block: permitData.block || "",
          date: currentBudget.date ? currentBudget.date.split('T')[0] : "",
          expirationDate: currentBudget.expirationDate ? currentBudget.expirationDate.split('T')[0] : "",
          status: currentBudget.status || "created",
          discountDescription: currentBudget.discountDescription || "",
          discountAmount: parseFloat(currentBudget.discountAmount) || 0,
          generalNotes: currentBudget.generalNotes || "",
          initialPaymentPercentage: String(currentBudget.initialPaymentPercentage || 60),
          // 🆕 Campos de comisiones
          leadSource: currentBudget.leadSource || 'web',
          createdByStaffId: currentBudget.createdByStaffId || '',
          lineItems: (currentBudget.lineItems || []).map(item => ({
            _tempId: generateTempId(),
            id: item.id,
            budgetItemId: item.budgetItemId,
            quantity: parseInt(item.quantity) || 0,
            notes: item.notes || '',
            name: item.itemDetails?.name || item.name || 'N/A',
            category: item.itemDetails?.category || item.category || 'N/A',
            marca: item.itemDetails?.marca || item.marca || '',
            capacity: item.itemDetails?.capacity || item.capacity || '',
            unitPrice: parseFloat(item.priceAtTimeOfBudget || item.itemDetails?.unitPrice || item.unitPrice || 0),
            description: item.itemDetails?.description || item.description || '',
            supplierName: item.itemDetails?.supplierName || item.supplierName || '', // ✅ AGREGAR SUPPLIERNAME
          })),
          // ✅ Priorizar URLs de Cloudinary, luego URLs legacy
          pdfDataUrl: permitData.permitPdfUrl || permitData.pdfDataUrl || null,
          optionalDocsUrl: permitData.optionalDocsUrl || null,
          pdfDataFile: null,
          optionalDocsFile: null,
          // 🆕 Campos PPI del Permit
          ppiCloudinaryUrl: permitData.ppiCloudinaryUrl || null,
          ppiSignatureStatus: permitData.ppiSignatureStatus || null,
          ppiSignedPdfUrl: permitData.ppiSignedPdfUrl || null,
          ppiDocusignEnvelopeId: permitData.ppiDocusignEnvelopeId || null,
          PermitIdPermit: permitData.idPermit || null,
          subtotalPrice: 0,
          totalPrice: 0,
          initialPayment: 0,
        };
       
        setFormData(newFormData);
        
        // 🆕 Poblar externalReferralInfo si existe
        if (currentBudget.leadSource === 'external_referral') {
          setExternalReferralInfo({
            name: currentBudget.externalReferralName || '',
            email: currentBudget.externalReferralEmail || '',
            phone: currentBudget.externalReferralPhone || '',
            company: currentBudget.externalReferralCompany || '',
            commissionAmount: currentBudget.salesCommissionAmount || ''
          });
        } else {
          // Resetear si no es external_referral
          setExternalReferralInfo({
            name: '',
            email: '',
            phone: '',
            company: '',
            commissionAmount: ''
          });
        }

        // 🆕 Pre-poblar comisión si el budget tiene sales_rep como leadSource
        if (currentBudget.leadSource === 'sales_rep' && currentBudget.createdByStaffId) {
          const staffMember = staffList.find(s => s.id === currentBudget.createdByStaffId);
          const savedCommission = currentBudget.salesCommissionAmount || currentBudget.customCommissionAmount;
          setStaffCommissionOverride(
            savedCommission ? String(savedCommission)
            : staffMember?.salesRepCommission ? String(staffMember.salesRepCommission)
            : '500'
          );
        } else if (currentBudget.leadSource !== 'external_referral') {
          setStaffCommissionOverride('');
        }
        
        // 🆕 Resetear el flag de forzar refresh después de recrear
        if (forceFormDataRefresh > 0) {
          setForceFormDataRefresh(0);
        }
       

      } catch (error) {
        console.error('❌ Error during setFormData:', error, 'currentBudget was:', currentBudget);
        setFormData(null);
      }
    }
  }, [currentBudget, selectedBudgetId, formData, forceFormDataRefresh]); // 🆕 Agregado forceFormDataRefresh

  // --- Recalcular Totales ---
  useEffect(() => {
    if (!formData) return;

    const subtotal = formData.lineItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      return sum + (quantity * price);
    }, 0);

    const discount = parseFloat(formData.discountAmount) || 0;
    
    // 🆕 Calcular comisión según leadSource
    let commission = 0;
    if (formData.leadSource === 'sales_rep' && formData.createdByStaffId) {
      // Sales rep / recept interno - usar monto manual si fue ingresado
      commission = parseFloat(staffCommissionOverride) || 500;
    } else if (formData.leadSource === 'external_referral' && externalReferralInfo.commissionAmount) {
      commission = parseFloat(externalReferralInfo.commissionAmount) || 0;
    }
    
    const total = subtotal - discount + commission;

    // Calcular pago inicial usando el valor actual del porcentaje (como string en el input)
    let payment = 0;
    const percentageValue = formData.initialPaymentPercentage;
    if (percentageValue === 'total' || percentageValue === '100') {
      payment = total;
    } else {
      const percentage = parseFloat(percentageValue);
      if (!isNaN(percentage) && percentage >= 0) {
        payment = (total * percentage) / 100;
      } else {
        // Si el valor no es válido, usar 60% por defecto
        payment = (total * 60) / 100;
      }
    }

    // Solo actualizar si realmente cambió (evita re-renders innecesarios)
    const subtotalChanged = Math.abs(subtotal - (formData.subtotalPrice || 0)) > 0.01;
    const totalChanged = Math.abs(total - (formData.totalPrice || 0)) > 0.01;
    const paymentChanged = Math.abs(payment - (formData.initialPayment || 0)) > 0.01;
    
    if (subtotalChanged || totalChanged || paymentChanged) {
      setFormData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          subtotalPrice: subtotal,
          totalPrice: total,
          initialPayment: payment,
          // Preservar el valor del porcentaje tal como está (no sobrescribirlo)
        };
      });
    }
  }, [formData?.lineItems, formData?.discountAmount, formData?.initialPaymentPercentage, formData?.leadSource, formData?.createdByStaffId, externalReferralInfo.commissionAmount, staffCommissionOverride, formData?.subtotalPrice, formData?.totalPrice, formData?.initialPayment, staffList]);

  // --- Handlers ---
  const handleGeneralInputChange = (e) => {
    const { name, value } = e.target;
    
    // Para campos numéricos, mantener como string para evitar conversiones no deseadas
    // El parseFloat solo se hace al momento de guardar o calcular
    setFormData(prev => prev ? { ...prev, [name]: value } : null);
    
    // Auto-poblar comisión al seleccionar staff
    if (name === 'createdByStaffId') {
      const selectedStaff = staffList.find(s => s.id === value);
      setStaffCommissionOverride(selectedStaff?.salesRepCommission ? String(selectedStaff.salesRepCommission) : '500');
    }
    // Limpiar override si cambian a otro leadSource
    if (name === 'leadSource' && value !== 'sales_rep') {
      setStaffCommissionOverride('');
    }
  };

  const handleManualItemChange = (e) => {
    const { name, value } = e.target;
    if (name === 'category') {
      setManualItemData(prev => ({
        ...prev,
        category: value,
        customCategory: value === 'other' ? prev.customCategory : '',
      }));
      return;
    }
    setManualItemData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddManualItem = () => {
    // Validaciones básicas
    const unitPriceNum = parseFloat(manualItemData.unitPrice);
    const quantityNum = parseFloat(manualItemData.quantity);

  let categoryValue = manualItemData.category === 'other' ? manualItemData.customCategory : manualItemData.category;
  if (!categoryValue.trim() || !manualItemData.name.trim()) {
    alert("Por favor, completa la categoría y el nombre del item manual.");
    return;
  }
    if (isNaN(unitPriceNum) || unitPriceNum < 0) {
        alert("Por favor, ingresa un precio unitario válido.");
        return;
    }
    if (isNaN(quantityNum) || quantityNum <= 0) {
        alert("Por favor, ingresa una cantidad válida.");
        return;
    }

  const newItem = {
    _tempId: generateTempId(), // ✅ AGREGAR TEMP ID
    id: undefined,
    budgetItemId: null,
    category: categoryValue.trim(),
    name: manualItemData.name.trim(),
    unitPrice: unitPriceNum,
    quantity: quantityNum,
    notes: manualItemData.notes.trim(),
    marca: '',
    capacity: '',
    description: manualItemData.description.trim(), // ✅ INCLUIR DESCRIPTION DEL FORMULARIO
  };

    setFormData(prev => {
        if (!prev) return null;
        return {
            ...prev,
            lineItems: [...prev.lineItems, newItem]
        };
    });

    // Resetear formulario manual
  setManualItemData({ category: "", customCategory: "", name: "", unitPrice: "", quantity: "1", notes: "", description: "" }); // ✅ RESETEAR DESCRIPTION
  };

  // ✅ AGREGAR HANDLERS PARA SISTEMA DINÁMICO:
  const toggleDynamicSection = (category) => {
    setDynamicSectionVisibility(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const addItemFromDynamicSection = (itemData) => {
    const foundItem = normalizedBudgetItemsCatalog.find(catalogItem => {
      let match = catalogItem.name === itemData.name && catalogItem.category === itemData.category;
      
      // Comparar marca si está presente
      if (itemData.marca && itemData.marca !== '') {
        match = match && catalogItem.marca === itemData.marca;
      }
      
      // Comparar capacity si está presente
      if (itemData.capacity && itemData.capacity !== '') {
        match = match && catalogItem.capacity === itemData.capacity;
      }
      
      // ✅ COMPARAR DESCRIPTION para diferenciar items con mismo nombre
      if (itemData.description && itemData.description !== '') {
        match = match && catalogItem.description === itemData.description;
      }
      
      // ✅ COMPARAR SUPPLIERNAME para diferenciar items del mismo producto pero diferentes proveedores
      if (itemData.supplierName && itemData.supplierName !== '') {
        match = match && catalogItem.supplierName === itemData.supplierName;
      }
      
      // ✅ COMPARAR UNITPRICE para items del catálogo (evita duplicados por precio)
      if (itemData.unitPrice !== undefined && itemData.unitPrice !== null) {
        match = match && parseFloat(catalogItem.unitPrice) === parseFloat(itemData.unitPrice);
      }
      
      return match;
    });

    if (foundItem) {
      const newItem = {
        _tempId: itemData._tempId,
        id: undefined, // Nuevo item, no tiene ID en BD todavía
        budgetItemId: foundItem.id,
        name: foundItem.name,
        category: foundItem.category,
        marca: foundItem.marca || '',
        capacity: foundItem.capacity || '',
        unitPrice: foundItem.unitPrice,
        quantity: itemData.quantity,
        notes: itemData.notes || '',
        description: foundItem.description || '', // ✅ INCLUIR DESCRIPTION
        supplierName: itemData.supplierName || foundItem.supplierName || '', // ✅ INCLUIR SUPPLIERNAME
      };

      setFormData(prev => {
        if (!prev) return null;
        const updatedLineItems = [...prev.lineItems, newItem];
        return {
          ...prev,
          lineItems: updatedLineItems
        };
      });
    } else {
      // Item personalizado (manual)
      const newItem = {
        _tempId: itemData._tempId,
        id: undefined,
        budgetItemId: null,
        name: itemData.name,
        category: itemData.category,
        marca: itemData.marca || '',
        capacity: itemData.capacity || '',
        unitPrice: itemData.unitPrice,
        quantity: itemData.quantity,
        notes: itemData.notes || '',
        description: itemData.description || '', // ✅ USAR DESCRIPTION DEL ITEM DATA
        supplierName: itemData.supplierName || '', // ✅ INCLUIR SUPPLIERNAME
      };

      setFormData(prev => {
        if (!prev) return null;
        const updatedLineItems = [...prev.lineItems, newItem];
        return {
          ...prev,
          lineItems: updatedLineItems
        };
      });
    }
  };

  // --- Resto de handlers sin cambios ---
  const handleLineItemChange = (index, field, value) => {
    setFormData(prev => {
      if (!prev) return null;
      const updatedLineItems = [...prev.lineItems];
      updatedLineItems[index] = { ...updatedLineItems[index], [field]: value };
      return { ...prev, lineItems: updatedLineItems };
    });
  };

  const handleRemoveLineItem = (indexToRemove) => {
    setFormData(prev => {
      if (!prev) return null;
      const updatedLineItems = prev.lineItems.filter((_, index) => index !== indexToRemove);
      return { ...prev, lineItems: updatedLineItems };
    });
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    if (files.length > 0) {
      setFormData(prev => prev ? { ...prev, [name]: files[0] } : null);
    }
  };

  const handleSelectBudget = (id) => {
   
    setSelectedBudgetId(id);
    setSearchTerm("");
    setSearchResults([]);
  };

  const handleSearchAgain = () => {
    
    setSelectedBudgetId(null);
    setFormData(null);
    setSearchTerm("");
    setSearchResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData || !selectedBudgetId) {
      alert("No hay datos de formulario o budget seleccionado.");
      return;
    }
    
    setIsSubmitting(true);
   

    // --- 1. Preparar datos para la actualización (Incluyendo status: 'send' si aplica) ---
    const dataToSend = {
      date: formData.date,
      expirationDate: formData.expirationDate || null,
      status: formData.status,
      discountDescription: formData.discountDescription,
      discountAmount: parseFloat(formData.discountAmount) || 0,
      generalNotes: formData.generalNotes,
      initialPaymentPercentage: parseFloat(formData.initialPaymentPercentage) || 60,
      contactCompany: normalizeCompanyName(formData.contactCompany) || null, // 🆕 Normalizado a Title Case
      // 🆕 Campos de comisiones
      leadSource: formData.leadSource,
      createdByStaffId: formData.createdByStaffId || null,
      // 🆕 Campos de external referral (solo si aplica)
      externalReferralName: formData.leadSource === 'external_referral' ? externalReferralInfo.name : null,
      externalReferralEmail: formData.leadSource === 'external_referral' ? externalReferralInfo.email : null,
      externalReferralPhone: formData.leadSource === 'external_referral' ? externalReferralInfo.phone : null,
      externalReferralCompany: formData.leadSource === 'external_referral' ? externalReferralInfo.company : null,
      salesCommissionAmount: formData.leadSource === 'external_referral'
        ? parseFloat(externalReferralInfo.commissionAmount) || 0
        : formData.leadSource === 'sales_rep' && formData.createdByStaffId
          ? parseFloat(staffCommissionOverride) || 500
          : 0,
    };

    console.log('📤 Datos a enviar al backend:', dataToSend);
    console.log('📝 generalNotes específicamente:', formData.generalNotes);

    const lineItemsPayload = formData.lineItems.map(item => ({
      id: item.id,
      budgetItemId: item.budgetItemId,
      category: item.category,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: parseFloat(item.quantity) || 0,
      notes: item.notes,
      marca: item.marca,
      capacity: item.capacity,
      description: item.description,
      supplierName: item.supplierName || undefined, // ✅ INCLUIR SUPPLIERNAME EN PAYLOAD
    }));

    let payload;
    // Verificar si se están actualizando los archivos del PERMIT
    if (formData.pdfDataFile || formData.optionalDocsFile) {
      
      payload = new FormData();
      Object.keys(dataToSend).forEach(key => {
        if (dataToSend[key] !== undefined) {
          payload.append(key, dataToSend[key] === null ? '' : dataToSend[key]);
        }
      });
      payload.append('lineItems', JSON.stringify(lineItemsPayload));
      if (formData.pdfDataFile) payload.append('permitPdfFile', formData.pdfDataFile, formData.pdfDataFile.name);
      if (formData.optionalDocsFile) payload.append('permitOptionalDocsFile', formData.optionalDocsFile, formData.optionalDocsFile.name);
    } else {
     
      payload = { ...dataToSend, lineItems: lineItemsPayload };
    }

   

    try {
     
      const resultAction = await dispatch(updateBudget(selectedBudgetId, payload));
      const updatedBudget = unwrapResult(resultAction);
 
      // ✅ VOLVER A CARGAR EL PRESUPUESTO PARA OBTENER DATOS FRESCOS
      await dispatch(fetchBudgetById(selectedBudgetId));

      alert("Presupuesto actualizado exitosamente!");
      // No hacer handleSearchAgain() para mantener el presupuesto cargado
      // handleSearchAgain();

    } catch (err) {
      console.error("❌ Error durante el proceso de handleSubmit:", err);
      let errorMsg = "Ocurrió un error desconocido.";
      if (err.response) {
        errorMsg = err.response.data?.error || err.response.data?.message || `Error ${err.response.status}`;
      } else if (err.request) {
        errorMsg = "No se pudo conectar con el servidor.";
      } else {
        errorMsg = err.message || errorMsg;
      }
      alert(`Error al actualizar el presupuesto: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
     
    }
  };

  // --- Handler para actualizar datos de cliente ---
  const handleClientDataUpdated = (updatedData) => {
    console.log('🔄 Datos recibidos en handleClientDataUpdated:', updatedData);
    
    // Actualizar formData con los nuevos datos del budget y permit
    setFormData(prev => {
      const newFormData = {
        ...prev,
        applicantName: updatedData.budget?.applicantName || prev.applicantName,
        propertyAddress: updatedData.budget?.propertyAddress || prev.propertyAddress,
        contactCompany: updatedData.budget?.contactCompany || prev.contactCompany, // 🆕 AGREGADO
        // Actualizar también los campos del permit
        applicantEmail: updatedData.permit?.applicantEmail || prev.applicantEmail,
        applicantPhone: updatedData.permit?.applicantPhone || prev.applicantPhone,
      };
      
      console.log('🔄 FormData actualizado:', newFormData);
      return newFormData;
    });

    // También refrescar los datos desde el servidor para asegurar sincronización
    dispatch(fetchBudgetById(selectedBudgetId));
  };

  // Handler para reemplazar PDF del Permit
  const handleReplacePermitPdf = async () => {
    if (!newPermitPdfFile || !currentBudget?.PermitIdPermit) {
      alert('Por favor selecciona un archivo PDF');
      return;
    }

    setUploadingPermitPdf(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('pdfData', newPermitPdfFile);

      await api.put(`/permit/${currentBudget.PermitIdPermit}/replace-pdf`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('PDF del Permit reemplazado exitosamente');
      setShowReplacePermitPdfModal(false);
      setNewPermitPdfFile(null);
      
      // Refrescar datos del budget
      dispatch(fetchBudgetById(selectedBudgetId));
    } catch (err) {
      console.error('Error al reemplazar PDF del Permit:', err);
      
      // Manejar error específico de tamaño de archivo
      const errorData = err.response?.data;
      if (errorData?.error && errorData?.message) {
        // Error estructurado del backend (incluye info de tamaño)
        alert(`❌ ${errorData.message}`);
      } else {
        // Error genérico
        alert(errorData?.error || errorData?.message || 'Error al reemplazar el PDF del Permit');
      }
    } finally {
      setUploadingPermitPdf(false);
    }
  };

  // Handler para reemplazar Optional Docs del Permit
  const handleReplaceOptionalDocs = async () => {
    if (!newOptionalDocsFile || !currentBudget?.PermitIdPermit) {
      alert('Por favor selecciona un archivo PDF');
      return;
    }

    setUploadingOptionalDocs(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('optionalDocs', newOptionalDocsFile);

      await api.put(`/permit/${currentBudget.PermitIdPermit}/replace-optional-docs`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Optional Docs del Permit reemplazados exitosamente');
      setShowReplaceOptionalDocsModal(false);
      setNewOptionalDocsFile(null);
      
      // Refrescar datos del budget
      dispatch(fetchBudgetById(selectedBudgetId));
    } catch (err) {
      console.error('Error al reemplazar Optional Docs del Permit:', err);
      
      // Manejar error específico de tamaño de archivo
      const errorData = err.response?.data;
      if (errorData?.error && errorData?.message) {
        // Error estructurado del backend (incluye info de tamaño)
        alert(`❌ ${errorData.message}`);
      } else {
        // Error genérico
        alert(errorData?.error || errorData?.message || 'Error al reemplazar los Optional Docs del Permit');
      }
    } finally {
      setUploadingOptionalDocs(false);
    }
  };

  // 🆕 Handler para subir PDF firmado manualmente
  const handleManualSignedPdfUpload = async () => {
    console.log('📤 === INICIO DE HANDLEMANULSIGNEDPDFUPLOAD ===');
    console.log('📄 Archivo seleccionado:', manualSignedPdfFile?.name);
    console.log('🎯 Budget ID:', selectedBudgetId);
    
    if (!manualSignedPdfFile || !selectedBudgetId) {
      console.error('❌ Validación fallida:');
      console.log('   - manualSignedPdfFile:', !!manualSignedPdfFile);
      console.log('   - selectedBudgetId:', !!selectedBudgetId);
      toast.error('Por favor selecciona un archivo PDF');
      return;
    }

    console.log('✅ Validación pasada, iniciando carga...');
    setUploadingManualSignedPdf(true);
    
    try {
      const formData = new FormData();
      formData.append('file', manualSignedPdfFile);
      console.log('📦 FormData creado con archivo:', manualSignedPdfFile.name);

      console.log('🌐 Enviando petición POST a /budget/${selectedBudgetId}/upload-manual-signed');
      const response = await api.post(`/budget/${selectedBudgetId}/upload-manual-signed`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('✅ Respuesta recibida:', response.data);
      
      // Status 202 = Procesando en background
      if (response.status === 202) {
        toast.success('📤 PDF recibido, procesando en segundo plano. Actualiza en unos segundos.');
        console.log('🔄 Cerrando modal y limpiando estado...');
        setShowManualSignatureUpload(false);
        setManualSignedPdfFile(null);
        
        // Recargar después de 3 segundos para dar tiempo a que termine la subida
        setTimeout(() => {
          console.log('🔄 Recargando budget desde el servidor...');
          dispatch(fetchBudgetById(selectedBudgetId));
        }, 3000);
      } 
      // Status 200 = Procesado inmediatamente (legacy support)
      else if (response.data.success) {
        toast.success('✅ PDF firmado cargado exitosamente');
        console.log('🔄 Cerrando modal y limpiando estado...');
        setShowManualSignatureUpload(false);
        setManualSignedPdfFile(null);
        
        // Recargar el budget actual para ver los cambios
        console.log('🔄 Recargando budget desde el servidor...');
        dispatch(fetchBudgetById(selectedBudgetId));
      } else {
        console.warn('⚠️ Respuesta no exitosa:', response.data);
      }
    } catch (error) {
      console.error('❌ Error al cargar PDF firmado:', error);
      console.error('   - Status:', error.response?.status);
      console.error('   - Data:', error.response?.data);
      console.error('   - Message:', error.message);
      toast.error(error.response?.data?.error || 'Error al cargar el PDF firmado');
    } finally {
      setUploadingManualSignedPdf(false);
      console.log('🏁 handleManualSignedPdfUpload finalizado');
    }
  };

  // 🆕 Handler para subir PPI firmado manualmente
  const handlePPIManualSignedPdfUpload = async () => {
    console.log('📤 === INICIO DE HANDLEPPIMANULSIGNEDPDFUPLOAD ===');
    console.log('📄 Archivo seleccionado:', ppiManualSignedPdfFile?.name);
    console.log('🎯 Permit ID:', formData?.PermitIdPermit);
    
    if (!ppiManualSignedPdfFile || !formData?.PermitIdPermit) {
      console.error('❌ Validación fallida:');
      console.log('   - ppiManualSignedPdfFile:', !!ppiManualSignedPdfFile);
      console.log('   - PermitIdPermit:', !!formData?.PermitIdPermit);
      toast.error('Por favor selecciona un archivo PDF');
      return;
    }

    console.log('✅ Validación pasada, iniciando carga...');
    setUploadingPPIManualSignedPdf(true);
    
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', ppiManualSignedPdfFile);
      console.log('📦 FormData creado con archivo:', ppiManualSignedPdfFile.name);

      console.log(`🌐 Enviando petición POST a /permit/${formData.PermitIdPermit}/ppi/upload-manual-signed`);
      const response = await api.post(`/permit/${formData.PermitIdPermit}/ppi/upload-manual-signed`, formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('✅ Respuesta recibida:', response.data);
      
      if (response.data.success) {
        toast.success('✅ PPI firmado cargado exitosamente');
        console.log('🔄 Cerrando modal y limpiando estado...');
        setShowPPIManualSignatureUpload(false);
        setPpiManualSignedPdfFile(null);
        
        // Recargar el budget actual para ver los cambios
        console.log('🔄 Recargando budget desde el servidor...');
        dispatch(fetchBudgetById(selectedBudgetId));
      } else {
        console.warn('⚠️ Respuesta no exitosa:', response.data);
      }
    } catch (error) {
      console.error('❌ Error al cargar PPI firmado:', error);
      console.error('   - Status:', error.response?.status);
      console.error('   - Data:', error.response?.data);
      console.error('   - Message:', error.message);
      toast.error(error.response?.data?.error || 'Error al cargar el PPI firmado');
    } finally {
      setUploadingPPIManualSignedPdf(false);
      console.log('🏁 handlePPIManualSignedPdfUpload finalizado');
    }
  };

  // 🆕 Funciones para abrir modales de vista previa de PDFs
  const handleViewBudgetPdf = async () => {
    // Limpiar URL anterior si existe (solo object URLs)
    if (pdfModalUrl && pdfModalUrl.startsWith('blob:')) {
      URL.revokeObjectURL(pdfModalUrl);
      setPdfModalUrl('');
    }

    setLoadingPdfType('budget');
    
    try {
      const budget = currentBudget;
      let response;

      // CASO 1: Firma Manual
      if (budget?.signatureMethod === 'manual' && budget?.manualSignedPdfPath) {
        response = await api.get(`/budget/${budget.idBudget}/view-manual-signed`, {
          responseType: 'blob'
        });
      }
      // CASO 2: Firma SignNow
      else if (budget?.signatureMethod === 'signnow' && budget?.signNowDocumentId) {
        response = await api.get(`/budget/${budget.idBudget}/view-signed`, {
          responseType: 'blob'
        });
      }
      // CASO 3: Budget Legacy con PDF firmado
      else if (budget?.isLegacy && budget?.legacySignedPdfUrl) {
        // Para legacy, usar proxy del backend si existe endpoint
        response = await api.get(`/budget/${budget.idBudget}/view/pdf`, {
          responseType: 'blob'
        });
      }
      // CASO 4: PDF del sistema (generado automáticamente)
      else if (budget?.pdfPath) {
        response = await api.get(`/budget/${budget.idBudget}/view/pdf`, {
          responseType: 'blob'
        });
      }
      else {
        toast.info('No hay PDF de presupuesto disponible');
        setLoadingPdfType(null);
        return;
      }

      // Crear object URL del blob
      const objectUrl = URL.createObjectURL(response.data);
      setPdfModalUrl(objectUrl);
      setPdfModalTitle(`Presupuesto - ${formData?.propertyAddress || 'Budget'}`);
      setPdfModalOpen(true);

    } catch (error) {
      console.error('Error al cargar PDF del presupuesto:', error);
      toast.error('Error al cargar el PDF del presupuesto');
    } finally {
      setLoadingPdfType(null);
    }
  };

  const handleViewPermitPdf = async () => {
    if (!currentBudget?.PermitIdPermit) {
      toast.info('No hay permit asociado');
      return;
    }

    // Limpiar URL anterior si existe (solo object URLs)
    if (pdfModalUrl && pdfModalUrl.startsWith('blob:')) {
      URL.revokeObjectURL(pdfModalUrl);
      setPdfModalUrl('');
    }

    setLoadingPdfType('permit');

    try {
      // Fetch del PDF como blob usando el endpoint del BUDGET (no del permit directamente)
      const response = await api.get(`/budget/${currentBudget.idBudget}/permit-pdf`, {
        responseType: 'blob'
      });

      const objectUrl = URL.createObjectURL(response.data);
      setPdfModalUrl(objectUrl);
      setPdfModalTitle(`Permit - ${formData?.permitNumber || 'N/A'}`);
      setPdfModalOpen(true);

    } catch (error) {
      console.error('Error al cargar PDF del permit:', error);
      if (error.response?.status === 404) {
        toast.info('No hay PDF de permit disponible');
      } else {
        toast.error('Error al cargar el PDF del permit');
      }
    } finally {
      setLoadingPdfType(null);
    }
  };

  const handleViewOptionalDocs = async () => {
    if (!currentBudget?.PermitIdPermit) {
      toast.info('No hay permit asociado');
      return;
    }

    // Limpiar URL anterior si existe (solo object URLs)
    if (pdfModalUrl && pdfModalUrl.startsWith('blob:')) {
      URL.revokeObjectURL(pdfModalUrl);
      setPdfModalUrl('');
    }

    setLoadingPdfType('optional');

    try {
      // Fetch del PDF como blob usando el endpoint del BUDGET (no del permit directamente)
      const response = await api.get(`/budget/${currentBudget.idBudget}/optional-docs`, {
        responseType: 'blob'
      });

      const objectUrl = URL.createObjectURL(response.data);
      setPdfModalUrl(objectUrl);
      setPdfModalTitle(`Optional Docs - ${formData?.propertyAddress || 'Budget'}`);
      setPdfModalOpen(true);

    } catch (error) {
      console.error('Error al cargar documentos opcionales:', error);
      if (error.response?.status === 404) {
        toast.info('No hay documentos opcionales disponibles');
      } else {
        toast.error('Error al cargar documentos opcionales');
      }
    } finally {
      setLoadingPdfType(null);
    }
  };

  // --- Renderizado ---
  return (
    <div className="max-w-4xl mx-auto p-4 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* --- Sección de Búsqueda --- */}
      {!selectedBudgetId && (
        <div className="mb-8 p-6 bg-white rounded-2xl shadow-xl border border-gray-200">
          <label htmlFor="searchAddress" className="block text-base font-semibold text-blue-900 mb-2">
            Search by Address, Permit # or Applicant
          </label>
          <input
            type="text"
            id="searchAddress"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type to search..."
            className="input-style w-full border border-gray-300 rounded-lg px-4 py-2 text-base focus:ring-2 focus:ring-blue-400 focus:border-blue-500"
            list="address-suggestions"
            autoComplete="off"
          />
          <datalist id="address-suggestions">
            {uniqueAddresses.map((address, index) => (
              <option key={index} value={address} />
            ))}
          </datalist>
          {loadingList && <p className="text-sm text-blue-500 mt-2">Searching budgets...</p>}
          {listError && <p className="text-sm text-red-600 mt-2">Error: {listError}</p>}
          {searchResults.length > 0 && (
            <ul className="mt-4 border border-gray-200 rounded-lg max-h-60 overflow-y-auto bg-white shadow">
              {searchResults.map(budget => (
                <li key={budget.idBudget} className="border-b border-gray-100 last:border-b-0">
                  <button
                    onClick={() => handleSelectBudget(budget.idBudget)}
                    className="w-full text-left p-3 hover:bg-blue-50 focus:outline-none focus:bg-blue-100 transition duration-150 ease-in-out rounded-lg"
                  >
                    <p className="font-medium text-base text-blue-900">{budget.propertyAddress}</p>
                    <p className="text-xs text-gray-600">
                      Permit: {budget.Permit?.permitNumber || 'N/A'} | Applicant: {budget.applicantName || 'N/A'} | Date: {budget.date ? formatDate(budget.date) : 'N/A'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchTerm && searchResults.length === 0 && !loadingList && (
            <p className="text-sm text-gray-500 mt-2">No matching budgets found.</p>
          )}
        </div>
      )}

      {/* --- Sección de Edición --- */}
      {selectedBudgetId && (
        <>
          <button onClick={handleSearchAgain} className="mb-4 text-sm text-blue-700 hover:text-blue-900 hover:underline font-semibold">
            &larr; Back
          </button>
          {loadingCurrentBudget && !formData && <div className="text-center p-4 text-blue-600">Loading budget data...</div>}
          {currentBudgetError && !formData && <div className="text-center p-4 text-red-600">Error loading data: {currentBudgetError}</div>}
          {formData && (
            <form onSubmit={handleSubmit} className="space-y-8 bg-white shadow-2xl rounded-2xl p-8 border border-gray-200">
              <div className="border-b border-gray-200 pb-4 mb-6">
                <h3 className="text-2xl font-bold text-blue-900">Edit Budget #{selectedBudgetId}</h3>
                
                {/* 🆕 Barra de Vista Previa de PDFs */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {/* Presupuesto - Siempre mostrar si hay budget */}
                  {currentBudget?.pdfPath && (
                    <button
                      type="button"
                      onClick={handleViewBudgetPdf}
                      disabled={loadingPdfType !== null}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {loadingPdfType === 'budget' ? (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                      Ver Presupuesto
                    </button>
                  )}
                  
                  {/* Permit PDF - Solo mostrar si está disponible */}
                  {currentBudget?.Permit?.hasPermitPdfData && (
                    <button
                      type="button"
                      onClick={handleViewPermitPdf}
                      disabled={loadingPdfType !== null}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {loadingPdfType === 'permit' ? (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                      Ver Permit
                    </button>
                  )}
                  
                  {/* Optional Docs - Solo mostrar si está disponible */}
                  {currentBudget?.Permit?.hasOptionalDocs && (
                    <button
                      type="button"
                      onClick={handleViewOptionalDocs}
                      disabled={loadingPdfType !== null}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {loadingPdfType === 'optional' ? (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                      Ver Optional Docs
                    </button>
                  )}
                </div>
              </div>
              
              {/* ⚠️ Mensaje de Advertencia si el Budget está bloqueado */}
              {isBudgetLocked && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-amber-700">
                        <span className="font-semibold">⚠️ Presupuesto con comprobante de pago:</span> Este presupuesto ya tiene un comprobante de pago cargado y se convirtió en Work. Solo puedes editar datos del cliente y reemplazar PDFs del Permit. Los campos del presupuesto están bloqueados para proteger la integridad del trabajo.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* --- Datos del Permit (No editables) --- */}
              <fieldset className="border border-gray-200 p-4 rounded-lg mb-6">
                <legend className="flex items-center justify-between w-full px-2">
                  <span className="text-lg font-semibold text-blue-800">Permit Information</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {currentBudget?.PermitIdPermit && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowReplacePermitPdfModal(true)}
                          className="inline-flex items-center px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                          📄 Reemplazar Permit
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowReplaceOptionalDocsModal(true)}
                          className="inline-flex items-center px-3 py-2 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                        >
                          📎 Reemplazar Site Plan
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowClientDataModal(true)}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Editar Cliente
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEditPermitFieldsModal(true)}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                    >
                      🔧 Editar Permit
                    </button>
                    
                    {/* 🆕 BOTÓN PARA SUBIR PPI FIRMADO MANUAL - Aparece si hay Permit */}
                    {formData.PermitIdPermit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🔘 === BOTÓN "Subir PPI Firmado" CLICKEADO ===');
                          console.log('   - Permit ID:', formData?.PermitIdPermit);
                          console.log('   - Estado actual showPPIManualSignatureUpload:', showPPIManualSignatureUpload);
                          setShowPPIManualSignatureUpload(true);
                          console.log('   - ✅ Modal debe abrirse ahora (showPPIManualSignatureUpload = true)');
                        }}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        {formData.ppiSignatureStatus === 'completed' 
                          ? 'Reemplazar PPI Firmado' 
                          : '📋 Subir PPI Firmado'
                        }
                      </button>
                    )}
                    
                    {/* 🆕 BOTÓN PARA SUBIR PDF FIRMADO - AHORA FUERA DEL FORM */}
                    {(!formData.signatureMethod || formData.signatureMethod !== 'legacy') && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🔘 === BOTÓN "Subir Presupuesto Firmado" CLICKEADO ===');
                          console.log('   - Budget ID:', selectedBudgetId);
                          console.log('   - Estado actual showManualSignatureUpload:', showManualSignatureUpload);
                          console.log('   - isBudgetLocked:', isBudgetLocked);
                          console.log('   - formData.signatureMethod:', formData?.signatureMethod);
                          setShowManualSignatureUpload(true);
                          console.log('   - ✅ Modal debe abrirse ahora (showManualSignatureUpload = true)');
                        }}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        {formData.signatureMethod === 'signnow' || formData.signatureMethod === 'manual' 
                          ? 'Reemplazar PDF Firmado' 
                          : '📄 Subir PDF Firmado'
                        }
                      </button>
                    )}
                  </div>
                </legend>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Permit #</label>
                    <p className="mt-1 text-base text-gray-900 font-semibold">{formData.permitNumber || 'N/A'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-500">Property Address</label>
                    <p className="mt-1 text-base text-gray-900 font-semibold">{formData.propertyAddress || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Applicant Name</label>
                    <p className="mt-1 text-base text-gray-900 font-semibold">{formData.applicantName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Email</label>
                    <p className="mt-1 text-base text-gray-900 font-semibold">{formData.applicantEmail || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Phone</label>
                    <p className="mt-1 text-base text-gray-900 font-semibold">{formData.applicantPhone || 'N/A'}</p>
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-500 mb-1">Contact/Company</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.contactCompany || ''}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, contactCompany: e.target.value }));
                          setContactSearchTerm(e.target.value);
                          setShowContactDropdown(true);
                        }}
                        onFocus={() => {
                          setContactSearchTerm(formData.contactCompany || '');
                          setShowContactDropdown(true);
                        }}
                        onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                        placeholder="Select existing or type new company"
                        className="mt-1 w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    
                    {/* Dropdown con opciones existentes */}
                    {showContactDropdown && contactCompanies.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
                          Existing Companies ({contactCompanies.filter(c => 
                            c.toLowerCase().includes((contactSearchTerm || '').toLowerCase())
                          ).length})
                        </div>
                        {contactCompanies
                          .filter(company => 
                            company.toLowerCase().includes((contactSearchTerm || '').toLowerCase())
                          )
                          .slice(0, 10)
                          .map((company, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, contactCompany: company }));
                                setShowContactDropdown(false);
                              }}
                              className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              {company}
                            </div>
                          ))
                        }
                        {contactCompanies.filter(c => 
                          c.toLowerCase().includes((contactSearchTerm || '').toLowerCase())
                        ).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500 italic">No matches found - type to add new</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Lot / Block</label>
                    <p className="mt-1 text-base text-gray-900 font-semibold">{formData.lot || 'N/A'} / {formData.block || 'N/A'}</p>
                  </div>
                </div>
              </fieldset>
              {/* --- Datos Generales del Presupuesto (Editables) --- */}
              <fieldset className="border border-gray-200 p-4 rounded-lg mb-6" disabled={isBudgetLocked}>
                <legend className="text-lg font-semibold text-blue-800 px-2">
                  Budget Details
                  {isBudgetLocked && <span className="ml-2 text-xs text-amber-600">(🔒 Bloqueado)</span>}
                </legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
                    <input type="date" id="date" name="date" value={formData.date} onChange={handleGeneralInputChange} className="input-style mt-1" disabled={isBudgetLocked} />
                  </div>
                  <div>
                    <label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700">Expiration Date</label>
                    <input type="date" id="expirationDate" name="expirationDate" value={formData.expirationDate} onChange={handleGeneralInputChange} className="input-style mt-1" disabled={isBudgetLocked} />
                  </div>
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                    <select id="status" name="status" value={formData.status} onChange={handleGeneralInputChange} className="input-style mt-1" disabled={isBudgetLocked}>
                      <option value="created">Created</option>
                      <option value="send">Send</option>
                      <option value="sent">Sent</option>
                      <option value="sent_for_signature">Sent for Signature</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="notResponded">No Response</option>
                      <option value="signed">Signed</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label htmlFor="generalNotes" className="block text-sm font-medium text-gray-700">Notas Generales del Presupuesto</label>
                  <textarea id="generalNotes" name="generalNotes" value={formData.generalNotes} onChange={handleGeneralInputChange} rows="3" className="input-style mt-1" placeholder="Notas generales que aplican a todo el presupuesto..."></textarea>
                </div>

                {/* 🆕 Lead Source & Commission Management */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-blue-900">Lead Source & Commissions</h4>
                    
                    {/* 🆕 BADGES DE ESTADO */}
                    <div className="flex gap-2">
                   
                      {formData.leadSource === 'external_referral' && externalReferralInfo.commissionAmount && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                          </svg>
                          External Ref (${parseFloat(externalReferralInfo.commissionAmount).toFixed(2)})
                        </span>
                      )}
                      {formData.leadSource && !['sales_rep', 'external_referral'].includes(formData.leadSource) && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          No Commission
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* 🆕 INFO PANEL - Resumen del estado actual */}
                  {(formData.leadSource === 'sales_rep' && formData.createdByStaffId) || 
                   (formData.leadSource === 'external_referral' && externalReferralInfo.name) ? (
                    <div className="mb-4 p-3 bg-white border-l-4 border-blue-500 rounded-r-lg shadow-sm">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">Current Commission Configuration:</p>
                          {formData.leadSource === 'sales_rep' && formData.createdByStaffId && (
                            <div className="mt-1 text-sm text-gray-700">
                              <p>• <span className="font-medium">Type:</span> Internal Sales Representative</p>
                              <p>• <span className="font-medium">Assigned to:</span> {salesReps.find(r => r.id === formData.createdByStaffId)?.name || 'Loading...'}</p>
                              <p>• <span className="font-medium">Commission:</span> ${(() => {
                                const selectedStaff = staffList.find(s => s.id === formData.createdByStaffId);
                                const commission = selectedStaff?.salesRepCommission || 500;
                                return (typeof commission === 'number' ? commission : parseFloat(commission) || 500).toFixed(2);
                              })()} {(() => {
                                const selectedStaff = staffList.find(s => s.id === formData.createdByStaffId);
                                return selectedStaff?.salesRepCommission ? '(Custom)' : '(Default)';
                              })()}</p>
                            </div>
                          )}
                          {formData.leadSource === 'external_referral' && externalReferralInfo.name && (
                            <div className="mt-1 text-sm text-gray-700">
                              <p>• <span className="font-medium">Type:</span> External Referral (Non-Staff)</p>
                              <p>• <span className="font-medium">Referral:</span> {externalReferralInfo.name}</p>
                              {externalReferralInfo.company && (
                                <p>• <span className="font-medium">Company:</span> {externalReferralInfo.company}</p>
                              )}
                              <p>• <span className="font-medium">Commission:</span> ${parseFloat(externalReferralInfo.commissionAmount || 0).toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  
                  <div className="mb-4">
                    <label htmlFor="leadSource" className="block text-sm font-medium text-gray-700 mb-1">
                      Lead Source <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="leadSource"
                      name="leadSource"
                      value={formData.leadSource}
                      onChange={handleGeneralInputChange}
                      className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      disabled={isBudgetLocked}
                    >
                      <option value="web">Website / Web Form</option>
                      <option value="direct_client">Direct Client (Walk-in/Call)</option>
                      <option value="social_media">Social Media</option>
                      <option value="referral">Referral (Generic)</option>
                      <option value="sales_rep">Sales Representative (Staff)</option>
                      <option value="external_referral">External Referral (Non-Staff)</option>
                    </select>
                  </div>

                  {/* Sales Rep (solo si leadSource === 'sales_rep') */}
                  {formData.leadSource === 'sales_rep' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="createdByStaffId" className="block text-sm font-medium text-gray-700">
                          Sales Representative <span className="text-red-500">*</span>
                        </label>
                        {formData.createdByStaffId && (
                          <span className="text-xs text-indigo-700 font-medium">
                            ✓ Currently assigned: {salesReps.find(r => r.id === formData.createdByStaffId)?.name || 'Unknown'}
                          </span>
                        )}
                      </div>
                      <select
                        id="createdByStaffId"
                        name="createdByStaffId"
                        value={formData.createdByStaffId}
                        onChange={handleGeneralInputChange}
                        required={formData.leadSource === 'sales_rep'}
                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        disabled={isBudgetLocked}
                      >
                        <option value="">Select a sales representative...</option>
                        {loadingStaff ? (
                          <option disabled>Loading sales reps...</option>
                        ) : salesReps.length === 0 ? (
                          <option disabled>No sales representatives available</option>
                        ) : (
                          salesReps.map(rep => (
                            <option key={rep.id} value={rep.id}>
                              {rep.name} ({rep.email})
                            </option>
                          ))
                        )}
                      </select>
                      <div className="mt-2">
                          <label className="block text-xs font-medium text-indigo-700 mb-1">💰 Commission Amount (USD)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={staffCommissionOverride}
                            onChange={(e) => setStaffCommissionOverride(e.target.value)}
                            placeholder="500"
                            disabled={isBudgetLocked}
                            className="block w-full px-3 py-2 bg-white border-2 border-indigo-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                          <p className="text-xs text-indigo-500 mt-1">Will be added to the client's total price</p>
                        </div>
                    </div>
                  )}

                  {/* External Referral Fields (solo si leadSource === 'external_referral') */}
                  {formData.leadSource === 'external_referral' && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-bold text-green-900">External Referral Information</h5>
                        {externalReferralInfo.name && (
                          <span className="text-xs text-green-700 font-medium">
                            ✓ Currently configured: {externalReferralInfo.name}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Referral Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={externalReferralInfo.name}
                            onChange={(e) => setExternalReferralInfo(prev => ({
                              ...prev,
                              name: e.target.value
                            }))}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="John Doe"
                            required
                            disabled={isBudgetLocked}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={externalReferralInfo.email}
                            onChange={(e) => setExternalReferralInfo(prev => ({
                              ...prev,
                              email: e.target.value
                            }))}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="referral@example.com"
                            disabled={isBudgetLocked}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                          <input
                            type="tel"
                            value={externalReferralInfo.phone}
                            onChange={(e) => setExternalReferralInfo(prev => ({
                              ...prev,
                              phone: e.target.value
                            }))}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="+1 (555) 123-4567"
                            disabled={isBudgetLocked}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                          <input
                            type="text"
                            value={externalReferralInfo.company}
                            onChange={(e) => setExternalReferralInfo(prev => ({
                              ...prev,
                              company: e.target.value
                            }))}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="ABC Real Estate"
                            disabled={isBudgetLocked}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Commission Amount ($) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={externalReferralInfo.commissionAmount}
                            onChange={(e) => setExternalReferralInfo(prev => ({
                              ...prev,
                              commissionAmount: e.target.value
                            }))}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="500.00"
                            min="0"
                            step="0.01"
                            required
                            disabled={isBudgetLocked}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Commission amount that will be added to the client's total price
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </fieldset>
              {/* --- Líneas de Items (Editables: Cantidad y Notas) --- */}
              <fieldset className="border border-gray-200 p-4 rounded-lg mb-6" disabled={isBudgetLocked}>
                <legend className="text-lg font-semibold text-blue-800 px-2">Budget Items {isBudgetLocked && <span className="text-xs text-orange-600">(🔒 Bloqueado)</span>}</legend>
                <div className="space-y-4">
                  {formData.lineItems.map((item, index) => (
                    <div key={item._tempId || item.id || index} className="border-b border-gray-100 pb-4 last:border-b-0">
                      <p className="font-medium text-blue-900">{item.name} <span className="text-xs text-gray-500">({item.category})</span></p>
                      <p className="text-sm text-gray-600">Brand: {item.marca || 'N/A'} | Capacity: {item.capacity || 'N/A'} | Unit Price: ${item.unitPrice.toFixed(2)}</p>
                      {item.supplierName && (
                        <p className="text-sm text-indigo-600 font-medium">Supplier: {item.supplierName}</p>
                      )}
                      {item.description && (
                        <p className="text-sm text-gray-500 italic">Description: {item.description}</p>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                        <div>
                          <label htmlFor={`quantity-${index}`} className="block text-xs font-medium text-gray-700">Quantity</label>
                          <input
                            type="number"
                            id={`quantity-${index}`}
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                            className="input-style mt-1 text-sm"
                            min="0"
                            step="0.01"
                            disabled={isBudgetLocked}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label htmlFor={`notes-${index}`} className="block text-xs font-medium text-gray-700">Item Notes</label>
                          <input
                            type="text"
                            id={`notes-${index}`}
                            value={item.notes}
                            onChange={(e) => handleLineItemChange(index, 'notes', e.target.value)}
                            className="input-style mt-1 text-sm"
                            disabled={isBudgetLocked}
                          />
                        </div>
                      </div>
                      <button type="button" onClick={() => handleRemoveLineItem(index)} className="text-red-500 text-xs mt-1 hover:underline" disabled={isBudgetLocked}>Remove Item</button>
                    </div>
                  ))}
                </div>
              </fieldset>
              {/* --- Agregar Items del Catálogo --- */}
              {!isBudgetLocked && (
              <fieldset className="border border-gray-200 p-4 rounded-lg mb-6">
                <legend className="text-lg font-semibold text-blue-800 px-2">Add Catalog Items</legend>
                
                {loadingCatalog && (
                  <p className="text-sm text-blue-500 mb-4">Cargando catálogo de items...</p>
                )}
                
                {catalogError && (
                  <p className="text-sm text-red-600 mb-4">Error al cargar catálogo: {catalogError}</p>
                )}

                {!loadingCatalog && !catalogError && availableCategories.length > 0 && (
                  <div className="space-y-3">
                    {availableCategories.map(category => (
                      <DynamicCategorySection
                        key={category}
                        category={category}
                        normalizedCatalog={normalizedBudgetItemsCatalog}
                        isVisible={dynamicSectionVisibility[category] || false}
                        onToggle={() => toggleDynamicSection(category)}
                        onAddItem={addItemFromDynamicSection}
                        generateTempId={generateTempId}
                      />
                    ))}
                  </div>
                )}

                {!loadingCatalog && !catalogError && availableCategories.length === 0 && (
                  <p className="text-sm text-gray-500">No hay categorías disponibles en el catálogo.</p>
                )}
              </fieldset>
              )}
              {/* --- Añadir Item Manualmente --- */}
              {!isBudgetLocked && (
              <fieldset className="border border-gray-200 p-4 rounded-lg mb-6">
                <legend className="text-lg font-semibold text-blue-800 px-2">Add Manual Item</legend>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="manualCategory" className="block text-xs font-medium text-gray-700">Categoría</label>
                    <select
                      id="manualCategory"
                      name="category"
                      value={manualItemData.category}
                      onChange={handleManualItemChange}
                      className="input-style mt-1 text-sm"
                    >
                      <option value="">Seleccione una categoría</option>
                      {availableCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="other">Otra...</option>
                    </select>
                    {manualItemData.category === 'other' && (
                      <input
                        type="text"
                        name="customCategory"
                        value={manualItemData.customCategory}
                        onChange={handleManualItemChange}
                        placeholder="Ingrese nueva categoría"
                        className="input-style mt-1 text-sm"
                      />
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="manualName" className="block text-xs font-medium text-gray-700">Nombre del Item</label>
                    <input type="text" id="manualName" name="name" value={manualItemData.name} onChange={handleManualItemChange} className="input-style mt-1 text-sm" placeholder="Ej: NEW SYSTEM INSTALLATION" />
                  </div>
                  <div>
                    <label htmlFor="manualUnitPrice" className="block text-xs font-medium text-gray-700">Precio Unitario ($)</label>
                    <input type="number" id="manualUnitPrice" name="unitPrice" value={manualItemData.unitPrice} onChange={handleManualItemChange} className="input-style mt-1 text-sm" placeholder="Ej: 150.00" min="0" step="0.01" />
                  </div>
                  <div>
                    <label htmlFor="manualQuantity" className="block text-xs font-medium text-gray-700">Cantidad</label>
                    <input type="number" id="manualQuantity" name="quantity" value={manualItemData.quantity} onChange={handleManualItemChange} className="input-style mt-1 text-sm" placeholder="Ej: 1" min="0.01" step="0.01" />
                  </div>
                  <div className="md:col-span-3"> {/* ✅ AGREGAR CAMPO DESCRIPTION */}
                    <label htmlFor="manualDescription" className="block text-xs font-medium text-gray-700">Descripción (Opcional)</label>
                    <textarea
                      id="manualDescription"
                      name="description"
                      value={manualItemData.description}
                      onChange={handleManualItemChange}
                      className="input-style mt-1 text-sm"
                      placeholder="Descripción detallada del item..."
                      rows="3"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label htmlFor="manualNotes" className="block text-xs font-medium text-gray-700">Notas del Item (Opcional)</label>
                    <input type="text" id="manualNotes" name="notes" value={manualItemData.notes} onChange={handleManualItemChange} className="input-style mt-1 text-sm" placeholder="Detalles específicos de este item..." />
                  </div>
                </div>
                <div className="mt-4 text-right">
                  <button
                    type="button"
                    onClick={handleAddManualItem}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  >
                    Añadir Item Manual al Presupuesto
                  </button>
                </div>
              </fieldset>
              )}
              {/* --- Descuento y Totales --- */}
              <fieldset className="border border-gray-200 p-4 rounded-lg mb-6" disabled={isBudgetLocked}>
                <legend className="text-lg font-semibold text-blue-800 px-2">Financial Summary {isBudgetLocked && <span className="text-xs text-orange-600">(🔒 Bloqueado)</span>}</legend>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="discountDescription" className="block text-sm font-medium text-gray-700">Discount Description</label>
                    <input type="text" id="discountDescription" name="discountDescription" value={formData.discountDescription} onChange={handleGeneralInputChange} className="input-style mt-1" disabled={isBudgetLocked} />
                  </div>
                  <div>
                    <label htmlFor="discountAmount" className="block text-sm font-medium text-gray-700">Discount Amount ($)</label>
                    <input type="number" id="discountAmount" name="discountAmount" value={formData.discountAmount} onChange={handleGeneralInputChange} className="input-style mt-1" min="0" step="0.01" disabled={isBudgetLocked} />
                  </div>
                  <div>
                    <label htmlFor="initialPaymentPercentage" className="block text-sm font-medium text-gray-700">Initial Payment %</label>
                    <input 
                      type="number" 
                      id="initialPaymentPercentage" 
                      name="initialPaymentPercentage" 
                      value={formData.initialPaymentPercentage} 
                      onChange={handleGeneralInputChange} 
                      className="input-style mt-1" 
                      min="0" 
                      max="100" 
                      step="1" 
                      disabled={isBudgetLocked}
                      placeholder="60"
                    />
                    <p className="text-xs text-gray-500 mt-1">Por defecto: 60%</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-right">
                  <p className="text-sm text-gray-600">Subtotal: <span className="font-medium text-gray-900">${formData.subtotalPrice.toFixed(2)}</span></p>
                  {(parseFloat(formData.discountAmount) || 0) > 0 && (
                    <p className="text-sm text-gray-600">Discount ({formData.discountDescription || 'General'}): <span className="font-medium text-red-600">-${(parseFloat(formData.discountAmount) || 0).toFixed(2)}</span></p>
                  )}
                  {formData.leadSource === 'sales_rep' && formData.createdByStaffId && (
                    <p className="text-sm text-indigo-600 italic">
                      Sales Commission (internal): <span className="font-semibold">+${(parseFloat(staffCommissionOverride) || 500).toFixed(2)}</span>
                    </p>
                  )}
                  {formData.leadSource === 'external_referral' && externalReferralInfo.commissionAmount && (
                    <p className="text-sm text-green-600 italic">
                      External Referral Commission: <span className="font-semibold">+${parseFloat(externalReferralInfo.commissionAmount || 0).toFixed(2)}</span>
                    </p>
                  )}
                  <p className="text-lg font-semibold text-blue-900">Total: ${formData.totalPrice.toFixed(2)}</p>
                  <p className="text-md font-medium text-blue-700">
                    Initial Payment Required ({formData.initialPaymentPercentage}%): ${formData.initialPayment.toFixed(2)}
                  </p>
                </div>
              </fieldset>
              {/* --- Botón de Envío --- */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-blue-700 text-white rounded-lg font-bold shadow hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 text-lg"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
          {!formData && !loadingCurrentBudget && !currentBudgetError && (
            <div className="text-center p-4 text-orange-600">Could not display form data. Check console.</div>
          )}
        </>
      )}

      {/* Modal para editar datos de cliente */}
      <EditClientDataModal
        isOpen={showClientDataModal}
        onClose={() => setShowClientDataModal(false)}
        budgetId={selectedBudgetId}
        onDataUpdated={handleClientDataUpdated}
      />

      {/* 🆕 Modal para subir/reemplazar PDF firmado manualmente */}
      {showManualSignatureUpload && (
        <div className="fixed inset-0 bg-gray-700 bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <button
              onClick={() => {
                setShowManualSignatureUpload(false);
                setManualSignedPdfFile(null);
              }}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-bold mb-4 text-center text-green-900">
              {formData?.signatureMethod === 'signnow' || formData?.signatureMethod === 'manual' 
                ? 'Reemplazar PDF Firmado' 
                : 'Subir Presupuesto Firmado (PDF)'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar archivo PDF firmado
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    console.log('📁 === ARCHIVO SELECCIONADO ===');
                    console.log('   - Archivo:', e.target.files[0]?.name);
                    console.log('   - Tipo:', e.target.files[0]?.type);
                    console.log('   - Tamaño:', e.target.files[0]?.size, 'bytes');
                    setManualSignedPdfFile(e.target.files[0]);
                  }}
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
                {manualSignedPdfFile && (
                  <p className="mt-2 text-sm text-green-600">
                    ✓ Archivo seleccionado: <span className="font-medium">{manualSignedPdfFile.name}</span>
                  </p>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-xs text-blue-800">
                  📄 Este PDF reemplazará cualquier documento firmado anterior. El presupuesto se marcará como firmado manualmente.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowManualSignatureUpload(false);
                    setManualSignedPdfFile(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  disabled={uploadingManualSignedPdf}
                >
                  Cancelar
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🎯 === BOTÓN "✓ Cargar PDF" CLICKEADO ===');
                    console.log('   - Archivo:', manualSignedPdfFile?.name);
                    console.log('   - Budget ID:', selectedBudgetId);
                    console.log('   - uploadingManualSignedPdf:', uploadingManualSignedPdf);
                    handleManualSignedPdfUpload();
                  }}
                  disabled={!manualSignedPdfFile || uploadingManualSignedPdf}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploadingManualSignedPdf ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Subiendo...
                    </>
                  ) : (
                    <>✓ Cargar PDF</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 Modal para subir/reemplazar PPI firmado manualmente */}
      {showPPIManualSignatureUpload && (
        <div className="fixed inset-0 bg-gray-700 bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <button
              onClick={() => {
                setShowPPIManualSignatureUpload(false);
                setPpiManualSignedPdfFile(null);
              }}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-bold mb-4 text-center text-orange-900">
              {formData?.ppiSignatureStatus === 'completed' 
                ? 'Reemplazar PPI Firmado' 
                : 'Subir PPI Firmado (PDF)'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar archivo PDF firmado del PPI
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    console.log('📁 === ARCHIVO PPI SELECCIONADO ===');
                    console.log('   - Archivo:', e.target.files[0]?.name);
                    console.log('   - Tipo:', e.target.files[0]?.type);
                    console.log('   - Tamaño:', e.target.files[0]?.size, 'bytes');
                    setPpiManualSignedPdfFile(e.target.files[0]);
                  }}
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                />
                {ppiManualSignedPdfFile && (
                  <p className="mt-2 text-sm text-orange-600">
                    ✓ Archivo seleccionado: <span className="font-medium">{ppiManualSignedPdfFile.name}</span>
                  </p>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-xs text-blue-800">
                  📋 Este PDF firmado del PPI reemplazará cualquier documento anterior. El PPI se marcará como firmado manualmente.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowPPIManualSignatureUpload(false);
                    setPpiManualSignedPdfFile(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  disabled={uploadingPPIManualSignedPdf}
                >
                  Cancelar
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🎯 === BOTÓN "✓ Cargar PPI" CLICKEADO ===');
                    console.log('   - Archivo:', ppiManualSignedPdfFile?.name);
                    console.log('   - Permit ID:', formData?.PermitIdPermit);
                    console.log('   - uploadingPPIManualSignedPdf:', uploadingPPIManualSignedPdf);
                    handlePPIManualSignedPdfUpload();
                  }}
                  disabled={!ppiManualSignedPdfFile || uploadingPPIManualSignedPdf}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploadingPPIManualSignedPdf ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Subiendo...
                    </>
                  ) : (
                    <>✓ Cargar PPI</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para reemplazar PDF del Permit */}
      {showReplacePermitPdfModal && (
        <div className="fixed inset-0 bg-gray-700 bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <button
              onClick={() => {
                setShowReplacePermitPdfModal(false);
                setNewPermitPdfFile(null);
              }}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-bold mb-4 text-center text-indigo-900">Reemplazar PDF del Permit</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar nuevo PDF
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setNewPermitPdfFile(e.target.files[0])}
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                />
                {newPermitPdfFile && (
                  <p className="mt-2 text-sm text-green-600">✓ {newPermitPdfFile.name}</p>
                )}
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ Este archivo reemplazará el PDF actual del Permit. Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowReplacePermitPdfModal(false);
                    setNewPermitPdfFile(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  disabled={uploadingPermitPdf}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReplacePermitPdf}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  disabled={!newPermitPdfFile || uploadingPermitPdf}
                >
                  {uploadingPermitPdf ? 'Subiendo...' : 'Reemplazar PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para reemplazar Optional Docs del Permit */}
      {showReplaceOptionalDocsModal && (
        <div className="fixed inset-0 bg-gray-700 bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <button
              onClick={() => {
                setShowReplaceOptionalDocsModal(false);
                setNewOptionalDocsFile(null);
              }}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-bold mb-4 text-center text-green-900">Reemplazar Optional Docs</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar nuevo PDF
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setNewOptionalDocsFile(e.target.files[0])}
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                />
                {newOptionalDocsFile && (
                  <p className="mt-2 text-sm text-green-600">✓ {newOptionalDocsFile.name}</p>
                )}
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ Este archivo reemplazará los Optional Docs actuales. Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowReplaceOptionalDocsModal(false);
                    setNewOptionalDocsFile(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  disabled={uploadingOptionalDocs}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReplaceOptionalDocs}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
                  disabled={!newOptionalDocsFile || uploadingOptionalDocs}
                >
                  {uploadingOptionalDocs ? 'Subiendo...' : 'Reemplazar Docs'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 MODAL: Editar Campos del Permit */}
      {showEditPermitFieldsModal && currentBudget?.PermitIdPermit && (
        <EditPermitFieldsModal
          permitId={currentBudget.PermitIdPermit}
          onClose={() => setShowEditPermitFieldsModal(false)}
          onSuccess={(updatedPermit) => {
           
            
            // 1. Forzar recreación de formData con datos actualizados
            setForceFormDataRefresh(prev => prev + 1);
            
            // 2. Recargar budget completo desde el servidor
            // NOTA: fetchBudgetById actualiza TANTO currentBudget como el budget en la lista global
            // (Ver BudgetReducer.jsx línea 51-53: actualiza state.budgets[index])
            dispatch(fetchBudgetById(selectedBudgetId))
              .then((result) => {
                console.log('🔄 Budget recargado después de generar PPI:', result);
                console.log('🔍 Permit en budget recargado:', result?.payload?.Permit);
                console.log('🔍 ppiCloudinaryUrl en Permit:', result?.payload?.Permit?.ppiCloudinaryUrl);
              });
            
            // 3. 🆕 Refrescar works para actualizar alertas de permit en ProgressTracker
            dispatch(fetchWorks());
            console.log('🔄 Works refrescados - alertas de permit actualizadas');
            
            // 4. 🆕 Limpiar búsqueda para forzar nueva búsqueda con valores actualizados
            setSearchTerm("");
            setSearchResults([]);
            console.log('🔍 Búsqueda limpiada - busca de nuevo con los valores actualizados');
            
            // 5. Cerrar modal después de un delay
            setTimeout(() => {
              setShowEditPermitFieldsModal(false);
              console.log('✅ Datos recargados y modal cerrado');
            }, 1000);
          }}
        />
      )}

      {/* 🆕 MODAL: Vista Previa de PDFs */}
      <PdfModal
        isOpen={pdfModalOpen}
        onClose={() => {
          // Solo revocar si es un object URL (blob:), no si es una URL de Cloudinary
          if (pdfModalUrl && pdfModalUrl.startsWith('blob:')) {
            URL.revokeObjectURL(pdfModalUrl);
          }
          setPdfModalOpen(false);
          setPdfModalUrl('');
          setPdfModalTitle('');
        }}
        pdfUrl={pdfModalUrl}
        title={pdfModalTitle}
      />

      <style>{`.input-style { border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.75rem 1rem; width: 100%; box-sizing: border-box; font-size: 1rem; } .input-style:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #2563eb; box-shadow: 0 0 0 2px #bfdbfe; }`}</style>
    </div>
  );
};

export default EditBudget;