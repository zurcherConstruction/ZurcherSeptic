import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchFinalInvoiceByWorkId,
  createFinalInvoice,
  addExtraItemToInvoice,
   updateExtraItem, 
   removeExtraItem, 
  updateFinalInvoiceStatus,
  updateFinalInvoiceDiscount, // 🆕
   generateFinalInvoicePdf,
   emailFinalInvoice 
} from '../../Redux/Actions/finalInvoiceActions';
import { fetchWorkById } from '../../Redux/Actions/workActions';
import { clearFinalInvoiceState, clearEmailMessage } from '../../Redux/Reducer/finalInvoiceReducer'; // Para limpiar al desmontar
import api from '../../utils/axios';
import GoogleReviewRequestModal from './GoogleReviewRequestModal';

const ExtraItemRow = ({ item, onUpdate, onRemove, isEditing, onSave, onCancelEdit, editFormData, onEditFormChange }) => {
  if (isEditing) {
    return (
      <tr className="bg-yellow-50">
        <td><input type="text" name="description" value={editFormData.description} onChange={onEditFormChange} className="input-style text-xs p-1 w-full" /></td>
        <td><input type="number" name="quantity" value={editFormData.quantity} onChange={onEditFormChange} className="input-style text-xs p-1 w-16 text-right" min="0" step="0.01"/></td>
        <td><input type="number" name="unitPrice" value={editFormData.unitPrice} onChange={onEditFormChange} className="input-style text-xs p-1 w-20 text-right" min="0" step="0.01"/></td>
        <td className="text-right text-xs pr-2">${(parseFloat(editFormData.quantity || 0) * parseFloat(editFormData.unitPrice || 0)).toFixed(2)}</td>
        <td className="text-center">
          <button onClick={() => onSave(item.id)} className="text-green-600 hover:text-green-800 text-xs mr-1">Guardar</button>
          <button onClick={onCancelEdit} className="text-gray-500 hover:text-gray-700 text-xs">Cancelar</button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="text-xs py-1">{item.description}</td>
      <td className="text-center text-xs">{parseFloat(item.quantity).toFixed(2)}</td>
      <td className="text-right text-xs pr-2">${parseFloat(item.unitPrice).toFixed(2)}</td>
      <td className="text-right text-xs pr-2 font-medium">${parseFloat(item.lineTotal).toFixed(2)}</td>
      <td className="text-center">
        <button onClick={() => onUpdate(item)} className="text-blue-600 hover:text-blue-800 text-xs mr-1">Editar</button> 
         <button onClick={() => onRemove(item.id)} className="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
         
      </td>
    </tr>
  );
};


const FinalInvoiceComponent = ({ workId }) => {
  //   const [pdfActionLoading, setPdfActionLoading] = useState(false);
  // const [pdfActionError, setPdfActionError] = useState(null);
  const dispatch = useDispatch();
  const {
    currentInvoice,
    loading, 
    error,
    loadingPdf, 
    errorPdf,
    loadingEmail,
    emailSuccessMessage,
    errorEmail
   } = useSelector((state) => state.finalInvoice);
  const { selectedWork } = useSelector((state) => state.work);

  const [newItem, setNewItem] = useState({ description: '', quantity: 1, unitPrice: 0 });
  const [editingItemId, setEditingItemId] = useState(null);
  const [editFormData, setEditFormData] = useState({ description: '', quantity: 0, unitPrice: 0 });
  const [recipientEmail, setRecipientEmail] = useState(''); 
  const [isEditingDiscount, setIsEditingDiscount] = useState(false); // 🆕
  const [discountValue, setDiscountValue] = useState(0); // 🆕
  const [discountReason, setDiscountReason] = useState(''); // 🆕

  // Estado para la carga y error de la descarga del PDF
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [selectedChangeOrderIds, setSelectedChangeOrderIds] = useState([]);
  
  // 🆕 Estado para el modal de Google Review
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [confirmingReview, setConfirmingReview] = useState(false);
  const [reviewConfirmMessage, setReviewConfirmMessage] = useState('');
  const [reviewConfirmError, setReviewConfirmError] = useState('');
  
  useEffect(() => {
    if (workId) {
     
      dispatch(fetchFinalInvoiceByWorkId(workId));
    }
    
    return () => {
      dispatch(clearFinalInvoiceState());
    };
  }, [dispatch, workId]);

  // 🆕 Sincronizar descuento cuando cambia currentInvoice
  useEffect(() => {
    if (currentInvoice) {
      console.log('🔄 [Component] currentInvoice actualizado:', currentInvoice);
      setDiscountValue(parseFloat(currentInvoice.discount) || 0);
      setDiscountReason(currentInvoice.discountReason || '');
    } else {
      console.log('❌ [Component] currentInvoice es null/undefined');
    }
  }, [currentInvoice]);


   const changeOrders = selectedWork?.changeOrders || [];

  // Filtrar Change Orders que son 'approved' y no están ya en la factura como extraItems
  const addableChangeOrders = useMemo(() => {
    if (!currentInvoice || !changeOrders.length) return [];

    const approvedCOs = changeOrders.filter(co => co.status === 'approved');
    const existingExtraItemDescriptions = currentInvoice.extraItems?.map(item => item.description.toLowerCase()) || [];
    
    return approvedCOs.filter(co => {
        // Crear un identificador único para el CO basado en su número o ID, y descripción
        // Este identificador debe ser similar al que se usa en el backend al agregar COs automáticamente
        const coDescriptionFragment = `Change Order #${co.changeOrderNumber || co.id?.substring(0,8)}`.toLowerCase();
        return !existingExtraItemDescriptions.some(desc => desc.includes(coDescriptionFragment));
    });
  }, [currentInvoice, changeOrders, selectedWork]); // selectedWork añadido como dependencia por si changeOrders cambia

  const handleToggleChangeOrderSelection = (coId) => {
    setSelectedChangeOrderIds(prevSelected =>
        prevSelected.includes(coId)
            ? prevSelected.filter(id => id !== coId)
            : [...prevSelected, coId]
    );
  };

  const handleAddSelectedChangeOrders = () => {
    if (!currentInvoice || selectedChangeOrderIds.length === 0) return;

    selectedChangeOrderIds.forEach(coId => {
        const co = changeOrders.find(c => c.id === coId);
        if (co) {
            const itemData = {
                description: `Change Order #${co.changeOrderNumber || co.id?.substring(0,8)}: ${co.itemDescription || co.description || 'Detalle de Orden de Cambio'}`,
                quantity: 1, // Los COs generalmente se añaden como una unidad global
                unitPrice: parseFloat(co.totalCost) || 0,
            };
            // Solo añadir si tiene un costo válido
            if (itemData.unitPrice > 0 || (itemData.unitPrice === 0 && window.confirm(`La Orden de Cambio #${co.changeOrderNumber || co.id?.substring(0,8)} tiene costo $0. ¿Añadir de todas formas?`))) {
                 dispatch(addExtraItemToInvoice({ finalInvoiceId: currentInvoice.id, itemData }));
            } else if (itemData.unitPrice < 0) {
                 alert(`La Orden de Cambio #${co.changeOrderNumber || co.id?.substring(0,8)} tiene un costo negativo y no se puede añadir.`);
            }
        }
    });
    setSelectedChangeOrderIds([]); // Limpiar selección después de añadir
  };

  const handleCreateInvoice = () => {
    if (window.confirm('¿Seguro que quieres generar la factura final para esta obra?')) {
      dispatch(createFinalInvoice(workId));
    }
  };

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    const isNumeric = ['quantity', 'unitPrice'].includes(name);
    setNewItem(prev => ({ ...prev, [name]: isNumeric ? parseFloat(value) || 0 : value }));
  };

  const handleAddExtraItem = (e) => {
    e.preventDefault();
    if (!newItem.description || newItem.quantity <= 0 || newItem.unitPrice <= 0) {
      alert('Completa descripción, cantidad (>0) y precio unitario (>0) del item extra.');
      return;
    }
    if (currentInvoice) {
      dispatch(addExtraItemToInvoice({ finalInvoiceId: currentInvoice.id, itemData: newItem }));
      setNewItem({ description: '', quantity: 1, unitPrice: 0 }); 
    }
  };


  const handleEditClick = (item) => {
    setEditingItemId(item.id);
    setEditFormData({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice });
  };
  const handleCancelEdit = () => {
    setEditingItemId(null);
  };
  const handleEditFormChange = (e) => {
     const { name, value } = e.target;
     const isNumeric = ['quantity', 'unitPrice'].includes(name);
     setEditFormData(prev => ({ ...prev, [name]: isNumeric ? parseFloat(value) || 0 : value }));
  };
  const handleSaveEdit = (itemId) => {
    dispatch(updateExtraItem({ itemId, itemData: editFormData }));
    console.warn("Update item functionality not fully implemented yet.");
    setEditingItemId(null); 
  };
  const handleRemoveItem = (itemId) => {
    if (window.confirm('¿Seguro que quieres eliminar este item extra?')) {
       dispatch(removeExtraItem(itemId));
      console.warn("Remove item functionality not fully implemented yet.");
    }
  };
 

   const handleMarkAsPaid = () => {
    if (currentInvoice && window.confirm('¿Marcar esta factura como Pagada?')) {
        // Generar fecha local
        const now = new Date();
        const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        dispatch(updateFinalInvoiceStatus({
            finalInvoiceId: currentInvoice.id,
            statusData: { status: 'paid', paymentDate: localDate }
        }));
    }
};

// 🆕 Handlers para descuento
const handleEditDiscount = () => {
  setIsEditingDiscount(true);
};

const handleCancelDiscountEdit = () => {
  setIsEditingDiscount(false);
  setDiscountValue(parseFloat(currentInvoice.discount) || 0); // Restaurar valor original
  setDiscountReason(currentInvoice.discountReason || ''); // Restaurar razón original
};

const handleSaveDiscount = () => {
  if (currentInvoice) {
    const discount = parseFloat(discountValue) || 0;
    if (discount < 0) {
      alert('El descuento no puede ser negativo.');
      return;
    }
    dispatch(updateFinalInvoiceDiscount({ 
      finalInvoiceId: currentInvoice.id, 
      discount,
      discountReason: discountReason.trim() || null
    }));
    setIsEditingDiscount(false);
  }
};

const handleGeneratePdf = () => {
    if (currentInvoice) {
      dispatch(generateFinalInvoicePdf(currentInvoice.id));
    }
  };

   const handlePreviewPdf = async () => {
    if (!currentInvoice?.id) return;

    setIsPreviewing(true);
    const previewUrl = `/final-invoice/${currentInvoice.id}/preview-pdf`;

    try {
      const response = await api.get(previewUrl, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const objectUrl = window.URL.createObjectURL(blob);
      setPdfBlobUrl(objectUrl);
      setShowPdfModal(true);
    } catch (err) {
      console.error("Error al generar la vista previa del PDF:", err);
      alert("No se pudo generar la vista previa del PDF. Por favor, inténtalo de nuevo.");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleClosePdfModal = () => {
    if (pdfBlobUrl) {
      window.URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    setShowPdfModal(false);
  };

  const handleDownloadPdfFromModal = () => {
    if (!pdfBlobUrl) return;
    
    const link = document.createElement('a');
    link.href = pdfBlobUrl;
    link.download = `Final_Invoice_${currentInvoice.invoiceNumber || currentInvoice.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  

  // 🆕 Función para mostrar el modal de confirmación con opción de review
  const handleSendEmail = () => {
    console.log("handleSendEmail - currentInvoice:", currentInvoice);
    if (currentInvoice && currentInvoice.id && currentInvoice.pdfPath) {
      if (recipientEmail && !/\S+@\S+\.\S+/.test(recipientEmail)) {
        alert('Por favor, ingresa un correo electrónico válido o déjalo vacío para usar el del cliente.');
        return;
      }
      // Mostrar modal en lugar de window.confirm
      setShowReviewModal(true);
    } else {
      console.error("Error: No se puede enviar email porque la información de la factura (ID o PDF) no está cargada.", currentInvoice);
      alert("Error: No se puede enviar el correo. Asegúrate de que la factura y su PDF estén generados.");
    }
  };

  // 🆕 Función que se ejecuta cuando se confirma el envío desde el modal
  const handleConfirmSendEmail = async (includeGoogleReview, selectedEmails) => {
    try {
      console.log("Dispatching emailFinalInvoice with ID:", currentInvoice.id);
      console.log("Include Google Review:", includeGoogleReview);
      console.log("Selected Emails:", selectedEmails);
      
      await dispatch(emailFinalInvoice({ 
        finalInvoiceId: currentInvoice.id, 
        recipientEmails: selectedEmails, // Array de emails seleccionados
        includeGoogleReview 
      }));
      
      // ✅ Refresh work data to update status in UI
      if (selectedWork?.idWork) {
        console.log("🔄 Refreshing work data after email sent");
        await dispatch(fetchWorkById(selectedWork.idWork));
      }
      
      setRecipientEmail('');
      setShowReviewModal(false);
    } catch (error) {
      console.error("Error sending email:", error);
      setShowReviewModal(false);
    }
  };

  const reviewStatus = useMemo(() => {
    const notes = selectedWork?.workNotes || [];
    const hasManualConfirmation = notes.some((note) =>
      typeof note?.message === 'string' && note.message.includes('[MANUAL] Google Review confirmed')
    );
    const hasClickSignal = notes.some((note) =>
      typeof note?.message === 'string' && note.message.includes('[AUTO] Google Review link clicked')
    );

    return {
      hasManualConfirmation,
      hasClickSignal,
      isDone: hasManualConfirmation || hasClickSignal,
    };
  }, [selectedWork?.workNotes]);

  const handleConfirmGoogleReview = async () => {
    if (!workId) {
      setReviewConfirmError('No se pudo determinar la obra para confirmar review.');
      return;
    }

    const accepted = window.confirm('Confirmar que el cliente ya dejó su Google Review?');
    if (!accepted) return;

    setConfirmingReview(true);
    setReviewConfirmMessage('');
    setReviewConfirmError('');

    try {
      const response = await api.post(`/final-invoice/work/${workId}/google-review/confirm`);
      setReviewConfirmMessage(response?.data?.message || 'Google Review confirmado correctamente.');

      if (selectedWork?.idWork) {
        await dispatch(fetchWorkById(selectedWork.idWork));
      }
    } catch (err) {
      const message = err?.response?.data?.message || 'Error al confirmar Google Review.';
      setReviewConfirmError(message);
    } finally {
      setConfirmingReview(false);
    }
  };

 // Limpiar mensajes de email al desmontar o cuando cambie el mensaje
 useEffect(() => {
    // Si hay un mensaje, limpiarlo después de un tiempo (ej: 5 segundos)
    let timer;
    if (emailSuccessMessage || errorEmail) {
        timer = setTimeout(() => {
            dispatch(clearEmailMessage());
        }, 5000); // 5 segundos
    }
    // Limpieza al desmontar
    return () => clearTimeout(timer);
  }, [emailSuccessMessage, errorEmail, dispatch]);





  // --- Renderizado ---
  if (loading) return <p className="text-blue-600">Cargando factura final...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  // Si no hay factura, mostrar botón para crearla
  if (!currentInvoice) {
    return (
      <div className="text-center">
        <p className="mb-4 text-gray-600">Aún no se ha generado la factura final para esta obra.</p>
        <button
          onClick={handleCreateInvoice}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          disabled={loading} // Deshabilitar mientras carga
        >
          {loading ? 'Generando...' : 'Generar Factura Final'}
        </button>
      </div>
    );
  }

  // Si la factura existe, mostrar detalles
  const budget = selectedWork?.budget; // Acceder al budget desde el work seleccionado

  return (
    <div className="space-y-6">
      {/* Resumen Financiero */}
      <div className="bg-gray-50 p-4 rounded border border-gray-200">
        <h3 className="text-lg font-semibold mb-3 border-b pb-2">Invoice Final #{currentInvoice.invoiceNumber || currentInvoice.id}</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-gray-600">Total Budget:</span>
          <span className="text-right font-medium">${parseFloat(currentInvoice.originalBudgetTotal || 0).toFixed(2)}</span>

          <span className="text-gray-600">Initial Payment:</span>
          <span className="text-right font-medium text-green-600">-${parseFloat(currentInvoice.initialPaymentMade || 0).toFixed(2)}</span>

          <span className="text-gray-600">Subtotal Items Extras:</span>
          <span className="text-right font-medium text-orange-600">+${parseFloat(currentInvoice.subtotalExtras || 0).toFixed(2)}</span>

          {/* 🆕 DESCUENTO */}
          <span className="text-gray-600">Descuento:</span>
          <div className="text-right">
            {isEditingDiscount ? (
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-24 px-2 py-1 text-sm border rounded"
                    min="0"
                    step="0.01"
                    placeholder="$0.00"
                  />
                  <button onClick={handleSaveDiscount} className="text-green-600 hover:text-green-800 text-xs font-bold px-2">
                    ✓
                  </button>
                  <button onClick={handleCancelDiscountEdit} className="text-gray-500 hover:text-gray-700 text-xs font-bold px-2">
                    ✕
                  </button>
                </div>
                <textarea
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  className="w-full px-2 py-1 text-xs border rounded resize-none"
                  rows="2"
                  placeholder="Motivo del descuento (opcional)..."
                />
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-600">-${parseFloat(currentInvoice.discount || 0).toFixed(2)}</span>
                  <button 
                    onClick={handleEditDiscount} 
                    className="text-blue-600 hover:text-blue-800 text-xs"
                    title="Editar descuento"
                  >
                    ✏️
                  </button>
                </div>
                {currentInvoice.discountReason && (
                  <span className="text-xs text-gray-500 italic text-right max-w-xs">
                    {currentInvoice.discountReason}
                  </span>
                )}
              </div>
            )}
          </div>

          <span className="text-gray-800 font-bold text-base border-t pt-1 mt-1">Monto Final Pendiente:</span>
          <span className="text-right font-bold text-base border-t pt-1 mt-1">${parseFloat(currentInvoice.finalAmountDue || 0).toFixed(2)}</span>

          <span className="text-gray-600 mt-2">State:</span>
          <span className={`text-right font-semibold mt-2 ${
            currentInvoice.status === 'paid' ? 'text-green-700' :
            currentInvoice.status === 'pending' ? 'text-orange-700' :
            currentInvoice.status === 'cancelled' ? 'text-red-700' : 'text-gray-700'
          }`}>
            {currentInvoice.status?.replace('_', ' ').toUpperCase()}
          </span>
           {currentInvoice.status === 'paid' && currentInvoice.paymentDate && (
             <>
                <span className="text-gray-600 text-xs">Fecha Pago:</span>
                <span className="text-right text-xs">{new Date(currentInvoice.paymentDate + 'T00:00:00').toLocaleDateString()}</span>
             </>
           )}
        </div>
         {/* Botón Marcar como Pagada */}
         {/* {currentInvoice.status === 'pending' && (
            <div className="mt-4 text-center">
                <button
                    onClick={handleMarkAsPaid}
                    className="bg-teal-500 hover:bg-teal-600 text-white text-sm py-1 px-3 rounded"
                    disabled={loading}
                >
                    Marcar como Pagada
                </button>
            </div>
        )} */}
      </div>

      {/* Items Extras */}
      <div className="bg-gray-50 p-4 rounded border border-gray-200">
        <h3 className="text-lg font-semibold mb-3 border-b pb-2">Items Extras Añadidos</h3>
        {currentInvoice.extraItems && currentInvoice.extraItems.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-200 text-xs uppercase">
                <th className="py-1 px-2">Descripción</th>
                <th className="text-center">Cant.</th>
                <th className="text-right pr-2">P. Unit.</th>
                <th className="text-right pr-2">Total</th>
                <th className="text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {currentInvoice.extraItems.map(item => (
                <ExtraItemRow
                  key={item.id}
                  item={item}
                  isEditing={editingItemId === item.id}
                  editFormData={editFormData}
                  onUpdate={handleEditClick} // Cambiado para iniciar edición
                  onRemove={handleRemoveItem}
                  onSave={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onEditFormChange={handleEditFormChange}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 text-sm">No hay items extras añadidos.</p>
        )}

        {/* Formulario para añadir nuevo item extra (solo si no está pagada/cancelada) */}
        {currentInvoice.status !== 'paid' && currentInvoice.status !== 'cancelled' && (
          <form onSubmit={handleAddExtraItem} className="mt-4 pt-4 border-t space-y-2">
            <h4 className="text-md font-semibold">Añadir Nuevo Item Extra</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
              <div className="md:col-span-2">
                <label htmlFor="newDesc" className="block text-xs font-medium text-gray-600">Descripción</label>
                <input type="text" id="newDesc" name="description" value={newItem.description} onChange={handleNewItemChange} className="input-style w-full" required />
              </div>
              <div>
                <label htmlFor="newQty" className="block text-xs font-medium text-gray-600">Cantidad</label>
                <input type="number" id="newQty" name="quantity" value={newItem.quantity} onChange={handleNewItemChange} className="input-style w-full" min="0.01" step="0.01" required />
              </div>
              <div>
                <label htmlFor="newPrice" className="block text-xs font-medium text-gray-600">Precio Unit.</label>
                <input type="number" id="newPrice" name="unitPrice" value={newItem.unitPrice} onChange={handleNewItemChange} className="input-style w-full" min="0.01" step="0.01" required />
              </div>
            </div>
             <button type="submit" className="button-add-item mt-2 bg-blue-500 p-2 rounded text-sm text-white" disabled={loading}>
               {loading ? 'Añadiendo...' : 'Añadir Item '}
             </button>
          </form>
        )}
      {/* SECCIÓN PARA AÑADIR ÓRDENES DE CAMBIO */}
      {currentInvoice && currentInvoice.status !== 'paid' && currentInvoice.status !== 'cancelled' && addableChangeOrders.length > 0 && (
        <div className="bg-gray-50 p-4 rounded border border-gray-200 mt-6">
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">Añadir Change Orders Aprobadas</h3>
            <div className="space-y-2">
                {addableChangeOrders.map(co => (
                    <div key={co.id} className="flex items-center justify-between p-2 border rounded bg-white hover:bg-gray-100">
                        <div>
                            <label htmlFor={`co-${co.id}`} className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    id={`co-${co.id}`}
                                    checked={selectedChangeOrderIds.includes(co.id)}
                                    onChange={() => handleToggleChangeOrderSelection(co.id)}
                                    className="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm">
                                    CO #{co.changeOrderNumber || co.id?.substring(0,8)}: {co.itemDescription || co.description || 'Sin descripción específica'}
                                    <span className="text-xs text-gray-600 ml-2 font-medium">(Total: ${parseFloat(co.totalCost || 0).toFixed(2)})</span>
                                </span>
                            </label>
                        </div>
                    </div>
                ))}
            </div>
            {selectedChangeOrderIds.length > 0 && (
                <button
                    onClick={handleAddSelectedChangeOrders}
                    className="button-add-item mt-4 bg-orange-500 hover:bg-orange-600" // Estilo similar al de añadir item, o uno nuevo
                    disabled={loading} // Puedes usar el 'loading' general o uno específico si lo creas
                >
                    {loading ? 'Procesando...' : `Añadir ${selectedChangeOrderIds.length} Órden(es) de Cambio Seleccionada(s)`}
                </button>
            )}
        </div>
      )}

      </div>

    {/* --- Opciones de Factura --- */}
    <div className="bg-gray-50 p-4 rounded border border-gray-200 mt-6">
         <h3 className="text-lg font-semibold mb-3 border-b pb-2">Opciones de Factura</h3>
         <div className="space-y-3">

            {/* Generar/Actualizar PDF */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleGeneratePdf}
                className="button-standard bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded disabled:opacity-50"
                disabled={loadingPdf || isPreviewing}
              >
                {loadingPdf ? 'Procesando...' : (currentInvoice?.pdfPath ? 'Actualizar Invoice PDF' : 'Generar Invoice PDF')}
              </button>
              
              {/* Ver y Descargar PDF */}
              {currentInvoice?.id && (
                <button
                  onClick={handlePreviewPdf}
                  className="button-standard bg-green-600 hover:bg-green-700 text-white text-sm py-1 px-3 rounded disabled:opacity-50"
                  disabled={loadingPdf || isPreviewing}
                >
                  {isPreviewing ? 'Cargando...' : '📄 Ver y Descargar Invoice'}
                </button>
              )}
            </div>
            {errorPdf && <p className="text-red-500 text-xs mt-1 ml-2">{errorPdf}</p>}





            {/* Enviar por Email */}
            {currentInvoice?.pdfPath && (
               <div className="pt-3 border-t">
                  {/* ... (código existente para enviar email) ... */}
                  <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Enviar PDF por Email (Opcional: dejar vacío para usar email del cliente)
                  </label>
                  <div className="flex items-center space-x-2">
                     <input
                        type="email"
                        id="recipientEmail"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="ejemplo@dominio.com"
                        className="input-style flex-grow text-sm"
                        disabled={loadingEmail || loadingPdf}
                     />
                     <button
                        onClick={handleSendEmail}
                        className="button-standard bg-teal-500 hover:bg-teal-600 text-white text-sm py-1 px-3 rounded disabled:opacity-50"
                        disabled={loadingEmail || loadingPdf || !currentInvoice?.pdfPath} 
                     >
                        {loadingEmail ? 'Enviando...' : 'Enviar'}
                     </button>
                  </div>
                  {emailSuccessMessage && <p className="text-green-600 text-xs mt-1">{emailSuccessMessage}</p>}
                  {errorEmail && <p className="text-red-500 text-xs mt-1">{errorEmail}</p>}
               </div>
            )}

            {/* Confirmación manual de Google Review */}
            <div className="pt-3 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seguimiento de Google Review
              </label>

              {reviewStatus.isDone ? (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                  {reviewStatus.hasManualConfirmation
                    ? 'Review confirmado manualmente.'
                    : 'Cliente ya abrió el link de review.'}
                </p>
              ) : (
                <button
                  onClick={handleConfirmGoogleReview}
                  className="button-standard bg-amber-500 hover:bg-amber-600 text-white text-sm py-1 px-3 rounded disabled:opacity-50"
                  disabled={confirmingReview}
                >
                  {confirmingReview ? 'Confirmando...' : 'Marcar Review Confirmado'}
                </button>
              )}

              {reviewConfirmMessage && <p className="text-green-600 text-xs mt-1">{reviewConfirmMessage}</p>}
              {reviewConfirmError && <p className="text-red-500 text-xs mt-1">{reviewConfirmError}</p>}
            </div>
         </div>
      </div>

      {/* Modal para ver y descargar PDF */}
      {showPdfModal && pdfBlobUrl && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center"
          style={{ padding: '20px' }}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl flex flex-col"
            style={{ 
              width: '95vw', 
              height: '95vh',
              maxWidth: '1400px',
              maxHeight: '900px'
            }}
          >
            {/* Header del Modal */}
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-lg">
              <h2 className="text-xl font-bold text-gray-800">
                Final Invoice #{currentInvoice.invoiceNumber || currentInvoice.id}
              </h2>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleDownloadPdfFromModal}
                  className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center space-x-2"
                >
                  <span>⬇</span>
                  <span>Descargar Invoice #{currentInvoice.invoiceNumber || currentInvoice.id}</span>
                </button>
                <button
                  onClick={handleClosePdfModal}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center text-2xl font-bold transition-colors"
                  title="Cerrar"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* Contenido del Modal - PDF */}
            <div className="flex-1 overflow-hidden bg-gray-100">
              <iframe
                src={pdfBlobUrl}
                className="w-full h-full border-0"
                title="Final Invoice PDF"
                style={{ minHeight: '600px' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 🆕 Modal de Solicitud de Google Review */}
      <GoogleReviewRequestModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onConfirm={handleConfirmSendEmail}
        primaryEmail={
          recipientEmail || 
          selectedWork?.budget?.applicantEmail || 
          selectedWork?.Permit?.applicantEmail || 
          ''
        }
        notificationEmails={selectedWork?.Permit?.notificationEmails || []}
        clientName={selectedWork?.budget?.applicantName || selectedWork?.Permit?.applicantName || 'Cliente'}
      />
    </div>
  );
};


export default FinalInvoiceComponent;