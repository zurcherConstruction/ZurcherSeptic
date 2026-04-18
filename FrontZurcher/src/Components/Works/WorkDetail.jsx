import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWorkById, updateWork, sendChangeOrderToClient, deleteChangeOrder, addImagesToWork } from "../../Redux/Actions/workActions";
import { clearWorkDetails } from "../../Redux/Reducer/workReducer";
import { balanceActions } from "../../Redux/Actions/balanceActions";
import {
  fetchIncomesAndExpensesRequest,
  fetchIncomesAndExpensesSuccess,
  fetchIncomesAndExpensesFailure,
} from "../../Redux/Reducer/balanceReducer"; // Ajusta esta ruta si es necesario
import { useParams, useNavigate } from "react-router-dom";
//import api from "../../utils/axios";
import FinalInvoice from "../Budget/FinalInvoice"
import InspectionFlowManager from "./InspectionFlowManager";
import FinalInspectionFlowManager from "./FinalInspectionFlowManager"
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'; // Para el banner
import CreateChangeOrderModal from './CreateChangeOrderModal'; // Importar el nuevo modal
import ManualApprovalModal from './ManualApprovalModal'; // 🆕 Modal de aprobación manual
import api from "../../utils/axios";
import useAutoRefresh from "../../utils/useAutoRefresh";
import PdfModal from "../Budget/PdfModal"; 
import { fetchInspectionsByWork, registerQuickInspectionResult } from '../../Redux/Actions/inspectionActions';
import WorkNotesModal from './WorkNotesModal';
import NoticeToOwnerCard from './NoticeToOwnerCard';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import useDataLoader from '../../hooks/useDataLoader';
import WorkDetailError from './WorkDetailError';
import WorkChecklistModal from './WorkChecklistModal'; // 📋 Modal de checklist
import { fetchChecklistByWorkId } from '../../Redux/Actions/checklistActions'; // 📋 Action de checklist
import FinalDocumentsSection from './FinalDocumentsSection'; // 🆕 Sección de documentos finales
import ClientPortalLink from './ClientPortalLink'; // 🆕 Portal de cliente
  // --- Estado para modal de resultado rápido de inspección ---
  
// Asegúrate de que esta ruta sea correcta

