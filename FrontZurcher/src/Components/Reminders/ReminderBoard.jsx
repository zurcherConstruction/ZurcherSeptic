import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  FaCheck, FaTrash, FaExclamationTriangle, FaSyncAlt,
  FaCalendarAlt, FaUser, FaClipboardList, FaBell, FaComment,
  FaPlus, FaTimes, FaPaperPlane, FaTag, FaLock, FaBullhorn,
  FaHardHat, FaFileAlt, FaLink, FaEdit,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../../utils/axios';
import { fetchStaff } from '../../Redux/Actions/adminActions';
import { searchWorksForLink, searchBudgetsForLink } from '../../Redux/Actions/reminderActions';

// ─── Constantes ───────────────────────────────────────────────────────────────

const PRIORITY = {
  urgent: { label: 'Urgente', dot: 'bg-rose-500',  row: 'bg-rose-50',  text: 'text-rose-700',  },
  high:   { label: 'Alta',    dot: 'bg-amber-500', row: 'bg-amber-50', text: 'text-amber-700', },
  medium: { label: 'Media',   dot: 'bg-sky-500',   row: 'bg-white',    text: 'text-sky-700',   },
  low:    { label: 'Baja',    dot: 'bg-slate-400', row: 'bg-white',    text: 'text-slate-500', },
};

const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600', 'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600', 'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600', 'from-cyan-500 to-sky-600',
];
const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const TAGGABLE_ROLES = ['admin', 'owner', 'recept', 'finance'];

const isOverdue = (dueDate, completed) => {
  if (!dueDate || completed) return false;
  return new Date(dueDate + 'T23:59:59') < new Date();
};

const fmtDate = (d) => {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const fmtDateTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const getWeekStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
};

// ─── Modal: Nueva tarea ───────────────────────────────────────────────────────

