import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchWorkNotes,
  fetchWorkStats,
  createWorkNote,
  updateWorkNote,
  deleteWorkNote,
} from '../../Redux/Actions/workNoteActions';
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
import { formatDateTimeInDisplayTz } from '../../utils/timezoneDisplay';

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

const WorkNotesModal = ({ work, onClose }) => {
  const dispatch = useDispatch();
  const { notesByWork, statsByWork, loading, creatingNote } = useSelector(
    (state) => state.workNote
  );
  const { user, currentStaff } = useSelector((state) => state.auth);

  const staff = currentStaff || user;
  const userRole = staff?.role || '';
  const userId = staff?.id;

  const notes = notesByWork[work.idWork] || [];
  const stats = statsByWork[work.idWork] || {};

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
  });

  // Cargar notas al abrir el modal
  useEffect(() => {
    if (work?.idWork) {
      dispatch(fetchWorkNotes(work.idWork));
      dispatch(fetchWorkStats(work.idWork));
    }
  }, [dispatch, work?.idWork]);

  // Filtrar notas - asegurar que notes sea un array
  const filteredNotes = Array.isArray(notes) ? notes.filter((note) => {
    if (filterType !== 'all' && note.noteType !== filterType) return false;
    if (filterPriority !== 'all' && note.priority !== filterPriority) return false;
    return true;
  }) : [];

  // Manejar submit del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingNote) {
      // Actualizar nota existente
      const result = await dispatch(
        updateWorkNote(editingNote.id, work.idWork, formData)
      );
      if (result.success) {
        setEditingNote(null);
        resetForm();
      }
    } else {
      // Crear nueva nota
      const result = await dispatch(
        createWorkNote(work.idWork, {
          ...formData,
          relatedStatus: work.status, // Capturar estado actual del Work
        })
      );
      if (result.success) {
        setShowAddForm(false);
        resetForm();
      }
    }
  };

  const resetForm = () => {
    setFormData({
      message: '',
      noteType: 'follow_up',
      priority: 'medium',
      isResolved: false,
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
      await dispatch(deleteWorkNote(noteId, work.idWork));
    }
  };

  const formatDate = (dateString) => {
    return formatDateTimeInDisplayTz(dateString);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6 rounded-t-lg flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="h-7 w-7" />
              Seguimiento de Obra
            </h2>
            <p className="text-blue-100 mt-1">
              📍 {work.propertyAddress || work.name}
            </p>
            {stats.totalNotes > 0 && (
              <div className="mt-2 flex gap-4 text-sm">
                <span>📝 {stats.totalNotes} notas</span>
                {stats.unresolvedProblems > 0 && (
                  <span className="text-red-300">
                    ⚠️ {stats.unresolvedProblems} problemas pendientes
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-700 rounded p-1"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Filtros y acciones */}
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center flex-wrap gap-3">
          <div className="flex gap-3 items-center flex-wrap">
            <FunnelIcon className="h-5 w-5 text-gray-500" />
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm"
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
              className="px-3 py-1.5 border rounded text-sm"
            >
              <option value="all">Todas las prioridades</option>
              {Object.entries(priorityLevels).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingNote(null);
              resetForm();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Nueva Nota
          </button>
        </div>

        {/* Formulario de nueva nota */}
        {showAddForm && (
          <div className="p-4 bg-yellow-50 border-b">
            <h3 className="font-semibold mb-3">
              {editingNote ? '✏️ Editar Nota' : '➕ Nueva Nota'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Tipo de Nota
                  </label>
                  <select
                    value={formData.noteType}
                    onChange={(e) =>
                      setFormData({ ...formData, noteType: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
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
                  <label className="block text-sm font-medium mb-1">
                    Prioridad
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
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
                <label className="block text-sm font-medium mb-1">
                  Mensaje
                </label>
                <MentionTextarea
                  value={formData.message}
                  onChange={(newValue) =>
                    setFormData({ ...formData, message: newValue })
                  }
                  placeholder="Escribe tu nota aquí... Usa @ para mencionar a alguien"
                  rows={3}
                  maxLength={5000}
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
                  <label htmlFor="isResolved" className="text-sm">
                    Marcar como resuelto
                  </label>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingNote(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingNote}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
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
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Cargando notas...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ChatBubbleLeftRightIcon className="h-16 w-16 mx-auto mb-3 text-gray-300" />
              <p>No hay notas de seguimiento aún.</p>
              <p className="text-sm mt-1">
                Haz clic en "Nueva Nota" para agregar una.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotes.map((note, index) => {
                const noteTypeInfo = noteTypes[note.noteType] || noteTypes.other;
                const priorityInfo = priorityLevels[note.priority] || priorityLevels.medium;
                const canEdit = userRole === 'admin' || note.staffId === userId;

                return (
                  <div
                    key={note.id}
                    className={`border-l-4 border-${noteTypeInfo.color}-500 bg-white p-4 rounded-r-lg shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{noteTypeInfo.icon}</span>
                        <div>
                          <span className="font-semibold text-gray-900">
                            {noteTypeInfo.label}
                          </span>
                          <span
                            className={`ml-2 px-2 py-0.5 text-xs rounded-full bg-${priorityInfo.color}-100 text-${priorityInfo.color}-700`}
                          >
                            {priorityInfo.label}
                          </span>
                          {note.isResolved && (
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                              ✓ Resuelto
                            </span>
                          )}
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex gap-2">
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
                        </div>
                      )}
                    </div>

                    <MessageWithMentions 
                      message={note.message}
                      className="text-gray-700 mb-3"
                    />

                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>
                        👤 {note.author?.name || 'Usuario'}
                        {note.work?.propertyAddress && (
                          <span className="ml-2">
                            📍 {note.work.propertyAddress}
                          </span>
                        )}
                        {note.relatedStatus && (
                          <span className="ml-2">
                            📋 Estado: {note.relatedStatus}
                          </span>
                        )}
                      </span>
                      <span>🕒 {formatDate(note.createdAt)}</span>
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

export default WorkNotesModal;
