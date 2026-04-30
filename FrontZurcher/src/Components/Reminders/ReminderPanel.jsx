import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchMyReminders,
  fetchAllReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  toggleComplete,
  addComment,
  deleteComment,
  searchWorksForLink,
  searchBudgetsForLink,
} from '../../Redux/Actions/reminderActions';
import { fetchStaff } from '../../Redux/Actions/adminActions';
import {
  FaBell, FaPlus, FaCheck, FaTrash, FaEdit, FaComment,
  FaTimes, FaChevronDown, FaChevronUp, FaUser, FaBroadcastTower,
  FaTag, FaLock, FaExclamationTriangle, FaCalendarAlt,
  FaExternalLinkAlt, FaSearch, FaHardHat, FaFileAlt, FaTimesCircle
} from 'react-icons/fa';
import { toast } from 'react-toastify';

const PRIORITY_CONFIG = {
  low:    { label: 'Baja',    pill: 'bg-slate-100 text-slate-500',          border: 'border-l-slate-300',   dot: 'bg-slate-400' },
  medium: { label: 'Media',   pill: 'bg-sky-100 text-sky-700',              border: 'border-l-sky-400',     dot: 'bg-sky-500' },
  high:   { label: 'Alta',    pill: 'bg-amber-100 text-amber-700',          border: 'border-l-amber-400',   dot: 'bg-amber-500' },
  urgent: { label: 'Urgente', pill: 'bg-rose-100 text-rose-700',            border: 'border-l-rose-500',    dot: 'bg-rose-500' },
};

const TYPE_CONFIG = {
  personal:  { label: 'Personal',   icon: FaLock,           pill: 'bg-slate-100 text-slate-500' },
  tagged:    { label: 'Etiquetado', icon: FaTag,             pill: 'bg-indigo-100 text-indigo-600' },
  broadcast: { label: 'General',    icon: FaBroadcastTower,  pill: 'bg-violet-100 text-violet-600' },
};

const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600','from-violet-500 to-purple-600','from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600','from-amber-500 to-orange-600','from-cyan-500 to-sky-600',
];
const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'medium',
  dueDate: '',
  assignedTo: [],
  isBroadcast: false,
  linkedEntityType: '',    // 'work' | 'budget' | ''
  linkedEntityId: '',
  linkedEntityLabel: '',
};

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const getFleetCompanyFromReminder = (reminder) => {
  if (reminder?.linkedEntityType !== 'fleet') return null;
  const desc = reminder?.description || '';
  const match = desc.match(/Empresa:\s*(.+)/i);
  if (!match?.[1]) return null;
  return match[1].trim().toUpperCase();
};

