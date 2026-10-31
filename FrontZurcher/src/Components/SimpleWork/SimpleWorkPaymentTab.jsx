import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FaPlus, FaTrash, FaDollarSign, FaCheck, FaTimes } from 'react-icons/fa';
import {
  createSimpleWorkPayment,
  deleteSimpleWorkPayment,
  fetchSimpleWorkById
} from '../../Redux/Actions/simpleWorkActions';

const SimpleWorkPaymentTab = ({ workId, readOnly = false }) => {
  const dispatch = useDispatch();
  const { currentSimpleWork } = useSelector(state => state.simpleWork);

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'Chase Bank',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // 🔧 Combinar SimpleWorkPayments (dedicados) + linkedIncomes (vinculados desde Seguimiento)
  // Deduplicar: si un SimpleWorkPayment tiene mismo monto+fecha que un linkedIncome, es legacy duplicado
  const simpleWorkPayments = currentSimpleWork?.payments || [];
  const linkedGeneralIncomes = currentSimpleWork?.linkedIncomes || [];
  
  // Filtrar SimpleWorkPayments que son duplicados legacy de linkedIncomes
  const nonDuplicatePayments = simpleWorkPayments.filter(p => {
    const pAmount = parseFloat(p.amount || 0);
    const pDate = (p.paymentDate || '').substring(0, 10);
    return !linkedGeneralIncomes.some(i => {
      const iAmount = parseFloat(i.amount || 0);
      const iDate = (i.date || '').substring(0, 10);
      return Math.abs(pAmount - iAmount) < 0.01 && pDate === iDate;
    });
  });
  
  const allPayments = [
    ...nonDuplicatePayments.map(p => ({ ...p, paymentType: 'dedicated' })),
    ...linkedGeneralIncomes.map(p => ({ 
      ...p, 
      paymentType: 'linked',
      paymentDate: p.date,
      notes: p.notes || p.typeIncome,
      description: p.notes || p.typeIncome
    }))
  ];

  const paymentMethods = [
    'Chase Bank',
    'AMEX',
    'Chase Credit Card',
    'Proyecto Septic BOFA',
    'Transferencia Bancaria',
    'Efectivo'
  ];

  const handleInputChange = (field, value) => {
    setPaymentData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();

    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    try {
      await dispatch(createSimpleWorkPayment(workId, {
        amount: parseFloat(paymentData.amount),
        paymentMethod: paymentData.paymentMethod,
        paymentDate: paymentData.paymentDate,
        notes: paymentData.notes.trim()
      }));

      toast.success('Pago registrado exitosamente');
      setShowPaymentForm(false);
      setPaymentData({
        amount: '',
        paymentMethod: 'Chase Bank',
        paymentDate: new Date().toISOString().split('T')[0],
        notes: ''
      });

      // Refresh work data
      dispatch(fetchSimpleWorkById(workId));
    } catch (error) {
      toast.error('Error al registrar pago');
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (window.confirm('¿Estás seguro de eliminar este pago?')) {
      try {
        await dispatch(deleteSimpleWorkPayment(workId, paymentId));
        toast.success('Pago eliminado exitosamente');
        dispatch(fetchSimpleWorkById(workId));
      } catch (error) {
        toast.error('Error al eliminar pago');
      }
    }
  };

  const totalPaid = allPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Pagos Recibidos
          </h3>
          <p className="text-sm text-gray-600">
            Total Pagado: ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          {linkedGeneralIncomes.length > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              💡 Incluye {linkedGeneralIncomes.length} ingreso(s) vinculado(s) desde Seguimiento
            </p>
          )}
        </div>
        <>{!readOnly && (<button
          onClick={() => setShowPaymentForm(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
        >
          <FaPlus />
          <span>Registrar Pago</span>
        </button>)}</>
      </div>

      {/* Payment Form */}
      {showPaymentForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-gray-900">Nuevo Pago</h4>
            <button
              onClick={() => setShowPaymentForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <FaTimes />
            </button>
          </div>

          <form onSubmit={handleSubmitPayment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Pago *
                </label>
                <select
                  value={paymentData.paymentMethod}
                  onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  {paymentMethods.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Pago *
                </label>
                <input
                  type="date"
                  value={paymentData.paymentDate}
                  onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <input
                  type="text"
                  value={paymentData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Notas adicionales (opcional)"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowPaymentForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <FaCheck />
                <span>Guardar Pago</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payments List */}
      {allPayments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <FaDollarSign className="text-4xl text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No hay pagos registrados aún</p>
          <>{!readOnly && (<button
            onClick={() => setShowPaymentForm(true)}
            className="mt-4 text-green-600 hover:text-green-700"
          >
            Registrar primer pago
          </button>)}</>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Método
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allPayments.map((payment) => (
                <tr key={payment.id || payment.idIncome} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(payment.paymentDate).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-green-600">
                        ${parseFloat(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      {payment.paymentType === 'linked' && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                          Vinculado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.paymentMethod}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {payment.notes || payment.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {payment.paymentType === 'dedicated' ? (
                      <>{!readOnly && (<button
                        onClick={() => handleDeletePayment(payment.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Eliminar pago"
                      >
                        <FaTrash />
                      </button>)}</>
                    ) : (
                      <span className="text-xs text-gray-400 italic">
                        Ver en Seguimiento
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                  Total:
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-bold text-green-600">
                    ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td colSpan="3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default SimpleWorkPaymentTab;
