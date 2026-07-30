import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { uploadInvoice, fetchBudgets, fetchBudgetById } from '../../Redux/Actions/budgetActions';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { PAYMENT_METHODS_GROUPED } from '../../utils/paymentConstants';
import {
  DocumentArrowUpIcon,
  CurrencyDollarIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';

const UploadInitialPay = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { budgets, loading: budgetsLoading, error: budgetsError } = useSelector((state) => state.budget);

  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [file, setFile] = useState(null);
  const [uploadedAmount, setUploadedAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(''); // 🆕 Método de pago
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    // 🆕 Cargar TODOS los presupuestos elegibles para pago (sin paginación)
    dispatch(fetchBudgets({ 
      pageSize: 1000 // Traer muchos presupuestos para asegurar que se muestren todos los elegibles
    }));
  }, [dispatch]);



  const handleBudgetSelect = (event) => {
    setSelectedBudgetId(event.target.value);
    setFile(null);
    setUploadedAmount(''); // <--- Resetear monto al cambiar presupuesto
    setPaymentMethod(''); // 🆕 Resetear método de pago
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    const fileInput = event.target;

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error("Tipo de archivo no permitido. Sube un PDF o una imagen (JPG, PNG, GIF, WEBP).");
      setFile(null);
      fileInput.value = null;
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("El archivo no debe superar los 5 MB.");
      setFile(null);
      fileInput.value = null;
      return;
    }

    setFile(selectedFile);
  };

   const handleAmountChange = (event) => { // <--- Nueva función para manejar cambio de monto
    const value = event.target.value;
    // Permitir solo números y un punto decimal
    if (/^\d*\.?\d*$/.test(value)) {
      setUploadedAmount(value);
    }
  };

 const handleUpload = async () => {
    if (!selectedBudgetId || !file || !uploadedAmount) { // <--- Validar que el monto también esté presente
      toast.error("Por favor, selecciona un presupuesto, un archivo y especifica el monto del comprobante.");
      return;
    }

    const parsedAmount = parseFloat(uploadedAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("El monto del comprobante debe ser un número positivo.");
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);
    let uploadToast;

    try {
      uploadToast = toast.loading("Iniciando la carga del comprobante...");

       const uploadResult = await dispatch(uploadInvoice(selectedBudgetId, file, parsedAmount, (progress) => {
        setUploadProgress(progress);
        if (uploadToast) {
          toast.update(uploadToast, {
            render: `Subiendo: ${progress}%`,
            type: "info",
          });
        }
      }, paymentMethod)); // 🆕 Pasar método de pago

      if (!uploadResult?.payload) {
        throw new Error('Error al subir el comprobante');
      }

      // ✅ NO cambiar status manualmente - El hook Budget.beforeUpdate lo manejará
      // Si tiene firma (status='signed') + pago → Hook cambia a 'approved'
      // Si solo tiene pago (sin firma) → Mantiene estado actual hasta que firme
      toast.update(uploadToast, {
        render: "Actualizando presupuesto...",
        type: "info",
        isLoading: true
      });

      // Refrescar datos para obtener el estado actualizado por el hook
      await dispatch(fetchBudgetById(selectedBudgetId));

      toast.update(uploadToast, {
        render: "¡Comprobante de pago subido exitosamente!",
        type: "success",
        isLoading: false,
        autoClose: 3000,
      });

      // Limpiar formulario
      setSelectedBudgetId('');
      setFile(null);
      setUploadedAmount('');
      setPaymentMethod(''); // 🆕 Limpiar método de pago
      setUploadProgress(0);
      const fileInput = document.getElementById('invoice-upload-input');
      if (fileInput) fileInput.value = null;

      // Recargar datos con pageSize grande para incluir todos los presupuestos
      await dispatch(fetchBudgets({ pageSize: 1000 }));
      
      // Pequeño delay para asegurar que Redux se actualice
      setTimeout(() => {
        navigate('/dashboard');
      }, 300);

    } catch (error) {
      console.error("Error durante la carga:", error);
      
      if (uploadToast) {
        toast.update(uploadToast, {
          render: error.message.includes('timeout') || error.code === 'ECONNABORTED'
            ? "La carga está tomando más tiempo de lo esperado. Por favor, intenta con un archivo más pequeño."
            : `Error: ${error.message || 'Error desconocido'}`,
          type: "error",
          isLoading: false,
          autoClose: 5000,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar presupuestos elegibles para subir comprobante de pago
  // ✅ PERMITIR PAGO ANTES DE FIRMA: Cliente puede pagar primero y firmar después
  // Estados válidos: client_approved, sent_for_signature, signed, o 'approved' sin comprobante (pago diferido)
  // Excluir: 'approved' con comprobante ya cargado, 'rejected', 'draft' (no aprobado aún)
  const sendBudgets = budgets.filter(b => {
    const invalidStatuses = ['draft', 'created', 'pending_review', 'rejected'];
    if (invalidStatuses.includes(b.status)) return false;
    // 'approved' solo aparece si aún no tiene comprobante (caso pago diferido)
    if (b.status === 'approved' && b.paymentInvoice) return false;
    
    // Excluir si ya tiene pago registrado (doble verificación)
    if (b.paymentProofAmount && parseFloat(b.paymentProofAmount) > 0) {
      return false;
    }
    
    return true;
  });

  if (budgetsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <p className="text-blue-600 font-medium">Cargando presupuestos...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (budgetsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
              <p className="text-red-700 font-medium">Error al cargar presupuestos</p>
            </div>
            <p className="text-red-600 text-sm">{budgetsError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (sendBudgets.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <ClipboardDocumentListIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No hay presupuestos disponibles</p>
            <p className="text-gray-600 text-sm mt-2">
              No hay presupuestos disponibles para subir comprobante de pago inicial.
            </p>
            <p className="text-gray-500 text-xs mt-3">
              Los presupuestos deben estar en estado client_approved, sent_for_signature, signed, o approved sin comprobante (pago inicial diferido).
              El pago puede subirse ANTES o DESPUÉS de la firma del cliente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectedBudgetDetails = selectedBudgetId ? budgets.find(b => b.idBudget === parseInt(selectedBudgetId)) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg">
              <DocumentArrowUpIcon className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Subir Comprobante de Pago Inicial</h2>
          </div>
          <p className="text-gray-600">Registra el comprobante de pago inicial para aprobar el presupuesto</p>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="space-y-6">
            {/* Budget Selection */}
            <div>
              <label htmlFor="budget-select" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                <ClipboardDocumentListIcon className="h-5 w-5 mr-2 text-blue-500" />
                Seleccionar Presupuesto (Aprobado por Cliente)
              </label>
              <select
                id="budget-select"
                value={selectedBudgetId}
                onChange={handleBudgetSelect}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
              >
                <option value="">-- Seleccionar Presupuesto --</option>
                {sendBudgets.map((budget) => (
                  <option key={budget.idBudget} value={budget.idBudget}>
                   {budget.propertyAddress} - {budget.applicantName} -  ({budget.status})
                  </option>
                ))}
              </select>
            </div>

            {selectedBudgetId && (
              <>
                {/* Budget Details Card */}
                {selectedBudgetDetails && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center space-x-3 mb-3">
                      <CurrencyDollarIcon className="h-5 w-5 text-blue-500" />
                      <h3 className="font-semibold text-blue-800">Detalles del Presupuesto</h3>
                    </div>
                    <div className="bg-white rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Cliente:</span> {selectedBudgetDetails.applicantName}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Dirección:</span> {selectedBudgetDetails.propertyAddress}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Estado actual:</span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                          selectedBudgetDetails.status === 'signed' ? 'bg-green-100 text-green-800' :
                          selectedBudgetDetails.status === 'sent_for_signature' ? 'bg-yellow-100 text-yellow-800' :
                          selectedBudgetDetails.status === 'client_approved' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedBudgetDetails.status === 'sent_for_signature' ? 'Enviado para Firma' :
                           selectedBudgetDetails.status === 'signed' ? 'Firmado' :
                           selectedBudgetDetails.status}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Pago inicial esperado:</span>
                        <span className="font-bold text-green-600 ml-2">
                          ${parseFloat(selectedBudgetDetails.initialPayment).toFixed(2)}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {/* File Upload */}
                <div>
                  <label htmlFor="invoice-upload-input" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <CloudArrowUpIcon className="h-5 w-5 mr-2 text-blue-500" />
                    Seleccionar Comprobante (PDF o Imagen)
                  </label>
                  <input
                    id="invoice-upload-input"
                    name="file"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {file && (
                    <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600 bg-green-50 p-2 rounded-lg">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span>Archivo seleccionado: <span className="font-medium">{file.name}</span></span>
                    </div>
                  )}
                </div>

                {/* Amount Input */}
                <div>
                  <label htmlFor="uploaded-amount-input" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-500" />
                    Monto del Comprobante
                  </label>
                  <input
                    id="uploaded-amount-input"
                    type="text"
                    value={uploadedAmount}
                    onChange={handleAmountChange}
                    placeholder="Ej: 1250.50"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                {/* 🆕 Payment Method Input */}
                <div>
                  <label htmlFor="payment-method-select" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    💳 Método de Pago (Opcional)
                  </label>
                  <select
                    id="payment-method-select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">Seleccionar método de pago (opcional)</option>
                    <optgroup label="🏦 Cuentas Bancarias">
                      {PAYMENT_METHODS_GROUPED.bank.map(method => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="💳 Tarjetas">
                      {PAYMENT_METHODS_GROUPED.card.map(method => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="💰 Otros Métodos">
                      {PAYMENT_METHODS_GROUPED.other.map(method => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Selecciona cómo se recibió el pago para mejor seguimiento financiero
                  </p>
                </div>
              </>
            )}

            {/* Progress Bar */}
            {isLoading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 text-center">{uploadProgress}% completado</p>
              </div>
            )}

            {/* Submit Button */}
            {selectedBudgetId && file && uploadedAmount && (
              <button
                onClick={handleUpload}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Subiendo...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <DocumentArrowUpIcon className="h-5 w-5" />
                    <span>Subir Comprobante y Aprobar</span>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadInitialPay;