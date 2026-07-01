import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  FaCheck, FaTrash, FaExclamationTriangle, FaSyncAlt,
  FaCalendarAlt, FaUser, FaClipboardList, FaBell, FaComment
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../../utils/axios';

// ─── Constantes de prioridad ────────────────────────────────────────────────

const PRIORITY = {
  urgent: { label: 'Urgente', dot: 'bg-rose-500',  row: 'bg-rose-50',   text: 'text-rose-700',  border: 'border-rose-300'  },
  high:   { label: 'Alta',    dot: 'bg-amber-500', row: 'bg-amber-50',  text: 'text-amber-700', border: 'border-amber-300' },
  medium: { label: 'Media',   dot: 'bg-sky-500',   row: 'bg-white',     text: 'text-sky-700',   border: ''                 },
  low:    { label: 'Baja',    dot: 'bg-slate-400', row: 'bg-white',     text: 'text-slate-500', border: ''                 },
};

const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600', 'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600', 'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600', 'from-cyan-500 to-sky-600',
];
const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const isOverdue = (dueDate, completed) => {
  if (!dueDate || completed) return false;
  return new Date(dueDate + 'T23:59:59') < new Date();
};

const fmtDate = (d) => {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Lunes de la semana actual — los completados anteriores no se muestran en "Esta semana"
const getWeekStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Dom, 1=Lun...
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
};

// ─── Componente de fila de recordatorio ─────────────────────────────────────

function ReminderRow({ reminder, onToggle, onDelete, isOwner, toggling, deleting }) {
  const { assignment } = reminder;
  const done = assignment?.completed;
  const overdue = isOverdue(reminder.dueDate, done);
  const pCfg = PRIORITY[reminder.priority] || PRIORITY.medium;

  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all group ${
      done
        ? 'bg-slate-50 border-slate-100 opacity-60'
        : overdue
          ? 'bg-red-50 border-red-200'
          : `${pCfg.row} border-slate-100`
    }`}>
      {/* Botón completar */}
      <button
        onClick={onToggle}
        disabled={toggling}
        title={done ? 'Marcar pendiente' : 'Marcar completado'}
        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          done
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50'
        } ${toggling ? 'opacity-50 cursor-wait' : ''}`}
      >
        {done && <FaCheck className="w-2.5 h-2.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {reminder.title}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            done ? 'bg-slate-100 text-slate-400' : `${pCfg.row} ${pCfg.text}`
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-slate-400' : pCfg.dot}`} />
            {pCfg.label}
          </span>
          {overdue && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
              <FaExclamationTriangle className="w-2.5 h-2.5" />
              VENCIDO
            </span>
          )}
          {reminder.dueDate && !overdue && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              <FaCalendarAlt className="w-2.5 h-2.5" />
              {fmtDate(reminder.dueDate)}
            </span>
          )}
          <span className="text-[10px] text-slate-400">
            asignado {fmtDate(reminder.createdAt?.slice(0, 10))}
            {reminder.creator?.name && (
              <> · <FaUser className="inline w-2 h-2 mr-0.5" />{reminder.creator.name}</>
            )}
          </span>
        </div>
      </div>

      {isOwner && (
        <button
          onClick={onDelete}
          disabled={deleting}
          className={`flex-shrink-0 p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 ${
            deleting ? 'opacity-50 cursor-wait' : ''
          }`}
          title="Eliminar recordatorio"
        >
          <FaTrash className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Tarjeta de staff ────────────────────────────────────────────────────────

function StaffCard({ staffData, showThisWeek, isOwner, currentStaffId, onRefresh }) {
  const [toggling, setToggling] = useState({});
  const [deleting, setDeleting] = useState({});
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmComment, setConfirmComment] = useState('');
  const [confirming, setConfirming] = useState(false);

  const reminders = staffData.reminders || [];
  const weekStart = getWeekStart();

  const visible = showThisWeek
    ? reminders.filter(r => {
        if (!r.assignment?.completed) return true;
        if (!r.assignment?.completedAt) return true;
        return new Date(r.assignment.completedAt) >= weekStart;
      })
    : reminders.filter(r => !r.assignment?.completed);

  const pendingCount = reminders.filter(r => !r.assignment?.completed).length;
  const overdueCount = reminders.filter(r => isOverdue(r.dueDate, r.assignment?.completed)).length;
  const allDone = reminders.length > 0 && pendingCount === 0;

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
    if (!r.assignment?.completed) return false;
    if (!r.assignment?.completedAt) return false;
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
            <p className="text-[11px] text-slate-500 capitalize">{staffData.role}</p>
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
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 p-3 space-y-1.5 overflow-y-auto max-h-72 sm:max-h-80">
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

      {/* Modal confirmación */}
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

// ─── Tablero principal ───────────────────────────────────────────────────────

export default function ReminderBoard() {
  const navigate = useNavigate();
  const { currentStaff } = useSelector(s => s.auth);
  const isOwner = ['admin', 'owner'].includes(currentStaff?.role);

  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showThisWeek, setShowThisWeek] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  const totalPending = board.reduce(
    (sum, s) => sum + (s.reminders || []).filter(r => !r.assignment?.completed).length, 0
  );
  const totalOverdue = board.reduce(
    (sum, s) => sum + (s.reminders || []).filter(r => isOverdue(r.dueDate, r.assignment?.completed)).length, 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-6">

          {/* Fila principal: título + botones */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
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
              {/* Toggle Pendientes / Esta semana */}
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

              {/* Refresh */}
              <button
                onClick={() => fetchBoard(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all"
              >
                <FaSyncAlt className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </button>

              {/* Panel clásico */}
              <button
                onClick={() => navigate('/reminders')}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all"
              >
                <FaClipboardList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Panel clásico</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {board.map(staffData => (
              <StaffCard
                key={staffData.id}
                staffData={staffData}
                showThisWeek={showThisWeek}
                isOwner={isOwner}
                currentStaffId={currentStaff?.id}
                onRefresh={() => fetchBoard(true)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
