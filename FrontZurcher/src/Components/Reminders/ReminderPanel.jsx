import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import {
  fetchMyReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  toggleComplete,
  addComment,
  deleteComment,
  updateComment,
  searchWorksForLink,
  searchBudgetsForLink,
} from '../../Redux/Actions/reminderActions';
import { fetchStaff } from '../../Redux/Actions/adminActions';
import {
  FaBell, FaPlus, FaCheck, FaTrash, FaEdit, FaComment,
  FaTimes, FaChevronDown, FaChevronUp, FaUser, FaBroadcastTower,
  FaTag, FaLock, FaExclamationTriangle, FaCalendarAlt,
  FaExternalLinkAlt, FaSearch, FaHardHat, FaFileAlt, FaTimesCircle, FaBook,
  FaClipboardList
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { formatDateOnlyInDisplayTz, formatDateInDisplayTz, isDateOnlyOverdueInDisplayTz } from '../../utils/timezoneDisplay';

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
  createType: 'personal',
  assignedTo: [],
  linkedEntityType: '',    // 'work' | 'budget' | ''
  linkedEntityId: '',
  linkedEntityLabel: '',
};

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const PRIORITY_ORDER = ['low', 'medium', 'high', 'urgent'];

const TAGGABLE_ROLES = ['admin', 'owner', 'recept', 'finance'];

const BOARD_AVATAR_COLORS = [
  'from-blue-500 to-indigo-600', 'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600', 'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600', 'from-cyan-500 to-sky-600',
];
const boardAvatarColor = (name = '') => BOARD_AVATAR_COLORS[name.charCodeAt(0) % BOARD_AVATAR_COLORS.length];


const priorityButtonClass = (key, selected) => {
  const config = PRIORITY_CONFIG[key] || PRIORITY_CONFIG.medium;
  if (selected) {
    return `border-transparent ${config.pill} ring-2 ring-offset-1 ring-slate-300`;
  }
  return 'border-slate-200 text-slate-500 hover:bg-slate-50';
};

const getFleetCompanyFromReminder = (reminder) => {
  if (reminder?.linkedEntityType !== 'fleet') return null;
  const desc = reminder?.description || '';
  const match = desc.match(/Empresa:\s*(.+)/i);
  if (!match?.[1]) return null;
  return match[1].trim().toUpperCase();
};

const isKbDocReminder = (reminder) => reminder?.linkedEntityType === 'kb_doc';

