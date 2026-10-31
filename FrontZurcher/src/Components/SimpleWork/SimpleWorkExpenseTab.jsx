import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FaPlus, FaTrash, FaShoppingCart, FaCheck, FaTimes, FaFileInvoice } from 'react-icons/fa';
import {
  createSimpleWorkExpense,
  deleteSimpleWorkExpense,
  fetchSimpleWorkById
} from '../../Redux/Actions/simpleWorkActions';

const SimpleWorkExpenseTab = ({ workId, readOnly = false }) => {
  const dispatch = useDispatch();
  const { currentSimpleWork } = useSelector(state => state.simpleWork);

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseData, setExpenseData] = useState({
    description: '',
    amount: '',
    category: 'materials',
    supplier: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    notes: ''
  });

  // 🆕 Combinar SimpleWorkExpenses (gastos dedicados) y linkedExpenses (gastos generales vinculados)
  const simpleWorkExpenses = currentSimpleWork?.expenses || [];
  const linkedGeneralExpenses = currentSimpleWork?.linkedExpenses || [];
  
  // Marcar cada gasto con su tipo para mostrarlos diferente en la UI
  const allExpenses = [
    ...simpleWorkExpenses.map(e => ({ ...e, expenseType: 'dedicated' })),
    ...linkedGeneralExpenses.map(e => ({ 
      ...e, 
      expenseType: 'linked',
      // Mapear campos para compatibilidad
      purchaseDate: e.date,
      description: e.notes || e.typeExpense,
      category: e.typeExpense?.includes('Material') ? 'materials' : 'other'
    }))
  ];

  const expenseCategories = [
    { value: 'materials', label: 'Materiales' },
    { value: 'labor', label: 'Mano de Obra' },
    { value: 'equipment', label: 'Equipo/Herramientas' },
    { value: 'transportation', label: 'Transporte' },
    { value: 'permits', label: 'Permisos' },
    { value: 'subcontractor', label: 'Subcontratista' },
    { value: 'other', label: 'Otro' }
  ];

  const handleInputChange = (field, value) => {
    setExpenseData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();

    if (!expenseData.description.trim()) {
      toast.error('La descripción es requerida');
      return;
    }

    if (!expenseData.amount || parseFloat(expenseData.amount) <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    try {
      await dispatch(createSimpleWorkExpense(workId, {
        description: expenseData.description.trim(),
        amount: parseFloat(expenseData.amount),
        category: expenseData.category,
        supplier: expenseData.supplier.trim(),
        purchaseDate: expenseData.purchaseDate,
        invoiceNumber: expenseData.invoiceNumber.trim(),
        notes: expenseData.notes.trim()
      }));

      toast.success('Gasto registrado exitosamente');
      setShowExpenseForm(false);
      setExpenseData({
        description: '',
        amount: '',
        category: 'materials',
        supplier: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        invoiceNumber: '',
        notes: ''
      });

      // Refresh work data
      dispatch(fetchSimpleWorkById(workId));
    } catch (error) {
      toast.error('Error al registrar gasto');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (window.confirm('¿Estás seguro de eliminar este gasto?')) {
      try {
        await dispatch(deleteSimpleWorkExpense(workId, expenseId));
        toast.success('Gasto eliminado exitosamente');
        dispatch(fetchSimpleWorkById(workId));
      } catch (error) {
        toast.error('Error al eliminar gasto');
      }
    }
  };

  const totalExpenses = allExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

  const getCategoryLabel = (category) => {
    const cat = expenseCategories.find(c => c.value === category);
    return cat ? cat.label : category;
  };

  const getCategoryColor = (category) => {
    const colors = {
      materials: 'bg-blue-100 text-blue-800',
      labor: 'bg-green-100 text-green-800',
      equipment: 'bg-purple-100 text-purple-800',
      transportation: 'bg-yellow-100 text-yellow-800',
      permits: 'bg-red-100 text-red-800',
      subcontractor: 'bg-indigo-100 text-indigo-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Gastos y Materiales
          </h3>
          <p className="text-sm text-gray-600">
            Total Gastado: ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          {linkedGeneralExpenses.length > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              💡 Incluye {linkedGeneralExpenses.length} gasto(s) vinculado(s) desde Seguimiento
            </p>
          )}
        </div>
        <>{!readOnly && (<button
          onClick={() => setShowExpenseForm(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
        >
          <FaPlus />
          <span>Registrar Gasto</span>
        </button>)}</>
      </div>

      {/* Expense Form */}
      {showExpenseForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-gray-900">Nuevo Gasto</h4>
            <button
              onClick={() => setShowExpenseForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <FaTimes />
            </button>
          </div>

          <form onSubmit={handleSubmitExpense} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción *
                </label>
                <input
                  type="text"
                  value={expenseData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Ej: Cemento Portland, Arena, Tubería PVC 4in"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={expenseData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría *
                </label>
                <select
                  value={expenseData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                >
                  {expenseCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor
                </label>
                <input
                  type="text"
                  value={expenseData.supplier}
                  onChange={(e) => handleInputChange('supplier', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Home Depot, Lowe's, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Compra *
                </label>
                <input
                  type="date"
                  value={expenseData.purchaseDate}
                  onChange={(e) => handleInputChange('purchaseDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Factura
                </label>
                <input
                  type="text"
                  value={expenseData.invoiceNumber}
                  onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="INV-12345"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={expenseData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Notas adicionales (opcional)"
                  rows="2"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowExpenseForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
              >
                <FaCheck />
                <span>Guardar Gasto</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses List */}
      {allExpenses.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <FaShoppingCart className="text-4xl text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No hay gastos registrados aún</p>
          <>{!readOnly && (<button
            onClick={() => setShowExpenseForm(true)}
            className="mt-4 text-red-600 hover:text-red-700"
          >
            Registrar primer gasto
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
                  Descripción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proveedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Factura
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allExpenses.map((expense) => (
                <tr key={expense.id || expense.idExpense} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(expense.purchaseDate || expense.createdAt).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center space-x-2">
                      <span>{expense.description}</span>
                      {expense.expenseType === 'linked' && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                          Vinculado
                        </span>
                      )}
                    </div>
                    {expense.notes && expense.expenseType === 'dedicated' && (
                      <div className="text-xs text-gray-500 mt-1">{expense.notes}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(expense.category)}`}>
                      {getCategoryLabel(expense.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.supplier || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {expense.invoiceNumber ? (
                      <div className="flex items-center space-x-1">
                        <FaFileInvoice className="text-gray-400" />
                        <span>{expense.invoiceNumber}</span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-red-600">
                      ${parseFloat(expense.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {expense.expenseType === 'dedicated' ? (
                      <>{!readOnly && (<button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Eliminar gasto"
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
                <td colSpan="5" className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                  Total:
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-bold text-red-600">
                    ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Expense Summary by Category */}
      {allExpenses.length > 0 && (
        <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Resumen por Categoría</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {expenseCategories.map(cat => {
              const categoryTotal = allExpenses
                .filter(exp => exp.category === cat.value)
                .reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
              
              if (categoryTotal === 0) return null;
              
              return (
                <div key={cat.value} className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className={`text-xs font-semibold mb-1 ${getCategoryColor(cat.value)} inline-block px-2 py-1 rounded`}>
                    {cat.label}
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    ${categoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-gray-500">
                    {((categoryTotal / totalExpenses) * 100).toFixed(1)}% del total
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleWorkExpenseTab;
