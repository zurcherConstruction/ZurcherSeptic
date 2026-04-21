import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWorks } from "../../Redux/Actions/workActions"; // Acción para obtener todas las obras
import { createReceipt } from "../../Redux/Actions/receiptActions"; // Acción para crear comprobantes
import { incomeActions, expenseActions } from "../../Redux/Actions/balanceActions"; // Acciones para Income y Expense
import { fetchSimpleWorks } from "../../Redux/Actions/simpleWorkActions"; // 🆕 Acciones para SimpleWork
import { toast } from "react-toastify";
import {
  DocumentTextIcon,
  CurrencyDollarIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  PaperClipIcon,
  ArrowUpTrayIcon,
  CalendarIcon
} from "@heroicons/react/24/outline";
import PaymentModal from "../Common/PaymentModal";
import FixedExpensePaymentHistory from "../FixedExpenses/FixedExpensePaymentHistory";

import api from "../../utils/axios";
import Swal from "sweetalert2";
import { PAYMENT_METHODS_GROUPED, INCOME_TYPES, EXPENSE_TYPES } from "../../utils/paymentConstants";

// 🚫 EXCLUIR solo "Factura Pago Inicial Budget" - se maneja en UploadInitialPay.jsx
// ✅ "Factura Pago Final Budget" SÍ se maneja aquí (tiene lógica de pagos parciales)
const incomeTypes = INCOME_TYPES.filter(type =>
  type !== 'Factura Pago Inicial Budget'
);
const expenseTypes = EXPENSE_TYPES;

// Tipos que NO requieren Work (son gastos/ingresos generales)
const generalExpenseTypes = [
  // "Workers", // ❌ Removido del sistema
  "Gastos Generales",
  // "Comisión Vendedor", // ❌ Removido - Las comisiones se pagan desde CommissionsManager.jsx
  "Gasto Fijo" // 🆕 Los gastos fijos son siempre generales
  // "Comprobante Gasto" // ❌ Removido del sistema
];

const generalIncomeTypes = [
  "Comprobante Ingreso" // Puede ser general o específico
];