export default function ReminderPanel() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { reminders, allReminders, loading } = useSelector(s => s.reminders);
  const { currentStaff } = useSelector(s => s.auth);
  const { staffList = [] } = useSelector(s => s.admin);

  const isAdmin = ['admin', 'owner'].includes(currentStaff?.role);

  const [tab, setTab] = useState('mine');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterPriority, setFilterPriority] = useState('');

  // Link-entity search state
  const [linkSearch, setLinkSearch]   = useState('');
  const [linkResults, setLinkResults] = useState([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const linkTimer = useRef(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentLoading, setCommentLoading] = useState({});

  useEffect(() => {
    dispatch(fetchMyReminders());
    if (isAdmin) dispatch(fetchAllReminders());
    dispatch(fetchStaff());
  }, [dispatch, isAdmin]);

  const activeList = tab === 'all' && isAdmin ? allReminders : reminders;

  const filtered = activeList.filter(r => {
    if (filterPriority && r.priority !== filterPriority) return false;
    if (filterStatus === 'pending') {
      return tab === 'all'
        ? !r.assignments?.every(a => a.completed)
        : !r.myAssignment?.completed;
    }
    if (filterStatus === 'completed') {
      return tab === 'all'
        ? r.assignments?.every(a => a.completed)
        : r.myAssignment?.completed;
    }
    return true;
  });

  const pendingCount = reminders.filter(r => !r.myAssignment?.completed).length;

  const groupedReminders = filtered.reduce((acc, reminder) => {
    const company = getFleetCompanyFromReminder(reminder);
    const key = company ? `fleet-${company}` : 'general';
    const label = company ? `Fleet - ${company}` : 'General';

    if (!acc[key]) {
      acc[key] = { key, label, items: [] };
    }
    acc[key].items.push(reminder);
    return acc;
  }, {});

  const sections = Object.values(groupedReminders).sort((a, b) => {
    if (a.key === 'general') return -1;
    if (b.key === 'general') return 1;
    return a.label.localeCompare(b.label);
  });

  // ---- Link entity search ----
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

  const selectLinkResult = (result) => {
    const isWork = !!result.idWork;
    setFormData(p => ({
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
    setFormData(p => ({ ...p, linkedEntityType: '', linkedEntityId: '', linkedEntityLabel: '' }));
    setLinkSearch('');
    setLinkResults([]);
  };

  // ---- Create ----
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return toast.error('El título es requerido');
    setFormLoading(true);
    try {
      let type = 'personal';
      if (formData.isBroadcast) type = 'broadcast';
      else if (formData.assignedTo.length > 0) type = 'tagged';

      await dispatch(createReminder({
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        dueDate: formData.dueDate,
        type,
        assignedTo: type === 'tagged' ? formData.assignedTo : [],
        linkedEntityType:  formData.linkedEntityType || null,
        linkedEntityId:    formData.linkedEntityId   || null,
        linkedEntityLabel: formData.linkedEntityLabel || null,
      }));
      toast.success('Recordatorio creado');
      setShowCreateModal(false);
      setFormData(EMPTY_FORM);
      setLinkSearch('');
      setLinkResults([]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // ---- Toggle complete ----
  const handleToggleComplete = async (id) => {
    await dispatch(toggleComplete(id));
  };

  // ---- Delete ----
  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar recordatorio?')) return;
    await dispatch(deleteReminder(id));
    toast.success('Recordatorio eliminado');
  };

  // ---- Edit ----
  const startEdit = (r) => {
    setEditingId(r.id);
    setEditForm({
      title: r.title,
      description: r.description || '',
      priority: r.priority,
      dueDate: r.dueDate || '',
      linkedEntityType:  r.linkedEntityType  || '',
      linkedEntityId:    r.linkedEntityId    || '',
      linkedEntityLabel: r.linkedEntityLabel || '',
    });
  };

  const saveEdit = async (id) => {
    try {
      await dispatch(updateReminder(id, {
        ...editForm,
        linkedEntityType:  editForm.linkedEntityType  || null,
        linkedEntityId:    editForm.linkedEntityId    || null,
        linkedEntityLabel: editForm.linkedEntityLabel || null,
      }));
      setEditingId(null);
      toast.success('Actualizado');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ---- Comments ----
  const toggleComments = (id) => setExpandedComments(p => ({ ...p, [id]: !p[id] }));

  const handleAddComment = async (reminderId) => {
    const msg = (commentInputs[reminderId] || '').trim();
    if (!msg) return;
    setCommentLoading(p => ({ ...p, [reminderId]: true }));
    try {
      await dispatch(addComment(reminderId, msg));
      setCommentInputs(p => ({ ...p, [reminderId]: '' }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCommentLoading(p => ({ ...p, [reminderId]: false }));
    }
  };

  const handleDeleteComment = async (reminderId, commentId) => {
    if (!window.confirm('¿Eliminar comentario?')) return;
    await dispatch(deleteComment(reminderId, commentId));
  };

  const canManage = (r) => r.createdBy === currentStaff?.id || isAdmin;

  // ---- Assigned staff selector ----
  const toggleAssigned = (staffId) => {
    setFormData(p => ({
      ...p,
      assignedTo: p.assignedTo.includes(staffId)
        ? p.assignedTo.filter(id => id !== staffId)
        : [...p.assignedTo, staffId],
    }));
  };

  const activeStaff = staffList.filter(s => s.isActive && s.id !== currentStaff?.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 shadow-xl">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20 shadow-inner">
                <FaBell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Recordatorios</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  {pendingCount > 0
                    ? <span className="text-amber-400 font-medium">{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span>
                    : <span className="text-emerald-400">Todo al día ✓</span>}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-px"
            >
              <FaPlus className="w-3.5 h-3.5" />
              Nuevo recordatorio
            </button>
          </div>

          {/* Tabs + Filters row */}
          <div className="flex flex-wrap items-center gap-3 mt-5">
            {isAdmin && (
              <div className="flex bg-white/10 rounded-xl p-1 gap-1">
                {[{ key: 'mine', label: 'Mis recordatorios' }, { key: 'all', label: 'Vista general' }].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      tab === t.key
                        ? 'bg-white text-slate-800 shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex bg-white/10 rounded-xl p-1 gap-1">
              {[{ k: 'pending', v: 'Pendientes' }, { k: 'completed', v: 'Completados' }, { k: 'all', v: 'Todos' }].map(f => (
                <button
                  key={f.k}
                  onClick={() => setFilterStatus(f.k)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filterStatus === f.k
                      ? 'bg-white text-slate-800 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {f.v}
                </button>
              ))}
            </div>

            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl bg-white/10 text-slate-300 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 hover:bg-white/15 transition-colors"
            >
              <option value="" className="text-slate-800">Todas las prioridades</option>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                <option key={k} value={k} className="text-slate-800">{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading && reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="text-sm">Cargando recordatorios...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <FaBell className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Sin recordatorios en esta vista</p>
            <p className="text-slate-400 text-sm mt-1">Crea uno nuevo con el botón de arriba</p>
          </div>
        ) : (
        <div className="space-y-5">
          {sections.map(section => (
            <div key={section.key}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                  {section.label}
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  {section.items.length} item{section.items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-3">
                {section.items.map(r => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    currentStaff={currentStaff}
                    isAdmin={isAdmin}
                    isEditing={editingId === r.id}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    onEdit={() => startEdit(r)}
                    onSaveEdit={() => saveEdit(r.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onToggleComplete={() => handleToggleComplete(r.id)}
                    onDelete={() => handleDelete(r.id)}
                    canManage={canManage(r)}
                    showComments={!!expandedComments[r.id]}
                    onToggleComments={() => toggleComments(r.id)}
                    commentInput={commentInputs[r.id] || ''}
                    onCommentChange={v => setCommentInputs(p => ({ ...p, [r.id]: v }))}
                    onAddComment={() => handleAddComment(r.id)}
                    onDeleteComment={(cId) => handleDeleteComment(r.id, cId)}
                    commentLoading={!!commentLoading[r.id]}
                    viewingAll={tab === 'all'}
                    onNavigateLink={() => navigate(
                      r.linkedEntityType === 'work'
                        ? `/work/${r.linkedEntityId}`
                        : '/budgets'
                    )}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <FaPlus className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <h2 className="text-base font-bold text-slate-800">Nuevo Recordatorio</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Título *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => { const v = e.target.value; setFormData(p => ({ ...p, title: v.length === 1 ? v.toUpperCase() : v })); }}
                  maxLength={200}
                  autoFocus
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-slate-800 placeholder-slate-300 transition-all"
                  placeholder="Ej: Llamar al cliente sobre presupuesto"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={e => { const v = e.target.value; setFormData(p => ({ ...p, description: v.length === 1 ? v.toUpperCase() : v })); }}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-none text-slate-800 placeholder-slate-300 transition-all"
                  placeholder="Detalles opcionales..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Prioridad</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData(p => ({ ...p, priority: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-slate-700 bg-white transition-all"
                  >
                    <option value="low">🔵 Baja</option>
                    <option value="medium">🟡 Media</option>
                    <option value="high">🟠 Alta</option>
                    <option value="urgent">🔴 Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fecha límite</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-slate-700 transition-all"
                  />
                </div>
              </div>

              {/* Staff tagging — always visible */}
              {!formData.isBroadcast && (
                <div>
                  <label className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    <span><FaTag className="inline mr-1.5" />Etiquetar a (opcional)</span>
                    {formData.assignedTo.length > 0 && (
                      <span className="normal-case text-indigo-600 font-semibold text-xs bg-indigo-50 px-2 py-0.5 rounded-full">
                        {formData.assignedTo.length} seleccionado{formData.assignedTo.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </label>
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50">
                    {activeStaff.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-3">Sin staff disponible</p>
                    ) : (
                      activeStaff.map(s => (
                        <label key={s.id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all select-none ${
                          formData.assignedTo.includes(s.id)
                            ? 'bg-indigo-50 border border-indigo-200 shadow-sm'
                            : 'hover:bg-white border border-transparent hover:shadow-sm'
                        }`}>
                          <input
                            type="checkbox"
                            checked={formData.assignedTo.includes(s.id)}
                            onChange={() => toggleAssigned(s.id)}
                            className="rounded accent-indigo-600 w-4 h-4 flex-shrink-0"
                          />
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(s.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow`}>
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-700 font-medium flex-1">{s.name}</span>
                          <span className="text-xs text-slate-400 capitalize bg-slate-100 px-2 py-0.5 rounded-full">{s.role}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {formData.assignedTo.length === 0 && (
                    <p className="text-xs text-slate-400 mt-1.5">Sin selección → solo visible para ti</p>
                  )}
                </div>
              )}

              {/* Link to Work or Budget */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  <FaExternalLinkAlt className="inline mr-1.5" />
                  Vincular a trabajo o presupuesto (opcional)
                </label>

                {/* Type selector */}
                <div className="flex gap-2 mb-3">
                  {[{ v: '', label: 'Ninguno' }, { v: 'work', label: 'Trabajo', icon: FaHardHat }, { v: 'budget', label: 'Presupuesto', icon: FaFileAlt }].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => {
                        setFormData(p => ({ ...p, linkedEntityType: opt.v, linkedEntityId: '', linkedEntityLabel: '' }));
                        setLinkSearch('');
                        setLinkResults([]);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                        formData.linkedEntityType === opt.v
                          ? opt.v === 'work'   ? 'bg-amber-50 border-amber-400 text-amber-700'
                          : opt.v === 'budget' ? 'bg-sky-50 border-sky-400 text-sky-700'
                          : 'bg-slate-100 border-slate-400 text-slate-700'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {opt.icon && <opt.icon className="w-3 h-3" />}
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Search when type is selected */}
                {formData.linkedEntityType && (
                  <div className="relative">
                    {formData.linkedEntityId ? (
                      /* Selected entity chip */
                      <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-2 ${
                        formData.linkedEntityType === 'work'
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'bg-sky-50 border-sky-300 text-sky-800'
                      }`}>
                        {formData.linkedEntityType === 'work' ? <FaHardHat className="w-3.5 h-3.5 flex-shrink-0" /> : <FaFileAlt className="w-3.5 h-3.5 flex-shrink-0" />}
                        <span className="text-sm font-medium flex-1 truncate">{formData.linkedEntityLabel || formData.linkedEntityId}</span>
                        <button type="button" onClick={clearLink} className="flex-shrink-0 hover:text-rose-500 transition-colors">
                          <FaTimesCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      /* Search input */
                      <>
                        <div className="relative">
                          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={linkSearch}
                            onChange={e => handleLinkSearch(e.target.value, formData.linkedEntityType)}
                            placeholder={formData.linkedEntityType === 'work'
                              ? 'Buscar por dirección del trabajo...'
                              : 'Buscar por cliente o dirección...'}
                            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm placeholder-slate-300"
                          />
                          {linkLoading && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                          )}
                        </div>
                        {linkResults.length > 0 && (
                          <ul className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                            {linkResults.map(res => {
                              const isWork = !!res.idWork;
                              const label = isWork
                                ? res.propertyAddress
                                : `${res.applicantName} — ${res.propertyAddress}`;
                              return (
                                <li
                                  key={isWork ? res.idWork : res.idBudget}
                                  onClick={() => selectLinkResult(res)}
                                  className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                                >
                                  {isWork ? <FaHardHat className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> : <FaFileAlt className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />}
                                  <span className="text-sm text-slate-700 truncate">{label}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {linkSearch.length > 1 && !linkLoading && linkResults.length === 0 && (
                          <p className="text-xs text-slate-400 mt-1.5">Sin resultados para "{linkSearch}"</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Broadcast option — admin/owner only */}
              {isAdmin && (
                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all select-none ${
                  formData.isBroadcast
                    ? 'border-violet-400 bg-violet-50 shadow-sm shadow-violet-100'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.isBroadcast}
                    onChange={e => setFormData(p => ({ ...p, isBroadcast: e.target.checked, assignedTo: [] }))}
                    className="rounded accent-violet-600 w-4 h-4 flex-shrink-0"
                  />
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    formData.isBroadcast ? 'bg-violet-200' : 'bg-slate-100'
                  }`}>
                    <FaBroadcastTower className={`w-4 h-4 ${formData.isBroadcast ? 'text-violet-600' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-700">Enviar a todos los empleados</span>
                    <p className="text-xs text-slate-400 mt-0.5">Todos los empleados activos recibirán este recordatorio</p>
                  </div>
                </label>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creando...
                    </span>
                  ) : 'Crear recordatorio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Individual Reminder Card ---
function ReminderCard({
  reminder: r,
  currentStaff,
  isAdmin,
  isEditing,
  editForm,
  setEditForm,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleComplete,
  onDelete,
  canManage,
  showComments,
  onToggleComments,
  commentInput,
  onCommentChange,
  onAddComment,
  onDeleteComment,
  commentLoading,
  viewingAll,
  onNavigateLink,
}) {
  const pCfg = PRIORITY_CONFIG[r.priority] || PRIORITY_CONFIG.medium;
  const tCfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.personal;
  const TypeIcon = tCfg.icon;
  const fleetCompany = getFleetCompanyFromReminder(r);

  const isCompleted = viewingAll
    ? r.assignments?.every(a => a.completed)
    : (() => {
        // Own assignment is completed
        if (r.myAssignment?.completed) return true;
        // I'm the creator and all OTHER assignees completed it → show as done
        if (r.createdBy === currentStaff?.id && r.assignments?.length > 0) {
          const otherAssignments = r.assignments.filter(a => a.staff?.id !== currentStaff?.id);
          if (otherAssignments.length > 0 && otherAssignments.every(a => a.completed)) return true;
        }
        return false;
      })();

  const isOverdue = r.dueDate && !isCompleted && new Date(r.dueDate) < new Date();

  return (
    <div className={`bg-white rounded-2xl border-l-4 shadow-sm hover:shadow-md transition-all duration-200 ${
      isCompleted
        ? 'border-l-emerald-400 opacity-60'
        : isOverdue
          ? 'border-l-rose-500'
          : pCfg.border
    }`}>
      <div className="px-5 py-4">
        {/* Top row */}
        <div className="flex items-start gap-3">
          {/* Complete toggle */}
          {!viewingAll && (
            <button
              onClick={onToggleComplete}
              title={isCompleted ? 'Marcar como pendiente' : 'Marcar como completado'}
              className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                isCompleted
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-200'
                  : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50'
              }`}
            >
              {isCompleted && <FaCheck className="w-3 h-3" />}
            </button>
          )}

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-indigo-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    value={editForm.priority}
                    onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <input
                    type="date"
                    value={editForm.dueDate}
                    onChange={e => setEditForm(p => ({ ...p, dueDate: e.target.value }))}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                  <button onClick={onSaveEdit} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors">Guardar</button>
                  <button onClick={onCancelEdit} className="px-4 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-semibold text-slate-800 leading-snug ${
                    isCompleted ? 'line-through text-slate-400' : ''
                  }`}>
                    {cap(r.title)}
                  </h3>
                  {canManage && (
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100">
                      <button onClick={onEdit} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-500 transition-colors">
                        <FaEdit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={onDelete} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 transition-colors">
                        <FaTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {r.description && (
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{cap(r.description)}</p>
                )}
              </>
            )}

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              {fleetCompany && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {fleetCompany}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${pCfg.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />
                {pCfg.label}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tCfg.pill}`}>
                <TypeIcon className="w-3 h-3" />
                {tCfg.label}
              </span>
              {r.dueDate && (
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                  isOverdue ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full' : 'text-slate-400'
                }`}>
                  <FaCalendarAlt className="w-3 h-3" />
                  {isOverdue && 'Vencido · '}
                  {new Date(r.dueDate + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
              {r.linkedEntityType && r.linkedEntityId && (
                <button
                  onClick={onNavigateLink}
                  title={`Ir al ${r.linkedEntityType === 'work' ? 'trabajo' : 'presupuesto'}`}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
                    r.linkedEntityType === 'work'
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                  }`}
                >
                  {r.linkedEntityType === 'work' ? <FaHardHat className="w-3 h-3" /> : <FaFileAlt className="w-3 h-3" />}
                  {r.linkedEntityLabel
                    ? r.linkedEntityLabel.length > 28 ? r.linkedEntityLabel.slice(0, 28) + '…' : r.linkedEntityLabel
                    : (r.linkedEntityType === 'work' ? 'Ver trabajo' : 'Ver presupuesto')}
                  <FaExternalLinkAlt className="w-2.5 h-2.5 ml-0.5" />
                </button>
              )}
              {r.creator && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <FaUser className="w-3 h-3" />
                  {r.creator.name}
                </span>
              )}
            </div>

            {/* Assignments in "all" view */}
            {viewingAll && r.assignments && r.assignments.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {r.assignments.map(a => (
                  <span key={a.id} className={`inline-flex items-center gap-1. px-2.5 py-1 rounded-full text-xs font-medium ${
                    a.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {a.completed
                      ? <FaCheck className="w-2.5 h-2.5" />
                      : <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />}
                    {a.staff?.name || 'Staff'}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right action buttons */}
          {!isEditing && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* Navigate to linked entity */}
              {r.linkedEntityType && r.linkedEntityId && (
                <button
                  onClick={onNavigateLink}
                  title={`Ir al ${r.linkedEntityType === 'work' ? 'trabajo' : 'presupuesto'}: ${r.linkedEntityLabel || r.linkedEntityId}`}
                  className={`p-2 rounded-xl transition-colors ${
                    r.linkedEntityType === 'work'
                      ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-50'
                      : 'text-sky-400 hover:text-sky-600 hover:bg-sky-50'
                  }`}
                >
                  <FaExternalLinkAlt className="w-3.5 h-3.5" />
                </button>
              )}
              {canManage && (
                <>
                  <button onClick={onEdit} className="p-2 hover:bg-slate-100 rounded-xl text-slate-300 hover:text-indigo-500 transition-colors">
                    <FaEdit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={onDelete} className="p-2 hover:bg-rose-50 rounded-xl text-slate-300 hover:text-rose-500 transition-colors">
                    <FaTrash className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Comments section */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <button
            onClick={onToggleComments}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-indigo-500 font-medium transition-colors"
          >
            <FaComment className="w-3.5 h-3.5" />
            {r.comments?.length > 0
              ? `${r.comments.length} comentario${r.comments.length !== 1 ? 's' : ''}`
              : 'Agregar comentario'}
            {showComments ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />}
          </button>

          {showComments && (
            <div className="mt-3 space-y-2">
              {(r.comments || []).map(c => (
                <div key={c.id} className="flex items-start gap-2">
                  <div className="flex-1 bg-slate-50 rounded-xl px-3.5 py-2.5 text-sm">
                    <span className="font-semibold text-slate-600 text-xs">{c.author?.name || 'Staff'} </span>
                    <span className="text-xs text-slate-400 mr-2">
                      {new Date(c.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                    <p className="text-slate-700 mt-0.5">{c.message}</p>
                  </div>
                  {(c.staffId === currentStaff?.id || isAdmin) && (
                    <button
                      onClick={() => onDeleteComment(c.id)}
                      className="mt-1 p-1.5 text-slate-300 hover:text-rose-400 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <FaTrash className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={e => onCommentChange(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onAddComment()}
                  placeholder="Escribe un comentario..."
                  className="flex-1 px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 placeholder-slate-300"
                />
                <button
                  onClick={onAddComment}
                  disabled={commentLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {commentLoading ? '...' : 'Enviar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
