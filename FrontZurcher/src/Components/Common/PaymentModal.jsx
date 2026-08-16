import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  CreditCardIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { PAYMENT_METHODS_GROUPED } from '../../utils/paymentConstants';

/**
 * 🆕 MODAL DE PAGO REUTILIZABLE
 * Usado en FixedExpenses, AttachInvoice, y otros módulos
 * 
 * Features:
 * - Validación de período (no duplicar pagos en mismo mes)
 * - Selector visual de período pagado
 * - Sugerencia automática de período basada en frecuencia
 * - Comprobante de pago (PDF/Imagen)
 * - Listado de pagos anteriores
 */

const PaymentModal = ({
  isOpen,
  onClose,
  expense, // { idFixedExpense, name, totalAmount, paidAmount, paymentMethod, paymentStatus, frequency }
  onSubmitPayment,
  paymentHistory = [],
  loading = false,
  modalTitle = "Registrar Pago",
  showPeriodSelector = true,
  defaultPaymentMethod = '',
  currency = 'USD'
}) => {
  if (!isOpen || !expense) return null;

  // Estados del formulario
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentDate: new Date().toLocaleDateString('en-CA'),
    paymentMethod: defaultPaymentMethod || expense.paymentMethod || '',
    notes: '',
    receipt: null,
    // 🆕 Período pagado
    periodStart: '',
    periodEnd: '',
    periodDueDate: '',
    periodType: 'monthly' // monthly, biweekly, custom
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validation, setValidation] = useState({
    hasWarning: false,
    warningMessage: '',
    isDuplicate: false
  });

  // Calcular fecha fin sugerida basada en frecuencia
  const calculateSuggestedPeriod = () => {
    const date = new Date(paymentData.paymentDate);
    const year = date.getFullYear();
    const month = date.getMonth();

    let start, end, dueDate;

    switch (expense.frequency) {
      case 'monthly':
        // Período: Primer día del mes anterior hasta último día del mes anterior
        const prevMonth = new Date(year, month - 1, 1);
        start = new Date(year, month - 1, 1);
        end = new Date(year, month, 0); // Último día del mes anterior
        dueDate = new Date(year, month, 0); // Mes vencido
        break;

      case 'biweekly':
        // Determinar si es 1ª o 2ª quincena
        if (date.getDate() <= 15) {
          // Pago del 1-15: corresponde a 2ª quincena del mes anterior
          start = new Date(year, month - 1, 16);
          end = new Date(year, month, 0);
          dueDate = new Date(year, month, 0);
        } else {
          // Pago del 16-31: corresponde a 1ª quincena del mes actual
          start = new Date(year, month, 1);
          end = new Date(year, month, 15);
          dueDate = new Date(year, month, 15);
        }
        break;

      case 'weekly':
        // Período: semana anterior
        const dayOfWeek = date.getDay();
        const daysBack = dayOfWeek || 7;
        start = new Date(date);
        start.setDate(date.getDate() - daysBack);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        dueDate = end;
        break;

      case 'quarterly':
      case 'semiannual':
      case 'annual':
      default:
        // Para frecuencias mayores, usar el mes completo
        start = new Date(year, month - 1, 1);
        end = new Date(year, month, 0);
        dueDate = new Date(year, month, 0);
    }

    return {
      periodStart: start.toISOString().split('T')[0],
      periodEnd: end.toISOString().split('T')[0],
      periodDueDate: dueDate.toISOString().split('T')[0]
    };
  };

  // Auto-llenar período cuando cambia la fecha de pago
  useEffect(() => {
    if (paymentData.paymentDate && showPeriodSelector && expense.frequency) {
      const suggested = calculateSuggestedPeriod();
      setPaymentData(prev => ({
        ...prev,
        periodStart: suggested.periodStart,
        periodEnd: suggested.periodEnd,
        periodDueDate: suggested.periodDueDate
      }));
    }
  }, [paymentData.paymentDate, expense.frequency, showPeriodSelector]);

  // Validar pagos duplicados en el mismo período
  useEffect(() => {
    if (!paymentHistory || paymentHistory.length === 0) {
      setValidation({ hasWarning: false, warningMessage: '', isDuplicate: false });
      return;
    }

    const paymentDate = new Date(paymentData.paymentDate);
    const paymentMonth = paymentDate.getMonth();
    const paymentYear = paymentDate.getFullYear();

    // Verificar si ya hay un pago en el mismo mes/año
    const isDuplicate = paymentHistory.some(payment => {
      const pDate = new Date(payment.paymentDate);
      return pDate.getMonth() === paymentMonth && pDate.getFullYear() === paymentYear;
    });

    if (isDuplicate) {
      setValidation({
        hasWarning: true,
        warningMessage: `⚠️ Ya existe un pago registrado en ${paymentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`,
        isDuplicate: true
      });
    } else {
      setValidation({ hasWarning: false, warningMessage: '', isDuplicate: false });
    }
  }, [paymentData.paymentDate, paymentHistory]);

  // Validar monto máximo
  const validateAmount = () => {
    const amount = parseFloat(paymentData.amount);
    const totalAmount = parseFloat(expense.totalAmount || 0);
    const paidAmount = parseFloat(expense.paidAmount || 0);
    const remaining = totalAmount - paidAmount;

    if (!amount || amount <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return false;
    }

    if (amount > remaining + 0.01) {
      toast.error(`El monto de $${amount.toFixed(2)} excede el restante de $${remaining.toFixed(2)}`);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!paymentData.amount || !paymentData.paymentMethod) {
      toast.error('Completa monto y método de pago');
      return;
    }

    if (!validateAmount()) {
      return;
    }

    // Advertencia de pago duplicado
    if (validation.isDuplicate && !window.confirm(validation.warningMessage + '\n\n¿Continuar de todas formas?')) {
      return;
    }

    // Preparar datos para enviar
    const dataToSend = {
      amount: paymentData.amount,
      paymentDate: paymentData.paymentDate,
      paymentMethod: paymentData.paymentMethod,
      notes: paymentData.notes,
      receipt: paymentData.receipt,
      // Período pagado
      periodStart: showPeriodSelector ? paymentData.periodStart : null,
      periodEnd: showPeriodSelector ? paymentData.periodEnd : null,
      periodDueDate: showPeriodSelector ? paymentData.periodDueDate : null
    };

    await onSubmitPayment(dataToSend);

    // Reset formulario
    setPaymentData({
      amount: '',
      paymentDate: new Date().toLocaleDateString('en-CA'),
      paymentMethod: defaultPaymentMethod || expense.paymentMethod || '',
      notes: '',
      receipt: null,
      periodStart: '',
      periodEnd: '',
      periodDueDate: '',
      periodType: 'monthly'
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPaymentData({ ...paymentData, receipt: file });
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const totalAmount = parseFloat(expense.totalAmount || 0);
  const paidAmount = parseFloat(expense.paidAmount || 0);
  const remaining = totalAmount - paidAmount;
  const paymentAmount = parseFloat(paymentData.amount) || 0;
  const progressPercent = Math.min((paidAmount / totalAmount) * 100, 100);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCardIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{modalTitle}</h2>
              <p className="text-sm text-gray-600 mt-1">{expense.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Información del gasto */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600 text-xs font-medium">TOTAL</p>
              <p className="font-bold text-gray-900 mt-1">{formatCurrency(totalAmount)}</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs font-medium">PAGADO</p>
              <p className="font-bold text-green-600 mt-1">{formatCurrency(paidAmount)}</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs font-medium">RESTANTE</p>
              <p className="font-bold text-orange-600 mt-1">{formatCurrency(remaining)}</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs font-medium">ESTADO</p>
              <p className={`font-bold mt-1 ${
                expense.paymentStatus === 'paid' ? 'text-green-600' :
                expense.paymentStatus === 'partial' ? 'text-yellow-600' :
                'text-gray-600'
              }`}>
                {expense.paymentStatus === 'paid' ? 'PAGADO' :
                 expense.paymentStatus === 'partial' ? 'PARCIAL' :
                 'PENDIENTE'}
              </p>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-2">
              <span className="font-medium">Progreso de pago</span>
              <span className="font-bold">{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario de pago */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">1</span>
              Registrar Pago
            </h3>

            {/* Validación de duplicado */}
            {validation.hasWarning && (
              <div className="mb-4 bg-yellow-50 border border-yellow-300 rounded-lg p-3 flex items-start gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800">{validation.warningMessage}</p>
                  <p className="text-xs text-yellow-700 mt-1">Verifica que no estés duplicando un pago</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Monto */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Monto a Pagar <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                  {paymentAmount > 0 && remaining > 0 && (
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs font-medium text-gray-600">
                      {paymentAmount > remaining ? (
                        <span className="text-red-600">⚠️ Excede</span>
                      ) : (
                        <span className="text-green-600">✓ {formatCurrency(remaining - paymentAmount)} restante</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Fecha de pago */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Fecha de Pago <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={paymentData.paymentDate}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Método de pago */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Método de Pago <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {PAYMENT_METHODS_GROUPED.bank && (
                    <optgroup label="🏦 Cuentas Bancarias">
                      {PAYMENT_METHODS_GROUPED.bank.map(method => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </optgroup>
                  )}
                  {PAYMENT_METHODS_GROUPED.card && (
                    <optgroup label="💳 Tarjetas">
                      {PAYMENT_METHODS_GROUPED.card.map(method => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </optgroup>
                  )}
                  {PAYMENT_METHODS_GROUPED.other && (
                    <optgroup label="💰 Otros">
                      {PAYMENT_METHODS_GROUPED.other.map(method => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Comprobante */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Comprobante de Pago (Opcional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 hover:bg-blue-50 transition">
                      {paymentData.receipt ? (
                        <div className="text-sm">
                          <CheckIcon className="h-5 w-5 text-green-600 mx-auto mb-1" />
                          <p className="font-medium text-green-600">{paymentData.receipt.name}</p>
                          <p className="text-xs text-gray-600">{(paymentData.receipt.size / 1024).toFixed(0)} KB</p>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">
                          <p className="font-medium">📎 Seleccionar archivo</p>
                          <p className="text-xs">PDF, JPG, PNG...</p>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.gif"
                    />
                  </label>
                </div>
              </div>

              {/* Botón expandir opciones avanzadas */}
              {showPeriodSelector && (
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium py-2"
                >
                  {showAdvanced ? '⬆️ Menos opciones' : '⬇️ Más opciones'}
                </button>
              )}

              {/* Opciones avanzadas - Período */}
              {showPeriodSelector && showAdvanced && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">
                      <strong>Período pagado:</strong> Especifica qué período laboral estás pagando. 
                      Se auto-completa basado en la frecuencia (mes vencido, quincena, etc.)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Inicio del Período
                    </label>
                    <input
                      type="date"
                      value={paymentData.periodStart}
                      onChange={(e) => setPaymentData({ ...paymentData, periodStart: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Fin del Período
                    </label>
                    <input
                      type="date"
                      value={paymentData.periodEnd}
                      onChange={(e) => setPaymentData({ ...paymentData, periodEnd: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Fecha de Vencimiento
                    </label>
                    <input
                      type="date"
                      value={paymentData.periodDueDate}
                      onChange={(e) => setPaymentData({ ...paymentData, periodDueDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Ej: Para sueldos mensual → último día del mes anterior
                    </p>
                  </div>
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notas (Opcional)
                </label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                  rows="3"
                  placeholder="Detalles adicionales del pago..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !paymentData.amount || !paymentData.paymentMethod}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Registrando...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-5 w-5" />
                      Registrar Pago
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Historial de pagos */}
          <div className="border border-gray-200 rounded-lg p-4 overflow-y-auto max-h-96">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">2</span>
              Historial de Pagos ({paymentHistory.length})
            </h3>

            {paymentHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No hay pagos registrados aún</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentHistory.map((payment, index) => (
                  <div key={payment.idPayment || index} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-800">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-gray-600">{payment.paymentDate}</p>
                      </div>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {payment.paymentMethod || 'N/A'}
                      </span>
                    </div>

                    {/* Período pagado */}
                    {(payment.periodStart || payment.periodEnd) && (
                      <div className="text-xs text-gray-600 mb-2 bg-gray-50 p-2 rounded">
                        <p>📅 Período: {payment.periodStart} a {payment.periodEnd}</p>
                        {payment.periodDueDate && (
                          <p>📆 Vencimiento: {payment.periodDueDate}</p>
                        )}
                      </div>
                    )}

                    {payment.notes && (
                      <p className="text-xs text-gray-600 italic border-t border-gray-200 pt-2 mt-2">
                        {payment.notes}
                      </p>
                    )}

                    {payment.receiptUrl && (
                      <a
                        href={payment.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 mt-2 inline-block"
                      >
                        📎 Ver comprobante
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