export default function ReminderPanel() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { reminders, loading } = useSelector(s => s.reminders);
  const { currentStaff } = useSelector(s => s.auth);
  const { staffList = [] } = useSelector(s => s.admin);

  const isAdmin = ['admin', 'owner'].includes(currentStaff?.role);
  const isOwner = currentStaff?.role === 'owner';

  const [tab, setTab] = useState('general');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterPriority, setFilterPriority] = useState('');
  const [sortMode, setSortMode] = useState('dueFirst');

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
  const [commentTaggedStaffByReminder, setCommentTaggedStaffByReminder] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const [editingCommentByReminder, setEditingCommentByReminder] = useState({});
  const [commentEditInputByReminder, setCommentEditInputByReminder] = useState({});
  const [commentEditTaggedStaffByReminder, setCommentEditTaggedStaffByReminder] = useState({});

  useEffect(() => {
    dispatch(fetchMyReminders());
    dispatch(fetchStaff());
  }, [dispatch]);


  const taggedByComment = (r) => {
    const myId = currentStaff?.id;
    if (!myId) return false;
    return (r.comments || []).some(c => Array.isArray(c.taggedStaffIds) && c.taggedStaffIds.includes(myId));
  };

  const activeList = reminders.filter((r) => {
    if (tab === 'private') {
      return r.type === 'personal' && r.createdBy === currentStaff?.id;
    }
    if (tab === 'tagged') {
      return (r.type === 'tagged' && !!r.myAssignment) || taggedByComment(r);
    }
    if (tab === 'general') {
      return r.type === 'broadcast';
    }
    return true;
  });

  const filtered = activeList.filter(r => {
    if (filterPriority && r.priority !== filterPriority) return false;
    if (filterStatus === 'pending') {
      return !r.myAssignment?.completed;
    }
    if (filterStatus === 'completed') {
      return r.myAssignment?.completed;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aCreated = new Date(a.createdAt || 0).getTime();
    const bCreated = new Date(b.createdAt || 0).getTime();

    if (sortMode === 'createdDesc') {
      return bCreated - aCreated;
    }

    const hasDueA = !!a.dueDate;
    const hasDueB = !!b.dueDate;
    if (hasDueA && !hasDueB) return -1;
    if (!hasDueA && hasDueB) return 1;

    if (hasDueA && hasDueB) {
      const aDue = new Date(a.dueDate).getTime();
      const bDue = new Date(b.dueDate).getTime();
      if (aDue !== bDue) return aDue - bDue;
    }

    return bCreated - aCreated;
  });

  const pendingCount = reminders.filter(r => !r.myAssignment?.completed).length;

  const groupedReminders = sorted.reduce((acc, reminder) => {
    let key, label;
    if (isKbDocReminder(reminder)) {
      key = 'kb_doc';
      label = 'Knowledge Base';
    } else {
      const company = getFleetCompanyFromReminder(reminder);
      key = company ? `fleet-${company}` : 'general';
      label = company ? `Fleet - ${company}` : 'General';
    }

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

  // Lista general → siempre agrupada por empleado
  const employeeGroups = (() => {
    if (tab !== 'general') return [];
    const groups = {};
    filtered.forEach(r => {
      const assignees = (r.assignments || []).filter(a => a.staff?.id);
      if (assignees.length === 0) {
        const creator = staffList.find(s => s.id === r.createdBy) || currentStaff;
        const key = `p-${r.createdBy}`;
        if (!groups[key]) groups[key] = { key, id: r.createdBy, name: creator?.name || 'Yo', role: creator?.role || '', items: [] };
        if (!groups[key].items.find(e => e.id === r.id)) groups[key].items.push(r);
      } else {
        assignees.forEach(a => {
          const key = `s-${a.staff.id}`;
          if (!groups[key]) groups[key] = { key, id: a.staff.id, name: a.staff.name, role: a.staff.role || '', items: [] };
          if (!groups[key].items.find(e => e.id === r.id)) groups[key].items.push(r);
        });
      }
    });
    return Object.values(groups).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  })();

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
      const type = formData.createType || 'personal';

      if (type === 'tagged' && formData.assignedTo.length === 0) {
        return toast.error('Selecciona al menos una persona para recordatorio etiquetado');
      }

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
    const assignedTo = (r.assignments || [])
      .map(a => a.staff?.id || a.staffId || a.staff_id)
      .filter(Boolean)
      .filter(id => id !== r.createdBy);

    setEditingId(r.id);
    setEditForm({
      title: r.title,
      description: r.description || '',
      priority: r.priority,
      dueDate: r.dueDate || '',
      type: r.type || 'personal',
      assignedTo,
      linkedEntityType:  r.linkedEntityType  || '',
      linkedEntityId:    r.linkedEntityId    || '',
      linkedEntityLabel: r.linkedEntityLabel || '',
    });
  };

  const saveEdit = async (id) => {
    try {
      await dispatch(updateReminder(id, {
        ...editForm,
        type: editForm.type,
        assignedTo: editForm.type === 'tagged' ? (editForm.assignedTo || []) : [],
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
    const taggedStaffIds = commentTaggedStaffByReminder[reminderId] || [];
    setCommentLoading(p => ({ ...p, [reminderId]: true }));
    try {
      await dispatch(addComment(reminderId, msg, taggedStaffIds));
      setCommentInputs(p => ({ ...p, [reminderId]: '' }));
      setCommentTaggedStaffByReminder(p => ({ ...p, [reminderId]: [] }));
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

  const startEditComment = (reminderId, comment) => {
    setEditingCommentByReminder(p => ({ ...p, [reminderId]: comment.id }));
    setCommentEditInputByReminder(p => ({ ...p, [reminderId]: comment.message || '' }));
    setCommentEditTaggedStaffByReminder(p => ({ ...p, [reminderId]: comment.taggedStaffIds || [] }));
  };

  const cancelEditComment = (reminderId) => {
    setEditingCommentByReminder(p => ({ ...p, [reminderId]: null }));
    setCommentEditInputByReminder(p => ({ ...p, [reminderId]: '' }));
    setCommentEditTaggedStaffByReminder(p => ({ ...p, [reminderId]: [] }));
  };

  const saveEditComment = async (reminderId, commentId) => {
    const message = (commentEditInputByReminder[reminderId] || '').trim();
    const taggedStaffIds = commentEditTaggedStaffByReminder[reminderId] || [];
    if (!message) return toast.error('El comentario no puede estar vacío');
    try {
      await dispatch(updateComment(reminderId, commentId, message, taggedStaffIds));
      cancelEditComment(reminderId);
      toast.success('Comentario actualizado');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const canEditReminder = (r) => r.createdBy === currentStaff?.id || isAdmin;
  const canDeleteReminder = () => isOwner;

  // ---- Assigned staff selector ----
  const toggleAssigned = (staffId) => {
    setFormData(p => ({
      ...p,
      assignedTo: p.assignedTo.includes(staffId)
        ? p.assignedTo.filter(id => id !== staffId)
        : [...p.assignedTo, staffId],
    }));
  };

  const activeStaff = staffList.filter(s => s.isActive && s.id !== currentStaff?.id && TAGGABLE_ROLES.includes(s.role));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 shadow-xl">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 sm:py-6">

          {/* Fila título + botones */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-white/10 backdrop-blur items-center justify-center border border-white/20 shadow-inner flex-shrink-0">
                <FaBell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Recordatorios</h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {pendingCount > 0
                    ? <span className="text-amber-400 font-medium">{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span>
                    : <span className="text-emerald-400">Todo al día ✓</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to="/reminders-board"
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all"
              >
                <FaClipboardList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ver Tablero</span>
                <span className="sm:hidden">Tablero</span>
              </Link>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-lg"
              >
                <FaPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nuevo recordatorio</span>
                <span className="sm:hidden">Nuevo</span>
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>

            {/* Tabs */}
            <div className="flex bg-white/10 rounded-xl p-1 gap-1 flex-shrink-0">
              {[
                { key: 'private', label: 'Privados', full: 'Mis privados' },
                { key: 'tagged', label: 'Para mí', full: 'Etiquetados para mi' },
                { key: 'general', label: 'General', full: 'Lista general' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    tab === t.key ? 'bg-white text-slate-800 shadow' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="hidden sm:inline">{t.full}</span>
                  <span className="sm:hidden">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Estado */}
            <div className="flex bg-white/10 rounded-xl p-1 gap-1 flex-shrink-0">
              {[{ k: 'pending', v: 'Pend.', full: 'Pendientes' }, { k: 'completed', v: 'Comp.', full: 'Completados' }, { k: 'all', v: 'Todos' }].map(f => (
                <button
                  key={f.k}
                  onClick={() => setFilterStatus(f.k)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    filterStatus === f.k ? 'bg-white text-slate-800 shadow' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="hidden sm:inline">{f.full || f.v}</span>
                  <span className="sm:hidden">{f.v}</span>
                </button>
              ))}
            </div>

            {/* Ordenar — solo en tabs de lista (no en General que es por empleado) */}
            {tab !== 'general' && (
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value)}
                className="flex-shrink-0 px-2.5 sm:px-3 py-2 text-xs sm:text-sm rounded-xl bg-white/10 text-slate-300 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 hover:bg-white/15 transition-colors"
              >
                <option value="dueFirst" className="text-slate-800">Vencimiento</option>
                <option value="createdDesc" className="text-slate-800">Más reciente</option>
              </select>
            )}

            {/* Prioridad */}
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="flex-shrink-0 px-2.5 sm:px-3 py-2 text-xs sm:text-sm rounded-xl bg-white/10 text-slate-300 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 hover:bg-white/15 transition-colors"
            >
              <option value="" className="text-slate-800">Prioridad</option>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                <option key={k} value={k} className="text-slate-800">{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-3 py-4 sm:px-6 sm:py-6">

        {/* ─── Lista general → siempre por empleado ─── */}
        {tab === 'general' && (
          employeeGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <FaBell className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">Sin recordatorios en esta vista</p>
              <p className="text-slate-400 text-sm mt-1">Ajusta los filtros o crea un nuevo recordatorio</p>
            </div>
          ) : (
            <div className="space-y-8">
              {employeeGroups.map(group => {
                const groupPending = group.items.filter(r => !r.myAssignment?.completed).length;
                const groupOverdue = group.items.filter(r =>
                  r.dueDate && !r.myAssignment?.completed && isDateOnlyOverdueInDisplayTz(r.dueDate)
                ).length;
                return (
                  <div key={group.key}>
                    {/* Cabecera ámbar del empleado */}
                    <div className={`flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl border-2 ${
                      groupPending === 0 ? 'bg-emerald-50 border-emerald-200'
                      : groupOverdue > 0 ? 'bg-amber-50 border-orange-300'
                      : 'bg-amber-50 border-amber-200'
                    }`}>
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${boardAvatarColor(group.name)} text-white font-bold text-sm flex items-center justify-center shadow flex-shrink-0`}>
                        {group.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800">{group.name}</p>
                        <p className="text-[11px] text-slate-500 capitalize">{group.role}</p>
                      </div>
                      {groupPending > 0 ? (
                        <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          groupOverdue > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-200 text-amber-800'
                        }`}>
                          {groupPending} pendiente{groupPending !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          ✓ Al día
                        </span>
                      )}
                    </div>

                    {/* ReminderCards completos — misma funcionalidad que la lista */}
                    <div className="space-y-3 sm:pl-4">
                      {group.items.map(r => (
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
                          canEdit={canEditReminder(r)}
                          canDelete={canDeleteReminder()}
                          showComments={!!expandedComments[r.id]}
                          onToggleComments={() => toggleComments(r.id)}
                          commentInput={commentInputs[r.id] || ''}
                          onCommentChange={v => setCommentInputs(p => ({ ...p, [r.id]: v }))}
                          commentTaggedStaffIds={commentTaggedStaffByReminder[r.id] || []}
                          onCommentTaggedStaffChange={(ids) => setCommentTaggedStaffByReminder(p => ({ ...p, [r.id]: ids }))}
                          onAddComment={() => handleAddComment(r.id)}
                          onDeleteComment={(cId) => handleDeleteComment(r.id, cId)}
                          editingCommentId={editingCommentByReminder[r.id] || null}
                          onStartEditComment={(comment) => startEditComment(r.id, comment)}
                          onCancelEditComment={() => cancelEditComment(r.id)}
                          commentEditInput={commentEditInputByReminder[r.id] || ''}
                          onCommentEditInputChange={(value) => setCommentEditInputByReminder(p => ({ ...p, [r.id]: value }))}
                          commentEditTaggedStaffIds={commentEditTaggedStaffByReminder[r.id] || []}
                          onCommentEditTaggedStaffChange={(ids) => setCommentEditTaggedStaffByReminder(p => ({ ...p, [r.id]: ids }))}
                          onSaveEditComment={(commentId) => saveEditComment(r.id, commentId)}
                          commentLoading={!!commentLoading[r.id]}
                          viewingAll={false}
                          staffList={staffList}
                          onNavigateLink={() => navigate(
                            r.linkedEntityType === 'work'
                              ? `/work/${r.linkedEntityId}`
                              : r.linkedEntityType === 'kb_doc'
                              ? '/knowledge-base'
                              : '/budgets'
                          )}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ─── Mis privados / Etiquetados → lista clásica ─── */}
        {tab !== 'general' && (loading && reminders.length === 0 ? (
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
                    canEdit={canEditReminder(r)}
                    canDelete={canDeleteReminder()}
                    showComments={!!expandedComments[r.id]}
                    onToggleComments={() => toggleComments(r.id)}
                    commentInput={commentInputs[r.id] || ''}
                    onCommentChange={v => setCommentInputs(p => ({ ...p, [r.id]: v }))}
                    commentTaggedStaffIds={commentTaggedStaffByReminder[r.id] || []}
                    onCommentTaggedStaffChange={(ids) => setCommentTaggedStaffByReminder(p => ({ ...p, [r.id]: ids }))}
                    onAddComment={() => handleAddComment(r.id)}
                    onDeleteComment={(cId) => handleDeleteComment(r.id, cId)}
                    editingCommentId={editingCommentByReminder[r.id] || null}
                    onStartEditComment={(comment) => startEditComment(r.id, comment)}
                    onCancelEditComment={() => cancelEditComment(r.id)}
                    commentEditInput={commentEditInputByReminder[r.id] || ''}
                    onCommentEditInputChange={(value) => setCommentEditInputByReminder(p => ({ ...p, [r.id]: value }))}
                    commentEditTaggedStaffIds={commentEditTaggedStaffByReminder[r.id] || []}
                    onCommentEditTaggedStaffChange={(ids) => setCommentEditTaggedStaffByReminder(p => ({ ...p, [r.id]: ids }))}
                    onSaveEditComment={(commentId) => saveEditComment(r.id, commentId)}
                    commentLoading={!!commentLoading[r.id]}
                    viewingAll={false}
                    staffList={staffList}
                    onNavigateLink={() => navigate(
                      r.linkedEntityType === 'work'
                        ? `/work/${r.linkedEntityId}`
                        : r.linkedEntityType === 'kb_doc'
                        ? '/knowledge-base'
                        : '/budgets'
                    )}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        ))}
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

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Visibilidad</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, createType: 'personal', assignedTo: [] }))}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      formData.createType === 'personal'
                        ? 'bg-slate-100 border-slate-400 text-slate-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Privado (solo yo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, createType: 'tagged' }))}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      formData.createType === 'tagged'
                        ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Etiquetado
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, createType: 'broadcast', assignedTo: [] }))}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      formData.createType === 'broadcast'
                        ? 'bg-violet-100 border-violet-400 text-violet-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    General (todos)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Importancia</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIORITY_ORDER.map((key) => {
                      const cfg = PRIORITY_CONFIG[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFormData(p => ({ ...p, priority: key }))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${priorityButtonClass(key, formData.priority === key)}`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
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

              {/* Staff tagging */}
              {formData.createType === 'tagged' && (
                <div>
                  <label className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    <span><FaTag className="inline mr-1.5" />Etiquetar a</span>
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
                    <p className="text-xs text-amber-600 mt-1.5">Selecciona al menos una persona</p>
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
  canEdit,
  canDelete,
  showComments,
  onToggleComments,
  commentInput,
  onCommentChange,
  commentTaggedStaffIds,
  onCommentTaggedStaffChange,
  onAddComment,
  onDeleteComment,
  editingCommentId,
  onStartEditComment,
  onCancelEditComment,
  commentEditInput,
  onCommentEditInputChange,
  commentEditTaggedStaffIds,
  onCommentEditTaggedStaffChange,
  onSaveEditComment,
  commentLoading,
  viewingAll,
  staffList,
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

  const isOverdue = r.dueDate && !isCompleted && isDateOnlyOverdueInDisplayTz(r.dueDate);
  const editableStaff = (staffList || [])
    .filter(s => s.isActive && TAGGABLE_ROLES.includes(s.role))
    .filter(s => s.id !== currentStaff?.id);

  const toggleCommentTag = (staffId) => {
    const current = commentTaggedStaffIds || [];
    const next = current.includes(staffId)
      ? current.filter(id => id !== staffId)
      : [...current, staffId];
    onCommentTaggedStaffChange(next);
  };

  const toggleCommentEditTag = (staffId) => {
    const current = commentEditTaggedStaffIds || [];
    const next = current.includes(staffId)
      ? current.filter(id => id !== staffId)
      : [...current, staffId];
    onCommentEditTaggedStaffChange(next);
  };

  const getStaffName = (staffId) => {
    const match = (staffList || []).find(s => s.id === staffId);
    return match?.name || 'Staff';
  };

  const toggleEditAssigned = (staffId) => {
    setEditForm((prev) => {
      const current = prev.assignedTo || [];
      const assignedTo = current.includes(staffId)
        ? current.filter(id => id !== staffId)
        : [...current, staffId];
      return { ...prev, assignedTo };
    });
  };

  return (
    <div className={`group bg-white rounded-2xl border-l-4 shadow-sm hover:shadow-md transition-all duration-200 ${
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
                  <button
                    type="button"
                    onClick={() => setEditForm(p => ({ ...p, type: 'personal', assignedTo: [] }))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                      editForm.type === 'personal'
                        ? 'bg-slate-100 border-slate-400 text-slate-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Personal
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm(p => ({ ...p, type: 'tagged' }))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                      editForm.type === 'tagged'
                        ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Etiquetado
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm(p => ({ ...p, type: 'broadcast', assignedTo: [] }))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                      editForm.type === 'broadcast'
                        ? 'bg-violet-100 border-violet-400 text-violet-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    General
                  </button>
                </div>

                {editForm.type === 'tagged' && (
                  <div className="border border-slate-200 rounded-xl p-2 max-h-40 overflow-y-auto bg-slate-50">
                    {editableStaff.length === 0 ? (
                      <p className="text-xs text-slate-400 p-2">Sin staff disponible para etiquetar</p>
                    ) : (
                      <div className="space-y-1">
                        {editableStaff.map((s) => {
                          const checked = (editForm.assignedTo || []).includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer border ${
                                checked
                                  ? 'bg-indigo-50 border-indigo-200'
                                  : 'bg-white border-transparent hover:border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleEditAssigned(s.id)}
                                  className="accent-indigo-600"
                                />
                                <span className="text-xs font-medium text-slate-700">{s.name}</span>
                              </div>
                              <span className="text-[10px] uppercase text-slate-400">{s.role}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITY_ORDER.map((key) => {
                    const cfg = PRIORITY_CONFIG[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setEditForm(p => ({ ...p, priority: key }))}
                        className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${priorityButtonClass(key, editForm.priority === key)}`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
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
                  {(canEdit || canDelete) && (
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100">
                      {canEdit && (
                        <button onClick={onEdit} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-500 transition-colors">
                          <FaEdit className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={onDelete} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 transition-colors">
                          <FaTrash className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                  {formatDateOnlyInDisplayTz(r.dueDate, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
              {r.linkedEntityType && r.linkedEntityId && (
                <button
                  onClick={onNavigateLink}
                  title={`Ir al ${ r.linkedEntityType === 'work' ? 'trabajo' : r.linkedEntityType === 'kb_doc' ? 'Knowledge Base' : 'presupuesto'}`}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
                    r.linkedEntityType === 'work'
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : r.linkedEntityType === 'kb_doc'
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                  }`}
                >
                  {r.linkedEntityType === 'work' ? <FaHardHat className="w-3 h-3" /> : r.linkedEntityType === 'kb_doc' ? <FaBook className="w-3 h-3" /> : <FaFileAlt className="w-3 h-3" />}
                  {r.linkedEntityLabel
                    ? r.linkedEntityLabel.length > 28 ? r.linkedEntityLabel.slice(0, 28) + '…' : r.linkedEntityLabel
                    : (r.linkedEntityType === 'work' ? 'Ver trabajo' : r.linkedEntityType === 'kb_doc' ? 'Ver documento' : 'Ver presupuesto')}
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
                  title={`Ir al ${r.linkedEntityType === 'work' ? 'trabajo' : r.linkedEntityType === 'kb_doc' ? 'Knowledge Base' : 'presupuesto'}: ${r.linkedEntityLabel || r.linkedEntityId}`}
                  className={`p-2 rounded-xl transition-colors ${
                    r.linkedEntityType === 'work'
                      ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-50'
                      : r.linkedEntityType === 'kb_doc'
                      ? 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'
                      : 'text-sky-400 hover:text-sky-600 hover:bg-sky-50'
                  }`}
                >
                  <FaExternalLinkAlt className="w-3.5 h-3.5" />
                </button>
              )}
              {(canEdit || canDelete) && (
                <>
                  {canEdit && (
                    <button onClick={onEdit} className="p-2 hover:bg-slate-100 rounded-xl text-slate-300 hover:text-indigo-500 transition-colors">
                      <FaEdit className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={onDelete} className="p-2 hover:bg-rose-50 rounded-xl text-slate-300 hover:text-rose-500 transition-colors">
                      <FaTrash className="w-3.5 h-3.5" />
                    </button>
                  )}
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
                      {formatDateInDisplayTz(c.createdAt, { day: 'numeric', month: 'short' })}
                    </span>
                    {editingCommentId === c.id ? (
                      <div className="mt-1 space-y-2">
                        <input
                          type="text"
                          value={commentEditInput}
                          onChange={e => onCommentEditInputChange(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSaveEditComment(c.id)}
                          className="w-full px-3 py-1.5 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        />
                        <div className="flex flex-wrap gap-2">
                          {editableStaff.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => toggleCommentEditTag(s.id)}
                              className={`px-2 py-0.5 rounded-full text-[11px] border ${
                                (commentEditTaggedStaffIds || []).includes(s.id)
                                  ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                  : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              @{s.name}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSaveEditComment(c.id)}
                            className="px-2.5 py-1 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEditComment}
                            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-slate-700 mt-0.5">{c.message}</p>
                        {Array.isArray(c.taggedStaffIds) && c.taggedStaffIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {c.taggedStaffIds.map(taggedId => (
                              <span
                                key={`${c.id}-${taggedId}`}
                                className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-100 text-indigo-700"
                              >
                                @{getStaffName(taggedId)}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {(c.staffId === currentStaff?.id || isAdmin) && (
                    <div className="mt-1 flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => onStartEditComment(c)}
                        className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar comentario"
                      >
                        <FaEdit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteComment(c.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-400 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Eliminar comentario"
                      >
                        <FaTrash className="w-3 h-3" />
                      </button>
                    </div>
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
              <div className="flex flex-wrap gap-2">
                {editableStaff.map(s => (
                  <button
                    key={`${r.id}-${s.id}`}
                    type="button"
                    onClick={() => toggleCommentTag(s.id)}
                    className={`px-2 py-0.5 rounded-full text-[11px] border ${
                      (commentTaggedStaffIds || []).includes(s.id)
                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    @{s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
