import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchBudgetNotes,
  fetchBudgetStats,
  createBudgetNote,
  updateBudgetNote,
  deleteBudgetNote,
  setReminder, // 🆕 Para recordatorios
  markNoteAsRead, // 🆕 Para marcar como leída
  completeReminder, // 🆕 Para completar recordatorios
} from '../../Redux/Actions/budgetNoteActions';
import {
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  PlusIcon,
  FunnelIcon,
  TrashIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import MentionTextarea from '../Common/MentionTextarea';
import MessageWithMentions from '../Common/MessageWithMentions';

// 📋 Tipos de nota con iconos y colores
const noteTypes = {
  follow_up: { label: 'Seguimiento', icon: '📞', color: 'blue' },
  client_contact: { label: 'Contacto Cliente', icon: '💬', color: 'green' },
  status_change: { label: 'Cambio Estado', icon: '📋', color: 'purple' },
  problem: { label: 'Problema', icon: '⚠️', color: 'red' },
  progress: { label: 'Avance', icon: '✅', color: 'emerald' },
  internal: { label: 'Nota Interna', icon: '🔒', color: 'gray' },
  payment: { label: 'Pago', icon: '💰', color: 'yellow' },
  other: { label: 'Otro', icon: '📝', color: 'indigo' },
};

const priorityLevels = {
  low: { label: 'Baja', color: 'gray' },
  medium: { label: 'Media', color: 'blue' },
  high: { label: 'Alta', color: 'orange' },
  urgent: { label: 'Urgente', color: 'red' },
};

const BudgetNotesModal = ({ budget, onClose, onAlertsChange }) => {
  const dispatch = useDispatch();
  const { notesByBudget, statsByBudget, loading, creatingNote } = useSelector(
    (state) => state.budgetNote
  );
  const { user, currentStaff } = useSelector((state) => state.auth);

  const staff = currentStaff || user;
  const userRole = staff?.role || '';
  const userId = staff?.id;

  const notes = notesByBudget[budget.idBudget] || [];
  const stats = statsByBudget[budget.idBudget] || {};

  // Estados locales
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [editingNote, setEditingNote] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    message: '',
    noteType: 'follow_up',
    priority: 'medium',
    isResolved: false,
    hasReminder: false, // 🆕 Si tiene recordatorio
    reminderDate: '', // 🆕 Fecha del recordatorio
    reminderTime: '', // 🆕 Hora del recordatorio
  });

  // Cargar notas al abrir el modal
  useEffect(() => {
    if (budget?.idBudget) {
      dispatch(fetchBudgetNotes(budget.idBudget));
      dispatch(fetchBudgetStats(budget.idBudget));
    }
  }, [dispatch, budget?.idBudget]);

  // ✅ Crear una "nota inicial" virtual si el budget tiene generalNotes
  const initialNote = budget?.generalNotes?.trim() ? {
    id: 'initial-note',
    message: budget.generalNotes,
    noteType: 'other',
    priority: 'medium',
    createdAt: budget.createdAt || budget.date,
    staffId: null,
    staffName: 'Sistema',
    isInitialNote: true, // Marcador especial
  } : null;

  // Filtrar notas - asegurar que notes sea un array e incluir la nota inicial si existe
  const allNotes = initialNote ? [initialNote, ...notes] : notes;
  
  const filteredNotes = Array.isArray(allNotes) ? allNotes.filter((note) => {
    // La nota inicial siempre se muestra (no se filtra)
    if (note.isInitialNote) return true;
    if (filterType !== 'all' && note.noteType !== filterType) return false;
    if (filterPriority !== 'all' && note.priority !== filterPriority) return false;
    return true;
  }) : [];

  // Manejar submit del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const noteData = {
      message: formData.message,
      noteType: formData.noteType,
      priority: formData.priority,
      isResolved: formData.isResolved,
    };
    
    let createdNoteId = null;
    
    if (editingNote) {
      // Actualizar nota existente
      const result = await dispatch(
        updateBudgetNote(editingNote.id, budget.idBudget, noteData)
      );
      if (result.success) {
        createdNoteId = editingNote.id;
        
        // Si tiene recordatorio, configurarlo
        if (formData.hasReminder && formData.reminderDate && formData.reminderTime) {
          const [month, day, year] = formData.reminderDate.split('/');
          const reminderDateTime = new Date(`${year}-${month}-${day}T${formData.reminderTime}`);
          
          await dispatch(setReminder(createdNoteId, {
            reminderDate: reminderDateTime.toISOString(),
            reminderFor: [userId]
          }));
        }
        
        setEditingNote(null);
        resetForm();
      }
    } else {
      // Crear nueva nota
      const result = await dispatch(
        createBudgetNote(budget.idBudget, {
          ...noteData,
          relatedStatus: budget.status,
        })
      );
      
      if (result.success) {
        createdNoteId = result.data.note?.id;
        
        // Si tiene recordatorio, configurarlo DESPUÉS de crear la nota
        if (createdNoteId && formData.hasReminder && formData.reminderDate && formData.reminderTime) {
          const [month, day, year] = formData.reminderDate.split('/');
          const reminderDateTime = new Date(`${year}-${month}-${day}T${formData.reminderTime}`);
          
          await dispatch(setReminder(createdNoteId, {
            reminderDate: reminderDateTime.toISOString(),
            reminderFor: [userId]
          }));
        }
        
        setShowAddForm(false);
        resetForm();
        
        // Recargar notas para ver el recordatorio
        dispatch(fetchBudgetNotes(budget.idBudget));
      }
    }
  };

  const resetForm = () => {
    setFormData({
      message: '',
      noteType: 'follow_up',
      priority: 'medium',
      isResolved: false,
      hasReminder: false,
      reminderDate: '',
      reminderTime: '',
    });
  };

  const handleEdit = (note) => {
    setEditingNote(note);
    setFormData({
      message: note.message,
      noteType: note.noteType,
      priority: note.priority,
      isResolved: note.isResolved || false,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (noteId) => {
    if (window.confirm('¿Estás seguro de eliminar esta nota?')) {
      await dispatch(deleteBudgetNote(noteId, budget.idBudget));
    }
  };

  // 🆕 Handler para completar recordatorio
  const handleCompleteReminder = async (noteId) => {
    if (window.confirm('¿Marcar este recordatorio como completado?')) {
      const result = await dispatch(completeReminder(noteId));
      if (result.success) {
        dispatch(fetchBudgetNotes(budget.idBudget));
        
        // Notificar al padre que las alertas cambiaron
        if (onAlertsChange) {
          onAlertsChange();
        }
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-4 sm:my-8 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 sm:p-5 rounded-t-lg flex justify-between items-start flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
              <span className="truncate">Seguimiento de Presupuesto</span>
            </h2>
            <p className="text-blue-100 mt-1 text-xs sm:text-sm truncate">
              📍 {budget.propertyAddress || budget.name} - #{budget.idBudget}
            </p>
            {stats.totalNotes > 0 && (
              <div className="mt-1 flex flex-wrap gap-2 sm:gap-3 text-xs">
                <span>📝 {stats.totalNotes} notas</span>
                {stats.unresolvedProblems > 0 && (
                  <span className="text-red-300">
                    ⚠️ {stats.unresolvedProblems} problemas
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-700 rounded p-1 ml-2 flex-shrink-0"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Filtros y acciones */}
        <div className="p-3 border-b bg-gray-50 flex-shrink-0">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
            <div className="flex gap-2 items-center flex-wrap">
              <FunnelIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2 py-1.5 border rounded text-xs flex-1 sm:flex-initial sm:min-w-[140px]"
            >
              <option value="all">Todos los tipos</option>
              {Object.entries(noteTypes).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.icon} {value.label}
                </option>
              ))}
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-2 py-1.5 border rounded text-xs flex-1 sm:flex-initial sm:min-w-[140px]"
            >
              <option value="all">Todas las prioridades</option>
              {Object.entries(priorityLevels).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setEditingNote(null);
                resetForm();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded flex items-center justify-center gap-2 text-xs sm:text-sm w-full sm:w-auto"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Nueva Nota</span>
            </button>
          </div>
          </div>
        </div>

        {/* Formulario de nueva nota */}
        {showAddForm && (
          <div className="p-3 bg-yellow-50 border-b flex-shrink-0 overflow-y-auto" style={{ maxHeight: '50vh' }}>
            <h3 className="font-semibold mb-2 text-sm">
              {editingNote ? '✏️ Editar Nota' : '➕ Nueva Nota'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Tipo de Nota
                  </label>
                  <select
                    value={formData.noteType}
                    onChange={(e) =>
                      setFormData({ ...formData, noteType: e.target.value })
                    }
                    className="w-full px-2 py-1.5 border rounded text-sm"
                    required
                  >
                    {Object.entries(noteTypes).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.icon} {value.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Prioridad
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="w-full px-2 py-1.5 border rounded text-sm"
                    required
                  >
                    {Object.entries(priorityLevels).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Mensaje
                </label>
                <MentionTextarea
                  value={formData.message}
                  onChange={(newValue) =>
                    setFormData({ ...formData, message: newValue })
                  }
                  placeholder="Escribe tu nota aquí... Usa @ para mencionar a alguien"
                  rows={2}
                  maxLength={5000}
                  className="text-sm"
                />
              </div>

              {formData.noteType === 'problem' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isResolved"
                    checked={formData.isResolved}
                    onChange={(e) =>
                      setFormData({ ...formData, isResolved: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <label htmlFor="isResolved" className="text-xs">
                    Marcar como resuelto
                  </label>
                </div>
              )}

              {/* 🆕 RECORDATORIO */}
              <div className="border-t pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="hasReminder"
                    checked={formData.hasReminder}
                    onChange={(e) =>
                      setFormData({ ...formData, hasReminder: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <label htmlFor="hasReminder" className="text-xs font-medium flex items-center gap-1">
                    ⏰ Configurar recordatorio
                  </label>
                </div>

                {formData.hasReminder && (
                  <div className="bg-blue-50 p-2 rounded border border-blue-200">
                    <p className="text-xs text-blue-700 mb-2">
                      💡 Ejemplo: "Llamar al cliente en una semana"
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={formData.reminderDate ? (() => {
                            // Convertir MM/DD/YYYY a YYYY-MM-DD para el input
                            const [month, day, year] = formData.reminderDate.split('/');
                            return `${year}-${month}-${day}`;
                          })() : ''}
                          onChange={(e) => {
                            // Convertir YYYY-MM-DD a MM/DD/YYYY
                            if (e.target.value) {
                              const [year, month, day] = e.target.value.split('-');
                              setFormData({ ...formData, reminderDate: `${month}/${day}/${year}` });
                            } else {
                              setFormData({ ...formData, reminderDate: '' });
                            }
                          }}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                          required={formData.hasReminder}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Hora
                        </label>
                        <input
                          type="time"
                          value={formData.reminderTime}
                          onChange={(e) =>
                            setFormData({ ...formData, reminderTime: e.target.value })
                          }
                          className="w-full px-2 py-1.5 border rounded text-sm"
                          required={formData.hasReminder}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingNote(null);
                    resetForm();
                  }}
                  className="px-3 py-1.5 border rounded hover:bg-gray-50 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingNote}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {creatingNote
                    ? 'Guardando...'
                    : editingNote
                    ? 'Actualizar'
                    : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Timeline de notas */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Cargando notas...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No hay notas de seguimiento aún.</p>
              <p className="text-xs mt-1">
                Haz clic en "Nueva Nota" para agregar una.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note, index) => {
                const noteTypeInfo = noteTypes[note.noteType] || noteTypes.other;
                const priorityInfo = priorityLevels[note.priority] || priorityLevels.medium;
                const canEdit = !note.isInitialNote && (userRole === 'admin' || note.staffId === userId);
                
                // ✅ Estilo especial para nota inicial
                if (note.isInitialNote) {
                  return (
                    <div
                      key={note.id}
                      className="border-2 border-blue-300 bg-blue-50 p-4 rounded-lg shadow-sm"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <span className="text-2xl">📋</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-blue-900 text-sm">
                              Nota Inicial del Presupuesto
                            </span>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-200 text-blue-800">
                              Creación
                            </span>
                          </div>
                          <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                            <MessageWithMentions message={note.message} />
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            {new Date(note.createdAt).toLocaleString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={note.id}
                    className={`border-l-4 border-${noteTypeInfo.color}-500 bg-white p-3 rounded-r-lg shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span className="text-lg flex-shrink-0">{noteTypeInfo.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="font-semibold text-gray-900 text-sm">
                              {noteTypeInfo.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full bg-${priorityInfo.color}-100 text-${priorityInfo.color}-700`}
                            >
                              {priorityInfo.label}
                            </span>
                            {note.isResolved && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                                ✓ Resuelto
                              </span>
                            )}
                            {note.isReminderActive && note.reminderDate && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
                                ⏰ {new Date(note.reminderDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-1 flex-shrink-0">
                        {/* 🆕 Botón para marcar nota individual como leída (solo si NO es tuya y NO la has leído) */}
                        {note.staffId !== userId && (!note.readBy || !note.readBy.includes(userId)) ? (
                          <button
                            onClick={async () => {
                              await dispatch(markNoteAsRead(note.id));
                              
                              // Esperar un poco para que se guarde en la DB
                              await new Promise(resolve => setTimeout(resolve, 500));
                              dispatch(fetchBudgetNotes(budget.idBudget));
                              if (onAlertsChange) {
                                await onAlertsChange();
                              }
                            }}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs font-semibold"
                            title="Marcar como leída"
                          >
                            👁️ Leída
                          </button>
                        ) : note.readBy?.includes(userId) && note.staffId !== userId ? (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                            ✓ Ya leída
                          </span>
                        ) : null}
                        
                        {/* Botón para completar recordatorio (cualquiera puede completarlo) */}
                        {note.isReminderActive && (
                          <button
                            onClick={() => handleCompleteReminder(note.id)}
                            className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold"
                            title="Completar recordatorio"
                          >
                            ✓ Completar
                          </button>
                        )}
                        
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleEdit(note)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Editar"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(note.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Eliminar"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <MessageWithMentions 
                      message={note.message}
                      className="text-gray-700 mb-2 text-sm break-words"
                    />

                    {/* 🆕 Mostrar quién ha leído la nota */}
                    {note.readBy && note.readBy.length > 0 && (
                      <div className="mb-2 text-xs text-green-600 flex items-center gap-1">
                        <span>✓ Leída por:</span>
                        <span className="font-medium">
                          {note.readBy.length} {note.readBy.length === 1 ? 'persona' : 'personas'}
                          {note.readBy.includes(userId) && ' (incluyéndote)'}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs text-gray-500">
                      <span className="break-words">
                        👤 {note.author?.name || 'Usuario'}
                        {note.relatedStatus && (
                          <span className="ml-2">
                            📋 {note.relatedStatus}
                          </span>
                        )}
                      </span>
                      <span className="whitespace-nowrap">🕒 {formatDate(note.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BudgetNotesModal;