function CreateModal({ onClose, onRefresh, staffList, currentStaff, preSelectedStaff }) {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium',
    type: 'tagged',
    assignedTo: preSelectedStaff ? [preSelectedStaff.id] : [],
    dueDate: '',
    linkedEntityType: '', linkedEntityId: '', linkedEntityLabel: '',
  });
  const [saving, setSaving] = useState(false);

  // Link search
  const linkTimer = useRef(null);
  const [linkSearch,  setLinkSearch]  = useState('');
  const [linkResults, setLinkResults] = useState([]);
  const [linkLoading, setLinkLoading] = useState(false);

  const handleLinkSearch = (query, entityType) => {
    setLinkSearch(query);
    setLinkResults([]);
    if (linkTimer.current) clearTimeout(linkTimer.current);
    if (!query.trim() || !entityType) return;
    linkTimer.current = setTimeout(async () => {
      setLinkLoading(true);
      const results = entityType === 'work'
        ? await searchWorksForLink(query)
        : await searchBudgetsForLink(query);
      setLinkResults(results);
      setLinkLoading(false);
    }, 350);
  };

  const selectLink = (result) => {
    const isWork = !!result.idWork;
    setForm(p => ({
      ...p,
      linkedEntityId:    isWork ? result.idWork : String(result.idBudget),
      linkedEntityLabel: isWork
        ? result.propertyAddress
        : `${result.applicantName} — ${result.propertyAddress}`,
    }));
    setLinkSearch('');
    setLinkResults([]);
  };

  const clearLink = () => {
    setForm(p => ({ ...p, linkedEntityType: '', linkedEntityId: '', linkedEntityLabel: '' }));
    setLinkSearch('');
    setLinkResults([]);
  };

  const taggable = staffList.filter(s => s.isActive && TAGGABLE_ROLES.includes(s.role));

  const toggleAssign = (id) =>
    setForm(p => ({
      ...p,
      assignedTo: p.assignedTo.includes(id)
        ? p.assignedTo.filter(x => x !== id)
        : [...p.assignedTo, id],
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('El título es requerido');
    if (form.type === 'tagged' && form.assignedTo.length === 0)
      return toast.error('Selecciona al menos un destinatario');
    setSaving(true);
    try {
      await api.post('/reminders', {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        type: form.type,
        assignedTo: form.type === 'tagged' ? form.assignedTo : [],
        dueDate: form.dueDate || null,
        linkedEntityType:  form.linkedEntityType  || null,
        linkedEntityId:    form.linkedEntityId    || null,
        linkedEntityLabel: form.linkedEntityLabel || null,
      });
      toast.success('Recordatorio creado');
      onRefresh();
      onClose();
    } catch {
      toast.error('Error al crear recordatorio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
              <FaPlus className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">
              {preSelectedStaff ? `Tarea para ${preSelectedStaff.name}` : 'Nueva tarea'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tipo</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { v: 'tagged',    label: 'Etiquetado', icon: <FaTag className="w-3 h-3" /> },
                { v: 'broadcast', label: 'General',    icon: <FaBullhorn className="w-3 h-3" /> },
                { v: 'personal',  label: 'Privado',    icon: <FaLock className="w-3 h-3" /> },
              ].map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, type: opt.v, assignedTo: [] }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    form.type === opt.v
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Título *</label>
            <input
              value={form.title}
              onChange={e => {
                const v = e.target.value;
                setForm(p => ({ ...p, title: v ? v.charAt(0).toUpperCase() + v.slice(1) : v }));
              }}
              placeholder="Nombre de la tarea..."
              maxLength={40}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
              autoFocus
            />
            <p className="text-[10px] text-slate-400 mt-1 text-right">{form.title.length}/40</p>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Detalles opcionales..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
            />
          </div>

          {/* Prioridad + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Prioridad</label>
              <select
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                <option value="urgent">Urgente</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Vencimiento</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          </div>

          {/* Destinatarios */}
          {form.type === 'tagged' && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Asignar a</label>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {taggable.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin staff disponible</p>
                ) : taggable.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleAssign(s.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${
                      form.assignedTo.includes(s.id)
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-white border-slate-200 hover:border-amber-200'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarColor(s.name)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                      {s.name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-slate-700 flex-1">{s.name}</span>
                    <span className="text-[11px] text-slate-400 capitalize">{s.role}</span>
                    {form.assignedTo.includes(s.id) && <FaCheck className="w-3 h-3 text-amber-600 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Vincular work / budget */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              <FaLink className="inline w-3 h-3 mr-1" />Vincular (opcional)
            </label>
            <div className="flex gap-2 mb-2">
              {[
                { v: 'work',   label: 'Work',     icon: <FaHardHat className="w-3 h-3" /> },
                { v: 'budget', label: 'Presupuesto', icon: <FaFileAlt className="w-3 h-3" /> },
              ].map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => {
                    setForm(p => ({ ...p, linkedEntityType: p.linkedEntityType === opt.v ? '' : opt.v, linkedEntityId: '', linkedEntityLabel: '' }));
                    setLinkSearch('');
                    setLinkResults([]);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    form.linkedEntityType === opt.v
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>

            {form.linkedEntityType && (
              form.linkedEntityId ? (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  {form.linkedEntityType === 'work'
                    ? <FaHardHat className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    : <FaFileAlt className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
                  <span className="text-sm text-slate-700 flex-1 truncate">{form.linkedEntityLabel}</span>
                  <button type="button" onClick={clearLink} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                    <FaTimes className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    value={linkSearch}
                    onChange={e => handleLinkSearch(e.target.value, form.linkedEntityType)}
                    placeholder={form.linkedEntityType === 'work' ? 'Buscar por dirección...' : 'Buscar por nombre o dirección...'}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
                  />
                  {linkLoading && (
                    <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">Buscando...</span>
                  )}
                  {linkResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-10 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-44 overflow-y-auto">
                      {linkResults.map(res => {
                        const isWork = !!res.idWork;
                        const label  = isWork ? res.propertyAddress : `${res.applicantName} — ${res.propertyAddress}`;
                        return (
                          <button
                            key={isWork ? res.idWork : res.idBudget}
                            type="button"
                            onClick={() => selectLink(res)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-amber-50 text-left transition-colors"
                          >
                            {isWork
                              ? <FaHardHat className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              : <FaFileAlt className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                            <span className="text-sm text-slate-700 truncate">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {linkSearch.length > 1 && !linkLoading && linkResults.length === 0 && (
                    <p className="text-xs text-slate-400 mt-1.5">Sin resultados para "{linkSearch}"</p>
                  )}
                </div>
              )
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            <FaPlus className="w-3.5 h-3.5" />
            {saving ? 'Creando...' : 'Crear tarea'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Detalle de tarea ──────────────────────────────────────────────────

function DetailModal({ reminderId, targetStaffId, isOwner, currentStaff, staffList, onClose, onRefresh }) {
  const navigate = useNavigate();
  const [detail, setDetail]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [newComment, setNewComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagging, setTagging]       = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving]     = useState(false);
  const editLinkTimer           = useRef(null);
  const [editLinkSearch,  setEditLinkSearch]  = useState('');
  const [editLinkResults, setEditLinkResults] = useState([]);
  const [editLinkLoading, setEditLinkLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const { data } = await api.get(`/reminders/${reminderId}`);
      setDetail(data.reminder);
    } catch {
      toast.error('Error cargando detalle');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [reminderId, onClose]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (!detail) return null;

  const assignees = (detail.assignments || []).filter(a => a.staff?.id);
  const myAsgn    = targetStaffId
    ? assignees.find(a => a.staff?.id === targetStaffId)
    : detail.myAssignment;
  const done      = myAsgn?.completed ?? detail.myAssignment?.completed;
  const overdue   = isOverdue(detail.dueDate, done);
  const pCfg      = PRIORITY[detail.priority] || PRIORITY.medium;

  // Permisos: editar/eliminar solo el creador o admin/owner
  const canEditDelete = isOwner || detail.createdBy === currentStaff?.id;

  const taggableStaff = staffList.filter(s =>
    s.isActive && TAGGABLE_ROLES.includes(s.role) &&
    !assignees.some(a => a.staff?.id === s.id)
  );

  const enterEdit = () => {
    setEditForm({
      title:             detail.title        || '',
      description:       detail.description  || '',
      priority:          detail.priority     || 'medium',
      dueDate:           detail.dueDate      || '',
      linkedEntityType:  detail.linkedEntityType  || '',
      linkedEntityId:    detail.linkedEntityId    || '',
      linkedEntityLabel: detail.linkedEntityLabel || '',
    });
    setEditLinkSearch('');
    setEditLinkResults([]);
    setEditMode(true);
  };

  const handleEditLinkSearch = (query, entityType) => {
    setEditLinkSearch(query);
    setEditLinkResults([]);
    if (editLinkTimer.current) clearTimeout(editLinkTimer.current);
    if (!query.trim() || !entityType) return;
    editLinkTimer.current = setTimeout(async () => {
      setEditLinkLoading(true);
      const results = entityType === 'work'
        ? await searchWorksForLink(query)
        : await searchBudgetsForLink(query);
      setEditLinkResults(results);
      setEditLinkLoading(false);
    }, 350);
  };

  const selectEditLink = (result) => {
    const isWork = !!result.idWork;
    setEditForm(p => ({
      ...p,
      linkedEntityId:    isWork ? result.idWork : String(result.idBudget),
      linkedEntityLabel: isWork
        ? result.propertyAddress
        : `${result.applicantName} — ${result.propertyAddress}`,
    }));
    setEditLinkSearch('');
    setEditLinkResults([]);
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) return toast.error('El título es requerido');
    setSaving(true);
    try {
      await api.patch(`/reminders/${detail.id}`, {
        title:             editForm.title.trim(),
        description:       editForm.description.trim() || null,
        priority:          editForm.priority,
        dueDate:           editForm.dueDate || null,
        linkedEntityType:  editForm.linkedEntityType  || null,
        linkedEntityId:    editForm.linkedEntityId    || null,
        linkedEntityLabel: editForm.linkedEntityLabel || null,
      });
      toast.success('Tarea actualizada');
      setEditMode(false);
      await fetchDetail();
      onRefresh();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const body = isOwner && targetStaffId && targetStaffId !== currentStaff?.id
        ? { targetStaffId } : {};
      await api.patch(`/reminders/${detail.id}/complete`, body);
      await fetchDetail();
      onRefresh();
    } catch {
      toast.error('Error al actualizar');
    } finally {
      setCompleting(false);
    }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;
    setCommenting(true);
    try {
      await api.post(`/reminders/${detail.id}/comments`, { message: newComment.trim() });
      setNewComment('');
      await fetchDetail();
    } catch {
      toast.error('Error al comentar');
    } finally {
      setCommenting(false);
    }
  };

  const handleAddTag = async (staffId) => {
    setTagging(true);
    try {
      const currentIds = assignees.map(a => a.staff?.id).filter(Boolean);
      await api.patch(`/reminders/${detail.id}`, {
        type: 'tagged', assignedTo: [...currentIds, staffId],
      });
      await fetchDetail();
      onRefresh();
      setShowTagPicker(false);
      toast.success('Etiqueta agregada');
    } catch {
      toast.error('Error al etiquetar');
    } finally {
      setTagging(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar "${detail.title}"?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/reminders/${detail.id}`);
      toast.success('Recordatorio eliminado');
      onClose();
      onRefresh();
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── MODO EDICIÓN ── */}
        {editMode ? (
          <>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center">
                  <FaEdit className="w-3 h-3 text-amber-600" />
                </div>
                <span className="font-bold text-slate-800">Editar tarea</span>
              </div>
              <button onClick={() => setEditMode(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <FaTimes className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Título */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Título *</label>
                <input
                  value={editForm.title}
                  onChange={e => {
                    const v = e.target.value;
                    setEditForm(p => ({ ...p, title: v ? v.charAt(0).toUpperCase() + v.slice(1) : v }));
                  }}
                  maxLength={40}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 mt-1 text-right">{editForm.title.length}/40</p>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Descripción</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
                />
              </div>

              {/* Prioridad + Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Prioridad</label>
                  <select
                    value={editForm.priority}
                    onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    <option value="urgent">Urgente</option>
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Vencimiento</label>
                  <input
                    type="date"
                    value={editForm.dueDate}
                    onChange={e => setEditForm(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>

              {/* Vincular */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  <FaLink className="inline w-3 h-3 mr-1" />Vincular
                </label>
                <div className="flex gap-2 mb-2">
                  {[
                    { v: 'work',   label: 'Work',        icon: <FaHardHat className="w-3 h-3" /> },
                    { v: 'budget', label: 'Presupuesto', icon: <FaFileAlt className="w-3 h-3" /> },
                  ].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => {
                        setEditForm(p => ({ ...p, linkedEntityType: p.linkedEntityType === opt.v ? '' : opt.v, linkedEntityId: '', linkedEntityLabel: '' }));
                        setEditLinkSearch('');
                        setEditLinkResults([]);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        editForm.linkedEntityType === opt.v
                          ? 'bg-slate-700 text-white border-slate-700'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
                {editForm.linkedEntityType && (
                  editForm.linkedEntityId ? (
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      {editForm.linkedEntityType === 'work'
                        ? <FaHardHat className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        : <FaFileAlt className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
                      <span className="text-sm text-slate-700 flex-1 truncate">{editForm.linkedEntityLabel}</span>
                      <button type="button" onClick={() => setEditForm(p => ({ ...p, linkedEntityType: '', linkedEntityId: '', linkedEntityLabel: '' }))} className="text-slate-400 hover:text-slate-600">
                        <FaTimes className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        value={editLinkSearch}
                        onChange={e => handleEditLinkSearch(e.target.value, editForm.linkedEntityType)}
                        placeholder={editForm.linkedEntityType === 'work' ? 'Buscar por dirección...' : 'Buscar por nombre o dirección...'}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                      {editLinkLoading && <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">Buscando...</span>}
                      {editLinkResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-10 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-44 overflow-y-auto">
                          {editLinkResults.map(res => {
                            const isWork = !!res.idWork;
                            const label  = isWork ? res.propertyAddress : `${res.applicantName} — ${res.propertyAddress}`;
                            return (
                              <button key={isWork ? res.idWork : res.idBudget} type="button" onClick={() => selectEditLink(res)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-amber-50 text-left transition-colors">
                                {isWork ? <FaHardHat className="w-3 h-3 text-slate-400 flex-shrink-0" /> : <FaFileAlt className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                                <span className="text-sm text-slate-700 truncate">{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {editLinkSearch.length > 1 && !editLinkLoading && editLinkResults.length === 0 && (
                        <p className="text-xs text-slate-400 mt-1.5">Sin resultados para "{editLinkSearch}"</p>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3 justify-end flex-shrink-0">
              <button onClick={() => setEditMode(false)} disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                <FaCheck className="w-3.5 h-3.5" />
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </>
        ) : (
          /* ── MODO VISTA ── */
          <>
            {/* Header */}
            <div className={`px-5 py-4 rounded-t-2xl border-b flex-shrink-0 ${
              overdue ? 'bg-red-50 border-red-200' : done ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'
            }`}>
              <div className="flex items-start gap-3">
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50'
                  } ${completing ? 'opacity-60 cursor-wait' : ''}`}
                  title={done ? 'Marcar pendiente' : 'Marcar completado'}
                >
                  {done && !completing && <FaCheck className="w-2.5 h-2.5" />}
                  {completing && <div className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />}
                </button>

                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold text-slate-800 text-base leading-snug truncate ${done ? 'line-through text-slate-400' : ''}`}>
                    {detail.title ? detail.title.charAt(0).toUpperCase() + detail.title.slice(1) : ''}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pCfg.row} ${pCfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />{pCfg.label}
                    </span>
                    {overdue && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                        <FaExclamationTriangle className="w-2.5 h-2.5" /> VENCIDO
                      </span>
                    )}
                    {detail.dueDate && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                        <FaCalendarAlt className="w-2.5 h-2.5" /> {fmtDate(detail.dueDate)}
                      </span>
                    )}
                    {detail.creator?.name && (
                      <span className="text-[10px] text-slate-400">
                        · por <span className="font-medium text-slate-600">{detail.creator.name}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {canEditDelete && (
                    <>
                      <button onClick={enterEdit}
                        className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Editar">
                        <FaEdit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={handleDelete} disabled={deleting}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Eliminar">
                        <FaTrash className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <FaTimes className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Descripción */}
              {detail.description && (
                <div className="px-5 py-3 border-b border-slate-100">
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{detail.description}</p>
                </div>
              )}

              {/* Vinculado */}
              {detail.linkedEntityType && detail.linkedEntityId && (
                <div className="px-5 py-3 border-b border-slate-100">
                  <button
                    onClick={() => {
                      onClose();
                      navigate(
                        detail.linkedEntityType === 'work'         ? `/work/${detail.linkedEntityId}`
                        : detail.linkedEntityType === 'workCalendar' ? '/workCalendar'
                        : '/budgets'
                      );
                    }}
                    className="flex items-center gap-2 text-left hover:text-amber-600 transition-colors group"
                  >
                    {detail.linkedEntityType === 'work'
                      ? <FaHardHat className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 flex-shrink-0" />
                      : detail.linkedEntityType === 'workCalendar'
                        ? <FaCalendarAlt className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 flex-shrink-0" />
                      : <FaFileAlt className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 flex-shrink-0" />}
                    <span className="text-sm text-slate-600 group-hover:text-amber-600 underline underline-offset-2">
                      {detail.linkedEntityLabel || detail.linkedEntityId}
                    </span>
                  </button>
                </div>
              )}

              {/* Etiquetar — sin mostrar la lista de asignados */}
              <div className="px-5 py-3 border-b border-slate-100">
                <div className="relative inline-block">
                  <button
                    onClick={() => setShowTagPicker(p => !p)}
                    className="flex items-center gap-1 bg-slate-50 border border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50 rounded-xl px-2.5 py-1 text-xs text-slate-400 hover:text-amber-600 transition-all"
                  >
                    <FaTag className="w-2.5 h-2.5" /> Etiquetar
                  </button>
                  {showTagPicker && (
                    <div className="absolute left-0 top-8 bg-white rounded-xl border border-slate-200 shadow-lg z-10 w-52 max-h-48 overflow-y-auto">
                      {taggableStaff.length === 0 ? (
                        <p className="text-xs text-slate-400 px-3 py-2 italic">Todos ya están etiquetados</p>
                      ) : taggableStaff.map(s => (
                        <button key={s.id} onClick={() => handleAddTag(s.id)} disabled={tagging}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-amber-50 text-left transition-colors">
                          <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarColor(s.name)} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                            {s.name?.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-slate-700 flex-1">{s.name}</span>
                          <span className="text-[10px] text-slate-400 capitalize">{s.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Comentarios */}
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <FaComment className="w-3 h-3 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Comentarios {(detail.comments?.length > 0) && `(${detail.comments.length})`}
                  </span>
                </div>
                <div className="space-y-2.5 mb-4 max-h-44 overflow-y-auto">
                  {(detail.comments || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Sin comentarios aún</p>
                  ) : detail.comments.map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarColor(c.author?.name || '')} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-0.5`}>
                        {c.author?.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[11px] font-semibold text-slate-700">{c.author?.name || 'Sistema'}</span>
                          <span className="text-[10px] text-slate-400">{fmtDateTime(c.createdAt)}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{c.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarColor(currentStaff?.name || '')} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                    {currentStaff?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                    placeholder="Escribe un comentario..."
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 placeholder-slate-300"
                  />
                  <button onClick={handleComment} disabled={commenting || !newComment.trim()}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors disabled:opacity-40 flex-shrink-0">
                    <FaPaperPlane className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Fila de recordatorio ─────────────────────────────────────────────────────

function ReminderRow({ reminder, onToggle, onDelete, isOwner, toggling, deleting, onOpenDetail }) {
  const { assignment } = reminder;
  const done    = assignment?.completed;
  const overdue = isOverdue(reminder.dueDate, done);
  const pCfg    = PRIORITY[reminder.priority] || PRIORITY.medium;

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border transition-all group cursor-pointer hover:shadow-sm ${
        done    ? 'bg-slate-50 border-slate-100 opacity-55'
        : overdue ? 'bg-red-50 border-red-200'
        : 'bg-white border-slate-150 hover:border-slate-200'
      }`}
      onClick={onOpenDetail}
    >
      {/* Checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onToggle(); }}
        disabled={toggling}
        title={done ? 'Marcar pendiente' : 'Marcar completado'}
        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          done    ? 'bg-emerald-500 border-emerald-500 text-white'
          : overdue ? 'border-red-300 hover:border-red-400 hover:bg-red-50'
          : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50'
        } ${toggling ? 'opacity-50 cursor-wait' : ''}`}
      >
        {done && <FaCheck className="w-2.5 h-2.5" />}
      </button>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        {/* Título */}
        <p className={`text-xs font-semibold leading-snug truncate ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {reminder.title}
        </p>

        {/* Metadata — una sola línea, sin wrap */}
        <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
          {/* Prioridad */}
          <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
            done ? 'bg-slate-100 text-slate-400' : `${pCfg.row} ${pCfg.text}`
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-slate-400' : pCfg.dot}`} />
            {pCfg.label}
          </span>

          {/* Creador */}
          {reminder.creator?.name && (
            <>
              <span className="flex-shrink-0 text-slate-200 text-[10px]">·</span>
              <span className="text-[10px] text-slate-400 truncate min-w-0 max-w-[60px]">
                {reminder.creator.name}
              </span>
            </>
          )}

          {/* Fecha y hora de asignación */}
          {reminder.createdAt && (
            <>
              <span className="flex-shrink-0 text-slate-200 text-[10px]">·</span>
              <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                <FaCalendarAlt className="w-2 h-2" />
                {fmtDateTime(reminder.createdAt)}
              </span>
            </>
          )}

          {/* Fecha de vencimiento — rojo si vencida */}
          {reminder.dueDate && (
            <>
              <span className="flex-shrink-0 text-slate-200 text-[10px]">·</span>
              <span className={`flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] ${overdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                {overdue && <FaExclamationTriangle className="w-2 h-2" />}
                {fmtDate(reminder.dueDate)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Eliminar */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        disabled={deleting}
        className={`flex-shrink-0 p-1 rounded-lg text-slate-200 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 ${
          deleting ? 'opacity-50 cursor-wait' : ''
        }`}
        title="Eliminar recordatorio"
      >
        <FaTrash className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Tarjeta de staff ─────────────────────────────────────────────────────────

function StaffCard({ staffData, showThisWeek, isOwner, currentStaffId, onRefresh, onOpenDetail, onCreateFor }) {
  const [toggling,  setToggling]  = useState({});
  const [deleting,  setDeleting]  = useState({});
  const [confirmModal,   setConfirmModal]   = useState(null);
  const [confirmComment, setConfirmComment] = useState('');
  const [confirming,     setConfirming]     = useState(false);

  const reminders  = staffData.reminders || [];
  const weekStart  = getWeekStart();

  const visible = showThisWeek
    ? reminders.filter(r => {
        if (!r.assignment?.completed) return true;
        if (!r.assignment?.completedAt) return true;
        return new Date(r.assignment.completedAt) >= weekStart;
      })
    : reminders.filter(r => !r.assignment?.completed);

  const pendingCount   = reminders.filter(r => !r.assignment?.completed).length;
  const overdueCount   = reminders.filter(r => isOverdue(r.dueDate, r.assignment?.completed)).length;
  const allDone        = reminders.length > 0 && pendingCount === 0;

  const buildBody = () => {
    const body = {};
    if (isOwner && staffData.id !== currentStaffId) body.targetStaffId = staffData.id;
    return body;
  };

  const handleToggle = async (reminder) => {
    const rId = reminder.id;
    setToggling(p => ({ ...p, [rId]: true }));
    try {
      await api.patch(`/reminders/${rId}/complete`, buildBody());
      onRefresh();
    } catch {
      toast.error('Error al actualizar tarea');
    } finally {
      setToggling(p => ({ ...p, [rId]: false }));
    }
  };

  const handleConfirm = async () => {
    if (!confirmModal) return;
    const rId = confirmModal.id;
    setConfirming(true);
    try {
      if (confirmComment.trim()) {
        await api.post(`/reminders/${rId}/comments`, { message: confirmComment.trim() });
      }
      await api.patch(`/reminders/${rId}/complete`, buildBody());
      toast.success('Tarea completada');
      setConfirmModal(null);
      setConfirmComment('');
      onRefresh();
    } catch {
      toast.error('Error al completar la tarea');
    } finally {
      setConfirming(false);
    }
  };

  const handleDelete = async (reminder) => {
    if (!window.confirm(`¿Eliminar "${reminder.title}"?`)) return;
    const rId = reminder.id;
    setDeleting(p => ({ ...p, [rId]: true }));
    try {
      await api.delete(`/reminders/${rId}`);
      toast.success('Recordatorio eliminado');
      onRefresh();
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setDeleting(p => ({ ...p, [rId]: false }));
    }
  };

  const completedThisWeek = reminders.filter(r => {
    if (!r.assignment?.completed || !r.assignment?.completedAt) return false;
    return new Date(r.assignment.completedAt) >= weekStart;
  }).length;

  return (
    <div className={`rounded-2xl border-2 shadow-sm flex flex-col transition-all ${
      allDone
        ? 'bg-emerald-50 border-emerald-200'
        : overdueCount > 0
          ? 'bg-amber-50 border-orange-300'
          : 'bg-amber-50 border-amber-200'
    }`}>
      {/* Cabecera */}
      <div className={`px-4 pt-4 pb-3 border-b ${allDone ? 'border-emerald-200' : 'border-amber-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(staffData.name)} flex items-center justify-center text-white font-bold text-sm shadow flex-shrink-0`}>
            {staffData.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 truncate">{staffData.name}</p>
          </div>
          {pendingCount > 0 && (
            <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
              overdueCount > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-200 text-amber-800'
            }`}>
              {pendingCount} pend.
            </span>
          )}
          {allDone && (
            <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              ✓ Al día
            </span>
          )}
          <button
            onClick={() => onCreateFor(staffData)}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-600 transition-colors"
            title={`Nueva tarea para ${staffData.name}`}
          >
            <FaPlus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 p-3 space-y-1.5 overflow-y-auto max-h-[26rem] sm:max-h-[30rem]">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-slate-400">
            {reminders.length === 0 ? (
              <>
                <FaClipboardList className="w-6 h-6 mb-2 opacity-40" />
                <p className="text-xs">Sin tareas asignadas</p>
              </>
            ) : (
              <>
                <FaCheck className="w-5 h-5 mb-2 text-emerald-400" />
                <p className="text-xs text-emerald-600">Todo completado esta semana</p>
              </>
            )}
          </div>
        ) : (
          visible.map(r => (
            <ReminderRow
              key={r.id}
              reminder={r}
              onToggle={() => r.assignment?.completed ? handleToggle(r) : setConfirmModal(r)}
              onDelete={() => handleDelete(r)}
              isOwner={isOwner}
              toggling={!!toggling[r.id]}
              deleting={!!deleting[r.id]}
              onOpenDetail={() => onOpenDetail(r, staffData.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {!showThisWeek && completedThisWeek > 0 && (
        <div className="px-4 py-2 border-t border-amber-200">
          <p className="text-[11px] text-slate-400 text-center">
            + {completedThisWeek} completado{completedThisWeek !== 1 ? 's' : ''} esta semana
          </p>
        </div>
      )}

      {/* Modal confirmar completado */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                  <FaCheck className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">¿Confirmar tarea completada?</h3>
              </div>
              <p className="text-sm text-slate-500 ml-9 line-clamp-2">"{confirmModal.title}"</p>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                <FaComment className="inline w-3.5 h-3.5 mr-1.5 text-slate-400" />
                Comentario <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={confirmComment}
                onChange={e => setConfirmComment(e.target.value)}
                placeholder="Ej: Llamé al cliente, completé la inspección..."
                rows={3}
                autoFocus
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 placeholder-slate-300"
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button
                onClick={() => { setConfirmModal(null); setConfirmComment(''); }}
                disabled={confirming}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                <FaCheck className="w-3.5 h-3.5" />
                {confirming ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tablero principal ────────────────────────────────────────────────────────

export default function ReminderBoard() {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const { currentStaff }    = useSelector(s => s.auth);
  const { staffList = [] }  = useSelector(s => s.admin);
  const isOwner = ['admin', 'owner'].includes(currentStaff?.role);

  const [board,        setBoard]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showThisWeek, setShowThisWeek] = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [createTarget, setCreateTarget] = useState(null); // null=cerrado | 'general' | staffData
  const [detailTarget, setDetailTarget] = useState(null); // { reminderId, targetStaffId }

  const fetchBoard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data } = await api.get('/reminders/board');
      setBoard(data.board || []);
    } catch {
      toast.error('Error cargando el tablero');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
    if (staffList.length === 0) dispatch(fetchStaff());
  }, [fetchBoard, dispatch, staffList.length]);

  const totalPending = board.reduce(
    (sum, s) => sum + (s.reminders || []).filter(r => !r.assignment?.completed).length, 0
  );
  const totalOverdue = board.reduce(
    (sum, s) => sum + (s.reminders || []).filter(r => isOverdue(r.dueDate, r.assignment?.completed)).length, 0
  );

  const handleOpenDetail = (reminder, staffId) => {
    setDetailTarget({ reminderId: reminder.id, targetStaffId: staffId });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">

            {/* Título */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20 flex-shrink-0">
                <FaBell className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Tablero de Tareas</h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {loading ? 'Cargando...' : (
                    <>
                      {board.length} empleado{board.length !== 1 ? 's' : ''} ·{' '}
                      {totalPending > 0
                        ? <span className="text-white font-semibold">{totalPending} pendiente{totalPending !== 1 ? 's' : ''}</span>
                        : <span className="text-emerald-300 font-semibold">Todo al día ✓</span>
                      }
                      {totalOverdue > 0 && (
                        <span className="text-red-300 font-semibold"> · {totalOverdue} vencido{totalOverdue !== 1 ? 's' : ''}</span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle semana */}
              <div className="flex bg-white/10 rounded-xl p-1 gap-1">
                {[
                  { k: false, label: 'Pendientes', short: 'Pend.' },
                  { k: true,  label: 'Esta semana', short: 'Semana' },
                ].map(opt => (
                  <button
                    key={String(opt.k)}
                    onClick={() => setShowThisWeek(opt.k)}
                    className={`px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      showThisWeek === opt.k
                        ? 'bg-white text-slate-800 shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="hidden sm:inline">{opt.label}</span>
                    <span className="sm:hidden">{opt.short}</span>
                  </button>
                ))}
              </div>

              {/* Nueva tarea */}
              <button
                onClick={() => setCreateTarget('general')}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all shadow-sm"
              >
                <FaPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nueva tarea</span>
              </button>

              {/* Refresh */}
              <button
                onClick={() => fetchBoard(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all"
              >
                <FaSyncAlt className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </button>

            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-3 py-4 sm:px-6 sm:py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin mb-4" />
            <p className="text-sm text-slate-500">Cargando tablero...</p>
          </div>
        ) : board.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <FaUser className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Sin empleados activos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {board.map(staffData => (
              <StaffCard
                key={staffData.id}
                staffData={staffData}
                showThisWeek={showThisWeek}
                isOwner={isOwner}
                currentStaffId={currentStaff?.id}
                onRefresh={() => fetchBoard(true)}
                onOpenDetail={handleOpenDetail}
                onCreateFor={setCreateTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal crear tarea */}
      {createTarget && (
        <CreateModal
          onClose={() => setCreateTarget(null)}
          onRefresh={() => fetchBoard(true)}
          staffList={staffList}
          currentStaff={currentStaff}
          preSelectedStaff={createTarget !== 'general' ? createTarget : null}
        />
      )}

      {/* Modal detalle de tarea */}
      {detailTarget && (
        <DetailModal
          reminderId={detailTarget.reminderId}
          targetStaffId={detailTarget.targetStaffId}
          isOwner={isOwner}
          currentStaff={currentStaff}
          staffList={staffList}
          onClose={() => setDetailTarget(null)}
          onRefresh={() => fetchBoard(true)}
        />
      )}
    </div>
  );
}
