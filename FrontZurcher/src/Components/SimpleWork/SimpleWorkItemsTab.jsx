import React from 'react';
import { FaList, FaCalendar, FaDollarSign } from 'react-icons/fa';

const SimpleWorkItemsTab = ({ work }) => {
  const items = work?.items || [];

  const totalWithoutDiscount = items.reduce((sum, item) => 
    sum + parseFloat(item.totalCost || 0), 0
  );

  const totalFinal = items.reduce((sum, item) => 
    sum + parseFloat(item.finalCost || item.totalCost || 0), 0
  );

  const totalDiscount = totalWithoutDiscount - totalFinal;
  const discountPercentage = work.discountPercentage || 0;

  // Group items by category
  const itemsByCategory = items.reduce((acc, item) => {
    const category = item.category || 'OTHER';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});

  const getCategoryDisplay = (category) => {
    const displays = {
      'PIPE': 'Tubería',
      'FITTINGS': 'Accesorios',
      'TANK': 'Tanque',
      'DISTRIBUTION BOX': 'Caja de Distribución',
      'ROCK': 'Piedra/Roca',
      'INSPECTION': 'Inspección',
      'LABOR FEE': 'Mano de Obra',
      'OTHER': 'Otros'
    };
    return displays[category] || category;
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <FaList className="text-4xl text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No hay items en esta cotización</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Items by Category */}
      {Object.keys(itemsByCategory).sort().map(category => (
        <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">
              {getCategoryDisplay(category)}
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio Unit.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  {itemsByCategory[category].some(item => item.discount > 0) && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descuento
                    </th>
                  )}
                  {itemsByCategory[category].some(item => item.markup > 0) && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Markup
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Costo Final
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {itemsByCategory[category].map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{item.description}</span>
                        {item.showPrice === false && (
                          <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-400 rounded border border-gray-200" title="Precio oculto en PDF">sin $</span>
                        )}
                      </div>
                      {item.notes && (
                        <div className="text-xs text-gray-500 mt-1">{item.notes}</div>
                      )}
                      {item.isFromTemplate && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                          Desde Template
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {parseFloat(item.quantity).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.unit || 'ea'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${parseFloat(item.unitCost).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${parseFloat(item.totalCost).toFixed(2)}
                    </td>
                    {itemsByCategory[category].some(i => i.discount > 0) && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {item.discount > 0 ? `-${item.discount}%` : '-'}
                      </td>
                    )}
                    {itemsByCategory[category].some(i => i.markup > 0) && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        {item.markup > 0 ? `+${item.markup}%` : '-'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ${parseFloat(item.finalCost || item.totalCost).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={itemsByCategory[category].some(i => i.discount > 0 || i.markup > 0) ? "7" : "6"} 
                      className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                    Subtotal {getCategoryDisplay(category)}:
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                    ${itemsByCategory[category].reduce((sum, item) => 
                      sum + parseFloat(item.finalCost || item.totalCost || 0), 0
                    ).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}

      {/* Grand Total */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
        <div className="space-y-3">
          {totalDiscount > 0 && (
            <>
              <div className="flex justify-between items-center text-gray-700">
                <span className="font-medium">Subtotal (sin descuento):</span>
                <span className="text-lg">${totalWithoutDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-red-600">
                <span className="font-medium">
                  Descuento {discountPercentage > 0 ? `(${discountPercentage}%)` : ''}:
                </span>
                <span className="text-lg">-${totalDiscount.toFixed(2)}</span>
              </div>
              <div className="border-t border-blue-300 pt-3"></div>
            </>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xl font-bold text-gray-900">Total General:</span>
            <span className="text-3xl font-bold text-blue-600">
              ${totalFinal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Terms Info */}
      {work.initialPaymentPercentage && work.initialPaymentPercentage < 100 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">
            Términos de Pago
          </h4>
          <div className="space-y-1 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>Pago Inicial ({work.initialPaymentPercentage}%):</span>
              <span className="font-semibold">
                ${(totalFinal * (work.initialPaymentPercentage / 100)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Pago Final ({100 - work.initialPaymentPercentage}%):</span>
              <span className="font-semibold">
                ${(totalFinal * ((100 - work.initialPaymentPercentage) / 100)).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Item Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 rounded-full p-3">
              <FaList className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{items.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 rounded-full p-3">
              <FaCalendar className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Categorías</p>
              <p className="text-2xl font-bold text-gray-900">{Object.keys(itemsByCategory).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 rounded-full p-3">
              <FaDollarSign className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Precio Promedio</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(totalFinal / items.length).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleWorkItemsTab;
