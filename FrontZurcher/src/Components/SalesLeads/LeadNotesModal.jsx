import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  createLeadNote,
  fetchLeadNotes,
  updateLeadNote,
  deleteLeadNote,
  markLeadNoteAsRead
} from '../../Redux/Actions/salesLeadActions';
import {
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  PlusIcon,
  TrashIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import MentionTextarea from '../Common/MentionTextarea';

// 📋 Tipos de nota
const noteTypes = {
  initial_contact: { label: 'Primer Contacto', icon: '📞', color: 'blue' },
  follow_up: { label: 'Seguimiento', icon: '🔄', color: 'cyan' },
  quote_sent: { label: 'Cotización Enviada', icon: '💵', color: 'purple' },
  meeting: { label: 'Reunión/Visita', icon: '🤝', color: 'green' },
  email: { label: 'Email', icon: '✉️', color: 'indigo' },
  phone_call: { label: 'Llamada', icon: '📞', color: 'blue' },
  no_answer: { label: 'No Contestó', icon: '❌', color: 'yellow' },
  problem: { label: 'Problema', icon: '⚠️', color: 'red' },
  progress: { label: 'Avance', icon: '✅', color: 'emerald' },
  status_change: { label: 'Cambio de Estado', icon: '📋', color: 'orange' },
  other: { label: 'Otro', icon: '📝', color: 'gray' }
};

const priorityLevels = {
  low: { label: 'Baja', color: 'gray' },
  medium: { label: 'Media', color: 'blue' },
  high: { label: 'Alta', color: 'orange' },
  urgent: { label: 'Urgente', color: 'red' }
};

const LeadNotesModal = ({ lead, onClose, onNoteRead }) => {
  const dispatch = useDispatch();
  const { notes, loading } = useSelector((state) => state.salesLeads);
  const { currentStaff } = useSelector((state) => state.auth);
  
  const userId = currentStaff?.id;

  // Estados locales
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    message: '',
    noteType: 'follow_up',
    priority: 'medium',
    hasReminder: false,
    reminderDate: ''
  });

  // Cargar notas al abrir el modal
  useEffect(() => {
    if (lead?.id) {
      dispatch(fetchLeadNotes({ leadId: lead.id }));
    }
  }, [dispatch, lead?.id]);

  // Formatear fecha (convierte UTC a hora local del browser de cada usuario)
  const formatDate = (dateString) => {
    if (!dateString) return '';
    // Si no tiene info de timezone, forzar interpretación como UTC
    const normalized = /Z|[+-]\d{2}:\d{2}$/.test(dateString) ? dateString : dateString + 'Z';
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return '';
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
  };

  // Manejar submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.message.trim()) {
      alert('El mensaje es obligatorio');
      return;
    }
    
    // Validar sesión si se quiere agregar recordatorio
    if (formData.hasReminder && !userId) {
      alert('Error: Sesión no válida. Por favor, inicia sesión nuevamente.');
      return;
    }

    const noteData = {
      leadId: lead.id,
      message: formData.message.trim(),
      noteType: formData.noteType,
      priority: formData.priority,
      relatedStatus: lead.status
    };

    // Si tiene recordatorio, agregarlo
    if (formData.hasReminder && formData.reminderDate && userId) {
      const [year, month, day] = formData.reminderDate.split('-');
      // Usar hora por defecto: 09:00
      const reminderDateTime = new Date(`${year}-${month}-${day}T09:00:00`);
      noteData.reminderDate = reminderDateTime.toISOString();
      noteData.reminderFor = [userId]; // ✅ Siempre asignar al usuario logueado
      noteData.isReminderActive = true;
    }

    setSubmitting(true);
    try {
      const result = await dispatch(createLeadNote(noteData));
      if (result.type.includes('fulfilled')) {
        setShowAddForm(false);
        resetForm();
        dispatch(fetchLeadNotes({ leadId: lead.id }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      message: '',
      noteType: 'follow_up',
      priority: 'medium',
      hasReminder: false,
      reminderDate: ''
    });
  };

  const handleDelete = async (noteId) => {
    if (window.confirm('¿Estás seguro de eliminar esta nota?')) {
      await dispatch(deleteLeadNote(noteId));
      dispatch(fetchLeadNotes({ leadId: lead.id }));
    }
  };
  const handleMarkAsRead = async (noteId) => {
    await dispatch(markLeadNoteAsRead(noteId));
    await dispatch(fetchLeadNotes({ leadId: lead.id }));
    if (onNoteRead) onNoteRead(); // refresca badges en la lista
  };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Notas de Seguimiento
                </h2>
                <p className="text-sm text-gray-600">{lead.applicantName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Botón agregar nota */}
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full mb-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                Agregar Nota
              </button>
            )}

            {/* Formulario nueva nota */}
            {showAddForm && (
              <form onSubmit={handleSubmit} className="mb-6 bg-gray-50 p-4 rounded-lg">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mensaje
                    </label>
                    <MentionTextarea
                      value={formData.message}
                      onChange={(value) => setFormData({ ...formData, message: value })}
                      placeholder="Escribe tu nota aquí... (Usa @ para mencionar)"
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo
                      </label>
                      <select
                        value={formData.noteType}
                        onChange={(e) => setFormData({ ...formData, noteType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.entries(noteTypes).map(([value, { label, icon }]) => (
                          <option key={value} value={value}>
                            {icon} {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prioridad
                      </label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.entries(priorityLevels).map(([value, { label }]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Recordatorio */}
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.hasReminder}
                        onChange={(e) => setFormData({ ...formData, hasReminder: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Configurar recordatorio
                      </span>
                    </label>

                    {formData.hasReminder && (
                      <div className="mt-2">
                        <label className="block text-sm text-gray-600 mb-1">Fecha del recordatorio</label>
                        <input
                          type="date"
                          value={formData.reminderDate}
                          onChange={(e) => setFormData({ ...formData, reminderDate: e.target.value })}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          📅 El recordatorio se creará a las 9:00 AM
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Guardando...' : 'Guardar Nota'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        resetForm();
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Lista de notas */}
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Cargando notas...</p>
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-12">
                <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No hay notas todavía</p>
                <p className="text-sm text-gray-500">Comienza agregando la primera nota</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => {
                  const noteType = noteTypes[note.noteType] || noteTypes.other;
                  const priority = priorityLevels[note.priority] || priorityLevels.medium;
                  // Una nota es no-le\u00edda si el usuario actual NO est\u00e1 en readBy
                  const isUnread = userId && !(note.readBy || []).includes(userId);
                  
                  return (
                    <div
                      key={note.id}
                      className={`bg-white border-l-4 border-${priority.color}-500 p-4 rounded-lg shadow-sm ${
                        isUnread ? 'ring-2 ring-yellow-300 bg-yellow-50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{noteType.icon}</span>
                          <span className="text-sm font-medium text-gray-700">
                            {noteType.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs bg-${priority.color}-100 text-${priority.color}-800`}>
                            {priority.label}
                          </span>
                          {isUnread && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-200 text-yellow-800 font-semibold">
                              🔔 No leída
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <button
                              onClick={() => handleMarkAsRead(note.id)}
                              className="text-green-600 hover:text-green-700 flex items-center gap-1 text-xs font-medium px-2 py-1 bg-green-50 rounded hover:bg-green-100 transition-colors"
                              title="Marcar como leída"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                              Marcar leída
                            </button>
                          )}
                          {note.isReminderActive && (
                            <span className="text-sm text-blue-600 flex items-center gap-1">
                              <ClockIcon className="h-4 w-4" />
                              Recordatorio
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(note.id)}
                            className="text-red-600 hover:text-red-700 p-1"
                            title="Eliminar nota"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-gray-800 mb-2 whitespace-pre-wrap">{note.message}</p>
                      
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>
                          {note.author?.name || 'Usuario'}
                        </span>
                        <span>{formatDate(note.createdAt)}</span>
                      </div>

                      {note.isReminderActive && note.reminderDate && (
                        <div className="mt-2 text-sm text-blue-600 bg-blue-50 p-2 rounded">
                          ⏰ Recordatorio: {formatDate(note.reminderDate)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              Total de notas: {notes.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadNotesModal;
