import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { uploadPdf } from "../Redux/Actions/pdfActions";
import { createPermit, checkPermitByAddress } from "../Redux/Actions/permitActions";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import { ToastContainer, toast } from 'react-toastify';
import CountyInput from './Common/CountyInput';
import 'react-toastify/dist/ReactToastify.css';
import Swal from 'sweetalert2';
 

const PdfReceipt = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector((state) => state.auth.token);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [optionalDocPreview, setOptionalDocPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [optionalDocs, setOptionalDocs] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    permitNumber: "",
    applicationNumber: "",
    constructionPermitFor: "",
    applicant: "",
    propertyAddress: "",
    county: "",
    systemType: "", // Mantener para mostrar/editar en el Permit si es necesario
    lot: "",
    block: "",
    gpdCapacity: "", // Mantener para mostrar/editar en el Permit si es necesario
    drainfieldDepth: "", // Mantener para mostrar/editar en el Permit si es necesario
    excavationRequired: "",
    dateIssued: "",
    expirationDate: "",
    pump: "",
    applicantName: "",
    applicantEmail: "",
    applicantPhone: "",
  });

  const [isPBTS, setIsPBTS] = useState(""); // Estado para PBTS (YES/NO)
  const [showPBTSField, setShowPBTSField] = useState(false); // Mostrar campo PBTS solo si es ATU
  
  // 🆕 Estados para validación de permit number en tiempo real
  const [permitNumberValidation, setPermitNumberValidation] = useState({ 
    status: 'idle', // idle, checking, valid, duplicate, duplicate_no_budget, error
    message: '',
    permitId: null,
    hasBudget: null
  });
  const [permitNumberCheckTimeout, setPermitNumberCheckTimeout] = useState(null);
  const [lastValidatedPermitNumber, setLastValidatedPermitNumber] = useState(''); // 🆕 Guardar último número validado

  // 🆕 Estados para emails adicionales (notificationEmails)
  const [notificationEmails, setNotificationEmails] = useState([]);
  const [newNotificationEmail, setNewNotificationEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const [expirationWarning, setExpirationWarning] = useState({ type: "", message: "" });
  const [excavationUnit, setExcavationUnit] = useState("INCH");
  const [displayDate, setDisplayDate] = useState(""); // Para mostrar fecha en formato MM-DD-YYYY
  const defaultLayoutPluginInstance = defaultLayoutPlugin();


  // 🆕 Función centralizada para validar permit number
  const validatePermitNumber = async (permitNumber) => {
    // Si el campo está vacío, resetear validación
    if (!permitNumber || permitNumber.trim() === '') {
      setPermitNumberValidation({ status: 'idle', message: '', permitId: null, hasBudget: null });
      setLastValidatedPermitNumber('');
      return;
    }

    const trimmedNumber = permitNumber.trim();

    // Mostrar estado "checking"
    setPermitNumberValidation({ status: 'checking', message: 'Verificando...', permitId: null, hasBudget: null });

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/permit/check-permit-number/${encodeURIComponent(trimmedNumber)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.exists) {
        // Verificar si tiene presupuesto asociado
        if (data.hasBudget) {
          // Tiene presupuesto: es un duplicado verdadero
          setPermitNumberValidation({ 
            status: 'duplicate', 
            message: `❌ Este número de permit ya existe y tiene presupuestos asociados.`,
            permitId: null,
            hasBudget: true
          });
        } else {
          // Existe pero SIN presupuesto: permitir reutilización
          setPermitNumberValidation({ 
            status: 'duplicate_no_budget', 
            message: `⚠️ Este número de permit ya existe pero no tiene presupuestos. Puedes reutilizarlo.`,
            permitId: null,
            hasBudget: false
          });
        }
      } else {
        setPermitNumberValidation({ 
          status: 'valid', 
          message: '✅ Número de permit disponible',
          permitId: null,
          hasBudget: null
        });
      }
      
      // Guardar el número validado
      setLastValidatedPermitNumber(trimmedNumber);
    } catch (error) {
      console.error('Error validating permit number:', error);
      setPermitNumberValidation({ 
        status: 'error', 
        message: '⚠️ Error al verificar el número',
        permitId: null,
        hasBudget: null
      });
      setLastValidatedPermitNumber('');
    }
  };

  // 🆕 Funciones para manejar emails adicionales
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddNotificationEmail = () => {
    const trimmedEmail = newNotificationEmail.trim();
    
    if (!trimmedEmail) {
      setEmailError('Por favor ingresa un email');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setEmailError('Por favor ingresa un email válido');
      return;
    }

    if (trimmedEmail.toLowerCase() === formData.applicantEmail.toLowerCase()) {
      setEmailError('Este email ya es el email principal');
      return;
    }

    if (notificationEmails.some(email => email.toLowerCase() === trimmedEmail.toLowerCase())) {
      setEmailError('Este email ya está en la lista');
      return;
    }

    setNotificationEmails([...notificationEmails, trimmedEmail]);
    setNewNotificationEmail('');
    setEmailError('');
  };

  const handleRemoveNotificationEmail = (emailToRemove) => {
    setNotificationEmails(notificationEmails.filter(email => email !== emailToRemove));
  };

  const handleNotificationEmailKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNotificationEmail();
    }
  };

  // Función helper para formatear fecha en formato MM-DD-YYYY
  const formatDateUSA = (dateString) => {
    if (!dateString) return '';
    const dateParts = dateString.split('-');
    if (dateParts.length === 3) {
      const year = dateParts[0];
      const month = dateParts[1];
      const day = dateParts[2];
      return `${month}-${day}-${year}`;
    }
    return dateString;
  };

  // Función para convertir MM-DD-YYYY a YYYY-MM-DD
  const convertUSAtoISO = (usaDate) => {
    if (!usaDate) return '';
    const parts = usaDate.split(/[-\/]/); // Acepta tanto - como /
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  // Manejar cambios en el input de fecha personalizado
  const handleDateChange = (e) => {
    const value = e.target.value;
    setDisplayDate(value);
    
    // Convertir a formato ISO para el estado interno
    const isoDate = convertUSAtoISO(value);
    if (isoDate) {
      setFormData(prev => ({
        ...prev,
        expirationDate: isoDate
      }));
    } else if (value === '') {
      setFormData(prev => ({
        ...prev,
        expirationDate: ''
      }));
    }
  };

  useEffect(() => {
    if (formData.expirationDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Comparar solo fechas

      // El input type="date" devuelve 'YYYY-MM-DD'
      // new Date('YYYY-MM-DD') puede tener problemas de zona horaria (interpretarse como UTC).
      // Es más seguro construir la fecha así para asegurar que es la fecha local:
      const dateParts = formData.expirationDate.split('-');
      if (dateParts.length === 3) {
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // Mes es 0-indexado
        const day = parseInt(dateParts[2], 10);
        
        const expDate = new Date(year, month, day);
        expDate.setHours(0,0,0,0);

        if (isNaN(expDate.getTime())) {
          setExpirationWarning({ type: "error", message: "Fecha de expiración inválida." });
          return;
        }

        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        // Formatear fecha en formato USA para mostrar en mensajes
        const dateUSAFormat = formatDateUSA(formData.expirationDate);

        if (expDate < today) {
          const msg = `¡Vencido! La fecha (${dateUSAFormat}) ya pasó.`;
          setExpirationWarning({ type: "error", message: msg });
        } else if (expDate <= thirtyDaysFromNow) {
          const msg = `Próximo a vencer: La fecha (${dateUSAFormat}) es en menos de 30 días.`;
          setExpirationWarning({ type: "warning", message: msg });
        } else {
          setExpirationWarning({ type: "", message: "" }); // Válido y no próximo a vencer
        }
      } else {
         setExpirationWarning({ type: "error", message: "Formato de fecha inválido." });
      }
    } else {
      setExpirationWarning({ type: "", message: "" }); // Sin fecha, sin advertencia
    }
  }, [formData.expirationDate]);
  
  // 🆕 Validar permit number automáticamente cuando cambia (ej. por extracción de PDF o autocompletar)
  useEffect(() => {
    const currentNumber = formData.permitNumber?.trim() || '';
    
    // Solo validar si:
    // 1. El número tiene valor
    // 2. El número es diferente al último validado
    if (currentNumber && currentNumber !== lastValidatedPermitNumber) {
      // Validar el nuevo número
      validatePermitNumber(currentNumber);
    } else if (!currentNumber) {
      // Si el campo está vacío, resetear validación
      setPermitNumberValidation({ status: 'idle', message: '' });
      setLastValidatedPermitNumber('');
    }
  }, [formData.permitNumber]); // Se ejecuta cuando permitNumber cambia

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    console.log("Archivo seleccionado:", uploadedFile);
    if (uploadedFile) {
      const fileUrl = URL.createObjectURL(uploadedFile);
      setPdfPreview(fileUrl);
      setFile(uploadedFile);
      dispatch(uploadPdf(uploadedFile)).then((action) => {
        if (action.payload && action.payload.data) {
          const extractedData = action.payload.data;
          let detectedUnit = "INCH"; // Default

          // --- Lógica para detectar unidad en excavationRequired ---
          if (extractedData.excavationRequired) {
            const textValue = String(extractedData.excavationRequired).trim();
            const parts = textValue.split(/\s+/);
            if (parts.length > 1) {
              const lastPartUpper = parts[parts.length - 1].toUpperCase();
              if (["INCH", "FEET"].includes(lastPartUpper)) {
                detectedUnit = lastPartUpper;
                // Opcional: podrías quitar la unidad del valor si siempre es número + unidad
                // extractedData.excavationRequired = parts.slice(0, -1).join(' ');
              }
            }
          }
          // --- Fin Lógica ---

         // Asegurar que expirationDate sea un string YYYY-MM-DD si viene de la extracción
         let finalExpirationDate = extractedData.expirationDate;
         if (finalExpirationDate) {
           try {
               // Intentar normalizar a YYYY-MM-DD si es una fecha válida
               const d = new Date(finalExpirationDate);
               // Verificar si la fecha es válida (getTime() no es NaN)
               // y también que el año sea razonable (ej. no año 0001 si el parseo falla parcialmente)
               if (!isNaN(d.getTime()) && d.getFullYear() > 1000) { 
                   const year = d.getFullYear();
                   const month = String(d.getMonth() + 1).padStart(2, '0');
                   const day = String(d.getDate()).padStart(2, '0');
                   finalExpirationDate = `${year}-${month}-${day}`;
               } else {
                   console.warn("Extracted expiration date was invalid or couldn't be parsed reliably:", extractedData.expirationDate);
                   finalExpirationDate = ""; // o null, o mantener el valor original si se prefiere
               }
           } catch (parseError) {
               console.warn("Error parsing extracted expiration date:", parseError, extractedData.expirationDate);
               finalExpirationDate = ""; // o null
           }
         }


         setFormData((prevFormData) => ({
           ...prevFormData,
           ...extractedData,
           expirationDate: finalExpirationDate || prevFormData.expirationDate, 
         }));
         setExcavationUnit(detectedUnit);
         
         // 🆕 Detectar si el systemType extraído incluye ATU
         if (extractedData.systemType && extractedData.systemType.toUpperCase().includes('ATU')) {
           setShowPBTSField(true);
         }
         
         // Actualizar displayDate con el formato USA
         if (finalExpirationDate) {
           setDisplayDate(formatDateUSA(finalExpirationDate));
         }

        } else if (action.error) {
            console.error("Error al procesar PDF:", action.error);
            
            // Manejar error de tamaño de archivo
            const errorPayload = action.payload;
            if (errorPayload?.error && errorPayload?.sizeMB) {
              // Error de tamaño específico del backend
              toast.error(`❌ ${errorPayload.message}`, {
                duration: 8000, // 8 segundos para mensaje importante
                icon: '⚠️'
              });
            } else {
              // Error genérico
              const errorMsg = action.error.message || "Error desconocido durante la extracción.";
              toast.error(`Error de Extracción: ${errorMsg}`);
            }
        }
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Para otros campos que no sean expirationDate
    if (name !== 'expirationDate') {
      setFormData((prevFormData) => ({
        ...prevFormData,
        [name]: value,
      }));

      // 🆕 Detectar si systemType incluye "ATU" para mostrar campo PBTS
      if (name === 'systemType') {
        const includesATU = value.toUpperCase().includes('ATU');
        setShowPBTSField(includesATU);
        if (!includesATU) {
          setIsPBTS(""); // Reset PBTS si no es ATU
        }
      }

      // 🆕 Validar permit number en tiempo real con debounce
      if (name === 'permitNumber') {
        // Limpiar timeout anterior
        if (permitNumberCheckTimeout) {
          clearTimeout(permitNumberCheckTimeout);
        }

        // Si el campo está vacío, resetear validación
        if (!value || value.trim() === '') {
          setPermitNumberValidation({ status: 'idle', message: '' });
          return;
        }

        // Mostrar estado "checking"
        setPermitNumberValidation({ status: 'checking', message: 'Verificando...' });

        // Configurar nuevo timeout para verificar después de 800ms
        const timeout = setTimeout(() => {
          validatePermitNumber(value);
        }, 800);

        setPermitNumberCheckTimeout(timeout);
      }
    }
  };

  const handleOptionalDocUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      const fileUrl = URL.createObjectURL(uploadedFile);
      setOptionalDocPreview(fileUrl);
      setOptionalDocs(uploadedFile);
    }
  };

  const checkExistingPermit = async (address) => {
    try {
      // La acción de Redux devuelve la data directamente o lanza un error
      const result = await dispatch(checkPermitByAddress(address));
      return result; // Esto será { exists: boolean, permit: object|null, hasBudget: boolean, message: string }
    } catch (error) {
      console.error("Error en checkExistingPermit (capturado en componente):", error);
      toast.error(error.message || `Error al verificar permiso existente.`);
      throw error; // Re-lanzar para que handleSubmit lo maneje si es necesario
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    // 🆕 VALIDAR PERMIT NUMBER ANTES DE CONTINUAR
    // Forzar validación si el estado no es 'valid', 'duplicate', o 'duplicate_no_budget'
    if (formData.permitNumber && permitNumberValidation.status !== 'valid' && permitNumberValidation.status !== 'duplicate' && permitNumberValidation.status !== 'duplicate_no_budget') {
      toast.info('Validando permit number...');
      await validatePermitNumber(formData.permitNumber);
      // Esperar un poco para que se complete la validación
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 🆕 VALIDAR PERMIT NUMBER - Si hay duplicado CON presupuesto, no permitir continuar
    if (permitNumberValidation.status === 'duplicate') {
      await Swal.fire({
        title: 'Permit Number Duplicado',
        text: permitNumberValidation.message,
        icon: 'error',
        confirmButtonColor: '#d33'
      });
      return;
    }

    // 🆕 NUEVO: Si hay duplicado SIN presupuesto, mostrar opción de reutilizar
    if (permitNumberValidation.status === 'duplicate_no_budget') {
      const continueWithExisting = await Swal.fire({
        title: 'Permit Existente',
        text: permitNumberValidation.message + '\n\n¿Deseas continuar para crear un presupuesto con este permit?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, reutilizar',
        cancelButtonText: 'No, cancelar'
      });

      if (continueWithExisting.isConfirmed) {
        // Continuar normalmente sin crear un nuevo permit
        // El backend aceptará el permit duplicado porque no tiene presupuesto
      } else {
        return; // El usuario decidió no continuar
      }
    }

    // 🆕 Si está verificando, esperar un momento
    if (permitNumberValidation.status === 'checking') {
      toast.info('Esperando validación del permit number...');
      return;
    }

    const confirmationResult = await Swal.fire({
      title: '¿Plano Cargado?',
      text: "Si este permit requiere un plano (documento opcional), ¿ya lo has cargado?",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'No, revisar'
    });

    // Si el usuario presiona "No, revisar" o cierra la alerta, detener el envío
    if (!confirmationResult.isConfirmed) {
      console.log("El usuario canceló el envío para verificar el plano.");
      toast.info("Envío cancelado. Verifica si necesitas cargar el plano opcional."); // Toast informativo
      return;
    }

    if (expirationWarning.type === "error" && formData.expirationDate) {
      const confirmExpired = await Swal.fire({
          title: 'Permiso Vencido',
          text: `${expirationWarning.message} ¿Aún así deseas crearlo? El presupuesto podría ser rechazado.`,
          icon: 'error',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'Sí, crear igualmente',
          cancelButtonText: 'Cancelar'
      });
      if (!confirmExpired.isConfirmed) {
          return; // Detener si el usuario cancela
      }
  } else if (expirationWarning.type === "warning" && formData.expirationDate) {
       const confirmSoonToExpire = await Swal.fire({
          title: 'Permiso Próximo a Vencer',
          text: `${expirationWarning.message} ¿Deseas continuar?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#3085d6',
          cancelButtonColor: '#d33',
          confirmButtonText: 'Sí, continuar',
          cancelButtonText: 'Cancelar'
      });
      if (!confirmSoonToExpire.isConfirmed) {
          return; 
      }
  }

    if (!formData.applicantName) {
      toast.warn("El campo 'Name' (Applicant Name) es obligatorio.");
      return;
    }
    if (!formData.applicantEmail) {
      toast.warn("El campo 'Email' es obligatorio.");
      return;
    }
    if (!formData.applicantPhone) {
      toast.warn("El campo 'Phone' es obligatorio.");
      return;
    }
    if (!formData.propertyAddress) {
      toast.warn("El campo 'Property Address' es obligatorio.");
      return;
    }
    if (!formData.permitNumber) {
      toast.warn("El campo 'Permit Number' es obligatorio.");
      return;
    }
    if (!formData.systemType) {
      toast.warn("El campo 'System Type' es obligatorio.");
      return;
    }
    if (!formData.expirationDate) {
      toast.warn("El campo 'Expiration Date' es obligatorio.");
      return;
    }
    if (!formData.lot || String(formData.lot).trim() === '') {
      toast.warn("El campo 'Lot' es obligatorio.");
      return;
    }
    if (!formData.block || String(formData.block).trim() === '') {
      toast.warn("El campo 'Block' es obligatorio.");
      return;
    }
    if (!formData.gpdCapacity || String(formData.gpdCapacity).trim() === '') {
      toast.warn("El campo 'GPD Capacity' es obligatorio.");
      return;
    }
    if (!formData.drainfieldDepth || String(formData.drainfieldDepth).trim() === '') {
      toast.warn("El campo 'Drainfield Depth' es obligatorio.");
      return;
    }
    if (!formData.excavationRequired || String(formData.excavationRequired).trim() === '') {
      toast.warn("El campo 'Excavation Required' es obligatorio.");
      return;
    }
    if (!formData.pump || String(formData.pump).trim() === '') {
      toast.warn("El campo 'Pump' es obligatorio.");
      return;
    }
    // 🆕 Validar PBTS si el systemType incluye ATU
    if (showPBTSField && !isPBTS) {
      toast.warn("Por favor seleccione si el sistema ATU es PBTS o NO.");
      return;
    }
    if (!file) {
      toast.warn("No se ha seleccionado ningún archivo PDF principal.");
      return;
    }

    let loadingToastId; // Definir fuera para que sea accesible en catch
    try {

      loadingToastId = toast.loading("Procesando permiso...");

      // --- PASO 1: VERIFICAR SI EL PERMIT YA EXISTE ---
      // Aquí usamos la función checkExistingPermit que llama a la acción de Redux
      const existingPermitCheck = await checkExistingPermit(formData.propertyAddress);

      if (existingPermitCheck.exists) {
        if (existingPermitCheck.hasBudget) {
          toast.dismiss(loadingToastId);
          Swal.fire({
            title: 'Permiso Existente',
            text: `Ya existe un permiso para "${formData.propertyAddress}" y tiene presupuestos asociados. No se puede crear uno nuevo ni proceder.`,
            icon: 'info'
          });
          return; // Detener el proceso
        } else {
          // Permit existe pero NO tiene budget
          toast.dismiss(loadingToastId);
          const continueWithExisting = await Swal.fire({
            title: 'Permiso Existente Sin Presupuesto',
            text: `Ya existe un permiso para "${formData.propertyAddress}" pero no tiene presupuestos. ¿Deseas continuar para crear un presupuesto con este permiso?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'No, cancelar'
          });

          if (continueWithExisting.isConfirmed) {
            // Navegar a la creación del budget usando el ID del permit existente
            // 🆕 Incluir PBTS si aplica
            const pbtsParam = showPBTSField && isPBTS ? `&pbts=${isPBTS}` : '';
            navigate(`/createBudget?permitId=${existingPermitCheck.permit.idPermit}${pbtsParam}`);
            return; // Detener el proceso actual
          } else {
            return; // El usuario decidió no continuar
          }
        }
      }
      if (toast.isActive(loadingToastId)) {
        // No es necesario reabrirlo si ya está activo
      } else {
        loadingToastId = toast.loading("Guardando nuevo permiso...");
      }
      // --- Preparar FormData (sin cambios) ---
      const formDataToSend = new FormData();
      formDataToSend.append("pdfData", file);
      if (optionalDocs) {
        formDataToSend.append("optionalDocs", optionalDocs);
      }
      Object.keys(formData).forEach((key) => {
        let valueToSend = formData[key] ?? ''; // Valor por defecto

        // --- Lógica especial para excavationRequired ---
        if (key === 'excavationRequired') {
          // 1. Obtener el valor original y asegurarse de que sea string, luego trim
          const originalStringValue = String(valueToSend).trim();
          // 2. Intentar parsear el valor trimeado
          const numericValue = parseFloat(originalStringValue);

          // 3. Verificar si el valor trimeado NO está vacío Y es un número válido Y coincide exactamente con su representación numérica
          if (originalStringValue !== '' && !isNaN(numericValue) && String(numericValue) === originalStringValue) {
             // 4. Si es puramente numérico, usar el valor trimeado y añadir la unidad
             valueToSend = `${originalStringValue} ${excavationUnit}`;
          } else {
             // 5. Si no es puramente numérico (o está vacío), usar el valor original trimeado tal cual
             valueToSend = originalStringValue;
          }
        }
        // --- Fin Lógica especial ---

        formDataToSend.append(key, valueToSend);
      });

      // 🆕 Agregar isPBTS si aplica (ATU system)
      if (showPBTSField && isPBTS) {
        formDataToSend.append('isPBTS', isPBTS === 'YES');
      }

      // 🆕 Agregar emails adicionales (notificationEmails)
      if (notificationEmails.length > 0) {
        formDataToSend.append('notificationEmails', JSON.stringify(notificationEmails));
      }

      console.log("Enviando datos para crear el permiso...");
      loadingToastId = toast.loading("Guardando permiso...");

      // --- Llamar al dispatch ---
      // La acción createPermit debe lanzar un error en caso de fallo
      const permitData = await dispatch(createPermit(formDataToSend));

      // --- Si llegamos aquí, fue exitoso ---
      toast.dismiss(loadingToastId);
      const newPermitId = permitData?.idPermit; // Asumiendo que la acción devuelve los datos en éxito
      if (newPermitId) {
        console.log("Permiso creado con ID:", newPermitId);
        toast.success("¡Permit creado correctamente!");
        // 🆕 Incluir PBTS si aplica
        const pbtsParam = showPBTSField && isPBTS ? `&pbts=${isPBTS}` : '';
        navigate(`/createBudget?permitId=${newPermitId}${pbtsParam}`);
      } else {
        console.error("Respuesta de éxito inesperada:", permitData);
        toast.error("Éxito, pero no se recibió el ID del permiso.");
      }

    } catch (error) {
      // --- Manejo de Error Simplificado ---
      console.error(">>> ERROR CAPTURADO EN handleSubmit:", error); // Log detallado del error
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
      }

      // --- Examinar el error directamente ---
      const errorDetails = error?.details; // Intenta acceder a la propiedad adjunta
      const responseData = error?.response?.data; // Intenta acceder a datos de respuesta Axios (si no se lanzó explícitamente)

      console.log(">>> error.details:", errorDetails);
      console.log(">>> error.response?.data:", responseData);

      let displayMessage = "Error al crear el permiso.";

      if (error.message.includes("verificar permiso existente")) { // O alguna otra forma de identificar el origen
        // El error ya fue (o debería haber sido) mostrado por checkExistingPermit
        // No hacer nada más aquí o mostrar un mensaje genérico si es necesario.
        console.log("Error durante la verificación del permiso, ya manejado o será manejado por checkExistingPermit.");
    } else if (responseData?.error && responseData?.sizeMB) {
      // Error de tamaño de archivo específico
      displayMessage = responseData.message;
      toast.error(`❌ ${displayMessage}`, { 
        autoClose: 8000,
        icon: '⚠️'
      });
    } else if (errorDetails && errorDetails.code === '23505' && errorDetails.constraint === 'Permits_propertyAddress_key1') {
      displayMessage = `Dirección ya existe: "${formData.propertyAddress}".`;
      toast.error(displayMessage, { autoClose: 7000 });
    } else if (errorDetails && errorDetails.message) {
      displayMessage = errorDetails.message;
      toast.error(`Error: ${displayMessage}`);
    } else if (error.message) {
      displayMessage = error.message;
      toast.error(`Error: ${displayMessage}`);
    } else {
      toast.error(displayMessage);
    }
  }
};
    // --- FIN SIMPLIFICADO try/catch ---
  

  return (
    <div className="max-w-7xl mx-auto p-4 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      <h1 className="text-2xl md:text-3xl font-bold mb-8 text-blue-900 flex items-center gap-3">
        <span className="inline-block bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-lg font-semibold">Permits & PDF</span>
        <span className="text-base font-normal text-gray-400">Document & Data Management</span>
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Panel PDF reorganizado por tab */}
        <div className="bg-white shadow-xl rounded-2xl p-6 col-span-2 flex flex-col">
          {/* Tabs de vista arriba */}
          <div className="flex gap-2 mb-6 justify-center">
            <button onClick={() => setCurrentPage(1)} className={`py-2 px-4 rounded-lg font-semibold transition-all duration-200 ${currentPage === 1 ? "bg-blue-700 text-white shadow" : "bg-gray-100 text-blue-700 hover:bg-blue-50"}`}>Permit</button>
            <button onClick={() => setCurrentPage(2)} className={`py-2 px-4 rounded-lg font-semibold transition-all duration-200 ${currentPage === 2 ? "bg-blue-700 text-white shadow" : "bg-gray-100 text-blue-700 hover:bg-blue-50"}`}>Site Plan</button>
          </div>
          {/* Sección de carga y preview según tab activo */}
          <div className="flex-1 flex flex-col items-center justify-start">
            {currentPage === 1 && (
              <>
                <label className="block mb-2 w-full max-w-md">
                  <span className="text-xs text-gray-500">Cargar Permit PDF</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="block border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white p-2 w-full"
                  />
                </label>
                {pdfPreview ? (
                  <div className="overflow-y-auto max-h-[600px] border border-gray-200 rounded-lg shadow-inner bg-gray-50 w-full max-w-2xl">
                    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
                      <Viewer fileUrl={pdfPreview} plugins={[defaultLayoutPluginInstance]} />
                    </Worker>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-lg min-h-[200px]">No main PDF uploaded.</div>
                )}
              </>
            )}
            {currentPage === 2 && (
              <>
                <label className="block mb-2 w-full max-w-md">
                  <span className="text-xs text-gray-500">Cargar Site Plan (opcional)</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleOptionalDocUpload}
                    className="block border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white p-2 w-full"
                  />
                </label>
                {optionalDocPreview ? (
                  <div className="overflow-y-auto max-h-[600px] border border-gray-200 rounded-lg shadow-inner bg-gray-50 w-full max-w-2xl">
                    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
                      <Viewer fileUrl={optionalDocPreview} plugins={[defaultLayoutPluginInstance]} />
                    </Worker>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-lg min-h-[200px]">No optional document uploaded.</div>
                )}
              </>
            )}
          </div>
        </div>
        {/* Panel Formulario */}
        <div className="bg-white shadow-xl rounded-2xl p-6 col-span-1">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5">
            <h2 className="text-lg font-bold text-blue-800 mb-2">Permit Data</h2>
            {Object.keys(formData)
              .filter(
                (key) =>
                  key !== "applicationNumber" &&
                  key !== "constructionPermitFor" &&
                  key !== "dateIssued"
              )
              .map((key) => (
                <div key={key} className="mb-1">
                  {key === "applicantName" && (
                    <h3 className="text-xs font-semibold mt-2 mb-2 bg-blue-100 text-blue-800 p-1 rounded">CUSTOMER CLIENT</h3>
                  )}
                  <label className="block text-xs font-medium capitalize text-gray-700 mb-1">
                    {key === "applicantName"
                      ? "Name"
                      : key === "applicantEmail"
                      ? "Email"
                      : key === "applicantPhone"
                      ? "Phone"
                      : key === "propertyAddress"
                      ? "Property Address"
                      : key === "county"
                      ? "County"
                      : key === "permitNumber"
                      ? "Permit Number"
                      : key === "systemType"
                      ? "System Type"
                      : key === "lot"
                      ? "Lot"
                      : key === "block"
                      ? "Block"
                      : key === "gpdCapacity"
                      ? "GPD Capacity"
                      : key === "drainfieldDepth"
                      ? "Drainfield Depth"
                      : key === "excavationRequired"
                      ? "Excavation Required"
                      : key === "expirationDate"
                      ? "Expiration Date"
                      : key === "pump"
                      ? "Pump"
                      : key.replace(/([A-Z])/g, " $1").trim()}
                    {(key === "applicantName" || key === "applicantEmail" || key === "applicantPhone" || 
                      key === "propertyAddress" || key === "permitNumber" || key === "systemType" || 
                      key === "expirationDate" || key === "lot" || key === "block" || 
                      key === "gpdCapacity" || key === "drainfieldDepth" || key === "excavationRequired" || 
                      key === "pump") && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {/* --- RENDERIZADO CONDICIONAL --- */}
                  {key === "excavationRequired" ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="text"
                        name="excavationRequired"
                        value={formData.excavationRequired ?? ""}
                        onChange={handleInputChange}
                        className="block w-2/3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50"
                        placeholder="Value or description"
                        required
                      />
                      <select
                        name="excavationUnit"
                        value={excavationUnit}
                        onChange={(e) => setExcavationUnit(e.target.value)}
                        className="block w-1/3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50"
                      >
                        <option value="INCH">INCH</option>
                        <option value="FEET">FEET</option>
                      </select>
                    </div>
                  ) : key === "expirationDate" ? (
                    <input
                      type="text"
                      name="expirationDate"
                      value={displayDate}
                      onChange={handleDateChange}
                      placeholder="MM-DD-YYYY"
                      className={`mt-1 block w-full border ${
                        expirationWarning.type === "error"
                          ? "border-red-500 bg-red-100 text-red-700 placeholder-red-700"
                          : expirationWarning.type === "warning"
                          ? "border-yellow-500 bg-yellow-100 text-yellow-700 placeholder-yellow-700"
                          : "border-gray-300 bg-gray-50"
                      } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                    />
                  ) : key === "permitNumber" ? (
                    <div>
                      <input
                        type="text"
                        name="permitNumber"
                        value={formData.permitNumber ?? ""}
                        onChange={handleInputChange}
                        onBlur={(e) => {
                          // Validar cuando pierde el foco (cubre autocompletar)
                          if (e.target.value && e.target.value.trim() !== '') {
                            // Cancelar cualquier timeout pendiente
                            if (permitNumberCheckTimeout) {
                              clearTimeout(permitNumberCheckTimeout);
                            }
                            // Validar inmediatamente
                            validatePermitNumber(e.target.value);
                          }
                        }}
                        className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                          permitNumberValidation.status === "duplicate"
                            ? "border-red-500 bg-red-50"
                            : permitNumberValidation.status === "duplicate_no_budget"
                            ? "border-yellow-500 bg-yellow-50"
                            : permitNumberValidation.status === "valid"
                            ? "border-green-500 bg-green-50"
                            : permitNumberValidation.status === "checking"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-300 bg-gray-50"
                        }`}
                        required
                      />
                      {permitNumberValidation.message && (
                        <p className={`mt-1 text-xs ${
                          permitNumberValidation.status === "duplicate"
                            ? "text-red-600"
                            : permitNumberValidation.status === "duplicate_no_budget"
                            ? "text-yellow-600"
                            : permitNumberValidation.status === "valid"
                            ? "text-green-600"
                            : permitNumberValidation.status === "checking"
                            ? "text-blue-600"
                            : "text-gray-600"
                        }`}>
                          {permitNumberValidation.message}
                        </p>
                      )}
                    </div>
                  ) : key === "county" ? (
                    <CountyInput
                      value={formData.county ?? ""}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 bg-gray-50 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  ) : (
                    <input
                      type={
                        key === "applicantEmail"
                          ? "email"
                          : key === "applicantPhone"
                          ? "tel"
                          : "text"
                      }
                      name={key}
                      value={formData[key] ?? ""}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 bg-gray-50 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      required={
                        key === "applicantName" || 
                        key === "applicantEmail" || 
                        key === "applicantPhone" || 
                        key === "propertyAddress" || 
                        key === "permitNumber" || 
                        key === "systemType" || 
                        key === "lot" || 
                        key === "block" || 
                        key === "gpdCapacity" || 
                        key === "drainfieldDepth" || 
                        key === "excavationRequired" || 
                        key === "pump"
                      }
                    />
                  )}
                  {/* 🆕 Mostrar campo PBTS si systemType incluye ATU */}
                  {key === "systemType" && showPBTSField && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        ¿El sistema ATU incluye PBTS?
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="pbts"
                            value="YES"
                            checked={isPBTS === "YES"}
                            onChange={(e) => setIsPBTS(e.target.value)}
                            className="mr-2"
                            required
                          />
                          <span className="text-sm">Sí, incluye PBTS</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="pbts"
                            value="NO"
                            checked={isPBTS === "NO"}
                            onChange={(e) => setIsPBTS(e.target.value)}
                            className="mr-2"
                            required
                          />
                          <span className="text-sm">No incluye PBTS</span>
                        </label>
                      </div>
                    </div>
                  )}
                  {key === "expirationDate" && (
                    <>
                      {/* Ayuda de formato */}
                      <p className="text-xs mt-1 text-gray-500">
                        Ejemplo: 12-25-2024 (MM-DD-YYYY)
                      </p>
                      {/* Mostrar advertencias de expiración */}
                      {expirationWarning.message && (
                        <p
                          className={`text-xs mt-1 ${
                            expirationWarning.type === "error"
                              ? "text-red-600 font-semibold"
                              : "text-yellow-600 font-semibold"
                          }`}
                        >
                          {expirationWarning.message}
                        </p>
                      )}
                    </>
                  )}
                  {/* --- FIN RENDERIZADO CONDICIONAL --- */}
                </div>
              ))}

            {/* 🆕 SECCIÓN: Emails Adicionales para Notificaciones */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-800 mb-3">
                📧 Emails Adicionales para Notificaciones
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                El email principal ({formData.applicantEmail || 'sin especificar'}) se usa para invoices y firma de documentos. 
                Aquí puedes agregar emails adicionales que recibirán notificaciones (vendedores, etc.).
              </p>

              {/* Input para agregar nuevo email */}
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <input
                    type="email"
                    value={newNotificationEmail}
                    onChange={(e) => {
                      setNewNotificationEmail(e.target.value);
                      setEmailError('');
                    }}
                    onKeyPress={handleNotificationEmailKeyPress}
                    placeholder="ejemplo@email.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  {emailError && (
                    <p className="mt-1 text-xs text-red-600">{emailError}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAddNotificationEmail}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
                >
                  + Agregar
                </button>
              </div>

              {/* Lista de emails adicionales */}
              {notificationEmails.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">
                    Emails adicionales ({notificationEmails.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {notificationEmails.map((email, index) => (
                      <div
                        key={index}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-blue-300 rounded-full text-sm"
                      >
                        <span className="text-gray-700">{email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveNotificationEmail(email)}
                          className="text-red-500 hover:text-red-700 font-bold text-lg leading-none"
                          title="Eliminar email"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {notificationEmails.length === 0 && (
                <p className="text-xs text-gray-500 italic">
                  No hay emails adicionales. Solo se usará el email principal.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="bg-blue-700 text-white py-3 px-4 rounded-lg font-bold shadow hover:bg-blue-800 transition-all duration-200 mt-2"
            >
              Save Permit and Continue
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PdfReceipt;