// URL de la API desde variables de entorno o config
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const WorkDetail = () => {
  const { idWork } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // ✅ Get Redux state - MUST BE BEFORE useEffects that reference them
  const { user, currentStaff } = useSelector((state) => state.auth);
  const staff = currentStaff || user;
  const userRole = staff?.role || '';
  
  const {
    selectedWork: work,
    loading: workLoading,
    error: workError,
  } = useSelector((state) => state.work);
  
  const workRef = useRef(work);
  
  // ✅ Estados para PDFs de Permit - MUST BE DECLARED BEFORE useEffects
  const [permitPdfBlob, setPermitPdfBlob] = useState(null);
  const [optionalDocsBlob, setOptionalDocsBlob] = useState(null);
  const [loadingPermitPdf, setLoadingPermitPdf] = useState(false);
  const [loadingOptionalDocs, setLoadingOptionalDocs] = useState(false);
  
  // ✅ Estados para supplier invoices vinculados
  const [linkedInvoices, setLinkedInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // ✅ Función para formatear fechas de YYYY-MM-DD a MM-DD-YYYY
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    
    // dateString viene como "YYYY-MM-DD" del backend
    const [year, month, day] = dateString.split('-');
    
    if (!year || !month || !day) {
      return "Invalid Date";
    }
    
    // Retornar en formato MM-DD-YYYY
    return `${month}-${day}-${year}`;
  };

  // ✅ Función para formatear fechas completas evitando problemas de timezone
  const formatDateSafe = (dateString) => {
    if (!dateString || dateString === 'null' || dateString === 'undefined') return "N/A";
    
    try {
      // Si viene como YYYY-MM-DD, usar formatDate
      if (typeof dateString === 'string' && dateString.includes('-') && !dateString.includes('T')) {
        return formatDate(dateString);
      }
      
      // Si es timestamp completo, crear fecha ajustando timezone
      const date = new Date(dateString);
      
      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        return "N/A";
      }
      
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${month}-${day}-${year}`;
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return "N/A";
    }
  };

  // ✅ Función para formatear fechas de imágenes con fecha y hora
  const formatImageDateTime = (dateTimeString) => {
    if (!dateTimeString || dateTimeString === 'null' || dateTimeString === 'undefined') return "Sin fecha";
    
    try {
      const date = new Date(dateTimeString);
      
      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        return "Sin fecha";
      }
      
      // Formatear como MM-DD-AAAA HH:MM AM/PM
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 horas debe ser 12
      
      return `${month}-${day}-${year} ${hours}:${minutes} ${ampm}`;
    } catch (error) {
      console.error('Error formatting image dateTime:', dateTimeString, error);
      return "Sin fecha";
    }
  };

  // Refresco automático cada 10 min
  useAutoRefresh(() => fetchWorkById(idWork), 600000, [idWork]);

  // ✅ **CONSOLIDACIÓN DE useEffects - Carga inicial de datos**
  // En lugar de 3 useEffects separados, consolidamos en uno con useDataLoader
  const { 
    loading: initialLoading, 
    error: initialError, 
    load: loadInitialData,
    retry: retryInitialData,
    retryCount: initialRetryCount
  } = useDataLoader(
    async () => {
      if (!idWork) return;

      // Cargar todos los datos en paralelo
      const [workData, inspectionsData, balanceData, checklistData] = await Promise.all([
        // 1. Cargar datos de la obra
        dispatch(fetchWorkById(idWork)),
        
        // 2. Cargar inspecciones
        dispatch(fetchInspectionsByWork(idWork)),
        
        // 3. Cargar balance (incomes y expenses)
        (async () => {
          dispatch(fetchIncomesAndExpensesRequest());
          try {
            const data = await balanceActions.getIncomesAndExpensesByWorkId(idWork);
            if (data.error) {
              console.error("Error fetching incomes/expenses:", data.message);
              dispatch(fetchIncomesAndExpensesFailure(data.message));
              return null;
            }
            dispatch(fetchIncomesAndExpensesSuccess(data));
            return data;
          } catch (err) {
            console.error("Unexpected error fetching incomes/expenses:", err);
            dispatch(fetchIncomesAndExpensesFailure(err.message));
            return null;
          }
        })(),
        
        // 4. Cargar checklist (para roles que pueden verlo)
        ['owner', 'admin', 'finance', 'finance-viewer'].includes(userRole) 
          ? dispatch(fetchChecklistByWorkId(idWork)) 
          : Promise.resolve(null)
      ]);

      return { workData, inspectionsData, balanceData, checklistData };
    },
    {
      onError: (error) => {
        console.error("Error loading WorkDetail data:", error);
      },
      cacheTimeout: 30000, // Cache de 30 segundos
    }
  );

  // Cargar datos cuando cambia idWork
  useEffect(() => {
    //  Limpiar estado de work anterior para prevenir cross-contamination
    dispatch(clearWorkDetails());
    loadInitialData();
  }, [idWork]);

  //  Cargar supplier invoices vinculados
  useEffect(() => {
    const loadLinkedInvoices = async () => {
      if (!idWork) return;
      
      setLoadingInvoices(true);
      try {
        const response = await api.get(`/supplier-invoices/work/${idWork}`);
        if (!response.data.error) {
          setLinkedInvoices(response.data.invoices || []);
        }
      } catch (error) {
        console.error('Error cargando invoices vinculados:', error);
      } finally {
        setLoadingInvoices(false);
      }
    };

    loadLinkedInvoices();
  }, [idWork]);

  // 🆕 Cargar Permit PDF mediante fetch y convertir a blob URL
  useEffect(() => {
    const loadPermitPdf = async () => {
      //  VALIDAR que el work cargado corresponde al idWork de la URL
      if (work && work.idWork !== idWork) {
        console.warn(' [WORKDETAIL] Work cargado no coincide con idWork de URL', {
          workId: work.idWork,
          urlId: idWork,
          propertyAddress: work.propertyAddress
        });
        setPermitPdfBlob(null);
        return;
      }
      
      // Solo cargar si hay URL o publicId (no legacy BLOB)
      if (!work?.Permit?.idPermit || !(work.Permit?.permitPdfUrl || work.Permit?.permitPdfPublicId)) {
        setPermitPdfBlob(null);
        return;
      }
      
      setLoadingPermitPdf(true);
      try {
        const response = await api.get(`/permit/${work.Permit.idPermit}/view/pdf`, {
          responseType: 'blob'
        });
        
        if (response.data) {
          const blob = new Blob([response.data], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          setPermitPdfBlob(blobUrl);
        }
      } catch (error) {
        // Silenciar 404 esperados (archivo no existe)
        if (error.response?.status !== 404) {
          console.error('Error cargando Permit PDF:', error);
        }
        setPermitPdfBlob(null);
      } finally {
        setLoadingPermitPdf(false);
      }
    };

    if (!workLoading && work) {
      loadPermitPdf();
    }

    // Cleanup: revocar blob URL cuando el componente se desmonte
    return () => {
      if (permitPdfBlob) {
        URL.revokeObjectURL(permitPdfBlob);
      }
    };
  }, [work?.Permit?.idPermit, workLoading]);

  // Cargar Optional Docs mediante fetch y convertir a blob URL
  useEffect(() => {
    const loadOptionalDocs = async () => {
      //  VALIDAR que el work cargado corresponde al idWork de la URL
      if (work && work.idWork !== idWork) {
        console.warn(' [WORKDETAIL] Work cargado no coincide con idWork de URL', {
          workId: work.idWork,
          urlId: idWork,
          propertyAddress: work.propertyAddress
        });
        setOptionalDocsBlob(null);
        return;
      }
      
      // Solo cargar si hay URL o publicId (no legacy BLOB)
      if (!work?.Permit?.idPermit || !(work.Permit?.optionalDocsUrl || work.Permit?.optionalDocsPublicId)) {
        setOptionalDocsBlob(null);
        return;
      }
      
      setLoadingOptionalDocs(true);
      try {
        const response = await api.get(`/permit/${work.Permit.idPermit}/view/optional`, {
          responseType: 'blob'
        });
        
        if (response.data) {
          const blob = new Blob([response.data], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          setOptionalDocsBlob(blobUrl);
        }
      } catch (error) {
        // Silenciar 404 esperados (archivo no existe)
        if (error.response?.status !== 404) {
          console.error('Error cargando Optional Docs:', error);
        }
        setOptionalDocsBlob(null);
      } finally {
        setLoadingOptionalDocs(false);
      }
    };

    if (!workLoading && work) {
      loadOptionalDocs();
    }

    // Cleanup: revocar blob URL cuando el componente se desmonte
    return () => {
      if (optionalDocsBlob) {
        URL.revokeObjectURL(optionalDocsBlob);
      }
    };
  }, [work?.Permit?.idPermit, workLoading]);

  // Mostrar error si falla después de reintentos
  if (initialError && initialRetryCount >= 3) {
    return (
      <WorkDetailError 
        error={initialError?.message || "Error al cargar los datos de la obra"}
        onRetry={retryInitialData}
        retryCount={initialRetryCount}
      />
    );
  }

  // ✅ Update workRef when work changes
  useEffect(() => {
    if (workRef.current !== work) {
      workRef.current = work;
    } else {
     
    }
  }, [work]);

  
  const [selectedImage, setSelectedImage] = useState(null);
  const [fileBlob, setFileBlob] = useState(null);
  const [openSections, setOpenSections] = useState({}); // Cambiado a un objeto para manejar múltiples secciones
  const [showFinalInvoice, setShowFinalInvoice] = useState(false);
  const [selectedInstalledImage, setSelectedInstalledImage] = useState(null);
  const [showQuickInspectionModal, setShowQuickInspectionModal] = useState(false);
  const [quickInspectionType, setQuickInspectionType] = useState('initial');
  const [quickInspectionStatus, setQuickInspectionStatus] = useState('approved');
  const [quickInspectionFile, setQuickInspectionFile] = useState(null);
  const [quickInspectionNotes, setQuickInspectionNotes] = useState('');
  const [quickInspectionLoading, setQuickInspectionLoading] = useState(false);
  const [selectedInvoiceModal, setSelectedInvoiceModal] = useState(null);
  
  // 📋 Estados para modal de comprobantes de inspección
  const [showInspectionDocModal, setShowInspectionDocModal] = useState(false);
  const [inspectionDocUrl, setInspectionDocUrl] = useState(null);
  const [inspectionDocTitle, setInspectionDocTitle] = useState('');
  
  // 🆕 Estados para documentos finales
  const [operatingPermitFile, setOperatingPermitFile] = useState(null);
  const [maintenanceServiceFile, setMaintenanceServiceFile] = useState(null);
  const [extraDocumentFile, setExtraDocumentFile] = useState(null);
  const [uploadingOperatingPermit, setUploadingOperatingPermit] = useState(false);
  const [uploadingMaintenanceService, setUploadingMaintenanceService] = useState(false);
  const [uploadingExtraDocument, setUploadingExtraDocument] = useState(false);
  
  const {
    incomes,
    expenses,
    loading: balanceLoading, // Renombrado para evitar conflicto
    error: balanceError, // Renombrado para evitar conflicto
  } = useSelector((state) => state.balance);

  // ✅ Obtener inspecciones del estado de Redux
  const { inspectionsByWork } = useSelector((state) => state.inspection);

  // ✅ Verificar si ya existe una inspección inicial o final APROBADA (solo bloqueamos aprobadas)
  const hasApprovedInitialInspection = useMemo(() => {
    return inspectionsByWork.some(insp => 
      insp.type === 'initial' && 
      insp.finalStatus === 'approved'
    );
  }, [inspectionsByWork]);

  const hasApprovedFinalInspection = useMemo(() => {
    return inspectionsByWork.some(insp => 
      insp.type === 'final' && 
      insp.finalStatus === 'approved'
    );
  }, [inspectionsByWork]);

  // ℹ️ Obtener historial de inspecciones para mostrar
  const initialInspectionsHistory = useMemo(() => {
    const history = inspectionsByWork
      .filter(insp => insp.type === 'initial' && insp.finalStatus)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    console.log('📋 [Inspecciones Iniciales] Historia:', history);
    return history;
  }, [inspectionsByWork]);

  const finalInspectionsHistory = useMemo(() => {
    const history = inspectionsByWork
      .filter(insp => insp.type === 'final' && insp.finalStatus)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    console.log('📋 [Inspecciones Finales] Historia:', history);
    return history;
  }, [inspectionsByWork]);

  // ✅ Permissions based on user role (already declared at top)
  const canUploadImages = ['owner', 'admin', 'worker'].includes(userRole);
  const isViewOnly = userRole === 'finance'; // Finance role is view-only

  const [showCreateCOModal, setShowCreateCOModal] = useState(false);
  const [showEditCOModal, setShowEditCOModal] = useState(false); // Estado para el modal de edición
  const [editingCO, setEditingCO] = useState(null); // Estado para la CO que se está editando
  const [showManualApprovalModal, setShowManualApprovalModal] = useState(false); // 🆕 Modal de aprobación manual
  const [approvingCO, setApprovingCO] = useState(null); // 🆕 CO que se está aprobando manualmente
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showWorkNotesModal, setShowWorkNotesModal] = useState(false); // 📝 Modal de notas
  const [showChecklistModal, setShowChecklistModal] = useState(false); // 📋 Modal de checklist
  const [pdfUrlCo, setPdfUrlCo] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [showUploadFinalInspectionImage, setShowUploadFinalInspectionImage] = useState(false);
  const [finalInspectionImageFile, setFinalInspectionImageFile] = useState(null);
  const [uploadingFinalImage, setUploadingFinalImage] = useState(false);
  const [showUploadInstalledImage, setShowUploadInstalledImage] = useState(false);
  const [installedImageFile, setInstalledImageFile] = useState(null);
  const [uploadingInstalledImage, setUploadingInstalledImage] = useState(false);
  const [installedImageComment, setInstalledImageComment] = useState('');
 const [showBudgetPdfModal, setShowBudgetPdfModal] = useState(false);
const [budgetPdfUrl, setBudgetPdfUrl] = useState('');

  // ✅ New states for general image upload
  const [showUploadImageModal, setShowUploadImageModal] = useState(false);
  const [selectedStage, setSelectedStage] = useState('');
  const [uploadImageFile, setUploadImageFile] = useState(null);
  const [uploadImageComment, setUploadImageComment] = useState('');
  const [truckCount, setTruckCount] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
 
  // --- 1. CALCULAR TOTALES Y BALANCE ---
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    const incomeSum = incomes?.reduce((sum, income) => sum + parseFloat(income.amount || 0), 0) || 0;
    const expenseSum = expenses?.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0) || 0;
    const calculatedBalance = incomeSum - expenseSum;
    return {
      totalIncome: incomeSum,
      totalExpense: expenseSum,
      balance: calculatedBalance,
    };
  }, [incomes, expenses]);


  // --- 1. Consolidar todos los recibos usando useMemo ---
  const allReceipts = useMemo(() => {
    const consolidated = [];

    // --- AÑADIR COMPROBANTE PAGO INICIAL (BUDGET) ---
    if (work?.budget?.paymentInvoice && work.budget.idBudget) { // Asegurarse que hay URL y ID de budget
      let mimeType = 'application/octet-stream'; // Tipo por defecto
      if (work.budget.paymentProofType === 'pdf') {
        mimeType = 'application/pdf';
      } else if (work.budget.paymentProofType === 'image') {
        // Intentar inferir tipo de imagen desde la URL si es posible, sino usar genérico
        const extension = work.budget.paymentInvoice.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg'].includes(extension)) mimeType = 'image/jpeg';
        else if (extension === 'png') mimeType = 'image/png';
        else if (extension === 'gif') mimeType = 'image/gif';
        else mimeType = 'image/jpeg'; // O un tipo de imagen genérico
      }

      // Determinar el monto a mostrar para el comprobante inicial
      const initialPaymentDisplayAmount = work.budget.paymentProofAmount !== null && !isNaN(parseFloat(work.budget.paymentProofAmount))
        ? parseFloat(work.budget.paymentProofAmount).toFixed(2)
        : parseFloat(work.budget.initialPayment || 0).toFixed(2);

      const paymentNotes = work.budget.paymentProofAmount !== null && !isNaN(parseFloat(work.budget.paymentProofAmount))
        ? `Comprobante cargado por $${initialPaymentDisplayAmount}`
        : `Pago inicial del presupuesto por $${initialPaymentDisplayAmount}`;

      consolidated.push({
        idReceipt: `budget-${work.budget.idBudget}-payment`,
        fileUrl: work.budget.paymentInvoice,
        mimeType: mimeType,
        originalName: 'Comprobante Pago Inicial',
        notes: paymentNotes,
        type: 'Comprobante Pago Inicial',
        relatedRecordType: 'Presupuesto',
        relatedRecordDesc: `Pago Inicial (Comprobante: $${initialPaymentDisplayAmount})`,
        // createdAt: work.budget.updatedAt || work.budget.createdAt 
      });
    }
    // --- FIN AÑADIR COMPROBANTE PAGO INICIAL ---

    // Recibos de Work
    if (work?.Receipts) {
      consolidated.push(...work.Receipts.map(r => ({ ...r, relatedRecordType: 'Obra', relatedRecordDesc: work.propertyAddress })));
    }

    // Recibos de Income
    if (incomes) {
      incomes.forEach(income => {
        if (income.Receipts) {
          consolidated.push(...income.Receipts.map(r => ({ ...r, relatedRecordType: 'Ingreso', relatedRecordDesc: `${income.typeIncome} - $${income.amount}` })));
        }
      });
    }

    // Recibos de Expense
    if (expenses) {
      expenses.forEach(expense => {
        if (expense.Receipts) {
          consolidated.push(...expense.Receipts.map(r => ({ ...r, relatedRecordType: 'Gasto', relatedRecordDesc: `${expense.typeExpense} - $${expense.amount}` })));
        }
      });
    }

    // Opcional: Ordenar por fecha si los recibos tienen createdAt/updatedAt
    consolidated.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return consolidated;
  }, [work?.budget, work?.Receipts, incomes, expenses, work?.propertyAddress]); // Dependencias

  // ❌ ELIMINADO: useEffect duplicado para fetchWorkById (ahora en loadInitialData consolidado)
  // ❌ ELIMINADO: useEffect duplicado para fetchInspectionsByWork (ahora en loadInitialData consolidado)
  // ❌ ELIMINADO: useEffect duplicado para fetchBalanceData (ahora en loadInitialData consolidado)


  useEffect(() => {
    const setInvoiceUrl = () => {
      try {
        if (work?.budget?.paymentInvoice) {
          // Si la URL viene del backend, usarla directamente
          setFileBlob(work.budget.paymentInvoice);
        } else {
          setFileBlob(null);
        }
      } catch (error) {
       
        setFileBlob(null);
      }
    };

    setInvoiceUrl();
  }, [work?.budget?.paymentInvoice]);

  // ❌ ELIMINADO: useEffect para fetchBalanceData (ahora en loadInitialData consolidado)

  // ✅ **FUNCIÓN CENTRALIZADA DE REFRESH**
  // Reemplaza los 16 dispatch(fetchWorkById) dispersos por el componente
  const refreshWorkData = useCallback(async (options = {}) => {
    const {
      fullRefresh = false,
      workOnly = false,
      inspectionsOnly = false,
      balanceOnly = false,
      optimistic = false // Para actualizaciones optimistas (no esperar respuesta)
    } = options;

    try {
      if (fullRefresh) {
        // Recargar todo (similar a loadInitialData pero sin cache)
        await loadInitialData(true); // forceRefresh
      } else if (workOnly) {
        // Solo recargar la obra
        await dispatch(fetchWorkById(idWork));
      } else if (inspectionsOnly) {
        // Solo recargar inspecciones
        await dispatch(fetchInspectionsByWork(idWork));
      } else if (balanceOnly) {
        // Solo recargar balance
        dispatch(fetchIncomesAndExpensesRequest());
        const data = await balanceActions.getIncomesAndExpensesByWorkId(idWork);
        if (!data.error) {
          dispatch(fetchIncomesAndExpensesSuccess(data));
        }
      } else {
        // Por defecto, solo recargar la obra (caso más común)
        await dispatch(fetchWorkById(idWork));
      }
    } catch (error) {
      console.error("Error refreshing work data:", error);
      if (!optimistic) {
        // Solo mostrar error si no es actualización optimista
        throw error;
      }
    }
  }, [idWork, dispatch, loadInitialData]);



  // Filtrar imágenes de "sistema instalado"
  const installedImages = useMemo(() => {
    return Array.isArray(work?.images)
      ? work.images.filter(img => img.stage === 'sistema instalado')
      : [];
  }, [work?.images]);

   // Define los estados en los que se debe poder seleccionar una imagen para inspección/reinspección
  const canSelectInspectionImageStates = [
    'installed', // Para inspección inicial
    'rejectedInspection', // Para reinspección de inicial
    'finalRejected' // Para reinspección de final (si tienes un estado así)
    // Añade otros estados si es necesario, por ejemplo, si una reinspección puede pedirse desde 'workerCorrected'
  ];

  // Lógica para determinar el botón a mostrar en el encabezado
  let displayHeaderButton = false;
  let headerButtonText = "";
  let headerButtonAction = null;
  let headerButtonClasses = "text-white font-bold py-2 px-4 rounded shadow-lg transition duration-150 ease-in-out";

  // --- LÓGICA DEL BOTÓN AJUSTADA (SOLO PARA CASOS ESPECIALES) ---

  // Nota: Las transiciones principales ahora son automáticas:
  // - approvedInspection → coverPending (automático cuando se aprueba inspección inicial)
  // - covered → invoiceFinal (automático cuando se envía factura final)
  
  // Solo mantener botones para casos especiales o de respaldo
  if (work?.status === 'approvedInspection') {
    // Botón de respaldo por si la automatización falla
    displayHeaderButton = true;
    headerButtonText = "⚠️ Manual: Cambiar a Pendiente de Cubrir";
    headerButtonClasses += " bg-yellow-500 hover:bg-yellow-600"; // Color de advertencia
    headerButtonAction = async () => {
      
      await dispatch(updateWork(idWork, { status: "coverPending" }));
    };
  } else if (work?.status === 'covered') {
    // Botón de respaldo por si la automatización falla
    displayHeaderButton = true;
    headerButtonText = "⚠️ Manual: Marcar Factura Final Enviada";
    headerButtonClasses += " bg-yellow-600 hover:bg-yellow-700"; // Color de advertencia
    headerButtonAction = async () => {
      
      await dispatch(updateWork(idWork, { status: "invoiceFinal" }));
    };
  }

  const needsStoneExtractionCO = work?.stoneExtractionCONeeded === true;

  const handleSendCOToClient = async (coId) => {
    if (!coId) {
      console.error("ID de Orden de Cambio no válido para enviar.");
      alert("Error: ID de Orden de Cambio no válido.");
      return;
    }
   
    try {
      const result = await dispatch(sendChangeOrderToClient(coId));
      if (result && !result.error) {
        alert(result.message || 'Orden de Cambio enviada al cliente exitosamente!');
        // ✅ Refrescar solo datos de obra (optimizado)
        await refreshWorkData({ workOnly: true });
      } else {
        alert(`Error al enviar la Orden de Cambio: ${result?.message || 'Error desconocido'}`);
      }
    } catch (error) {
      alert(`Error al enviar la Orden de Cambio: ${error.message}`);
    }
    // Opcional: Ocultar indicador de carga
  };
  const handleEditCO = (coToEdit) => {
   
    setEditingCO(coToEdit);
    setShowEditCOModal(true);
  };

  // 🆕 Handler para abrir el modal de aprobación manual
  const handleManualApprove = (coToApprove) => {
    setApprovingCO(coToApprove);
    setShowManualApprovalModal(true);
  };

  const handleDeleteCO = async (coId) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta Orden de Cambio? Esta acción no se puede deshacer.")) return;
    try {
      const result = await dispatch(deleteChangeOrder(coId));
      if (result && result.success) {
        alert("Orden de Cambio eliminada correctamente.");
        // ✅ Refrescar solo datos de obra (optimizado)
        await refreshWorkData({ workOnly: true });
      } else {
        alert(result?.message || "Error al eliminar la Orden de Cambio.");
      }
    } catch (error) {
      alert(error.message || "Error inesperado al eliminar la Orden de Cambio.");
    }
  };

    const handleFinalInspectionImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setFinalInspectionImageFile(event.target.files[0]);
    }
  };

  const handleUploadFinalInspectionImage = async () => {
    if (!finalInspectionImageFile || !work?.idWork) {
      alert("Por favor, selecciona un archivo y asegúrate de que la obra esté cargada.");
      return;
    }

    setUploadingFinalImage(true);
    const formData = new FormData();
    formData.append("imageFile", finalInspectionImageFile);
    formData.append("stage", "inspeccion final");
    formData.append("dateTime", new Date().toISOString()); // ✅ Activando dateTime
    // formData.append("comment", "Imagen para inspección final subida por el administrador.");

    try {
      const result = await dispatch(addImagesToWork(work.idWork, formData));
      if (result && !result.error) {
        alert("Imagen para inspección final subida correctamente.");
        setFinalInspectionImageFile(null);
        setShowUploadFinalInspectionImage(false);
        // ✅ Refrescar solo datos de obra (optimizado)
        await refreshWorkData({ workOnly: true });
      } else {
        alert(`Error al subir la imagen: ${result?.message || 'Error desconocido'}`);
      }
    } catch (error) {
      alert(`Error al subir la imagen: ${error.message}`);
    } finally {
      setUploadingFinalImage(false);
    }
  };

   // Lógica para determinar qué gestor de flujo mostrar
  const showInitialInspectionManager = useMemo(() => {
    if (!work?.status) return false;
    // Estados de la OBRA en los que se muestra el gestor de inspección INICIAL
    const initialWorkStates = [
      'installed',              // Listo para solicitar inspección inicial
      'firstInspectionPending', // Inspección inicial en curso
      'rejectedInspection',     // Inspección inicial rechazada (para gestionar reinspección)
    ];
    return initialWorkStates.includes(work.status);
  }, [work?.status]);

  const showFinalInspectionManager = useMemo(() => {
    if (!work?.status) return false;
    // Estados de la OBRA en los que se muestra el gestor de inspección FINAL
    const finalWorkStates = [
      'approvedInspection',     // Inspección inicial aprobada, listo para flujo final
      'coverPending',           // Si el flujo final puede comenzar o continuar aquí
      'covered',                // Si el flujo final puede comenzar o continuar aquí
      'invoiceFinal',           // Si el flujo final puede comenzar o continuar aquí
      'paymentReceived',        // Si el flujo final puede comenzar o continuar aquí
      'finalInspectionPending', // Inspección final en curso
      'finalRejected',          // Inspección final rechazada (para gestionar nueva solicitud/reinspección final)
      // Los siguientes estados indican que el flujo final ha concluido o está en su etapa final.
      // El FinalInspectionFlowManager puede mostrar un estado de "completado".
      'finalApproved',          // Inspección final aprobada (estado de obra)
      'maintenance',            // Obra en mantenimiento post-aprobación final
    ];
    return finalWorkStates.includes(work.status);
  }, [work?.status]);

  const toggleSection = (section) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleInstalledImageChange = (event) => {
  if (event.target.files && event.target.files[0]) {
    setInstalledImageFile(event.target.files[0]);
  }
};

const handleUploadInstalledImage = async () => {
  if (!installedImageFile || !work?.idWork) {
    alert("Por favor, selecciona un archivo y asegúrate de que la obra esté cargada.");
    return;
  }

  setUploadingInstalledImage(true);
  const formData = new FormData();
  formData.append("imageFile", installedImageFile);
  formData.append("stage", "sistema instalado");
  formData.append("comment", installedImageComment || "Imagen del sistema instalado subida manualmente desde administración");
  formData.append("dateTime", new Date().toISOString());

  try {
    const result = await dispatch(addImagesToWork(work.idWork, formData));
    if (result && !result.error) {
      alert("Imagen del sistema instalado subida correctamente.");
      setInstalledImageFile(null);
      setInstalledImageComment('');
      setShowUploadInstalledImage(false);
      // ✅ Refrescar solo datos de obra (optimizado)
      await refreshWorkData({ workOnly: true });
    } else {
      alert(`Error al subir la imagen: ${result?.message || 'Error desconocido'}`);
    }
  } catch (error) {
    alert(`Error al subir la imagen: ${error.message}`);
  } finally {
    setUploadingInstalledImage(false);
  }
};

const handleShowBudgetPdf = async () => {
  try {
    const budget = work?.budget;
    if (!budget?.idBudget) {
      alert('No se encontró información del presupuesto');
      return;
    }

    // CASO 1: Presupuesto firmado manualmente
    if (budget.signatureMethod === 'manual' && budget.manualSignedPdfPath) {
      const response = await api.get(`/budget/${budget.idBudget}/view-manual-signed`, {
        responseType: 'blob'
      });
      const objectUrl = window.URL.createObjectURL(response.data);
      setBudgetPdfUrl(objectUrl);
      setShowBudgetPdfModal(true);
      return;
    }

    // CASO 2: Presupuesto firmado con SignNow
    if (budget.signatureMethod === 'signnow' && budget.signNowDocumentId) {
      try {
        const response = await api.get(`/budget/${budget.idBudget}/view-signed`, {
          responseType: 'blob'
        });
        const objectUrl = window.URL.createObjectURL(response.data);
        setBudgetPdfUrl(objectUrl);
        setShowBudgetPdfModal(true);
        return;
      } catch (signNowError) {
        // Si falla SignNow, continuar al CASO 3
      }
    }

    // CASO 3: Regenerar PDF sin firma
    const response = await api.get(`/budget/${budget.idBudget}/preview`, { 
      responseType: 'blob' 
    });
    const objectUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    setBudgetPdfUrl(objectUrl);
    setShowBudgetPdfModal(true);
  } catch (e) {
    alert('No se pudo cargar el PDF del presupuesto');
  }
};

// ✅ NEW: General image upload function with stage selection
const handleImageFileChange = (event) => {
  if (event.target.files && event.target.files[0]) {
    setUploadImageFile(event.target.files[0]);
  }
};

const handleUploadImage = async () => {
  if (!uploadImageFile || !work?.idWork || !selectedStage) {
    alert("Por favor, selecciona un archivo y una etapa.");
    return;
  }

  // Validation for truck stages
  const isTruckStage = selectedStage === 'camiones de arena' || selectedStage === 'camiones de tierra';
  if (isTruckStage && (!truckCount || parseInt(truckCount) <= 0)) {
    alert("Por favor, ingresa un número válido de camiones.");
    return;
  }

  setUploadingImage(true);
  const formData = new FormData();
  formData.append("imageFile", uploadImageFile);
  formData.append("stage", selectedStage);
  formData.append("comment", uploadImageComment || `Imagen de ${selectedStage} subida desde administración`);
  formData.append("dateTime", new Date().toISOString());
  
  if (isTruckStage) {
    formData.append("truckCount", parseInt(truckCount));
  }

  try {
    const result = await dispatch(addImagesToWork(work.idWork, formData));
    if (result && !result.error) {
      alert(`Imagen de "${selectedStage}" subida correctamente.`);
      // Reset form
      setUploadImageFile(null);
      setUploadImageComment('');
      setTruckCount('');
      setSelectedStage('');
      setShowUploadImageModal(false);
      // ✅ Refrescar solo datos de obra (optimizado)
      await refreshWorkData({ workOnly: true });
    } else {
      alert(`Error al subir la imagen: ${result?.message || 'Error desconocido'}`);
    }
  } catch (error) {
    alert(`Error al subir la imagen: ${error.message}`);
  } finally {
    setUploadingImage(false);
  }
};



  if (workLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex justify-center items-center h-screen">
          <p className="text-xl text-gray-700">Cargando detalles de la obra...</p>
        </div>
      </div>
    );

  } // probando spiner
  

  if (workError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl font-semibold text-red-500">Error: {workError}</p>
      </div>
    );
  }

  // ✅ Mostrar loading mientras se carga el work (evita mostrar "No se encontró la obra" prematuramente)
  if (initialLoading || workLoading || !work) {
    if (!work) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg font-medium text-gray-600">Cargando información de la obra...</p>
          </div>
        </div>
      );
    }
  }

  const groupedImages = Array.isArray(work.images)
    ? work.images.reduce((acc, image) => {
      if (!acc[image.stage]) acc[image.stage] = [];
      acc[image.stage].push(image);
      return acc;
    }, {})
    : {};

  // ✅ Usar blob URLs cargados mediante fetch (con autenticación) o fallback a BLOB legacy
  const pdfUrl = permitPdfBlob
    ? permitPdfBlob
    : work.Permit?.pdfData 
      ? URL.createObjectURL(
          new Blob([new Uint8Array(work.Permit.pdfData.data)], {
            type: "application/pdf",
          })
        )
      : null;

  const optionalDocs = optionalDocsBlob
    ? optionalDocsBlob
    : work.Permit?.optionalDocs 
      ? URL.createObjectURL(
          new Blob([new Uint8Array(work.Permit.optionalDocs.data)], {
            type: "application/pdf",
          })
        )
      : null;



  // const toggleSection = (section) => {
  //   setOpenSections((prev) => ({
  //     ...prev,
  //     [section]: !prev[section],
  //   }));
  // };

  const finalInvoiceVisibleStates = [
    'approvedInspection',
    'rejectedInspection',
    'coverPending',
    'covered',
    'invoiceFinal',
    'paymentReceived',
    'finalInspectionPending',
    'finalApproved',
    'finalRejected',
    'maintenance',
  ];

  const canShowFinalInvoiceSection = finalInvoiceVisibleStates.includes(work.status);


  const handlePreviewPdf = async (coId) => {
    setPdfLoading(true);
    setPdfError('');
    setPdfUrlCo(''); // Limpiar URL anterior
    setShowPdfModal(true); // Mostrar modal inmediatamente con indicador de carga

    try {
      // La instancia 'api' ya tiene la baseURL y enviará el token
      const response = await api.get(`/change-orders/${coId}/preview-pdf`, {
        responseType: 'blob', // Importante: para recibir datos binarios
      });

      if (response.data) {
        const file = new Blob([response.data], { type: 'application/pdf' });
        const fileURL = URL.createObjectURL(file);
        setPdfUrlCo(fileURL);
      } else {
        throw new Error("No se recibieron datos del PDF.");
      }
    } catch (error) {
      console.error("Error al cargar la vista previa del PDF:", error);
      let message = "Error al cargar el PDF.";
      if (error.response) {
        // Intentar decodificar el error si es un blob (json de error)
        if (error.response.data instanceof Blob && error.response.data.type === "application/json") {
          try {
            const errorJson = JSON.parse(await error.response.data.text());
            message = errorJson.message || message;
          } catch (e) {
            // No hacer nada si no se puede parsear
          }
        } else if (error.response.data && error.response.data.message) {
          message = error.response.data.message;
        } else if (error.response.statusText) {
          message = error.response.statusText;
        }
      } else if (error.message) {
        message = error.message;
      }
      setPdfError(message);
    } finally {
      setPdfLoading(false);
    }
  };


  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Título principal con dirección y estado */}
        <div className="bg-blue-500 text-white p-4 md:p-6 rounded-lg shadow-md mb-6 flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold uppercase break-words">
              {work.propertyAddress}
            </h1>
            <p className="text-lg md:text-xl text-slate-800 p-1 uppercase mt-2 flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0">
              <strong>Status: </strong>
              <span className="ml-0 sm:ml-2 px-3 py-2 text-sm font-medium tracking-wider text-white bg-sky-500 rounded-full shadow-md inline-block">
                {work.status}
              </span>
              {work.status === 'installed' && (
                <span className="ml-0 sm:ml-4 px-3 py-1 bg-yellow-400 text-black text-sm font-bold rounded-full animate-pulse">
                  PEDIR INSPECCIÓN
                </span>
              )}
            </p>
          </div>
          {/* Botones de acción en el encabezado */}
          <div className="flex-shrink-0 w-full lg:w-auto flex flex-col sm:flex-row gap-2">
            {/* 📝 Botón de Notas de Seguimiento */}
            <button
              onClick={() => setShowWorkNotesModal(true)}
              className="flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-yellow-500 rounded-lg shadow-md transition-colors duration-200 w-full sm:w-auto"
            >
              <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2 text-yellow-500" />
              <span className="font-medium">Notas</span>
            </button>
            
            {/* 📋 Botón de Checklist (visible para owner, admin, finance) */}
            {['owner', 'admin', 'finance', 'finance-viewer'].includes(userRole) && (
              <button
                onClick={() => setShowChecklistModal(true)}
                className="flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-colors duration-200 w-full sm:w-auto"
                title={userRole === 'owner' ? 'Verificar checklist de tareas completadas' : 'Ver checklist (solo lectura)'}
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="font-medium">Checklist</span>
              </button>
            )}

            {/* Botón dinámico */}
            {displayHeaderButton && headerButtonAction && (
              <button
                onClick={() => {
                  headerButtonAction().catch(err => {
                    console.error("Error al ejecutar la acción del botón:", err);
                  });
                }}
                className={`${headerButtonClasses} w-full sm:w-auto`}
              >
                {headerButtonText}
              </button>
            )}
          </div>
        </div>

        {/* --- BANNER Y BOTÓN PARA ORDEN DE CAMBIO POR EXTRACCIÓN DE PIEDRAS --- */}
        {needsStoneExtractionCO && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-500 p-4 md:p-6 shadow-md rounded-md">
            <div className="flex flex-col md:flex-row">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                </div>
                <div className="ml-3 flex-grow">
                  <h3 className="text-md md:text-lg font-semibold text-yellow-800">
                    Acción Requerida: Orden de Cambio
                  </h3>
                  <div className="mt-1 text-sm md:text-base text-yellow-700">
                    <p>
                      Se han registrado imágenes/costos por "extracción de piedras" desde la aplicación móvil. Es necesario generar una Orden de Cambio para formalizar estos trabajos/costos adicionales.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 md:mt-0 md:ml-auto md:pl-3">
                <div className="-mx-1.5 -my-1.5">
                  {!isViewOnly && (
                    <button
                      type="button"
                      onClick={() => setShowCreateCOModal(true)}
                      className="w-full md:w-auto inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                    >
                      Generar CO
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Columna izquierda: Tarjetas desplegables */}
          <div className="space-y-6">
            {/* Tarjeta: Información principal */}
            <div className="bg-white shadow-md rounded-lg p-4 md:p-6 border-l-4 border-blue-500">
              <h2
                className="text-lg md:text-xl font-semibold mb-4 cursor-pointer"
                onClick={() => toggleSection("info")}
              >
                Información Principal
              </h2>
              {openSections.info && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <p><strong>Aplicante:</strong> {work.budget?.applicantName || "No disponible"}</p>
                    <p><strong>Permit N°:</strong> {work.Permit?.permitNumber || "No disponible"}</p>
                    <p className="sm:col-span-2"><strong>Aplicante Email:</strong> {work.Permit?.applicantEmail || "No disponible"}</p>
                  </div>

                  {pdfUrl && (
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">Permit</h3>
                        <a
                          href={pdfUrl}
                          download={`Permit_${work.propertyAddress?.replace(/[^a-z0-9]/gi, '_') || 'documento'}.pdf`}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded shadow text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Descargar
                        </a>
                      </div>
                      <iframe
                        src={pdfUrl}
                        width="100%"
                        height="250px"
                        title="Vista previa del PDF"
                        className="rounded"
                      ></iframe>
                    </div>
                  )}
                  {optionalDocs && (
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">Optional Docs</h3>
                        <a
                          href={optionalDocs}
                          download={`OptionalDocs_${work.propertyAddress?.replace(/[^a-z0-9]/gi, '_') || 'documento'}.pdf`}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded shadow text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Descargar
                        </a>
                      </div>
                      <iframe
                        src={optionalDocs}
                        width="100%"
                        height="250px"
                        title="Vista previa del PDF"
                        className="rounded"
                      ></iframe>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Tarjeta: Presupuesto */}
            {work.budget && (
              <div className="bg-white shadow-md rounded-lg p-4 md:p-6 border-l-4 border-blue-500">
                <h2
                  className="text-lg md:text-xl font-semibold mb-4 cursor-pointer flex justify-between items-center"
                  onClick={() => toggleSection("budget")}
                >
                  <span>Presupuesto</span>
                  <span>{openSections.budget ? "▲" : "▼"}</span>
                </h2>
                {openSections.budget && (
                  <>
                    {/* Total */}
                    <p className="mb-1">
                      <strong>Total Presupuesto:</strong> ${parseFloat(work.budget.totalPrice || 0).toFixed(2)}
                    </p>

                    {/* Pago Inicial Esperado */}
                    <p className="mb-1 text-gray-700">
                      <strong>Pago Inicial Esperado ({work.budget.initialPaymentPercentage || 0}%):</strong> ${parseFloat(work.budget.initialPayment || 0).toFixed(2)}
                    </p>

                    {/* Monto del Comprobante Cargado (si existe) */}
                    {work.budget.paymentProofAmount !== null && !isNaN(parseFloat(work.budget.paymentProofAmount)) && (
                      <p className="mb-1 text-green-700 font-semibold">
                        <strong>Monto Comprobante Cargado:</strong> ${parseFloat(work.budget.paymentProofAmount).toFixed(2)}
                        {parseFloat(work.budget.paymentProofAmount).toFixed(2) !== parseFloat(work.budget.initialPayment || 0).toFixed(2) && (
                          <span className="ml-2 text-xs text-orange-500">(Difiere del esperado)</span>
                        )}
                      </p>
                    )}

                    {/* Restante (basado en el monto del comprobante cargado si existe, sino en el initialPayment esperado) */}
                    <p className="mb-1 text-orange-700">
                    <strong>Restante (vs. Total):</strong> ${
                      (
                        parseFloat(work.budget.totalPrice || 0) -
                        (
                          work.budget.paymentProofAmount !== null && !isNaN(parseFloat(work.budget.paymentProofAmount))
                            ? parseFloat(work.budget.paymentProofAmount)
                            : parseFloat(work.budget.initialPayment || 0)
                        )
                      ).toFixed(2)
                    }
                  </p>
                    {/* Otros Datos */}
                    <p className="mt-3 text-sm text-gray-600">
                      <strong>Fecha:</strong> {formatDate(work.budget.date)}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Estado:</strong> {work.budget.status}
                    </p>
                    
                    {/* Método de Firma */}
                    {work.budget.signatureMethod && work.budget.signatureMethod !== 'none' && (
                      <div className="mt-3 p-3 bg-green-50 border-l-4 border-green-500 rounded">
                        <p className="text-sm font-semibold text-green-800">
                          {work.budget.signatureMethod === 'signnow' && '✍️ Firmado con SignNow'}
                          {work.budget.signatureMethod === 'manual' && '📄 Firmado Manualmente'}
                          {work.budget.signatureMethod === 'legacy' && '🏷️ Presupuesto Legacy'}
                        </p>
                      </div>
                    )}
                    
                    {/* 🆕 Portal de Cliente */}
                    <div className="mt-4">
                      <ClientPortalLink work={work} budget={work.budget} />
                    </div>
                  </>
                )}
                <button
    className="bg-blue-600 text-white px-3 py-2 rounded shadow hover:bg-blue-700 mt-4"
    onClick={handleShowBudgetPdf}
  >
    {work.budget.signatureMethod === 'signnow' || work.budget.signatureMethod === 'manual' 
      ? 'Ver Presupuesto Firmado' 
      : 'Ver Presupuesto PDF'}
  </button>
              </div>
            )}

            {/* --- 2. SECCIÓN DE COMPROBANTES ACTUALIZADA --- */}
            {allReceipts && allReceipts.length > 0 && (
              <div className="bg-white shadow-md rounded-lg p-4 md:p-6 border-l-4 border-yellow-500">
                <h2
                  className="text-lg md:text-xl font-semibold mb-4 cursor-pointer"
                  onClick={() => toggleSection("allReceipts")}
                >
                  Todos los Comprobantes ({allReceipts.length})
                </h2>
                {openSections.allReceipts && (
                  <div className="max-h-[400px] md:max-h-[600px] overflow-y-auto pr-2">
                    <ul className="space-y-4">
                      {allReceipts.map((receipt) => (
                        <li
                          key={receipt.idReceipt}
                          className="border p-4 rounded shadow bg-gray-50"
                        >
                          <p className="text-sm font-medium text-blue-700 mb-1">
                            Asociado a: {receipt.relatedRecordType} ({receipt.relatedRecordDesc})
                          </p>
                          <p><strong>Tipo (Recibo):</strong> {receipt.type}</p>
                          <p><strong>Notas:</strong> {receipt.notes || "Sin notas"}</p>
                          {receipt.fileUrl && receipt.mimeType ? (
                            <div className="mt-2">
                              {receipt.mimeType.startsWith('image/') ? (
                                <img
                                  src={receipt.fileUrl}
                                  alt={`Comprobante ${receipt.originalName || receipt.type}`}
                                  className="rounded w-full h-auto object-contain max-h-[200px] border"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              ) : receipt.mimeType === 'application/pdf' ? (
                                <iframe
                                  src={`https://docs.google.com/gview?url=${encodeURIComponent(receipt.fileUrl)}&embedded=true`}
                                  width="100%"
                                  height="200px"
                                  title={`Vista previa de ${receipt.originalName || receipt.type}`}
                                  className="rounded border"
                                  onError={(e) => { e.target.outerHTML = '<p class="text-red-500 text-xs">No se pudo cargar la vista previa.</p>'; }}
                                ></iframe>
                              ) : (
                                <p className="text-gray-600 text-xs">Archivo no previsualizable.</p>
                              )}
                              <a
                                href={receipt.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700 underline text-xs mt-1 block"
                              >
                                Ver/Descargar {receipt.originalName || receipt.type}
                              </a>
                            </div>
                          ) : (
                            <p className="text-gray-500 text-xs mt-1">Info de archivo incompleta.</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 🆕 SECCIÓN DE INVOICES VINCULADOS */}
            {linkedInvoices && linkedInvoices.length > 0 && (
              <div className="bg-white shadow-md rounded-lg p-4 md:p-6 border-l-4 border-purple-500">
                <h2
                  className="text-lg md:text-xl font-semibold mb-4 cursor-pointer flex items-center justify-between"
                  onClick={() => toggleSection("linkedInvoices")}
                >
                  <span className="flex items-center">
                    📄 Invoices Vinculados ({linkedInvoices.length})
                  </span>
                  <svg
                    className={`w-5 h-5 transition-transform ${openSections.linkedInvoices ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </h2>
                {openSections.linkedInvoices && (
                  <div className="space-y-3">
                    {linkedInvoices.map((invoice) => (
                      <div
                        key={invoice.idSupplierInvoice}
                        className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg font-bold text-gray-800">
                                #{invoice.invoiceNumber}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                invoice.paymentStatus === 'paid' 
                                  ? 'bg-green-100 text-green-800'
                                  : invoice.paymentStatus === 'partial'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : invoice.paymentStatus === 'overdue'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {invoice.paymentStatus === 'paid' ? 'Pagado' :
                                 invoice.paymentStatus === 'partial' ? 'Parcial' :
                                 invoice.paymentStatus === 'overdue' ? 'Vencido' :
                                 'Pendiente'}
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-1">
                              <strong>Proveedor:</strong> {invoice.vendor}
                            </p>
                            
                            <p className="text-sm text-gray-600 mb-1">
                              <strong>Total:</strong> ${parseFloat(invoice.totalAmount || 0).toFixed(2)}
                              {invoice.paymentStatus === 'partial' && (
                                <span className="ml-2 text-orange-600">
                                  (Pagado: ${parseFloat(invoice.paidAmount || 0).toFixed(2)})
                                </span>
                              )}
                            </p>
                            
                            <p className="text-sm text-gray-600">
                              <strong>Fecha:</strong> {formatDateSafe(invoice.issueDate)}
                              {invoice.dueDate && (
                                <span className="ml-2 text-gray-500">
                                  | Vence: {formatDateSafe(invoice.dueDate)}
                                </span>
                              )}
                            </p>
                            
                            {invoice.notes && (
                              <p className="text-sm text-gray-500 mt-1 italic">
                                {invoice.notes}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            {invoice.invoicePdfPath && (
                              <button
                                onClick={() => setSelectedInvoiceModal(invoice)}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Ver Comprobante
                              </button>
                            )}
                            
                            <button
                              onClick={() => navigate(`/supplier-invoices?openInvoice=${invoice.idSupplierInvoice}`)}
                              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              Ir al Invoice
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 🆕 SECCIÓN DE DOCUMENTOS FINALES */}
            <FinalDocumentsSection
              work={work}
              idWork={idWork}
              isOpen={openSections.finalDocuments}
              toggleSection={toggleSection}
              formatDateSafe={formatDateSafe}
              isViewOnly={isViewOnly}
              operatingPermitFile={operatingPermitFile}
              setOperatingPermitFile={setOperatingPermitFile}
              uploadingOperatingPermit={uploadingOperatingPermit}
              setUploadingOperatingPermit={setUploadingOperatingPermit}
              maintenanceServiceFile={maintenanceServiceFile}
              setMaintenanceServiceFile={setMaintenanceServiceFile}
              uploadingMaintenanceService={uploadingMaintenanceService}
              setUploadingMaintenanceService={setUploadingMaintenanceService}
              extraDocumentFile={extraDocumentFile}
              setExtraDocumentFile={setExtraDocumentFile}
              uploadingExtraDocument={uploadingExtraDocument}
              setUploadingExtraDocument={setUploadingExtraDocument}
              onDocumentUploaded={() => dispatch(fetchWorkById(idWork))}
            />

            {/* Tarjeta: Imágenes */}
            <div className="bg-white shadow-md rounded-lg p-4 md:p-6 border-l-4 border-yellow-500">              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
                <h2
                  className="text-lg md:text-xl font-semibold cursor-pointer"
                  onClick={() => toggleSection("images")}
                >
                  Imágenes de la Obra
                </h2>
                {!isViewOnly && (
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    {/* ✅ NEW: General image upload button for owner, admin, worker */}
                    {canUploadImages && (
                      <button
                        onClick={() => setShowUploadImageModal(true)}
                        className="w-full sm:w-auto text-sm bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-3 rounded shadow"
                      >
                        📸 Subir Imagen
                      </button>
                    )}
                    
                    {/* Botón para subir imagen de sistema instalado */}
                    {work?.status && ['inProgress', 'installed'].includes(work.status) && (
                      <button
                        onClick={() => setShowUploadInstalledImage(!showUploadInstalledImage)}
                        className="w-full sm:w-auto text-sm bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-3 rounded shadow"
                      >
                        {showUploadInstalledImage ? 'Cancelar' : 'Subir Img. Sistema'}
                      </button>
                    )}
                    
                    {/* Botón existente para inspección final */}
                    {work?.status && (work.status === 'paymentReceived' || work.status === 'finalRejected' || work.status === 'finalInspectionPending') && (
                      <button
                        onClick={() => setShowUploadFinalInspectionImage(!showUploadFinalInspectionImage)}
                        className="w-full sm:w-auto text-sm bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-3 rounded shadow"
                      >
                        {showUploadFinalInspectionImage ? 'Cancelar Subida' : 'Subir Img. Insp. Final'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Sección para subir imagen del sistema instalado */}
              {showUploadInstalledImage && (
                <div className="my-4 p-4 border border-gray-300 rounded-md bg-blue-50">
                  <h3 className="text-md font-semibold text-gray-700 mb-2">
                    Subir Imagen del Sistema Instalado
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Esta imagen será necesaria para solicitar la inspección inicial.
                  </p>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Seleccionar imagen:
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleInstalledImageChange}
                      className="block w-full text-sm text-gray-500
                                 file:mr-4 file:py-2 file:px-4
                                 file:rounded-full file:border-0
                                 file:text-sm file:font-semibold
                                 file:bg-blue-50 file:text-blue-700
                                 hover:file:bg-blue-100"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Comentario (opcional):
                    </label>
                    <input
                      type="text"
                      value={installedImageComment}
                      onChange={(e) => setInstalledImageComment(e.target.value)}
                      placeholder="Describe la imagen del sistema instalado..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {installedImageFile && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-600 mb-2">
                        Archivo seleccionado: {installedImageFile.name}
                      </p>
                      <img 
                        src={URL.createObjectURL(installedImageFile)} 
                        alt="Previsualización" 
                        className="max-h-40 rounded border shadow-sm"
                      />
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <button
                      onClick={handleUploadInstalledImage}
                      disabled={!installedImageFile || uploadingInstalledImage}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {uploadingInstalledImage ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Subiendo...
                        </span>
                      ) : (
                        'Subir Imagen del Sistema'
                      )}
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowUploadInstalledImage(false);
                        setInstalledImageFile(null);
                        setInstalledImageComment('');
                      }}
                      className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Mensaje informativo si no hay imágenes del sistema instalado */}
              {work?.status === 'installed' && installedImages.length === 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">
                        Atención: No hay imágenes del sistema instalado
                      </p>
                      <p className="text-xs text-yellow-700">
                        Necesitas subir al menos una imagen del sistema instalado para poder solicitar la inspección inicial.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sección para subir imagen de inspección final */}
              {showUploadFinalInspectionImage && (
                <div className="my-4 p-4 border border-gray-300 rounded-md bg-gray-50">
                  <h3 className="text-md font-semibold text-gray-700 mb-2">Subir Imagen para Inspección Final</h3>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFinalInspectionImageChange}
                    className="block w-full text-sm text-gray-500
                               file:mr-4 file:py-2 file:px-4
                               file:rounded-full file:border-0
                               file:text-sm file:font-semibold
                               file:bg-blue-50 file:text-blue-700
                               hover:file:bg-blue-100 mb-3"
                  />
                  {finalInspectionImageFile && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-600">Archivo seleccionado: {finalInspectionImageFile.name}</p>
                      <img src={URL.createObjectURL(finalInspectionImageFile)} alt="Previsualización" className="mt-2 max-h-40 rounded border"/>
                    </div>
                  )}
                  <button
                    onClick={handleUploadFinalInspectionImage}
                    disabled={!finalInspectionImageFile || uploadingFinalImage}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
                  >
                    {uploadingFinalImage ? 'Subiendo...' : 'Confirmar y Subir Imagen'}
                  </button>
                </div>
              )}

              {openSections.images &&
                Object.entries(groupedImages).map(([stage, images]) => {
                  const truckSumStages = ['camiones de arena', 'camiones de tierra'];
                  let totalTrucksInStage = 0;

                  if (truckSumStages.includes(stage)) {
                    // Obtener el valor máximo (último total acumulado) en lugar de sumar
                    totalTrucksInStage = Math.max(
                      ...images.map(image => Number(image.truckCount) || 0),
                      0
                    );
                  }

                  return (
                    <div key={stage} className="mb-6">
                      <h3 className="text-sm text-white bg-indigo-900 p-1 text-center uppercase font-semibold mb-2">
                        {stage}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4 p-2">
                        {images.map((image) => (
                          <div
                            key={image.id}
                            className="cursor-pointer bg-gray-50 p-2 rounded-lg shadow hover:shadow-md transition-shadow"
                            onClick={() => setSelectedImage(image)}
                          >
                            <img
                              src={image.imageUrl}
                              alt={stage}
                              className="w-full aspect-square object-cover rounded-md shadow"
                            />
                            <p className="text-xs text-gray-500 mt-1 truncate" title={image.dateTime}>
                              {formatImageDateTime(image.dateTime)}
                            </p>
                            {(stage === 'camiones de arena' || stage === 'camiones de tierra') && image.truckCount != null && image.truckCount > 0 && (
                              <p className="text-xs font-semibold text-blue-600 mt-1">
                                {image.truckCount} {image.truckCount === 1 ? 'Camión' : 'Camiones'}
                              </p>
                            )}
                            {image.comment && (
                              <p className="text-xs text-gray-600 mt-1 italic truncate" title={image.comment}>
                                "{image.comment}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      {truckSumStages.includes(stage) && totalTrucksInStage > 0 && (
                        <div className="mt-3 text-right pr-2">
                          <p className="text-xl font-bold text-indigo-700 bg-indigo-100 px-4 py-2 rounded-full inline-block shadow-lg">
                            Total Camiones: {totalTrucksInStage}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>

            {canSelectInspectionImageStates.includes(work?.status) && installedImages.length > 0 && (
              <div className="my-6 p-4 border rounded-lg shadow-sm bg-white">
                <h3 className="text-lg font-semibold mb-3 text-gray-700">
                  Seleccionar Imagen de Referencia para Inspección
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-72 overflow-y-auto p-2 border rounded-md">
                  {installedImages.map(image => (
                    <div
                      key={image.id}
                      className={`cursor-pointer border-2 p-1 rounded-md hover:border-green-500 transition-all ${selectedInstalledImage?.id === image.id ? 'border-green-600 ring-2 ring-green-500' : 'border-gray-200'}`}
                      onClick={() => setSelectedInstalledImage(image)}
                    >
                      <img
                        src={image.imageUrl}
                        alt={`Sistema Instalado - ${image.id}`}
                        className="w-full h-28 object-cover rounded"
                      />
                      <p className="text-xs text-center mt-1 truncate" title={`ID: ${image.id}`}>ID: {image.id}</p>
                    </div>
                  ))}
                </div>
                {selectedInstalledImage && (
                  <p className="text-sm text-green-700 mt-2">
                    Imagen de referencia seleccionada: ID {selectedInstalledImage.id}
                  </p>
                )}
                {!selectedInstalledImage && installedImages.length > 0 && (
                  <p className="text-sm text-yellow-600 mt-2">
                    Por favor, selecciona una imagen de "sistema instalado" como referencia para la inspección.
                  </p>
                )}
              </div>
            )}

            {(work?.status === 'paymentReceived' || work?.status === 'finalRejected' || work?.status === 'finalInspectionPending') && (
              <div className="my-6 p-4 border rounded-lg shadow-sm bg-white">
                <h3 className="text-lg font-semibold mb-3 text-gray-700">
                  Seleccionar Imagen para Inspección Final
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-72 overflow-y-auto p-2 border rounded-md">
                  {(groupedImages['inspeccion final'] || []).map(image => (
                    <div
                      key={image.id}
                      className={`cursor-pointer border-2 p-1 rounded-md hover:border-green-500 transition-all ${selectedInstalledImage?.id === image.id ? 'border-green-600 ring-2 ring-green-500' : 'border-gray-200'}`}
                      onClick={() => setSelectedInstalledImage(image)}
                    >
                      <img
                        src={image.imageUrl}
                        alt={`Inspección Final - ${image.id}`}
                        className="w-full h-28 object-cover rounded"
                      />
                      <p className="text-xs text-center mt-1 truncate" title={`ID: ${image.id}`}>ID: {image.id}</p>
                    </div>
                  ))}
                  {(groupedImages['inspeccion final'] === undefined || groupedImages['inspeccion final'].length === 0) && (
                    <p className="col-span-full text-center text-sm text-gray-500 py-4">
                      No hay imágenes cargadas para la etapa 'inspección final'.
                      Puedes subir una usando el botón de arriba.
                    </p>
                  )}
                </div>
                {selectedInstalledImage && groupedImages['inspeccion final']?.some(img => img.id === selectedInstalledImage.id) && (
                  <p className="text-sm text-green-700 mt-2">
                    Imagen para inspección final seleccionada: ID {selectedInstalledImage.id}
                  </p>
                )}
              </div>
            )}

            {/* Pasar la imagen seleccionada (o su ID) a InspectionFlowManager */}
            {work && (showInitialInspectionManager || showFinalInspectionManager) && (
              <div className="bg-white shadow-md rounded-lg border-l-4 border-teal-500">
                <h2
                  className="text-xl font-semibold p-6 cursor-pointer flex justify-between items-center"
                  onClick={() => toggleSection("inspectionFlow")}
                >
                  <span>Gestión de Inspección</span>
                  <span className="text-gray-600 transform transition-transform duration-200">
                    {openSections.inspectionFlow ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    )}
                  </span>
                  {work?.status === 'approvedInspection' ? (
                    <span className="ml-4 px-3 py-2 rounded shadow text-sm font-bold bg-green-200 text-green-800">
                      Inspección APROBADA
                      {work?.updatedAt && (
                        <span className="block text-xs font-normal text-gray-500 mt-1">{`Fecha: ${new Date(work.updatedAt).toLocaleString()}`}</span>
                      )}
                    </span>
                  ) : (
                    <>
                      {work?.status === 'rejectedInspection' && (
                        <span className="ml-4 px-3 py-2 rounded shadow text-sm font-bold bg-red-200 text-red-800">
                          Inspección RECHAZADA
                          {work?.updatedAt && (
                            <span className="block text-xs font-normal text-gray-500 mt-1">{`Fecha: ${new Date(work.updatedAt).toLocaleString()}`}</span>
                          )}
                        </span>
                      )}
                      {/* ✅ Deshabilitar botón solo si ambas inspecciones están APROBADAS o si es finance (solo vista) */}
                      {!isViewOnly && (
                        <>
                          {(!hasApprovedInitialInspection || !hasApprovedFinalInspection) ? (
                            <button
                              className="ml-4 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded shadow text-sm"
                              onClick={e => { 
                                e.stopPropagation(); 
                                // ✅ Establecer el tipo de inspección por defecto según cuál no está aprobada
                                if (!hasApprovedInitialInspection) {
                                  setQuickInspectionType('initial');
                                } else if (!hasApprovedFinalInspection) {
                                  setQuickInspectionType('final');
                                }
                                setShowQuickInspectionModal(true); 
                              }}
                            >
                              Registrar resultado rápido
                            </button>
                          ) : (
                            <span className="ml-4 px-3 py-2 rounded shadow text-sm font-medium bg-gray-300 text-gray-600 cursor-not-allowed">
                              ✅ Todas las inspecciones procesadas
                            </span>
                          )}
                        </>
                      )}
                    </>
                  )}
                </h2>
                
                {/* Renderizado condicional del gestor de flujo apropiado */}
                {showInitialInspectionManager && (
                  <InspectionFlowManager
                    work={work}
                    selectedWorkImageId={selectedInstalledImage?.id || null}
                    isVisible={openSections.inspectionFlow}
                  />
                )}
                
                {/* 📋 Historial de Inspecciones Rápidas - Sección expandible */}
                {(initialInspectionsHistory.length > 0 || finalInspectionsHistory.length > 0) && (
                  <div className="mt-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <button
                      onClick={() => toggleSection('inspectionHistory')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📋</span>
                        <h3 className="text-md font-semibold text-gray-800">
                          Historial de Inspecciones
                        </h3>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                          {initialInspectionsHistory.length + finalInspectionsHistory.length}
                        </span>
                      </div>
                      <svg 
                        className={`w-5 h-5 transform transition-transform ${openSections.inspectionHistory ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {openSections.inspectionHistory && (
                      <div className="p-4 border-t border-gray-200 space-y-4">
                        {/* Inspecciones Iniciales */}
                        {initialInspectionsHistory.length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
                              🔵 Inspección Inicial
                              {hasApprovedInitialInspection && <span className="text-green-600">✅ APROBADA</span>}
                            </h4>
                            <div className="space-y-3">
                              {initialInspectionsHistory.map((insp, idx) => (
                                <div 
                                  key={insp.idInspection} 
                                  className={`p-4 rounded-lg border-2 ${
                                    insp.finalStatus === 'approved' 
                                      ? 'bg-green-50 border-green-300' 
                                      : 'bg-red-50 border-red-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold uppercase">
                                      {insp.finalStatus === 'approved' ? '✅ APROBADA' : '❌ RECHAZADA'}
                                    </span>
                                    <span className="text-xs text-gray-600">
                                      {formatDateSafe(insp.dateResultReceived || insp.createdAt)}
                                    </span>
                                  </div>
                                  {insp.notes && (
                                    <p className="text-sm text-gray-700 mb-2">
                                      <strong>Notas:</strong> {insp.notes}
                                    </p>
                                  )}
                                  {insp.resultDocumentUrl && (
                                    <button
                                      onClick={() => {
                                        console.log('🔵 [Inspección Inicial] URL del documento:', insp.resultDocumentUrl);
                                        setInspectionDocUrl(insp.resultDocumentUrl);
                                        setInspectionDocTitle(`Inspección Inicial - ${insp.finalStatus === 'approved' ? 'Aprobada' : 'Rechazada'}`);
                                        setShowInspectionDocModal(true);
                                        console.log('✅ [Modal] Estado actualizado - showModal: true');
                                      }}
                                      className="inline-flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      Ver Comprobante
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Inspecciones Finales */}
                        {finalInspectionsHistory.length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-purple-700 mb-3 flex items-center gap-2">
                              🟣 Inspección Final
                              {hasApprovedFinalInspection && <span className="text-green-600">✅ APROBADA</span>}
                            </h4>
                            <div className="space-y-3">
                              {finalInspectionsHistory.map((insp, idx) => (
                                <div 
                                  key={insp.idInspection} 
                                  className={`p-4 rounded-lg border-2 ${
                                    insp.finalStatus === 'approved' 
                                      ? 'bg-green-50 border-green-300' 
                                      : 'bg-red-50 border-red-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold uppercase">
                                      {insp.finalStatus === 'approved' ? '✅ APROBADA' : '❌ RECHAZADA'}
                                    </span>
                                    <span className="text-xs text-gray-600">
                                      {formatDateSafe(insp.dateResultReceived || insp.createdAt)}
                                    </span>
                                  </div>
                                  {insp.notes && (
                                    <p className="text-sm text-gray-700 mb-2">
                                      <strong>Notas:</strong> {insp.notes}
                                    </p>
                                  )}
                                  {insp.resultDocumentUrl && (
                                    <button
                                      onClick={() => {
                                        console.log('🟣 [Inspección Final] URL del documento:', insp.resultDocumentUrl);
                                        setInspectionDocUrl(insp.resultDocumentUrl);
                                        setInspectionDocTitle(`Inspección Final - ${insp.finalStatus === 'approved' ? 'Aprobada' : 'Rechazada'}`);
                                        setShowInspectionDocModal(true);
                                        console.log('✅ [Modal] Estado actualizado - showModal: true');
                                      }}
                                      className="inline-flex items-center gap-2 px-3 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      Ver Comprobante
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
            {/* 📄 Modal para ver Comprobante de Inspección */}
            {showInspectionDocModal && inspectionDocUrl && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                {console.log('🎯 [Modal] Renderizando modal con URL:', inspectionDocUrl)}
                <div className="bg-white rounded-lg shadow-2xl w-[95vw] h-[95vh] flex flex-col">
                  {/* Header del modal */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800">{inspectionDocTitle}</h3>
                    <button
                      onClick={() => {
                        setShowInspectionDocModal(false);
                        setInspectionDocUrl(null);
                        setInspectionDocTitle('');
                      }}
                      className="text-gray-500 hover:text-red-600 text-2xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                  
                  {/* Contenedor del documento */}
                  <div className="flex-1 p-4 overflow-auto bg-gray-100">
                    <div className="w-full h-full flex items-center justify-center">
                      {/* Detectar tipo de archivo por extensión */}
                      {inspectionDocUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <>
                          {console.log('🖼️ [Modal] Mostrando como imagen:', inspectionDocUrl)}
                          <img
                            src={inspectionDocUrl}
                            alt={inspectionDocTitle}
                            className="max-w-full max-h-full object-contain rounded shadow-lg"
                          />
                        </>
                      ) : inspectionDocUrl.match(/\.(pdf)$/i) ? (
                        <>
                          {console.log('📄 [Modal] Mostrando PDF con Google Docs Viewer:', inspectionDocUrl)}
                          <iframe
                            src={`https://docs.google.com/gview?url=${encodeURIComponent(inspectionDocUrl)}&embedded=true`}
                            title={inspectionDocTitle}
                            className="w-full h-full rounded border-2 border-gray-300 bg-white"
                            style={{ minHeight: '600px' }}
                          />
                        </>
                      ) : (
                        <>
                          {console.log('⚠️ [Modal] Archivo sin extensión o tipo desconocido. Mostrando directamente:', inspectionDocUrl)}
                          <iframe
                            src={inspectionDocUrl}
                            title={inspectionDocTitle}
                            className="w-full h-full rounded border-2 border-gray-300 bg-white"
                            style={{ minHeight: '600px' }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Footer con botones */}
                  <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
                    <a
                      href={inspectionDocUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Descargar
                    </a>
                    <button
                      onClick={() => {
                        setShowInspectionDocModal(false);
                        setInspectionDocUrl(null);
                        setInspectionDocTitle('');
                      }}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Modal para resultado rápido de inspección */}
            {showQuickInspectionModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto">
                  <button className="absolute top-2 right-2 text-gray-500 hover:text-red-600" onClick={() => setShowQuickInspectionModal(false)}>&#10005;</button>
                  <h3 className="text-lg font-bold mb-4 text-gray-800">Registrar resultado rápido de inspección</h3>
                  
                  {/* ✅ BANNER DE ESTADO ACTUAL - Más prominente */}
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    {/* Estado Inspección Inicial */}
                    <div className={`p-3 rounded-lg border-2 ${
                      hasApprovedInitialInspection 
                        ? 'bg-green-50 border-green-500' 
                        : initialInspectionsHistory.some(i => i.finalStatus === 'rejected')
                        ? 'bg-yellow-50 border-yellow-400'
                        : 'bg-gray-50 border-gray-300'
                    }`}>
                      <p className="text-xs font-semibold text-gray-700 mb-1">Inicial:</p>
                      {hasApprovedInitialInspection ? (
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">✅</span>
                          <div>
                            <p className="text-sm font-bold text-green-700">APROBADA</p>
                            <p className="text-xs text-green-600">Finalizada</p>
                          </div>
                        </div>
                      ) : initialInspectionsHistory.length > 0 ? (
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">❌</span>
                          <div>
                            <p className="text-sm font-bold text-red-700">RECHAZADA</p>
                            <p className="text-xs text-gray-600">{initialInspectionsHistory.length} intento{initialInspectionsHistory.length > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">⏳</span>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Pendiente</p>
                            <p className="text-xs text-gray-500">Sin registro</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Estado Inspección Final */}
                    <div className={`p-3 rounded-lg border-2 ${
                      hasApprovedFinalInspection 
                        ? 'bg-green-50 border-green-500' 
                        : finalInspectionsHistory.some(i => i.finalStatus === 'rejected')
                        ? 'bg-yellow-50 border-yellow-400'
                        : 'bg-gray-50 border-gray-300'
                    }`}>
                      <p className="text-xs font-semibold text-gray-700 mb-1">Final:</p>
                      {hasApprovedFinalInspection ? (
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">✅</span>
                          <div>
                            <p className="text-sm font-bold text-green-700">APROBADA</p>
                            <p className="text-xs text-green-600">Finalizada</p>
                          </div>
                        </div>
                      ) : finalInspectionsHistory.length > 0 ? (
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">❌</span>
                          <div>
                            <p className="text-sm font-bold text-red-700">RECHAZADA</p>
                            <p className="text-xs text-gray-600">{finalInspectionsHistory.length} intento{finalInspectionsHistory.length > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">⏳</span>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Pendiente</p>
                            <p className="text-xs text-gray-500">Sin registro</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 📋 Historial detallado (colapsable si quieres, por ahora siempre visible si hay datos) */}
                  {(initialInspectionsHistory.length > 0 || finalInspectionsHistory.length > 0) && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-300 rounded-lg">
                      <p className="text-sm text-blue-800 font-medium mb-2">📋 Historial de Inspecciones:</p>
                      
                      {initialInspectionsHistory.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-blue-700 mb-1">Inicial:</p>
                          {initialInspectionsHistory.map((insp, idx) => (
                            <div key={insp.idInspection} className={`text-xs p-3 rounded mb-2 ${
                              insp.finalStatus === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              <div className="mb-2">
                                <span className="font-medium">
                                  {idx === 0 ? '🔵 Último: ' : `Intento ${initialInspectionsHistory.length - idx}: `}
                                </span>
                                <span className="uppercase font-bold">{insp.finalStatus}</span>
                                <span className="ml-2 text-gray-600">
                                  ({formatDateSafe(insp.dateResultReceived || insp.createdAt)})
                                </span>
                                {insp.finalStatus === 'approved' && (
                                  <span className="ml-2 text-green-700">✓ Finalizada</span>
                                )}
                              </div>
                              {insp.notes && (
                                <p className="text-xs text-gray-600 mb-2">
                                  <strong>Notas:</strong> {insp.notes.substring(0, 150)}{insp.notes.length > 150 ? '...' : ''}
                                </p>
                              )}
                              {insp.resultDocumentUrl && (
                                <div className="mt-2">
                                  {/* Intentar mostrar como imagen primero, si es imagen de Cloudinary funcionará */}
                                  <img
                                    src={insp.resultDocumentUrl}
                                    alt={`Comprobante inspección ${insp.finalStatus}`}
                                    className="rounded w-full h-auto object-contain max-h-[150px] border border-gray-300"
                                    onError={(e) => {
                                      // Si falla como imagen, intentar mostrar iframe para PDF
                                      e.target.style.display = 'none';
                                      const parent = e.target.parentElement;
                                      const iframe = document.createElement('iframe');
                                      iframe.src = `https://docs.google.com/gview?url=${encodeURIComponent(insp.resultDocumentUrl)}&embedded=true`;
                                      iframe.width = '100%';
                                      iframe.height = '150px';
                                      iframe.title = 'Vista previa inspección';
                                      iframe.className = 'rounded border border-gray-300';
                                      parent.insertBefore(iframe, e.target);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {finalInspectionsHistory.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-blue-700 mb-1">Final:</p>
                          {finalInspectionsHistory.map((insp, idx) => (
                            <div key={insp.idInspection} className={`text-xs p-3 rounded mb-2 ${
                              insp.finalStatus === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              <div className="mb-2">
                                <span className="font-medium">
                                  {idx === 0 ? '🔵 Último: ' : `Intento ${finalInspectionsHistory.length - idx}: `}
                                </span>
                                <span className="uppercase font-bold">{insp.finalStatus}</span>
                                <span className="ml-2 text-gray-600">
                                  ({formatDateSafe(insp.dateResultReceived || insp.createdAt)})
                                </span>
                                {insp.finalStatus === 'approved' && (
                                  <span className="ml-2 text-green-700">✓ Finalizada</span>
                                )}
                              </div>
                              {insp.notes && (
                                <p className="text-xs text-gray-600 mb-2">
                                  <strong>Notas:</strong> {insp.notes.substring(0, 150)}{insp.notes.length > 150 ? '...' : ''}
                                </p>
                              )}
                              {insp.resultDocumentUrl && (
                                <div className="mt-2">
                                  {/* Intentar mostrar como imagen primero, si es imagen de Cloudinary funcionará */}
                                  <img
                                    src={insp.resultDocumentUrl}
                                    alt={`Comprobante inspección ${insp.finalStatus}`}
                                    className="rounded w-full h-auto object-contain max-h-[150px] border border-gray-300"
                                    onError={(e) => {
                                      // Si falla como imagen, intentar mostrar iframe para PDF
                                      e.target.style.display = 'none';
                                      const parent = e.target.parentElement;
                                      const iframe = document.createElement('iframe');
                                      iframe.src = `https://docs.google.com/gview?url=${encodeURIComponent(insp.resultDocumentUrl)}&embedded=true`;
                                      iframe.width = '100%';
                                      iframe.height = '150px';
                                      iframe.title = 'Vista previa inspección';
                                      iframe.className = 'rounded border border-gray-300';
                                      parent.insertBefore(iframe, e.target);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <form
                    onSubmit={async e => {
                      e.preventDefault();
                      
                      // ✅ Prevenir múltiples clicks - guard clause inmediata
                      if (quickInspectionLoading) {
                        console.log('⚠️ Ya se está procesando una inspección, ignorando click adicional');
                        return;
                      }
                      
                      // ✅ Validación previa: verificar si el tipo seleccionado ya está aprobado
                      if (quickInspectionType === 'initial' && hasApprovedInitialInspection) {
                        const approvedInsp = initialInspectionsHistory.find(i => i.finalStatus === 'approved');
                        const approvedDate = approvedInsp 
                          ? new Date(approvedInsp.dateResultReceived || approvedInsp.createdAt).toLocaleString('es-ES')
                          : 'fecha desconocida';
                        
                        alert(`⚠️ ATENCIÓN: Ya existe una inspección inicial APROBADA para esta obra.\n\nFecha de aprobación: ${approvedDate}\n\nNo puedes crear más inspecciones del mismo tipo una vez aprobada. La inspección está finalizada.`);
                        setQuickInspectionLoading(false);
                        return;
                      }
                      
                      if (quickInspectionType === 'final' && hasApprovedFinalInspection) {
                        const approvedInsp = finalInspectionsHistory.find(i => i.finalStatus === 'approved');
                        const approvedDate = approvedInsp 
                          ? new Date(approvedInsp.dateResultReceived || approvedInsp.createdAt).toLocaleString('es-ES')
                          : 'fecha desconocida';
                        
                        alert(`⚠️ ATENCIÓN: Ya existe una inspección final APROBADA para esta obra.\n\nFecha de aprobación: ${approvedDate}\n\nNo puedes crear más inspecciones del mismo tipo una vez aprobada. La inspección está finalizada.`);
                        setQuickInspectionLoading(false);
                        return;
                      }
                      
                      // ✅ Validación: No permitir inspección final si no hay pago del Final Invoice
                      if (quickInspectionType === 'final') {
                        // Buscar receipts asociados a pagos del Final Invoice
                        // Los receipts de Final Invoice tienen relatedModel === 'FinalInvoice'
                        const hasFinalInvoicePayment = allReceipts?.some(r => 
                          r.relatedModel === 'FinalInvoice'
                        );
                        
                        // También verificar si el Final Invoice existe y está pagado
                        const finalInvoicePaid = work?.finalInvoice?.status === 'paid';
                        
                        console.log('🔍 [Validación Final Invoice] hasFinalInvoicePayment:', hasFinalInvoicePayment);
                        console.log('🔍 [Validación Final Invoice] finalInvoicePaid:', finalInvoicePaid);
                        console.log('🔍 [Validación Final Invoice] finalInvoice:', work?.finalInvoice);
                        
                        if (!hasFinalInvoicePayment && !finalInvoicePaid) {
                          alert('⚠️ ERROR: No se puede registrar el resultado de la inspección final.\n\nDebe existir un comprobante de pago del Final Invoice antes de subir el resultado de la inspección final.\n\nPor favor, asegúrate de que el cliente haya pagado el Final Invoice y que el comprobante esté cargado en el sistema.');
                          setQuickInspectionLoading(false);
                          return;
                        }
                      }
                      
                      if (!quickInspectionFile) return alert('Debes subir una imagen o PDF.');
                      setQuickInspectionLoading(true);
                      try {
                        const formData = new FormData();
                        formData.append('type', quickInspectionType);
                        formData.append('finalStatus', quickInspectionStatus);
                        formData.append('resultDocumentFile', quickInspectionFile);
                        if (quickInspectionNotes) formData.append('notes', quickInspectionNotes);
                        await dispatch(registerQuickInspectionResult(work.idWork, formData));
                        
                        // ✅ Limpiar formulario pero NO cerrar modal para ver historial actualizado
                        setQuickInspectionFile(null);
                        setQuickInspectionNotes('');
                        setQuickInspectionLoading(false);
                        
                        // ✅ Recargar datos de la obra e inspecciones (optimizado - paralelo)
                        await refreshWorkData({ fullRefresh: true });
                        
                        // ✅ Mensaje de éxito sin cerrar modal
                        alert('✅ Resultado de inspección registrado exitosamente.\n\nPuedes ver el registro actualizado en el historial arriba. El modal permanecerá abierto para que puedas registrar otro resultado si es necesario.');
                      } catch (err) {
                        console.error('Error al registrar resultado rápido:', err);
                        const errorData = err.response?.data;
                        
                        // ✅ Manejo especial para inspecciones ya aprobadas
                        if (errorData?.alreadyApproved) {
                          const typeText = quickInspectionType === 'initial' ? 'inicial' : 'final';
                          const processedDate = errorData.dateProcessed 
                            ? new Date(errorData.dateProcessed).toLocaleString('es-ES')
                            : 'fecha desconocida';
                          
                          alert(`⚠️ ATENCIÓN: Ya existe una inspección ${typeText} APROBADA para esta obra.\n\nFecha de aprobación: ${processedDate}\n\nNo puedes crear más inspecciones del mismo tipo una vez aprobada. La inspección está finalizada.`);
                        } else {
                          const errorMessage = errorData?.message || err.message || 'Error desconocido';
                          alert(`Error al registrar resultado: ${errorMessage}`);
                        }
                        setQuickInspectionLoading(false);
                      }
                    }}
                  >
                    <div className="mb-3">
                      <label className="block text-sm font-medium mb-1">Tipo de inspección</label>
                      <select 
                        value={quickInspectionType} 
                        onChange={e => setQuickInspectionType(e.target.value)} 
                        className="w-full border rounded px-2 py-1"
                      >
                        <option value="initial" disabled={hasApprovedInitialInspection}>
                          Inicial {hasApprovedInitialInspection ? '(✓ Aprobada - Finalizada)' : initialInspectionsHistory.length > 0 ? `(${initialInspectionsHistory.length} intento${initialInspectionsHistory.length > 1 ? 's' : ''})` : ''}
                        </option>
                        <option value="final" disabled={hasApprovedFinalInspection}>
                          Final {hasApprovedFinalInspection ? '(✓ Aprobada - Finalizada)' : finalInspectionsHistory.length > 0 ? `(${finalInspectionsHistory.length} intento${finalInspectionsHistory.length > 1 ? 's' : ''})` : ''}
                        </option>
                      </select>
                      {((quickInspectionType === 'initial' && hasApprovedInitialInspection) || 
                        (quickInspectionType === 'final' && hasApprovedFinalInspection)) && (
                        <p className="text-xs text-red-600 mt-1">
                          ⚠️ Esta inspección ya fue APROBADA y está finalizada. No se pueden agregar más resultados.
                        </p>
                      )}
                      {quickInspectionType === 'initial' && !hasApprovedInitialInspection && initialInspectionsHistory.some(i => i.finalStatus === 'rejected') && (
                        <p className="text-xs text-blue-600 mt-1">
                          ℹ️ Puedes cargar un nuevo resultado ya que la inspección anterior fue rechazada.
                        </p>
                      )}
                      {quickInspectionType === 'final' && !hasApprovedFinalInspection && finalInspectionsHistory.some(i => i.finalStatus === 'rejected') && (
                        <p className="text-xs text-blue-600 mt-1">
                          ℹ️ Puedes cargar un nuevo resultado ya que la inspección anterior fue rechazada.
                        </p>
                      )}
                    </div>
                    <div className="mb-3">
                      <label className="block text-sm font-medium mb-1">Resultado</label>
                      <select value={quickInspectionStatus} onChange={e => setQuickInspectionStatus(e.target.value)} className="w-full border rounded px-2 py-1">
                        <option value="approved">Aprobada</option>
                        <option value="rejected">Rechazada</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="block text-sm font-medium mb-1">Imagen o PDF</label>
                      <input type="file" accept="image/*,application/pdf" onChange={e => setQuickInspectionFile(e.target.files[0])} className="w-full" />
                    </div>
                    <div className="mb-3">
                      <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
                      <textarea value={quickInspectionNotes} onChange={e => setQuickInspectionNotes(e.target.value)} className="w-full border rounded px-2 py-1" rows={2} />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <button type="button" className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400" onClick={() => setShowQuickInspectionModal(false)}>Cancelar</button>
                      <button 
                        type="submit" 
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed" 
                        disabled={
                          quickInspectionLoading || 
                          (quickInspectionType === 'initial' && hasApprovedInitialInspection) ||
                          (quickInspectionType === 'final' && hasApprovedFinalInspection)
                        }
                      >
                        {quickInspectionLoading ? 'Guardando...' : 'Registrar'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

                {showFinalInspectionManager && !showInitialInspectionManager && (
                  <FinalInspectionFlowManager
                    work={work}
                    isVisible={openSections.inspectionFlow}
                  />
                )}
              </div>
            )}
          </div>

          {/* Columna derecha: Tarjetas de gastos e ingresos */}
          <div className="space-y-6">
            {/* Notice to Owner & Lien Card */}
            {work && work.installationStartDate && (
              <NoticeToOwnerCard 
                work={work}
                isOpen={openSections.noticeToOwner}
                onToggle={() => toggleSection('noticeToOwner')}
                onUpdate={async (data) => {
                  try {
                    await api.put(`/work/${idWork}/notice-to-owner`, data);
                    // Refrescar el trabajo después de actualizar
                    dispatch(fetchWorkById(idWork));
                  } catch (error) {
                    console.error('Error updating Notice to Owner:', error);
                    alert('Error al actualizar Notice to Owner');
                  }
                }}
              />
            )}

            {/* --- 2. TARJETA DE BALANCE TOTAL --- */}
            <div className={`
              shadow-lg rounded-lg p-4 md:p-6 border-l-8
              ${balance > 0 ? 'bg-green-100 border-green-500' : ''}
              ${balance < 0 ? 'bg-red-100 border-red-500' : ''}
              ${balance === 0 ? 'bg-gray-100 border-gray-500' : ''}
            `}>
              <h2 className="text-xl md:text-2xl font-bold mb-3 text-center text-gray-800">
                Balance de la Obra
              </h2>
              <div className="text-center">
                <p className={`text-3xl md:text-4xl font-extrabold mb-1
                  ${balance > 0 ? 'text-green-700' : ''}
                  ${balance < 0 ? 'text-red-700' : ''}
                  ${balance === 0 ? 'text-gray-700' : ''}
                `}>
                  ${balance.toFixed(2)}
                </p>
                <p className={`text-lg font-semibold
                  ${balance > 0 ? 'text-green-600' : ''}
                  ${balance < 0 ? 'text-red-600' : ''}
                  ${balance === 0 ? 'text-gray-600' : ''}
                `}>
                  {balance > 0 ? 'Ganancia' : (balance < 0 ? 'Pérdida' : 'Equilibrio')}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-300 flex justify-around text-sm">
                <div className="text-center">
                  <p className="font-semibold text-green-600">Ingresos Totales</p>
                  <p className="text-gray-700">${totalIncome.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-red-600">Gastos Totales</p>
                  <p className="text-gray-700">${totalExpense.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Tarjeta: Gastos */}
            <div className="bg-red-100 shadow-md rounded-lg p-4 md:p-6 border-l-4 border-red-500">
              <h2
                className="text-xl font-bold mb-4 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection("expenses")}
              >
                Gastos
                <span className="text-red-700 font-semibold">
                  {expenses && expenses.length > 0
                    ? `$${expenses
                      .reduce(
                        (total, expense) =>
                          total + parseFloat(expense.amount || 0),
                        0
                      )
                      .toFixed(2)}`
                    : "$0.00"}
                </span>
                <span>{openSections.expenses ? "▲" : "▼"}</span>
              </h2>
              {openSections.expenses && (
                <>
                  {balanceLoading && <p>Cargando gastos...</p>}
                  {balanceError && (
                    <p className="text-red-500">
                      Error al cargar gastos: {balanceError}
                    </p>
                  )}
                  {!balanceLoading &&
                    !balanceError &&
                    (expenses && expenses.length > 0 ? (
                      <ul className="space-y-3">
                        {expenses.map((expense) => (
                          <li
                            key={expense.idExpense}
                            className="border-b pb-3 last:border-b-0"
                          >
                            <p>
                              <strong>Tipo:</strong> {expense.typeExpense}
                            </p>
                            <p>
                              <strong>Monto:</strong> $
                              {parseFloat(expense.amount).toFixed(2)}
                            </p>
                            <p>
                              <strong>Fecha:</strong>{" "}
                              {formatDateSafe(expense.date)}
                            </p>
                            {expense.paymentMethod && (
                              <p>
                                <strong>Método de Pago:</strong> {expense.paymentMethod}
                              </p>
                            )}
                            {expense.notes && (
                              <p>
                                <strong>Notas:</strong> {expense.notes}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500">
                        No hay gastos registrados para esta obra.
                      </p>
                    ))}
                </>
              )}
            </div>

            {/* Tarjeta: Ingresos */}
            <div className="bg-green-100 shadow-md rounded-lg p-4 md:p-6 border-l-4 border-green-500">
              <h2
                className="text-xl font-bold mb-4 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection("incomes")}
              >
                Ingresos
                <span className="text-green-700 font-semibold">
                  {incomes && incomes.length > 0
                    ? `$${incomes
                      .reduce(
                        (total, income) =>
                          total + parseFloat(income.amount || 0),
                        0
                      )
                      .toFixed(2)}`
                    : "$0.00"}
                </span>
                <span>{openSections.incomes ? "▲" : "▼"}</span>
              </h2>
              {openSections.incomes && (
                <>
                  {balanceLoading && <p>Cargando ingresos...</p>}
                  {balanceError && (
                    <p className="text-red-500">
                      Error al cargar ingresos: {balanceError}
                    </p>
                  )}
                  {!balanceLoading &&
                    !balanceError &&
                    (incomes && incomes.length > 0 ? (
                      <ul className="space-y-3">
                        {incomes.map((income) => (
                          <li
                            key={income.idIncome}
                            className="border-b pb-3 last:border-b-0"
                          >
                            <p>
                              <strong>Tipo:</strong> {income.typeIncome}
                            </p>
                            <p>
                              <strong>Monto:</strong> $
                              {parseFloat(income.amount).toFixed(2)}
                            </p>
                            <p>
                              <strong>Fecha:</strong>{" "}
                              {formatDateSafe(income.date)}
                            </p>
                            {income.paymentMethod && (
                              <p>
                                <strong>Método de Pago:</strong> {income.paymentMethod}
                              </p>
                            )}
                            {income.notes && (
                              <p>
                                <strong>Notas:</strong> {income.notes}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500">
                        No hay ingresos registrados para esta obra.
                      </p>
                    ))}
                </>
              )}
            </div>

            <div className="bg-white shadow-md rounded-lg p-4 md:p-6 border-l-4 border-orange-500">
              <h3
                className="text-lg font-semibold mb-4 text-gray-700 flex justify-between items-center cursor-pointer"
                onClick={() => toggleSection("changeOrders")}
              >
                <span>Changes Orders</span>
                {!isViewOnly && (
                  <button
                    className="bg-blue-600 hover:bg-blue-800 text-white px-3 py-2 rounded-xl shadow ml-4"
                    onClick={e => {
                      e.stopPropagation();
                      setShowCreateCOModal(true);
                    }}
                  >
                    Generate Change Order
                  </button>
                )}
                <span className="ml-2">
                  {openSections.changeOrders ? "▲" : "▼"}
                </span>
              </h3>
              {openSections.changeOrders && (
                work?.changeOrders && work.changeOrders.length > 0 ? (
                  <ul className="space-y-4">
                    {work.changeOrders.map(co => {
                      // Determinar el color y el texto del badge de estado
                      let statusColor = 'bg-gray-500'; // Color por defecto
                      let statusTextColor = 'text-white';
                      let statusText = co.status;

                      switch (co.status) {
                        case 'approved':
                          statusColor = 'bg-green-500';
                          statusText = 'Aprobada';
                          break;
                        case 'rejected':
                          statusColor = 'bg-red-600';
                          statusText = 'Rechazada';
                          break;
                        case 'pendingClientApproval':
                          statusColor = 'bg-yellow-500';
                          statusTextColor = 'text-yellow-800';
                          statusText = 'Pendiente Cliente';
                          break;
                        case 'pendingAdminReview':
                          statusColor = 'bg-blue-500';
                          statusText = 'Pendiente Revisión';
                          break;
                        case 'draft':
                          statusColor = 'bg-gray-400';
                          statusTextColor = 'text-gray-800';
                          statusText = 'Borrador';
                          break;
                        default:
                          statusText = co.status;
                      }

                      return (
                        <li key={co.id} className="border p-4 rounded-lg shadow-sm bg-gray-50 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-semibold text-gray-800">
                                CO #: {co.changeOrderNumber || co.id.substring(0, 8)}
                              </p>
                              <p className="text-sm text-gray-700">
                                <strong>Descripción:</strong> {co.description}
                              </p>
                            </div>
                            <span
                              className={`px-3 py-1 text-xs font-bold rounded-full ${statusColor} ${statusTextColor} shadow-sm`}
                            >
                              {statusText.toUpperCase()}
                            </span>
                          </div>

                          {co.itemDescription && co.itemDescription !== co.description && (
                            <p className="text-sm text-gray-600 mb-1">
                              <strong>Detalle:</strong> {co.itemDescription}
                            </p>
                          )}
                          <p className="text-sm text-gray-700 mb-1">
                            <strong>Costo Total:</strong> ${parseFloat(co.totalCost || 0).toFixed(2)}
                          </p>

                          {co.respondedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              <strong>Respondida por Cliente:</strong> {new Date(co.respondedAt).toLocaleString()}
                            </p>
                          )}

                          {co.clientMessage && (
                            <div className="mt-2 text-xs p-2 bg-blue-50 border border-blue-200 rounded">
                              <p className="font-semibold text-blue-700">Mensaje para el Cliente (al enviar):</p>
                              <p className="text-gray-700">{co.clientMessage}</p>
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap items-center space-x-2">
                            {(co.status === 'draft' || co.status === 'pendingAdminReview') && (
                              <button
                                onClick={() => handlePreviewPdf(co.id)}
                                className="ml-2 px-3 py-1 text-xs font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
                              >
                                Ver Borrador PDF
                              </button>
                            )}

                            {!isViewOnly && (co.status === 'draft' || co.status === 'pendingAdminReview' || co.status === 'rejected') && (
                              <button
                                onClick={() => handleEditCO(co)}
                                className="ml-2 px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                              >
                                Editar CO
                              </button>
                            )}
                            {!isViewOnly && (co.status === 'draft' || co.status === 'pendingAdminReview' || co.status === 'rejected') && (
                              <button
                                onClick={() => handleDeleteCO(co.id)}
                                className="ml-2 px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                              >
                                Eliminar
                              </button>
                            )}
                            {!isViewOnly && (co.status === 'draft' || co.status === 'pendingAdminReview') && !co.pdfUrl && (
                              <button
                                onClick={() => handleSendCOToClient(co.id)}
                                className="ml-2 px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                              >
                                Enviar al Cliente
                              </button>
                            )}

                            {/* 🆕 Botón de Aprobación Manual */}
                            {!isViewOnly && (co.status === 'draft' || co.status === 'pendingAdminReview' || co.status === 'pendingClientApproval') && (
                              <button
                                onClick={() => handleManualApprove(co)}
                                className="ml-2 px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
                                title="Registrar aprobación verbal/telefónica del cliente"
                              >
                                ✓ Aprobar Manualmente
                              </button>
                            )}

                            {/* Enlace para ver el PDF enviado/actual */}
                            {co.pdfUrl && !co.pdfUrl.startsWith('file:///') && (co.status === 'pendingClientApproval' || co.status === 'approved' || co.status === 'rejected') && (
                              <a
                                href={co.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
                              >
                                Ver PDF
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-4 text-gray-600">No hay Órdenes de Cambio registradas para esta obra.</p>
                )
              )}
            </div>
          </div>
        </div>

        {/* --- SECCIÓN PARA FACTURA FINAL --- */}
        {canShowFinalInvoiceSection && (
          <div className="mt-6 bg-white shadow-md rounded-lg p-4 md:p-6 border-l-4 border-purple-500">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
              <h2 className="text-xl font-semibold">Factura Final</h2>
              <button
                onClick={() => setShowFinalInvoice(!showFinalInvoice)}
                className="text-sm text-white bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded"
              >
                {showFinalInvoice ? 'Ocultar' : 'Ver/Gestionar'} Factura Final
              </button>
            </div>

            {showFinalInvoice && (
              <div className="mt-4 border-t pt-4">
                <FinalInvoice workId={idWork} />
              </div>
            )}
          </div>
        )}

        {/* Modal para mostrar la imagen ampliada */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedImage(null);
              }
            }}
          >
            <div
              className="relative bg-white p-4 md:p-6 rounded shadow-lg flex flex-col max-h-[90vh] w-auto max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="overflow-y-auto flex-grow mb-4">
                <img
                  src={selectedImage.imageUrl}
                  alt="Imagen ampliada"
                  className="w-full h-auto object-contain rounded"
                />
              </div>
              <p className="text-center text-sm text-gray-600">{formatImageDateTime(selectedImage.dateTime)}</p>
              {selectedImage.comment && (
                <p className="text-center text-xs text-gray-500 mt-1 italic">"{selectedImage.comment}"</p>
              )}
              <div className="flex flex-col sm:flex-row justify-around mt-4 pt-4 border-t space-y-2 sm:space-y-0">
                <button
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded text-sm"
                  onClick={() => setSelectedImage(null)}
                >
                  Cerrar
                </button>
                <a
                  href={selectedImage.imageUrl}
                  download={`imagen_${selectedImage.id}_${selectedImage.stage}.jpg`}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded text-sm text-center"
                >
                  Descargar
                </a>
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL PARA CREAR ORDEN DE CAMBIO --- */}
        {work && (
          <>
           
            <CreateChangeOrderModal
              isOpen={showCreateCOModal}
              onClose={() => setShowCreateCOModal(false)}
              idWork={work.idWork}
              workPropertyAddress={work?.propertyAddress}
              currentTotalBudget={parseFloat(work.budget?.totalPrice || 0)}
              onCOCreated={() => {
                setShowCreateCOModal(false);
                // ✅ Refrescar solo datos de obra (optimizado)
                refreshWorkData({ workOnly: true });
              }}
            />
          </>
        )}
        {editingCO && showEditCOModal && (
          <CreateChangeOrderModal
            isOpen={showEditCOModal}
            onClose={() => {
              setShowEditCOModal(false);
              setEditingCO(null);
            }}
            idWork={work.idWork}
            workPropertyAddress={work?.propertyAddress}
            isEditing={true}
            initialCOData={editingCO}
            onCOCreated={() => {
              setShowEditCOModal(false);
              setEditingCO(null);
              // ✅ Refrescar solo datos de obra (optimizado)
              refreshWorkData({ workOnly: true });
            }}
          />
        )}
        {/* Modal para mostrar el PDF */}
        {showPdfModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-4 rounded shadow-lg w-full max-w-3xl h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Vista Previa del PDF</h3>
                <button
                  onClick={() => {
                    setShowPdfModal(false);
                    if (pdfUrlCo) {
                      URL.revokeObjectURL(pdfUrlCo);
                    }
                    setPdfUrlCo('');
                    setPdfError('');
                  }}
                  className="text-black text-2xl"
                >
                  &times;
                </button>
              </div>
              {pdfLoading && <p className="text-center">Cargando PDF...</p>}
              {pdfError && <p className="text-center text-red-500">Error: {pdfError}</p>}
              {pdfUrlCo && !pdfLoading && !pdfError && (
                <iframe
                  src={pdfUrlCo}
                  title="Vista previa del PDF"
                  className="w-full h-full border-0"
                />
              )}
            </div>
          </div>
        )}

        {/* 🆕 Modal para ver comprobante de invoice */}
        {selectedInvoiceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">
                    Invoice #{selectedInvoiceModal.invoiceNumber}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedInvoiceModal.vendor} • ${parseFloat(selectedInvoiceModal.totalAmount || 0).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedInvoiceModal(null)}
                  className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
                >
                  &times;
                </button>
              </div>
              
              <div className="p-6">
                {selectedInvoiceModal.invoicePdfPath && (
                  <div className="mb-4">
                    {selectedInvoiceModal.invoicePdfPath.includes('/image/') ? (
                      // Es una imagen de Cloudinary
                      <img
                        src={selectedInvoiceModal.invoicePdfPath}
                        alt={`Invoice ${selectedInvoiceModal.invoiceNumber}`}
                        className="w-full h-auto rounded border"
                      />
                    ) : (
                      // Es un PDF - usar Google Docs Viewer
                      <iframe
                        src={`https://docs.google.com/gview?url=${encodeURIComponent(selectedInvoiceModal.invoicePdfPath)}&embedded=true`}
                        className="w-full h-[600px] border rounded"
                        title={`Invoice ${selectedInvoiceModal.invoiceNumber}`}
                      />
                    )}
                    
                    
                    <div className="mt-4 flex gap-3">
                      <a
                        href={selectedInvoiceModal.invoicePdfPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium text-center transition-colors"
                      >
                        Abrir en Nueva Pestaña
                      </a>
                      
                      <button
                        onClick={() => {
                          setSelectedInvoiceModal(null);
                          navigate(`/supplier-invoices?openInvoice=${selectedInvoiceModal.idSupplierInvoice}`);
                        }}
                        className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded font-medium transition-colors"
                      >
                        Ir al Invoice para Pagar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <PdfModal
  isOpen={showBudgetPdfModal}
  onClose={() => {
    setShowBudgetPdfModal(false);
    if (budgetPdfUrl) URL.revokeObjectURL(budgetPdfUrl);
    setBudgetPdfUrl('');
  }}
  pdfUrl={budgetPdfUrl}
  title={`Presupuesto #${work?.budget?.idBudget}`}
/>

      {/* ✅ NEW: General Image Upload Modal */}
      {showUploadImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">📸 Subir Imagen a la Obra</h3>
                <button
                  onClick={() => {
                    setShowUploadImageModal(false);
                    setUploadImageFile(null);
                    setUploadImageComment('');
                    setSelectedStage('');
                    setTruckCount('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  &times;
                </button>
              </div>

              {/* Stage Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Etapa: <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Selecciona una etapa --</option>
                  <option value="foto previa del lugar">📍 Foto Previa del Lugar</option>
                  <option value="materiales">🧱 Materiales</option>
                  <option value="foto excavación">⛏️ Foto Excavación</option>
                  <option value="camiones de arena">🚛 Camiones de Arena</option>
                  <option value="sistema instalado">⚙️ Sistema Instalado</option>
                  <option value="extracción de piedras">🪨 Extracción de Piedras</option>
                  <option value="camiones de tierra">🚚 Camiones de Tierra</option>
                  <option value="trabajo cubierto">✅ Trabajo Cubierto</option>
                  <option value="inspeccion final">🔍 Inspección Final</option>
                </select>
              </div>

              {/* Truck Count (only for truck stages) */}
              {(selectedStage === 'camiones de arena' || selectedStage === 'camiones de tierra') && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  {(() => {
                    const currentImages = groupedImages[selectedStage] || [];
                    const currentTotal = currentImages.length > 0 
                      ? Math.max(...currentImages.map(img => Number(img.truckCount) || 0), 0)
                      : 0;
                    return currentTotal > 0 ? (
                      <div className="mb-3 p-2 bg-blue-100 border border-blue-300 rounded text-center">
                        <p className="text-sm font-semibold text-blue-800">
                          📊 Total actual registrado: <span className="text-lg">{currentTotal}</span> camiones
                        </p>
                      </div>
                    ) : null;
                  })()}
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total de Camiones Hasta el Momento: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={truckCount}
                    onChange={(e) => setTruckCount(e.target.value)}
                    placeholder="Ej: 5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Indica el total acumulado de camiones hasta este momento (no solo los de esta imagen)
                  </p>
                </div>
              )}

              {/* Image File Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Imagen: <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="block w-full text-sm text-gray-500
                             file:mr-4 file:py-2 file:px-4
                             file:rounded-full file:border-0
                             file:text-sm file:font-semibold
                             file:bg-indigo-50 file:text-indigo-700
                             hover:file:bg-indigo-100"
                />
              </div>

              {/* Image Preview */}
              {uploadImageFile && (
                <div className="mb-4">
                  <p className="text-xs text-gray-600 mb-2">
                    Archivo seleccionado: <span className="font-medium">{uploadImageFile.name}</span>
                  </p>
                  <img 
                    src={URL.createObjectURL(uploadImageFile)} 
                    alt="Previsualización" 
                    className="max-h-60 w-auto rounded border shadow-sm mx-auto"
                  />
                </div>
              )}

              {/* Comment */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comentario (opcional):
                </label>
                <textarea
                  value={uploadImageComment}
                  onChange={(e) => setUploadImageComment(e.target.value)}
                  placeholder="Agrega un comentario descriptivo sobre esta imagen..."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Role Info */}
              <div className="mb-4 p-3 bg-gray-50 rounded-md">
                <p className="text-xs text-gray-600">
                  👤 Subiendo como: <span className="font-semibold capitalize">{userRole}</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleUploadImage}
                  disabled={!uploadImageFile || !selectedStage || uploadingImage}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {uploadingImage ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Subiendo Imagen...
                    </span>
                  ) : (
                    '📤 Subir Imagen'
                  )}
                </button>
                
                <button
                  onClick={() => {
                    setShowUploadImageModal(false);
                    setUploadImageFile(null);
                    setUploadImageComment('');
                    setSelectedStage('');
                    setTruckCount('');
                  }}
                  disabled={uploadingImage}
                  className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold rounded disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📝 Modal de Notas de Seguimiento */}
      {showWorkNotesModal && (
        <WorkNotesModal
          work={work}
          onClose={() => setShowWorkNotesModal(false)}
        />
      )}

      {/* 📋 Modal de Checklist */}
      {showChecklistModal && (
        <WorkChecklistModal
          work={work}
          onClose={() => setShowChecklistModal(false)}
          onUpdate={() => {
            // Recargar checklist después de actualizar (solo roles permitidos)
            if (['owner', 'admin', 'finance', 'finance-viewer'].includes(userRole)) {
              dispatch(fetchChecklistByWorkId(idWork));
            }
          }}
        />
      )}

      {/* 🆕 Modal de Aprobación Manual de Change Order */}
      {showManualApprovalModal && approvingCO && (
        <ManualApprovalModal
          isOpen={showManualApprovalModal}
          onClose={() => {
            setShowManualApprovalModal(false);
            setApprovingCO(null);
          }}
          changeOrder={approvingCO}
          workId={idWork}
        />
      )}
    </div>
  );
};

export default WorkDetail;