// 🆕 Función para calcular períodos pendientes de un gasto fijo
const getPendingMonthsForFixedExpense = (expense) => {
  if (!expense || !expense.nextDueDate || !expense.startDate) return [];
  
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  // 🔴 CRITICAL: NO usar new Date(dateString) porque interpreta en timezone local
  // Parsear manualmente: YYYY-MM-DD
  const parseDate = (dateStr) => {
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0];
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  };
  
  const nextDueDate = parseDate(expense.nextDueDate);
  const startDate = parseDate(expense.startDate);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  const pendingMonths = [];
  
  // Si nextDueDate está vencido, mostrar períodos anteriores también
  if (nextDueDate <= today) {
    // Calcular hacia atrás desde startDate hasta encontrar períodos vencidos
    let checkDate = new Date(startDate);
    while (checkDate <= today) {
      // Avanzar un mes
      const nextMonth = new Date(checkDate);
      const originalDay = startDate.getUTCDate();
      const daysInMonth = new Date(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0).getUTCDate();
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
      nextMonth.setUTCDate(Math.min(originalDay, daysInMonth));
      
      if (nextMonth <= today && nextMonth <= nextDueDate) {
        // Este período está vencido y no está en el futuro del nextDueDate
        pendingMonths.push({
          month: nextMonth.getUTCMonth() + 1,
          name: monthNames[nextMonth.getUTCMonth()],
          year: nextMonth.getUTCFullYear()
        });
      }
      checkDate = new Date(nextMonth);
    }
  }
  
  // Mostrar el mes del nextDueDate
  pendingMonths.push({
    month: nextDueDate.getUTCMonth() + 1,
    name: monthNames[nextDueDate.getUTCMonth()],
    year: nextDueDate.getUTCFullYear()
  });
  
  // Si el nextDueDate está vencido, también mostrar próximos 3 meses
  if (nextDueDate <= today) {
    const future = new Date(nextDueDate);
    for (let i = 0; i < 3; i++) {
      const originalDay = nextDueDate.getUTCDate();
      const nextFuture = new Date(future);
      const daysInMonth = new Date(nextFuture.getUTCFullYear(), nextFuture.getUTCMonth() + 1, 0).getUTCDate();
      nextFuture.setUTCMonth(nextFuture.getUTCMonth() + 1);
      nextFuture.setUTCDate(Math.min(originalDay, daysInMonth));
      
      pendingMonths.push({
        month: nextFuture.getUTCMonth() + 1,
        name: monthNames[nextFuture.getUTCMonth()],
        year: nextFuture.getUTCFullYear()
      });
      future.setUTCMonth(future.getUTCMonth() + 1);
      future.setUTCDate(Math.min(originalDay, daysInMonth));
    }
  }
  
  // Remover duplicados
  const uniquePendingMonths = [];
  const seen = new Set();
  for (const month of pendingMonths) {
    const key = `${month.year}-${month.month}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePendingMonths.push(month);
    }
  }
  
  return uniquePendingMonths;
};

const AttachReceipt = () => {
  const dispatch = useDispatch();

  // Obtener las obras desde el estado global
  const { works, loading, error: worksError } = useSelector((state) => state.work);
  // 🆕 Obtener SimpleWorks desde el estado global
  const { simpleWorks, loading: simpleWorksLoading, error: simpleWorksError } = useSelector((state) => state.simpleWork);
  const staff = useSelector((state) => state.auth.currentStaff);
  // Estados locales
  const [selectedWork, setSelectedWork] = useState(""); // ID de la obra seleccionada
  const [type, setType] = useState(""); // Tipo de comprobante (Income o Expense)
  const [file, setFile] = useState(null); // Archivo del comprobante
  const [notes, setNotes] = useState(""); // Notas opcionales
  const [generalAmount, setGeneralAmount] = useState("");
  const [amount, setAmount] = useState(""); // Monto del ingreso o gasto
  const [finalPaymentAmount, setFinalPaymentAmount] = useState(''); // Monto específico para el pago de Factura Final
  const [amountPaid, setAmountPaid] = useState(''); // Nuevo estado para el monto pagado
  const [finalInvoiceDetails, setFinalInvoiceDetails] = useState(null);
  const [isGeneralTransaction, setIsGeneralTransaction] = useState(false); // Nuevo estado para marcar si es transacción general
  const [paymentMethod, setPaymentMethod] = useState(''); // 🆕 Método de pago
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]); // 🆕 Fecha de pago (por defecto hoy)
  const [paymentDetails, setPaymentDetails] = useState(''); // 🆕 Detalles adicionales del pago
  const [fixedExpenses, setFixedExpenses] = useState([]); // 🆕 Lista de gastos fijos
  const [selectedFixedExpense, setSelectedFixedExpense] = useState(''); // 🆕 Gasto fijo seleccionado
  const [selectedSimpleWork, setSelectedSimpleWork] = useState(''); // 🆕 SimpleWork seleccionado
  const [simpleWorkPaymentAmount, setSimpleWorkPaymentAmount] = useState(''); // 🆕 Monto a pagar de SimpleWork
  const [loadingFixedExpenses, setLoadingFixedExpenses] = useState(false); // 🆕 Loading para gastos fijos
  const [fixedExpensePaymentAmount, setFixedExpensePaymentAmount] = useState(''); // 🆕 Monto del pago parcial para gasto fijo
  const [workSearchTerm, setWorkSearchTerm] = useState(''); // 🆕 Término de búsqueda para works
  // Estado para el periodo (mes) seleccionado para Gasto Fijo - Ahora es el objeto completo del período
  const [fixedExpensePeriodMonth, setFixedExpensePeriodMonth] = React.useState(null);
  // 🆕 Estados para periodos pendientes
  const [pendingPeriods, setPendingPeriods] = useState([]);
  const [loadingPendingPeriods, setLoadingPendingPeriods] = useState(false);
  // 🆕 Estados para PaymentModal de Gastos Fijos
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedExpenseForPayment, setSelectedExpenseForPayment] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  // 🆕 Estado para el modal de FixedExpensePaymentHistory
  const [showFixedExpensePaymentModal, setShowFixedExpensePaymentModal] = useState(false);
  // 🛡️ Estado para prevenir doble envío (doble-clic)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);

  useEffect(() => {
    dispatch(fetchWorks(1, 'all')); // ✅ Usar 'all' para obtener TODOS los works sin límite
    dispatch(fetchSimpleWorks()); // 🆕 Cargar todos los SimpleWorks
  }, [dispatch]);

  // Verificar Works disponibles para filtrado
  useEffect(() => {
    // Los useEffects se ejecutan automáticamente cuando cambian works o type
  }, [works, type]);

  // Funciones para PaymentModal (para otros tipos de gastos)
  const openPaymentModal = (fixedExpense) => {
    setSelectedExpenseForPayment(fixedExpense);
    loadPaymentHistoryForFixedExpense(fixedExpense.idFixedExpense);
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedExpenseForPayment(null);
    setPaymentHistory([]);
  };

  // 🆕 Funciones para FixedExpensePaymentHistory (solo para Gasto Fijo)
  const openFixedExpensePaymentModal = (fixedExpense) => {
    setSelectedExpenseForPayment(fixedExpense);
    setShowFixedExpensePaymentModal(true);
  };

  const closeFixedExpensePaymentModal = () => {
    setShowFixedExpensePaymentModal(false);
    setSelectedExpenseForPayment(null);
  };

  const loadPaymentHistoryForFixedExpense = async (fixedExpenseId) => {
    try {
      const response = await api.get(`/fixed-expenses/${fixedExpenseId}/payments`);
      setPaymentHistory(response.data || []);
    } catch (error) {
      console.error('Error cargando historial de pagos:', error);
      setPaymentHistory([]);
    }
  };

  const handlePaymentSubmitFromModal = async (paymentData) => {
    if (!selectedExpenseForPayment) return;

    try {
      const formData = new FormData();
      formData.append('amount', paymentData.amount);
      formData.append('paymentDate', paymentData.paymentDate);
      formData.append('paymentMethod', paymentData.paymentMethod);
      if (paymentData.notes) {
        formData.append('notes', paymentData.notes);
      }
      if (paymentData.receipt) {
        formData.append('receipt', paymentData.receipt);
      }
      // Agregar información de período si está disponible
      if (paymentData.periodStart) {
        formData.append('periodStart', paymentData.periodStart);
      }
      if (paymentData.periodEnd) {
        formData.append('periodEnd', paymentData.periodEnd);
      }
      if (paymentData.periodDueDate) {
        formData.append('periodDueDate', paymentData.periodDueDate);
      }

      const response = await api.post(
        `/fixed-expenses/${selectedExpenseForPayment.idFixedExpense}/payments`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      toast.success('Pago registrado correctamente');
      closePaymentModal();
      
      // Recargar gastos fijos
      if (type === 'Gasto Fijo') {
        const updatedResponse = await api.get('/fixed-expenses');
        const activeExpenses = Array.isArray(updatedResponse.data.fixedExpenses || updatedResponse.data)
          ? (updatedResponse.data.fixedExpenses || updatedResponse.data).filter(expense =>
            expense.isActive &&
            expense.paymentStatus !== 'paid' &&
            expense.paymentStatus !== 'paid_via_invoice'
          )
          : [];
        setFixedExpenses(activeExpenses);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Error al registrar el pago';
      toast.error(errorMessage);
      console.error('Error registrando pago:', error);
    }
  };

  // 🆕 Cargar gastos fijos cuando se selecciona "Gasto Fijo"
  useEffect(() => {
    const loadFixedExpenses = async () => {
      if (type === 'Gasto Fijo') {
        setLoadingFixedExpenses(true);
        try {
          const response = await api.get('/fixed-expenses');
          console.log('📋 Respuesta de gastos fijos:', response.data);

          // El endpoint devuelve { fixedExpenses: [...], stats: {...} }
          const allExpenses = response.data.fixedExpenses || response.data || [];

          // Filtrar solo gastos activos y no pagados completamente
          const activeExpenses = Array.isArray(allExpenses)
            ? allExpenses.filter(expense =>
              expense.isActive &&
              expense.paymentStatus !== 'paid' &&
              expense.paymentStatus !== 'paid_via_invoice'
            )
            : [];

          console.log('✅ Gastos fijos activos y pendientes:', activeExpenses.length);
          setFixedExpenses(activeExpenses);
        } catch (error) {
          console.error('❌ Error cargando gastos fijos:', error);
          toast.error('Error al cargar gastos fijos');
          setFixedExpenses([]);
        } finally {
          setLoadingFixedExpenses(false);
        }
      } else {
        setFixedExpenses([]);
        setSelectedFixedExpense('');
      }
    };

    loadFixedExpenses();
  }, [type]);

  // 🆕 Cargar períodos pendientes cuando se selecciona un gasto fijo
  useEffect(() => {
    if (selectedFixedExpense && type === 'Gasto Fijo') {
      const loadPendingPeriods = async () => {
        try {
          setLoadingPendingPeriods(true);
          const response = await api.get(`/fixed-expenses/${selectedFixedExpense}/pending-periods`);
          setPendingPeriods(response.data.pendingPeriods || []);
          setFixedExpensePeriodMonth(''); // Limpiar selección anterior
        } catch (error) {
          console.error('Error cargando períodos pendientes:', error);
          setPendingPeriods([]);
        } finally {
          setLoadingPendingPeriods(false);
        }
      };

      loadPendingPeriods();
    } else {
      setPendingPeriods([]);
    }
  }, [selectedFixedExpense, type]);

  // 🆕 Auto-marcar como transacción general cuando se selecciona "Gasto Fijo"
  useEffect(() => {
    if (type === 'Gasto Fijo') {
      setIsGeneralTransaction(true);
      setSelectedWork(""); // Limpiar selección de obra
    }
  }, [type]);

  // 🆕 Auto-marcar como transacción general cuando se selecciona "Factura SimpleWork"
  useEffect(() => {
    if (type === 'Factura SimpleWork') {
      setIsGeneralTransaction(true);
      setSelectedWork(""); // Limpiar selección de obra
      // Resetear campos de SimpleWork
      setSelectedSimpleWork("");
      setSimpleWorkPaymentAmount("");
    }
  }, [type]);

  // 🆕 Limpiar selección de obra cuando cambie el tipo de comprobante
  useEffect(() => {
    if (type === "Factura Pago Final Budget") {
      // Si la obra actual no está en la lista filtrada, limpiar la selección
      const filtered = works?.filter(work => {
        if (!work.finalInvoice || !work.finalInvoice.id) return false;
        const validStatuses = ['pending', 'partially_paid', 'send', 'sent'];
        if (!validStatuses.includes(work.finalInvoice.status)) return false;
        const totalDue = parseFloat(work.finalInvoice.finalAmountDue || 0);
        const totalPaid = parseFloat(work.finalInvoice.totalAmountPaid || 0);
        return (totalDue - totalPaid) > 0;
      }) || [];

      const isSelectedWorkValid = filtered.some(w => w.idWork === selectedWork);
      if (!isSelectedWorkValid) {
        setSelectedWork("");
      }
    }
  }, [type, works, selectedWork]);

  useEffect(() => {
    if (type === "Factura Pago Final Budget" && selectedWork && works) {
      const workDetails = works.find(w => w.idWork === selectedWork);
      if (workDetails && workDetails.finalInvoice) {
        setFinalInvoiceDetails(workDetails.finalInvoice);
        // Limpiar el monto de pago final si se cambia la obra o el tipo
        setFinalPaymentAmount('');
      } else {
        setFinalInvoiceDetails(null);
      }
    } else {
      setFinalInvoiceDetails(null);
    }
  }, [selectedWork, type, works]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 🛡️ PROTECCIÓN ANTI-DOBLE-CLIC
    if (isSubmitting) {
      console.warn('⚠️ Envío ya en progreso. Ignorando doble-clic.');
      toast.warning('Por favor, espera. El pago se está procesando...');
      return;
    }

    const now = Date.now();
    if (now - lastSubmitTime < 2000) {
      console.warn('⚠️ Doble-clic detectado (< 2 segundos). Ignorando envío duplicado.');
      toast.warning('¡Espera! Detectamos un doble-clic. Por favor, espera unos segundos.');
      return;
    }

    // Marcar como enviando
    setIsSubmitting(true);
    setLastSubmitTime(now);

    // Determinar si el tipo seleccionado permite transacciones generales
    const canBeGeneral = generalExpenseTypes.includes(type) || generalIncomeTypes.includes(type);

    // Validaciones básicas - permitir si hay SimpleWork seleccionado
    if (!canBeGeneral && !isGeneralTransaction && !selectedWork && !selectedSimpleWork) {
      toast.error("Por favor, selecciona una obra, un SimpleWork, o marca como transacción general.");
      setIsSubmitting(false);
      return;
    }

    if (!type) {
      toast.error("Por favor, selecciona el tipo de comprobante.");
      setIsSubmitting(false);
      return;
    }

    // 🆕 Validación de método de pago - OBLIGATORIO
    if (!paymentMethod) {
      toast.error("⚠️ Por favor, selecciona un método de pago. Este campo es obligatorio para el control financiero.");
      setIsSubmitting(false);
      return;
    }

    // Validación de archivo
    console.log('🔍 Verificando archivo adjunto:', { hasFile: !!file, fileName: file?.name, fileSize: file?.size });
    if (!file) {
      toast.error("Por favor, adjunta un archivo de comprobante.");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData();
    if (file) { // Solo adjuntar si hay archivo (aunque ahora es siempre obligatorio)
      formData.append("file", file);
    }
    formData.append("notes", notes);
    formData.append("type", type); // El backend usa este 'type' para la lógica especial

    try {
      if (type === "Factura Pago Final Budget") {
        if (!finalInvoiceDetails || !finalInvoiceDetails.id) {
          toast.error("No se encontraron detalles de la factura final para la obra seleccionada o la factura no tiene ID.");
          return;
        }

        // ACTUALIZAR ESTA VALIDACIÓN - Permitir también 'paymentReceived'
        if (finalInvoiceDetails.status === 'paid') {
          toast.error("❌ La Factura Final para esta obra ya está completamente pagada. No se pueden agregar más pagos.");
          return;
        }

        // ✅ VALIDAR SI EL FINAL INVOICE ESTÁ CANCELADO
        if (finalInvoiceDetails.status === 'cancelled') {
          toast.error("❌ Esta Factura Final está cancelada. No se pueden registrar pagos.");
          return;
        }

        // Permitir carga de comprobante incluso si el trabajo ya está en 'paymentReceived'
        const workDetails = works.find(w => w.idWork === selectedWork);
        if (workDetails?.status === 'paymentReceived' && finalInvoiceDetails.status !== 'paid') {
          // Caso especial: El trabajo está en paymentReceived pero la factura no está marcada como paid
          toast.info("El trabajo está marcado como pago recibido. Procesando comprobante para completar el registro.");
        } else if (!['pending', 'partially_paid', 'send'].includes(finalInvoiceDetails.status)) {
          toast.error(`La Factura Final no está en un estado válido para registrar el pago (Estado actual: ${finalInvoiceDetails.status}).`);
          return;
        }

        if (!finalPaymentAmount || isNaN(parseFloat(finalPaymentAmount)) || parseFloat(finalPaymentAmount) <= 0) {
          toast.error("Por favor, ingrese un monto pagado válido para la factura final.");
          return;
        }

        const numericAmountPaid = parseFloat(finalPaymentAmount);
        const numericFinalAmountDue = parseFloat(finalInvoiceDetails.finalAmountDue);
        const numericTotalAmountPaidPreviously = parseFloat(finalInvoiceDetails.totalAmountPaid || 0);
        const currentRemainingBalance = numericFinalAmountDue - numericTotalAmountPaidPreviously;

        // ✅ Permitir umbral de $0.05 para evitar validaciones estrictas con centavos
        if (numericAmountPaid > currentRemainingBalance + 0.05) {
          toast.error(`El monto pagado ($${numericAmountPaid.toFixed(2)}) no puede exceder el saldo pendiente ($${currentRemainingBalance.toFixed(2)}).`);
          return;
        }

        formData.append("relatedModel", "FinalInvoice");
        formData.append("relatedId", finalInvoiceDetails.id.toString());
        formData.append("amountPaid", numericAmountPaid.toString());
        formData.append("workId", selectedWork);
        if (paymentMethod) {
          formData.append("paymentMethod", paymentMethod); // ✅ Agregar método de pago
        }
        if (paymentDetails) {
          formData.append("paymentDetails", paymentDetails); // 🆕 Agregar detalles del pago
        }

        console.log('Enviando FormData para Receipt (Pago Final Factura):', Object.fromEntries(formData));
        await dispatch(createReceipt(formData));

        // Mensaje específico según el contexto
        if (workDetails?.status === 'paymentReceived') {
          toast.success("Comprobante de Pago Final registrado. El trabajo ya estaba marcado como pago recibido.");
        } else {
          toast.success("Comprobante de Pago Final adjuntado y procesado correctamente.");
        }

      } else {
        // Lógica para otros tipos (Income/Expense + Receipt)

        // 🆕 MANEJO ESPECIAL PARA GASTO FIJO
        if (type === 'Gasto Fijo') {
          if (!selectedFixedExpense) {
            toast.error("Por favor, selecciona un gasto fijo para pagar.");
            return;
          }

          if (!fixedExpensePaymentAmount || parseFloat(fixedExpensePaymentAmount) <= 0) {
            toast.error("Por favor, ingresa un monto válido a pagar.");
            return;
          }

          // Obtener detalles del gasto fijo seleccionado
          const fixedExpense = fixedExpenses.find(fe => fe.idFixedExpense === selectedFixedExpense);
          if (!fixedExpense) {
            toast.error("Gasto fijo no encontrado.");
            return;
          }

          // 🆕 Definir fecha actual
          const now = new Date();

          // 🆕 Calcular monto restante (lo que realmente se debe) con redondeo a 2 decimales
          const totalAmount = Math.round(parseFloat(fixedExpense.totalAmount || 0) * 100) / 100;
          const paidAmount = Math.round(parseFloat(fixedExpense.paidAmount || 0) * 100) / 100;
          const remainingAmount = Math.round((totalAmount - paidAmount) * 100) / 100;
          const paymentAmount = Math.round(parseFloat(fixedExpensePaymentAmount) * 100) / 100;

          // 🆕 Validaciones
          if (remainingAmount <= 0) {
            toast.error("Este gasto fijo ya está completamente pagado.");
            return;
          }

          if (paymentAmount > remainingAmount + 0.01) {
            toast.error(`El monto a pagar ($${paymentAmount.toFixed(2)}) no puede exceder el saldo restante ($${remainingAmount.toFixed(2)})`);
            return;
          }

          // Determinar si es pago total o parcial (con tolerancia de 1 centavo)
          const isFullPayment = Math.abs(paymentAmount - remainingAmount) <= 0.01;
          const newPaidAmount = Math.round((paidAmount + paymentAmount) * 100) / 100;
          const newStatus = isFullPayment ? 'paid' : 'partial';

          // Crear el expense vinculado al gasto fijo
          const expenseData = {
            date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
            amount: paymentAmount, // 🔄 Usar el monto ingresado por el usuario
            notes: `${isFullPayment ? 'Pago final' : 'Pago parcial'} de gasto fijo: ${fixedExpense.description || fixedExpense.name} (${fixedExpense.category})${notes ? ` - ${notes}` : ''} - Total: $${totalAmount.toFixed(2)}, Ya pagado: $${paidAmount.toFixed(2)}, Este pago: $${paymentAmount.toFixed(2)}${isFullPayment ? '' : `, Restante: $${(remainingAmount - paymentAmount).toFixed(2)}`}`,
            staffId: staff?.id,
            typeExpense: 'Gasto Fijo',
            fixedExpenseId: fixedExpense.idFixedExpense, // 🔗 Vincular con el gasto fijo (campo correcto)
            ...(paymentMethod ? { paymentMethod } : {}),
            ...(paymentDetails ? { paymentDetails } : {}),
            ...(fixedExpensePeriodMonth ? { periodMonth: parseInt(fixedExpensePeriodMonth, 10) } : {}),
          };

          console.log('📋 Creando expense para Gasto Fijo:', expenseData);
          console.log(`💰 Tipo de pago: ${isFullPayment ? 'COMPLETO' : 'PARCIAL'} - Nuevo estado: ${newStatus}`);

          try {
            const createdExpense = await expenseActions.create(expenseData);
            if (!createdExpense || !createdExpense.idExpense) {
              throw new Error("No se pudo crear el gasto.");
            }

            console.log('✅ Expense creado con ID:', createdExpense.idExpense);

            // Adjuntar comprobante
            let receiptUrl = null;
            let receiptPublicId = null;
            formData.append("relatedModel", "Expense");
            formData.append("relatedId", createdExpense.idExpense.toString());

            console.log('📎 Adjuntando comprobante al gasto fijo. FormData tiene file?', file ? 'SI' : 'NO');
            
            // 🆕 Hacer llamada directa a la API para obtener la respuesta del receipt
            if (file) {
              try {
                const receiptResponse = await api.post('/receipt', formData, {
                  headers: {
                    'Content-Type': 'multipart/form-data',
                  },
                });
                console.log('📄 Receipt response:', receiptResponse.data);
                receiptUrl = receiptResponse.data?.receipt?.fileUrl;
                receiptPublicId = receiptResponse.data?.receipt?.publicId;
              } catch (receiptError) {
                console.error('❌ Error al adjuntar comprobante:', receiptError);
                throw new Error("Error al adjuntar el comprobante: " + (receiptError.response?.data?.message || receiptError.message));
              }
            }

            console.log('✅ Comprobante adjuntado correctamente');

            // 🆕 ACTUALIZAR EL GASTO FIJO PRIMERO (crítico)
            console.log(`✅ Actualizando gasto fijo - Estado: ${newStatus}, Nuevo monto pagado: $${newPaidAmount.toFixed(2)}`);

            const updateData = {
              paymentStatus: newStatus,
              paidAmount: newPaidAmount
            };

            // Si es pago completo, agregar fecha de pago
            if (isFullPayment) {
              updateData.paidDate = new Date().toISOString().split('T')[0];
            }

            await api.patch(`/fixed-expenses/${fixedExpense.idFixedExpense}`, updateData);
            console.log('✅ Gasto fijo actualizado correctamente');

            // 🆕 CREAR REGISTRO EN HISTORIAL DE PAGOS (FixedExpensePayment) - opcional
            console.log('📝 Creando registro en historial de pagos...');
            try {
              const paymentRecord = {
                fixedExpenseId: fixedExpense.idFixedExpense,
                amount: paymentAmount,
                paymentDate: paymentDate, // 🆕 Usar la fecha seleccionada en lugar de la fecha actual
                paymentMethod: paymentMethod || null,
                notes: notes || `${isFullPayment ? 'Pago final' : 'Pago parcial'} - ${fixedExpense.description || fixedExpense.name}`,
                expenseId: createdExpense.idExpense, // 🔑 Enviar el ID del expense ya creado
                createdByStaffId: staff?.id,
                skipExpenseCreation: true, // 🆕 Flag para que el backend NO cree otro Expense
                // Usar el período completo del objeto enviado por la API
                ...(fixedExpensePeriodMonth ? {
                  periodStart: fixedExpensePeriodMonth.startDate,
                  periodEnd: fixedExpensePeriodMonth.endDate,
                  periodDueDate: fixedExpensePeriodMonth.dueDate || fixedExpensePeriodMonth.endDate
                } : {}),
                // 🆕 Enviar URLs del receipt para vincular al pago
                ...(receiptUrl && receiptPublicId ? {
                  receiptUrl: receiptUrl,
                  receiptPublicId: receiptPublicId
                } : {})
              };

              console.log('💾 Datos del registro de pago:', paymentRecord);
              await api.post(`/fixed-expenses/${fixedExpense.idFixedExpense}/payments`, paymentRecord);
              console.log('✅ Registro de pago creado en historial');
            } catch (paymentError) {
              console.error('⚠️ Error creando registro de pago (no crítico):', paymentError);
              // No fallar toda la operación si solo falla el historial
              toast.warning('El pago se registró pero hubo un problema con el historial. El gasto fijo fue actualizado correctamente.');
            }

            // Mensajes de éxito
            if (isFullPayment) {
              toast.success(`✅ Gasto fijo pagado completamente: ${fixedExpense.description || fixedExpense.name} - $${paymentAmount.toFixed(2)}`);
            } else {
              toast.success(`📝 Pago parcial registrado: $${paymentAmount.toFixed(2)}. Saldo restante: $${(remainingAmount - paymentAmount).toFixed(2)}`);
            }
          } catch (error) {
            console.error('❌ Error procesando gasto fijo:', error);
            throw error; // Re-lanzar para que se capture en el catch principal
          }

        } else if (type === 'Factura SimpleWork') {
          // 🆕 MANEJO ESPECIAL PARA PAGOS DE SIMPLEWORK
          if (!selectedSimpleWork) {
            toast.error("Por favor, selecciona un SimpleWork para registrar el pago.");
            return;
          }

          if (!simpleWorkPaymentAmount || parseFloat(simpleWorkPaymentAmount) <= 0) {
            toast.error("Por favor, ingresa un monto válido a cobrar.");
            return;
          }

          // Obtener detalles del SimpleWork seleccionado
          const simpleWork = simpleWorks?.find(sw => sw.id === selectedSimpleWork);
          if (!simpleWork) {
            toast.error("SimpleWork no encontrado.");
            return;
          }

          const paymentAmount = parseFloat(simpleWorkPaymentAmount);
          
          // 🔍 VALIDACIÓN CRÍTICA: Asegurar que usamos el monto correcto
          if (!paymentAmount || paymentAmount <= 0 || isNaN(paymentAmount)) {
            toast.error(`Monto inválido: ${simpleWorkPaymentAmount}. Por favor verifica el valor.`);
            return;
          }
          
          // 🔍 DEBUG: Log detallado del proceso de pago
          console.log('🔍 === DEBUGGING PROCESO DE PAGO SIMPLEWORK ===');
          console.log('📝 simpleWorkPaymentAmount (campo manual):', simpleWorkPaymentAmount);
          console.log('📝 amount (campo sincronizado):', amount);
          console.log('💰 paymentAmount (calculado para usar):', paymentAmount);
          console.log('📊 SimpleWork seleccionado:', simpleWork);
          console.log('💵 estimatedAmount:', simpleWork.estimatedAmount);
          console.log('💵 finalAmount:', simpleWork.finalAmount);
          console.log('💵 totalPaid:', simpleWork.totalPaid);
          console.log('💵 initialPayment:', simpleWork.initialPayment);
          console.log('💵 initialPaymentPercentage:', simpleWork.initialPaymentPercentage);

          // Crear Income para el pago de SimpleWork
          const incomeData = {
            date: paymentDate,
            amount: paymentAmount,
            typeIncome: 'Factura SimpleWork',
            notes: `Pago SimpleWork #${simpleWork.workNumber} - ${simpleWork.description}`,
            staffId: staff?.id,
            paymentMethod: paymentMethod || null,
            paymentDetails: paymentDetails || null,
            // Agregar referencia al SimpleWork
            simpleWorkId: selectedSimpleWork
          };

          console.log('💰 Creando Income para SimpleWork:', incomeData);
          console.log('🔍 Monto específico que se enviará:', incomeData.amount);

          try {
            const createdIncome = await incomeActions.create(incomeData);
            if (!createdIncome || !createdIncome.idIncome) {
              throw new Error("No se pudo crear el ingreso para SimpleWork.");
            }

            console.log('✅ Income creado con ID:', createdIncome.idIncome);

            // Adjuntar comprobante al Income
            formData.append("relatedModel", "Income");
            formData.append("relatedId", createdIncome.idIncome.toString());

            console.log('📎 Adjuntando comprobante al pago SimpleWork');
            
            // Crear receipt directamente via API
            if (file) {
              const receiptResponse = await api.post('/receipt', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
              console.log('📄 Receipt de SimpleWork creado:', receiptResponse.data);
            }

            // 🆕 Actualizar estado del SimpleWork y totales pagados
            const finalAmount = parseFloat(simpleWork.finalAmount || simpleWork.estimatedAmount || 0);
            const currentPaid = parseFloat(simpleWork.totalPaid || 0);
            const newTotalPaid = currentPaid + paymentAmount;
            const isFullyPaid = Math.abs(newTotalPaid - finalAmount) <= 0.01; // Tolerancia de 1 centavo

            try {
              const updateData = {
                totalPaid: newTotalPaid,
                // Actualizar estado según el pago
                status: isFullyPaid ? 'paid' : 'invoiced' // paid si está completamente pagado, invoiced si es parcial
              };

              await api.patch(`/simple-works/${selectedSimpleWork}`, updateData);
              console.log(`✅ SimpleWork actualizado: totalPaid=${newTotalPaid}, status=${updateData.status}`);
            } catch (updateError) {
              console.warn('⚠️ Error actualizando SimpleWork (no crítico):', updateError);
              // No fallar toda la operación por esto
            }

            // TODO: Integrar con BankTransaction si es cuenta bancaria
            
            const statusMsg = isFullyPaid ? 'completamente pagado' : 'pago parcial registrado';
            toast.success(`✅ Pago SimpleWork ${statusMsg}: #${simpleWork.workNumber} - $${paymentAmount.toFixed(2)}`);

          } catch (error) {
            console.error('❌ Error procesando pago SimpleWork:', error);
            throw error;
          }

        } else {
          // Lógica original para otros tipos de gastos/ingresos
          
          // Validación de monto
          if (!generalAmount || isNaN(parseFloat(generalAmount)) || parseFloat(generalAmount) <= 0) {
            toast.error("Por favor, ingrese un monto válido para el ingreso/gasto.");
            return;
          }

          let createdRecordId = null;
          let createdRecord;
          const isIncome = incomeTypes.includes(type);

          const incomeExpenseData = {
            date: paymentDate, // 🆕 Usar la fecha de pago seleccionada por el usuario (o hoy por defecto)
            amount: parseFloat(generalAmount),
            notes,
            // Solo incluir workId si no es transacción general (y no hay simpleWorkId)
            ...(isGeneralTransaction || selectedSimpleWork ? {} : { workId: selectedWork }),
            staffId: staff?.id,
            ...(isIncome ? { typeIncome: type } : { typeExpense: type }),
            // 🆕 Agregar método de pago si se especificó
            ...(paymentMethod ? { paymentMethod } : {}),
            // 🆕 Agregar detalles del pago si se especificó
            ...(paymentDetails ? { paymentDetails } : {}),
            // 🆕 SIMPLIFIED: Agregar simpleWorkId si se seleccionó un SimpleWork (funciona con CUALQUIER tipo)
            ...(selectedSimpleWork ? { simpleWorkId: selectedSimpleWork } : {}),
          };

          console.log('💰 Datos a enviar (Income/Expense):', incomeExpenseData);

          try {
            if (isIncome) {
              createdRecord = await incomeActions.create(incomeExpenseData);
              if (!createdRecord || !createdRecord.idIncome) {
                throw new Error("No se pudo obtener el ID del ingreso creado.");
              }
              createdRecordId = createdRecord.idIncome;
              console.log('✅ Ingreso creado con ID:', createdRecordId);
              toast.success("Ingreso registrado correctamente.");
            } else {
              createdRecord = await expenseActions.create(incomeExpenseData);
              if (!createdRecord || !createdRecord.idExpense) {
                throw new Error("No se pudo obtener el ID del gasto creado.");
              }
              createdRecordId = createdRecord.idExpense;
              console.log('✅ Gasto creado con ID:', createdRecordId);
              toast.success("Gasto registrado correctamente.");
            }

            if (createdRecordId) {
              formData.append("relatedModel", isIncome ? "Income" : "Expense");
              formData.append("relatedId", createdRecordId.toString());

              console.log('📎 Adjuntando comprobante...');
              await dispatch(createReceipt(formData));
              toast.success("Comprobante adjuntado correctamente.");
            }
          } catch (error) {
            console.error('❌ Error en Income/Expense:', error);
            throw error; // Re-lanzar para manejo unificado
          }
        }
      }

      // 🆕 Refrescar SimpleWorks si se procesó un pago de SimpleWork
      if (selectedSimpleWork) {
        console.log('🔄 Refrescando lista de SimpleWorks después del pago...');
        dispatch(fetchSimpleWorks());
      }

      // Limpiar el formulario
      setSelectedWork("");
      setType("");
      setFile(null);
      if (e.target.elements.file) {
        e.target.elements.file.value = null;
      }
      setNotes("");
      setGeneralAmount("");
      setFinalPaymentAmount("");
      setFinalInvoiceDetails(null);
      setIsGeneralTransaction(false);
      setPaymentMethod(""); // 🆕 Limpiar método de pago
      setPaymentDate(new Date().toISOString().split('T')[0]); // 🆕 Resetear fecha de pago a hoy
      setPaymentDetails(""); // 🆕 Limpiar detalles del pago
      setSelectedFixedExpense(""); // 🆕 Limpiar gasto fijo seleccionado
      setFixedExpensePaymentAmount(""); // 🆕 Limpiar monto de pago de gasto fijo
      setFixedExpensePeriodMonth(""); // 🆕 Limpiar periodo de gasto fijo
      setSelectedSimpleWork(""); // 🆕 Limpiar SimpleWork seleccionado

    } catch (err) {
      console.error("❌❌❌ Error completo en handleSubmit:", err);

      // Mensaje de error más específico según el tipo de error
      let errorMessage = "Error al procesar la transacción.";

      if (err.response) {
        // Error de respuesta del servidor
        const status = err.response.status;
        const data = err.response.data;

        console.error('❌ Error del servidor:', {
          status,
          data,
          url: err.config?.url,
          method: err.config?.method
        });

        if (status === 400) {
          errorMessage = data.message || "Datos inválidos. Verifica todos los campos.";
        } else if (status === 401) {
          errorMessage = "Sesión expirada. Por favor, inicia sesión nuevamente.";
        } else if (status === 403) {
          errorMessage = "No tienes permisos para realizar esta operación.";
        } else if (status === 404) {
          errorMessage = data.message || "Recurso no encontrado.";
        } else if (status === 409) {
          // 🛡️ Error de pago duplicado (doble-clic)
          errorMessage = data.message || "Este pago ya fue registrado recientemente. Por favor, verifica el historial de pagos antes de intentar nuevamente.";
          // Mostrar detalles adicionales si hay información de duplicados
          if (data.details || data.existingPayments) {
            console.warn('⚠️ Detalles del pago duplicado:', data.details || data.existingPayments);
            errorMessage += " Verifica el historial de pagos para confirmar.";
          }
        } else if (status === 500) {
          errorMessage = "Error del servidor. Por favor, contacta al administrador.";
        } else {
          errorMessage = data.message || `Error del servidor (${status})`;
        }
      } else if (err.request) {
        // La solicitud se hizo pero no hubo respuesta
        console.error('❌ No hay respuesta del servidor:', err.request);
        errorMessage = "No se pudo conectar con el servidor. Verifica tu conexión a internet.";
      } else if (err.message) {
        // Error durante la configuración de la solicitud
        errorMessage = err.message;
      } else if (err.payload?.message) {
        // Error de Redux action
        errorMessage = err.payload.message;
      }

      toast.error(`❌ ${errorMessage}`);

      // Log adicional para debugging
      if (err.stack) {
        console.error('Stack trace:', err.stack);
      }
    } finally {
      // 🛡️ Resetear estado de envío después de un pequeño delay para prevenir clics rápidos
      setTimeout(() => {
        setIsSubmitting(false);
      }, 1500);
    }
  };

  const currentWorkDetails = works && selectedWork ? works.find(w => w.idWork === selectedWork) : null;
  const calculatedRemainingBalance = finalInvoiceDetails
    ? (parseFloat(finalInvoiceDetails.finalAmountDue || 0) - parseFloat(finalInvoiceDetails.totalAmountPaid || 0)).toFixed(2)
    : "0.00";

  // Determinar si el tipo actual permite ser general
  const canBeGeneral = generalExpenseTypes.includes(type) || generalIncomeTypes.includes(type);
  const requiresWork = type === "Factura Pago Final Budget"; // Los pagos de factura final SIEMPRE requieren work

  // 🆕 FILTRAR OBRAS SEGÚN EL TIPO DE COMPROBANTE SELECCIONADO Y BÚSQUEDA
  const filteredWorksForDropdown = () => {
    if (!works || works.length === 0) return [];

    let filteredWorks;

    // Si seleccionó "Factura Pago Final Budget", mostrar obras en estado 'invoiceFinal'
    // También incluir works en 'maintenance' que tengan factura final pendiente de cobro (no legacy)
    if (type === "Factura Pago Final Budget") {
      filteredWorks = works.filter(work => {
        const validStatuses = ['pending', 'partially_paid', 'send', 'sent'];

        if (work.status === 'invoiceFinal') {
          // Flujo normal: si tiene finalInvoice debe tener saldo pendiente
          if (work.finalInvoice && work.finalInvoice.id) {
            if (!validStatuses.includes(work.finalInvoice.status)) return false;
            const remaining = parseFloat(work.finalInvoice.finalAmountDue || 0) - parseFloat(work.finalInvoice.totalAmountPaid || 0);
            return remaining > 0;
          }
          // Sin finalInvoice aún: incluir para poder registrar el primero
          return true;
        }

        if (work.status === 'maintenance') {
          // Excluir legacy (no deberían tener factura final real)
          if (work.isLegacy) return false;
          // Solo incluir si tiene finalInvoice generado en estado válido con saldo pendiente
          if (!work.finalInvoice || !work.finalInvoice.id) return false;
          if (!validStatuses.includes(work.finalInvoice.status)) return false;
          const remaining = parseFloat(work.finalInvoice.finalAmountDue || 0) - parseFloat(work.finalInvoice.totalAmountPaid || 0);
          return remaining > 0;
        }

        return false;
      });
    } else {
      // Para otros tipos de comprobantes, mostrar todas las obras
      filteredWorks = works;
    }

    // 🆕 Aplicar filtro de búsqueda si hay término de búsqueda
    if (workSearchTerm.trim()) {
      const searchLower = workSearchTerm.toLowerCase().trim();
      filteredWorks = filteredWorks.filter(work => {
        return (
          work.propertyAddress?.toLowerCase().includes(searchLower) ||
          work.idWork?.toLowerCase().includes(searchLower) ||
          work.clientFirstName?.toLowerCase().includes(searchLower) ||
          work.clientLastName?.toLowerCase().includes(searchLower) ||
          `${work.clientFirstName || ''} ${work.clientLastName || ''}`.toLowerCase().includes(searchLower)
        );
      });
    }

    return filteredWorks;
  };

  const availableWorks = filteredWorksForDropdown();


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
              <PaperClipIcon className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Adjuntar Comprobante</h2>
          </div>
          <p className="text-gray-600">Registra ingresos, gastos y pagos de facturas finales</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <div className="flex items-center justify-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <p className="text-blue-600 font-medium">Cargando obras...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {worksError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center space-x-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
              <p className="text-red-700 font-medium">Error al cargar obras</p>
            </div>
            <p className="text-red-600 text-sm mt-1">
              {typeof worksError === 'object' ? JSON.stringify(worksError) : worksError}
            </p>
          </div>
        )}

        {/* Main Form Card */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Receipt Type Selection - Moved to top */}
            <div>
              <label htmlFor="type" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                <DocumentTextIcon className="h-5 w-5 mr-2 text-blue-500" />
                Tipo de Comprobante
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  // Reset general transaction when type changes
                  setIsGeneralTransaction(false);
                  // 🆕 Limpiar búsqueda y selección al cambiar tipo
                  setWorkSearchTerm('');
                  setSelectedWork('');
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
              >
                <option value="">Seleccione un tipo</option>
                <optgroup
                  label="💰 Ingresos"
                  style={{
                    backgroundColor: '#86efac',
                    fontWeight: 'bold',
                    color: '#065f46'
                  }}
                >
                  {incomeTypes.map((incomeType) => (
                    <option
                      key={incomeType}
                      value={incomeType}
                      style={{ backgroundColor: 'white', color: 'black' }}
                    >
                      {incomeType}
                    </option>
                  ))}
                </optgroup>
                <optgroup
                  label="💳 Gastos"
                  style={{
                    backgroundColor: '#fca5a5',
                    fontWeight: 'bold',
                    color: '#7f1d1d'
                  }}
                >
                  {expenseTypes.map((expenseType) => (
                    <option
                      key={expenseType}
                      value={expenseType}
                      style={{ backgroundColor: 'white', color: 'black' }}
                    >
                      {expenseType}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* General Transaction Toggle - Only show for applicable types (excepto Gasto Fijo que es siempre general) */}
            {type && canBeGeneral && !requiresWork && type !== 'Gasto Fijo' && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isGeneralTransaction}
                    onChange={(e) => {
                      setIsGeneralTransaction(e.target.checked);
                      if (e.target.checked) {
                        setSelectedWork(""); // Clear work selection if marking as general
                      }
                    }}
                    className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    💼 Este es un gasto/ingreso general (no asociado a una obra específica)
                  </span>
                </label>
                <p className="ml-8 mt-1 text-xs text-gray-500">
                  Marca esta opción para gastos como pagos de workers generales, comisiones, o gastos administrativos que no corresponden a una obra en particular.
                </p>
              </div>
            )}

            {/* 🆕 SELECTOR DE GASTO FIJO */}
            {type === 'Gasto Fijo' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-5">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="p-2 bg-orange-500 rounded-lg">
                    <CurrencyDollarIcon className="h-5 w-5 text-white" />
                  </div>
                  <h5 className="font-semibold text-orange-800">
                    📋 Seleccionar Gasto Fijo a Pagar
                  </h5>
                </div>

                {loadingFixedExpenses && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                    <span className="ml-3 text-sm text-gray-600">Cargando gastos fijos...</span>
                  </div>
                )}

                {!loadingFixedExpenses && fixedExpenses.length === 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <InformationCircleIcon className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">
                          No hay gastos fijos pendientes
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Todos los gastos fijos están pagados o no hay gastos configurados.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!loadingFixedExpenses && fixedExpenses.length > 0 && (
                  <>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label htmlFor="fixedExpense" className="block text-sm font-medium text-gray-700 mb-2">
                          Selecciona el gasto fijo que deseas pagar: <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="fixedExpense"
                          value={selectedFixedExpense}
                          onChange={(e) => setSelectedFixedExpense(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-white"
                          required
                        >
                      <option value="">Seleccionar gasto fijo...</option>
                      {fixedExpenses.map((fe) => {
                        const dueDate = new Date(fe.nextDueDate);
                        const isOverdue = dueDate < new Date();
                        const formattedDate = dueDate.toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        });

                        // 🆕 Calcular monto restante (lo que realmente se debe) con redondeo
                        const totalAmount = Math.round(parseFloat(fe.totalAmount || 0) * 100) / 100;
                        const paidAmount = Math.round(parseFloat(fe.paidAmount || 0) * 100) / 100;
                        const remainingAmount = Math.round((totalAmount - paidAmount) * 100) / 100;

                        // 🆕 Construir etiqueta completa con toda la información relevante
                        const label = [
                          fe.category,
                          fe.name,
                          fe.description,
                          fe.vendor
                        ]
                          .filter(Boolean) // Remover valores null/undefined
                          .filter((value, index, array) => array.indexOf(value) === index) // Remover duplicados
                          .join(' - ');

                        return (
                          <option key={fe.idFixedExpense} value={fe.idFixedExpense}>
                            {label} - ${remainingAmount.toFixed(2)}
                          </option>
                        );
                      })}
                        </select>
                      </div>
                      {/* 🆕 Botón para abrir PaymentModal */}
                      {selectedFixedExpense && (
                        <button
                          type="button"
                          onClick={() => {
                            const selected = fixedExpenses.find(fe => fe.idFixedExpense === selectedFixedExpense);
                            if (selected) {
                              openFixedExpensePaymentModal(selected);
                            }
                          }}
                          className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center gap-2 whitespace-nowrap"
                        >
                          <CurrencyDollarIcon className="h-5 w-5" />
                          Ver Pagos
                        </button>
                      )}
                    </div>

                    {/* Detalles del gasto fijo seleccionado */}
                    {selectedFixedExpense && fixedExpenses.find(fe => fe.idFixedExpense === selectedFixedExpense) && (
                      <div className="mt-4 p-4 bg-white rounded-lg border border-orange-200">
                        {(() => {
                          const selected = fixedExpenses.find(fe => fe.idFixedExpense === selectedFixedExpense);
                          const dueDate = new Date(selected.nextDueDate);
                          const isOverdue = dueDate < new Date();

                          // 🆕 Calcular montos con redondeo
                          const totalAmount = Math.round(parseFloat(selected.totalAmount || 0) * 100) / 100;
                          const paidAmount = Math.round(parseFloat(selected.paidAmount || 0) * 100) / 100;
                          const remainingAmount = Math.round((totalAmount - paidAmount) * 100) / 100;
                          const hasPartialPayment = paidAmount > 0;

                          return (
                            <>
                              <h6 className="font-semibold text-gray-800 mb-3">Detalles del Gasto:</h6>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-600 font-medium">Descripción:</p>
                                  <p className="text-gray-800 break-words">{selected.description || selected.name}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600 font-medium">Categoría:</p>
                                  <p className="text-gray-800">{selected.category}</p>
                                </div>

                                {/* 🆕 Mostrar monto total y pagos parciales - Responsive */}
                                <div className="col-span-1 md:col-span-2 bg-blue-50 rounded-lg p-3 border border-blue-200">
                                  <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                      <p className="text-xs text-gray-600 font-medium mb-1">Monto Total</p>
                                      <p className="text-sm md:text-base text-gray-800 font-semibold break-words">${totalAmount.toFixed(2)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-600 font-medium mb-1">Ya Pagado</p>
                                      <p className={`text-sm md:text-base font-semibold break-words ${hasPartialPayment ? 'text-green-600' : 'text-gray-400'}`}>
                                        ${paidAmount.toFixed(2)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-600 font-medium mb-1">🎯 Restante</p>
                                      <p className="text-orange-600 font-bold text-base md:text-lg break-words">${remainingAmount.toFixed(2)}</p>
                                    </div>
                                  </div>

                                  {hasPartialPayment && (
                                    <div className="mt-2 pt-2 border-t border-blue-300">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-600">Progreso de pago:</span>
                                        <span className="font-semibold text-blue-700">
                                          {((paidAmount / totalAmount) * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                      <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                                        <div
                                          className="bg-blue-500 h-2 rounded-full transition-all"
                                          style={{ width: `${(paidAmount / totalAmount) * 100}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <p className="text-gray-600 font-medium">Fecha de Vencimiento:</p>
                                  <p className={`font-semibold break-words ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                                    {dueDate.toLocaleDateString('es-ES', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                    {isOverdue && ' ⚠️ VENCIDO'}
                                  </p>
                                </div>
                                {selected.vendor && (
                                  <div>
                                    <p className="text-gray-600 font-medium">Proveedor:</p>
                                    <p className="text-gray-800 break-words">{selected.vendor}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-gray-600 font-medium">Frecuencia:</p>
                                  <p className="text-gray-800 capitalize break-words">{selected.frequency || 'Mensual'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600 font-medium">Método de Pago:</p>
                                  <p className="text-gray-800 break-words">{selected.paymentMethod}</p>
                                </div>
                              </div>

                              {selected.notes && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <p className="text-gray-600 font-medium text-xs mb-1">Notas:</p>
                                  <p className="text-gray-700 text-sm italic break-words">{selected.notes}</p>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* 🆕 Campo de monto para pago parcial/total */}
                    {selectedFixedExpense && (
                      <div className="mt-4">
                        <label htmlFor="fixedExpensePaymentAmount" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                          <CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-500" />
                          Monto a Pagar <span className="ml-1 text-red-500">*</span>
                        </label>
                        {(() => {
                          const selected = fixedExpenses.find(fe => fe.idFixedExpense === selectedFixedExpense);
                          if (!selected) return null;

                          const totalAmount = Math.round(parseFloat(selected.totalAmount || 0) * 100) / 100;
                          const paidAmount = Math.round(parseFloat(selected.paidAmount || 0) * 100) / 100;
                          const remainingAmount = Math.round((totalAmount - paidAmount) * 100) / 100;

                          return (
                            <>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  id="fixedExpensePaymentAmount"
                                  value={fixedExpensePaymentAmount}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    
                                    // Permitir valores vacíos y números válidos
                                    if (value === '' || !isNaN(parseFloat(value))) {
                                      setFixedExpensePaymentAmount(value);
                                    }

                                    // Validación en tiempo real con tolerancia de 1 centavo
                                    const numValue = parseFloat(value);
                                    if (value && numValue > remainingAmount + 0.01) {
                                      e.target.setCustomValidity(`El monto no puede exceder el saldo restante ($${remainingAmount.toFixed(2)})`);
                                    } else if (value && numValue <= 0) {
                                      e.target.setCustomValidity('El monto debe ser mayor a cero');
                                    } else {
                                      e.target.setCustomValidity('');
                                    }
                                  }}
                                  onBlur={(e) => {
                                    // Formatear solo al perder foco - mantener enteros sin decimales
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value) && value >= 0) {
                                      // Si es un número entero, no agregar decimales
                                      const formatted = value % 1 === 0 ? value.toString() : value.toFixed(2);
                                      setFixedExpensePaymentAmount(formatted);
                                    }
                                  }}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                                  placeholder={`Ingrese monto (máx: $${remainingAmount.toFixed(2)})`}
                                  required
                                />
                                <button
                                  type="button"
                                  onClick={() => setFixedExpensePaymentAmount(remainingAmount.toFixed(2))}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-orange-500 text-white text-xs font-semibold rounded hover:bg-orange-600 transition-colors"
                                >
                                  Pagar Todo
                                </button>
                              </div>

                              {/* Indicador visual del monto */}
                              {fixedExpensePaymentAmount && parseFloat(fixedExpensePaymentAmount) > 0 && (
                                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">
                                      {Math.abs(parseFloat(fixedExpensePaymentAmount) - remainingAmount) <= 0.01
                                        ? '✅ Pago Total - Se marcará como pagado completamente'
                                        : '📝 Pago Parcial - Quedará pendiente de pago'}
                                    </span>
                                    <span className="font-bold text-orange-600">
                                      ${parseFloat(fixedExpensePaymentAmount).toFixed(2)}
                                    </span>
                                  </div>

                                  {Math.abs(parseFloat(fixedExpensePaymentAmount) - remainingAmount) > 0.01 && (
                                    <div className="mt-2 pt-2 border-t border-blue-200 text-xs text-gray-600">
                                      Saldo restante después de este pago:
                                      <span className="font-semibold text-orange-600 ml-1">
                                        ${(remainingAmount - parseFloat(fixedExpensePaymentAmount)).toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* 🆕 SELECTOR DE PERIODO (MES) PARA GASTO FIJO - Usando períodos pendientes del backend */}
                    {type === 'Gasto Fijo' && selectedFixedExpense && (() => {
                      return (
                        <>
                          <label htmlFor="fixedExpensePeriodMonth" className="block text-sm font-medium text-gray-700 mb-2">
                            Selecciona el periodo a pagar <span className="text-red-500">*</span>
                          </label>
                          
                          {loadingPendingPeriods ? (
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                          ) : pendingPeriods && pendingPeriods.length > 0 ? (
                            <>
                              <select
                                id="fixedExpensePeriodMonth"
                                value={fixedExpensePeriodMonth ? JSON.stringify(fixedExpensePeriodMonth) : ''}
                                onChange={e => setFixedExpensePeriodMonth(e.target.value ? JSON.parse(e.target.value) : null)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-white"
                                required
                              >
                                <option value="">Seleccionar período pendiente...</option>
                                {pendingPeriods.map((period, idx) => (
                                  <option key={idx} value={JSON.stringify(period)}>
                                    {period.displayDate} - PENDIENTE
                                  </option>
                                ))}
                              </select>
                              {fixedExpensePeriodMonth && (
                                <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
                                  <span className="font-medium">📅 Período seleccionado:</span> {fixedExpensePeriodMonth.displayDate}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                              ✅ No hay períodos pendientes de pago
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* 🆕 SELECTOR DE SIMPLEWORK */}
            {type === 'Factura SimpleWork' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <CurrencyDollarIcon className="h-5 w-5 text-white" />
                  </div>
                  <h5 className="font-semibold text-blue-800">
                    🔧 Seleccionar SimpleWork para Cobrar
                  </h5>
                </div>

                {simpleWorksLoading && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span className="ml-3 text-sm text-gray-600">Cargando SimpleWorks...</span>
                  </div>
                )}

                {!simpleWorksLoading && (!simpleWorks || simpleWorks.length === 0) && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <InformationCircleIcon className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">
                          No hay SimpleWorks disponibles
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          No hay trabajos SimpleWork para registrar pagos.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!simpleWorksLoading && simpleWorks && simpleWorks.length > 0 && (
                  <>
                    <div className="mb-4">
                      <label htmlFor="simpleWork" className="block text-sm font-medium text-gray-700 mb-2">
                        Selecciona el SimpleWork: <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="simpleWork"
                        value={selectedSimpleWork}
                        onChange={(e) => {
                          const simpleWorkId = e.target.value;
                          setSelectedSimpleWork(simpleWorkId);
                          
                          // 🆕 Auto-llenar el monto cuando se selecciona un SimpleWork
                          if (simpleWorkId) {
                            const selectedSW = simpleWorks.find(sw => sw.id === simpleWorkId);
                            if (selectedSW) {
                              const estimatedAmount = parseFloat(selectedSW.estimatedAmount || 0);
                              const finalAmount = parseFloat(selectedSW.finalAmount || estimatedAmount);
                              const paidAmount = parseFloat(selectedSW.totalPaid || 0);
                              const initialPayment = parseFloat(selectedSW.initialPayment || 0);
                              
                              let amountToFill;
                              
                              // 🎯 Si nunca se ha pagado nada, sugerir el pago inicial
                              if (paidAmount === 0 && initialPayment > 0) {
                                amountToFill = initialPayment.toFixed(2);
                                console.log('💡 Sugiriendo pago inicial:', amountToFill);
                              } else {
                                // Si ya hay pagos, calcular el restante
                                const remainingAmount = Math.max(0, finalAmount - paidAmount);
                                amountToFill = remainingAmount.toFixed(2);
                                console.log('💡 Sugiriendo monto restante:', amountToFill);
                              }
                              
                              // Auto-llenar ambos campos
                              setSimpleWorkPaymentAmount(amountToFill);
                              setAmount(amountToFill); // Sincronizar con "Monto del Ingreso"
                            }
                          } else {
                            // Limpiar campos cuando se deselecciona
                            setSimpleWorkPaymentAmount('');
                            setAmount('');
                          }
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                        required
                      >
                        <option value="">Seleccionar SimpleWork...</option>
                        {simpleWorks.map((sw) => {
                          return (
                            <option key={sw.id} value={sw.id}>
                              #{sw.workNumber} - {sw.propertyAddress} - ${parseFloat(sw.finalAmount || sw.estimatedAmount || 0).toFixed(2)}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Campo de monto a cobrar */}
                    {selectedSimpleWork && (
                      <div className="mb-4">
                        <label htmlFor="simpleWorkAmount" className="block text-sm font-medium text-gray-700 mb-2">
                          Monto a cobrar: <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="simpleWorkAmount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={simpleWorkPaymentAmount}
                          onChange={(e) => {
                            const value = e.target.value;
                            console.log('🔄 Cambiando monto SimpleWork de', simpleWorkPaymentAmount, 'a', value);
                            setSimpleWorkPaymentAmount(value);
                            // Sincronizar automáticamente con el campo "Monto del Ingreso"
                            setAmount(value);
                            console.log('🔄 Campos sincronizados - simpleWorkPaymentAmount:', value, 'amount:', value);
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Ingrese monto a cobrar"
                          required
                        />
                        
                        {/* Mostrar detalles del SimpleWork seleccionado */}
                        {(() => {
                          const selectedSW = simpleWorks.find(sw => sw.id === selectedSimpleWork);
                          if (!selectedSW) return null;
                          
                          const estimatedAmount = parseFloat(selectedSW.estimatedAmount || 0);
                          const finalAmount = parseFloat(selectedSW.finalAmount || estimatedAmount);
                          const paidAmount = parseFloat(selectedSW.totalPaid || 0);
                          const remainingAmount = finalAmount - paidAmount;
                          
                          return (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                <div>
                                  <p className="text-gray-600 font-medium mb-1">Monto Total</p>
                                  <p className="text-gray-800 font-semibold">${finalAmount.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600 font-medium mb-1">Ya Pagado</p>
                                  <p className="text-green-600 font-semibold">${paidAmount.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600 font-medium mb-1">🎯 Pendiente</p>
                                  <p className="text-blue-600 font-bold">${remainingAmount.toFixed(2)}</p>
                                </div>
                              </div>
                              
                              <div className="mt-2 text-xs text-gray-600 space-y-1">
                                <p><strong>Dirección:</strong> {selectedSW.propertyAddress}</p>
                                <p><strong>Descripción:</strong> {selectedSW.description}</p>
                                <p><strong>Estado:</strong> {selectedSW.status}</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Work Selection - Only show if not general transaction, type is selected, and no SimpleWork selected */}
            {type && !isGeneralTransaction && !selectedSimpleWork && (
              <div>
                <label htmlFor="work" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <BuildingOffice2Icon className="h-5 w-5 mr-2 text-blue-500" />
                  Seleccionar Obra {requiresWork && <span className="ml-1 text-red-500">*</span>}
                </label>

                {/* 🆕 Mensaje informativo para Factura Final */}
                {type === "Factura Pago Final Budget" && availableWorks.length === 0 && (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <InformationCircleIcon className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">
                          No hay obras disponibles para pago final
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Solo se muestran obras con Factura Final generada y saldo pendiente de pago.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 🆕 Mensaje informativo general */}
                {type === "Factura Pago Final Budget" && availableWorks.length > 0 && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <InformationCircleIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-700">
                        <strong>📋 {availableWorks.length}</strong> obra(s) con Factura Final pendiente de pago
                      </p>
                    </div>
                  </div>
                )}

                {/* 🆕 Campo de búsqueda para works - SIEMPRE VISIBLE Y FUNCIONAL */}
                {(availableWorks.length > 5 || workSearchTerm || selectedWork) && (
                  <div className="mb-3 relative">
                    <input
                      type="text"
                      placeholder={selectedWork ? "🔍 Escribir para cambiar obra..." : "🔍 Buscar obra por dirección, ID o cliente..."}
                      value={workSearchTerm}
                      onChange={(e) => setWorkSearchTerm(e.target.value)}
                      onFocus={() => {
                        // Si hay obra seleccionada, limpiarla al hacer foco para permitir nueva búsqueda
                        if (selectedWork) {
                          setSelectedWork('');
                        }
                      }}
                      className="w-full px-3 py-2 pr-20 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                    {(workSearchTerm || selectedWork) && (
                      <button
                        type="button"
                        onClick={() => {
                          setWorkSearchTerm('');
                          setSelectedWork('');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors font-semibold"
                        title="Limpiar búsqueda y selección"
                      >
                        ✕ Limpiar
                      </button>
                    )}
                    
                    {/* Mensaje de ayuda cuando no hay resultados */}
                    {workSearchTerm.trim() && availableWorks.length === 0 && (
                      <div className="mt-1 text-xs text-red-600 flex items-center space-x-1">
                        <span>❌ Sin resultados para "{workSearchTerm}"</span>
                        <button
                          type="button"
                          onClick={() => setWorkSearchTerm('')}
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          Limpiar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 🆕 Mostrar obra seleccionada con opción de limpiar */}
                {selectedWork && (
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-green-700 font-medium">✅ Obra seleccionada:</span>
                        <span className="text-green-800 font-semibold">
                          {availableWorks.find(w => w.idWork === selectedWork)?.propertyAddress || selectedWork}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWork('');
                          setWorkSearchTerm('');
                        }}
                        className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded font-semibold transition-colors"
                        title="Deseleccionar obra"
                      >
                        ✕ Quitar
                      </button>
                    </div>
                  </div>
                )}

                <select
                  id="work"
                  value={selectedWork}
                  onChange={(e) => setSelectedWork(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                  required={requiresWork}
                  disabled={type === "Factura Pago Final Budget" && availableWorks.length === 0}
                >
                  <option value="">
                    {type === "Factura Pago Final Budget"
                      ? "Seleccione una obra con factura final pendiente"
                      : availableWorks.length === 0 && workSearchTerm.trim()
                        ? "No hay obras con ese criterio"
                        : workSearchTerm.trim() 
                          ? `${availableWorks.length} obra(s) encontrada(s)`
                          : "Seleccione una obra"}
                  </option>
                  {availableWorks && availableWorks.map((work) => {
                    // Para Factura Final, mostrar info del saldo pendiente
                    if (type === "Factura Pago Final Budget" && work.finalInvoice) {
                      const totalDue = parseFloat(work.finalInvoice.finalAmountDue || 0);
                      const totalPaid = parseFloat(work.finalInvoice.totalAmountPaid || 0);
                      const remainingBalance = (totalDue - totalPaid).toFixed(2);

                      return (
                        <option key={work.idWork} value={work.idWork}>
                          {work.propertyAddress} - Pendiente: ${remainingBalance}
                        </option>
                      );
                    }

                    // Para otros tipos, mostrar normalmente
                    const canAttachPayment = ['invoiceFinal', 'paymentReceived'].includes(work.status);
                    const hasUnpaidInvoice = work.finalInvoice && work.finalInvoice.status !== 'paid';

                    // Mostrar todas las obras, pero destacar las relevantes para pagos
                    return (
                      <option key={work.idWork} value={work.idWork}>
                        {work.propertyAddress}
                        {canAttachPayment && hasUnpaidInvoice ? ' 💰' : ''}
                        {work.status === 'paymentReceived' ? ' (Pago Recibido)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Work Status Card */}
            {selectedWork && currentWorkDetails && (
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-3 mb-3">
                  <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                  <h5 className="font-semibold text-gray-800">Estado de la Obra</h5>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Obra:</span> {currentWorkDetails.propertyAddress}
                  </p>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">Estado:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${currentWorkDetails.status === 'paymentReceived'
                        ? 'bg-green-100 text-green-800 border border-green-200' :
                        currentWorkDetails.status === 'invoiceFinal'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          'bg-gray-100 text-gray-800 border border-gray-200'
                      }`}>
                      {currentWorkDetails.status}
                    </span>
                  </div>
                </div>

                {/* Alert for Missing Final Invoice */}
                {type === "Factura Pago Final Budget" && !currentWorkDetails.finalInvoice && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-yellow-800 text-sm">
                          ⚠️ Factura Final no encontrada
                        </p>
                        <p className="text-yellow-700 text-xs mt-1">
                          Para poder registrar el pago final, primero debes <strong>generar la Factura Final</strong> de esta obra.
                        </p>
                        <div className="mt-3">
                          <p className="text-yellow-700 text-xs font-medium">📋 Pasos a seguir:</p>
                          <ol className="text-yellow-600 text-xs mt-1 ml-4 list-decimal space-y-0.5">
                            <li>Ve al detalle de la obra</li>
                            <li>Busca la sección "Factura Final"</li>
                            <li>Haz clic en "Generar Factura Final"</li>
                            <li>Luego podrás registrar el comprobante de pago aquí</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Alert for Cancelled Final Invoice */}
                {type === "Factura Pago Final Budget" && currentWorkDetails.finalInvoice?.status === 'cancelled' && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <InformationCircleIcon className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-red-800 text-sm">
                          ❌ Factura Final Cancelada
                        </p>
                        <p className="text-red-700 text-xs mt-1">
                          Esta Factura Final está cancelada y no puede recibir pagos.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Alert for Already Paid Invoice */}
                {type === "Factura Pago Final Budget" && currentWorkDetails.finalInvoice?.status === 'paid' && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-green-800 text-sm">
                          ✅ Factura completamente pagada
                        </p>
                        <p className="text-green-700 text-xs mt-1">
                          La Factura Final de esta obra ya está marcada como pagada completamente.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 🆕 SimpleWork Selection - Alternativa a Work para gastos/ingresos, o al revés */}
            {type && !isGeneralTransaction && !selectedWork && (
              <div>
                <label htmlFor="simpleWork" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <DocumentTextIcon className="h-5 w-5 mr-2 text-orange-500" />
                  Vincular a SimpleWork (opcional)
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  💡 Si este gasto/ingreso es para un SimpleWork, selecciónalo aquí en lugar de una obra normal.
                </p>

                {simpleWorksLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                    <span className="ml-3 text-sm text-gray-600">Cargando SimpleWorks...</span>
                  </div>
                ) : (
                  <select
                    id="simpleWork"
                    value={selectedSimpleWork}
                    onChange={(e) => setSelectedSimpleWork(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-white"
                  >
                    <option value="">No vincular a SimpleWork</option>
                    {simpleWorks && simpleWorks.map((sw) => {
                      return (
                        <option key={sw.id} value={sw.id}>
                          🔧 #{sw.workNumber} - {sw.propertyAddress}
                        </option>
                      );
                    })}
                  </select>
                )}

                {/* SimpleWork Status Card */}
                {selectedSimpleWork && simpleWorks && (() => {
                  const selectedSW = simpleWorks.find(sw => sw.id === selectedSimpleWork);
                  if (!selectedSW) return null;

                  const estimatedAmount = parseFloat(selectedSW.estimatedAmount || 0);
                  const finalAmount = parseFloat(selectedSW.finalAmount || estimatedAmount);
                  const paidAmount = parseFloat(selectedSW.totalPaid || 0);
                  const totalExpenses = parseFloat(selectedSW.totalExpenses || 0);
                  const profit = paidAmount - totalExpenses;
                  
                  return (
                    <div className="mt-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
                      <div className="flex items-center space-x-3 mb-3">
                        <InformationCircleIcon className="h-5 w-5 text-orange-500" />
                        <h5 className="font-semibold text-orange-800">Estado del SimpleWork</h5>
                      </div>

                      <div className="bg-white rounded-lg p-3 space-y-2">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">SimpleWork:</span> #{selectedSW.workNumber} - {selectedSW.propertyAddress}
                        </p>
                        <p className="text-xs text-gray-500 italic">
                          {selectedSW.description}
                        </p>
                        
                        <div className="grid grid-cols-4 gap-2 mt-3">
                          <div className="text-center">
                            <p className="text-xs text-gray-600">Monto Total</p>
                            <p className="text-sm font-bold text-gray-800">${finalAmount.toFixed(2)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-600">Cobrado</p>
                            <p className="text-sm font-bold text-green-600">${paidAmount.toFixed(2)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-600">Gastos</p>
                            <p className="text-sm font-bold text-orange-600">${totalExpenses.toFixed(2)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-600">Ganancia</p>
                            <p className={`text-sm font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${profit.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-xs font-medium text-gray-700">Estado:</span>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                            {selectedSW.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Final Invoice Details Card */}
            {type === "Factura Pago Final Budget" && finalInvoiceDetails && currentWorkDetails && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-200">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <CurrencyDollarIcon className="h-5 w-5 text-white" />
                  </div>
                  <h5 className="font-semibold text-blue-800">
                    Detalles de Factura Final
                  </h5>
                </div>

                <div className="bg-white rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-800">
                    Obra: {currentWorkDetails.propertyAddress}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <p className="text-gray-600">
                        <span className="font-medium">Monto Total Original:</span>
                        <span className="font-bold text-gray-800 ml-2">
                          ${parseFloat(finalInvoiceDetails.originalBudgetTotal || 0).toFixed(2)}
                        </span>
                      </p>

                      {parseFloat(finalInvoiceDetails.subtotalExtras || 0) > 0 && (
                        <p className="text-gray-600">
                          <span className="font-medium">Subtotal Extras:</span>
                          <span className="font-bold text-gray-800 ml-2">
                            ${parseFloat(finalInvoiceDetails.subtotalExtras).toFixed(2)}
                          </span>
                        </p>
                      )}

                      <p className="text-gray-600">
                        <span className="font-medium">Monto Total Adeudado:</span>
                        <span className="font-bold text-gray-800 ml-2">
                          ${parseFloat(finalInvoiceDetails.finalAmountDue || 0).toFixed(2)}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-gray-600">
                        <span className="font-medium">Total Pagado:</span>
                        <span className="font-bold text-green-600 ml-2">
                          ${parseFloat(finalInvoiceDetails.totalAmountPaid || 0).toFixed(2)}
                        </span>
                      </p>

                      <p className="text-gray-600">
                        <span className="font-medium">Saldo Pendiente:</span>
                        <span className="font-bold text-red-600 ml-2">
                          ${calculatedRemainingBalance}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label htmlFor="finalPaymentAmount" className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                    <CurrencyDollarIcon className="h-4 w-4 mr-2 text-green-500" />
                    Monto Pagado con este Comprobante
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    id="finalPaymentAmount"
                    value={finalPaymentAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || !isNaN(parseFloat(value))) {
                        setFinalPaymentAmount(value);
                      }
                    }}
                    onBlur={(e) => {
                      // Formatear solo al perder foco - mantener enteros sin decimales
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        // Si es un número entero, no agregar decimales
                        const formatted = value % 1 === 0 ? value.toString() : value.toFixed(2);
                        setFinalPaymentAmount(formatted);
                      }
                    }}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
            )}

            {/* General Amount Input - Ocultar para Gasto Fijo y Factura SimpleWork (tienen sus propios campos) */}
            {type && type !== "Factura Pago Final Budget" && type !== "Gasto Fijo" && type !== "Factura SimpleWork" && (
              <div>
                <label htmlFor="generalAmount" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-500" />
                  Monto del {incomeTypes.includes(type) ? "Ingreso" : "Gasto"}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  id="generalAmount"
                  value={generalAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Permitir valores vacíos y números válidos
                    if (value === '' || !isNaN(parseFloat(value))) {
                      setGeneralAmount(value);
                      // Sincronizar con amount para mantener consistencia
                      setAmount(value);
                    }
                  }}
                  onBlur={(e) => {
                    // Formatear solo al perder foco - mantener enteros sin decimales
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 0) {
                      // Si es un número entero, no agregar decimales
                      const formatted = value % 1 === 0 ? value.toString() : value.toFixed(2);
                      setGeneralAmount(formatted);
                      setAmount(formatted);
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="0.00"
                  required
                />
              </div>
            )}

            {/* File Upload */}
            <div>
              <label htmlFor="file" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                <ArrowUpTrayIcon className="h-5 w-5 mr-2 text-blue-500" />
                Adjuntar Comprobante (PDF o Imagen)
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="file"
                  name="file"
                  accept="application/pdf, image/jpeg, image/png, image/gif"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              {file && (
                <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600 bg-green-50 p-2 rounded-lg">
                  <PaperClipIcon className="h-4 w-4 text-green-500" />
                  <span>Archivo seleccionado: <span className="font-medium">{file.name}</span></span>
                </div>
              )}
            </div>

            {/* Payment Method - OBLIGATORIO */}
            {type && (
              <div>
                <label htmlFor="paymentMethod" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-500" />
                  Método de Pago <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                >
                  <option value="">Seleccionar método de pago...</option>
                  <optgroup label="🏦 Cuentas Bancarias">
                    {PAYMENT_METHODS_GROUPED.bank.map(method => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="💳 Tarjetas">
                    {PAYMENT_METHODS_GROUPED.card.map(method => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="💰 Otros Métodos">
                    {PAYMENT_METHODS_GROUPED.other.map(method => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Especifica la cuenta o método con el que se recibió/pagó el dinero
                </p>
              </div>
            )}

            {/* Payment Details - Campo adicional para detalles */}
            {paymentMethod && (
              <div>
                <label htmlFor="paymentDetails" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <DocumentTextIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Detalles del Pago (Opcional)
                </label>
                <input
                  id="paymentDetails"
                  type="text"
                  value={paymentDetails}
                  onChange={(e) => setPaymentDetails(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder={
                    paymentMethod === 'Cheque' ? 'Ej: Check #1234' :
                      paymentMethod.includes('Card') || paymentMethod.includes('Débito') ? 'Ej: Últimos 4 dígitos: 5678' :
                        paymentMethod === 'Transferencia Bancaria' ? 'Ej: Ref #ABC123' :
                          'Detalles adicionales...'
                  }
                />
              </div>
            )}

            {/* Fecha de Pago */}
            {paymentMethod && (
              <div>
                <label htmlFor="paymentDate" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <CalendarIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Fecha del Pago
                </label>
                <input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                <DocumentTextIcon className="h-5 w-5 mr-2 text-blue-500" />
                Notas (Opcional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                rows="3"
                placeholder="Agregar notas adicionales..."
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || isSubmitting || (type === "Factura Pago Final Budget" && ['paid', 'cancelled'].includes(finalInvoiceDetails?.status))}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {(loading || isSubmitting) ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{isSubmitting ? 'Enviando pago...' : 'Procesando...'}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <PaperClipIcon className="h-5 w-5" />
                  <span>
                    {type === "Factura Pago Final Budget" && finalInvoiceDetails?.status === 'paid'
                      ? 'Factura completamente pagada'
                      : type === "Factura Pago Final Budget" && finalInvoiceDetails?.status === 'cancelled'
                        ? 'Factura cancelada - No se permiten pagos'
                        : 'Adjuntar Comprobante'
                    }
                  </span>
                </div>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Modal para pago de Gastos Normales */}
      {showPaymentModal && selectedExpenseForPayment && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={closePaymentModal}
          expense={selectedExpenseForPayment}
          onSubmitPayment={handlePaymentSubmitFromModal}
          paymentHistory={paymentHistory}
          loading={false}
          modalTitle="Registrar Pago de Gasto Fijo"
          showPeriodSelector={false}
          defaultPaymentMethod={selectedExpenseForPayment?.paymentMethod}
        />
      )}

      {/* 🆕 Modal para pago de Gastos Fijos SOLAMENTE */}
      {showFixedExpensePaymentModal && selectedExpenseForPayment && (
        <FixedExpensePaymentHistory
          isOpen={showFixedExpensePaymentModal}
          onClose={closeFixedExpensePaymentModal}
          expense={selectedExpenseForPayment}
        />
      )}
    </div>
  );
};
export default AttachReceipt;