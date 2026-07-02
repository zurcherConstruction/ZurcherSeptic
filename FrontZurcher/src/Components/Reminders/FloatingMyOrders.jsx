import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchMyReminders, toggleComplete } from '../../Redux/Actions/reminderActions';
import {
  FaClipboardList, FaChevronDown, FaChevronUp,
  FaCheck, FaExclamationTriangle, FaCalendarAlt, FaSyncAlt,
} from 'react-icons/fa';

const PRIORITY_DOT = {
  urgent: 'bg-rose-500',
  high:   'bg-amber-500',
  medium: 'bg-sky-500',
  low:    'bg-slate-400',
};

const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  return new Date(dueDate + 'T23:59:59') < new Date();
};

const fmtDate = (d) => {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const STORAGE_KEY = 'floating_orders_minimized';

export default function FloatingMyOrders() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { reminders }   = useSelector(s => s.reminders);
  const { isAuthenticated, currentStaff } = useSelector(s => s.auth);

  const [minimized,  setMinimized]  = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');
  const [toggling,   setToggling]   = useState({});
  const [refreshing, setRefreshing] = useState(false);

  if (!isAuthenticated || !currentStaff) return null;

  const pending      = reminders.filter(r => !r.myAssignment?.completed);
  const overdueCount = pending.filter(r => isOverdue(r.dueDate)).length;

  const toggle = (val) => {
    setMinimized(val);
    localStorage.setItem(STORAGE_KEY, val);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await dispatch(fetchMyReminders()); } finally { setRefreshing(false); }
  };

  const handleComplete = async (r) => {
    setToggling(p => ({ ...p, [r.id]: true }));
    try { await dispatch(toggleComplete(r.id)); } finally { setToggling(p => ({ ...p, [r.id]: false })); }
  };

  /* ── Minimizado ─────────────────────────────────────────────── */
  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => toggle(false)}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white pl-3 pr-2 py-2 rounded-2xl shadow-xl transition-all"
        >
          <FaClipboardList className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs font-semibold">Mis órdenes</span>
          {pending.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              overdueCount > 0 ? 'bg-red-500 text-white' : 'bg-amber-400 text-slate-900'
            }`}>
              {pending.length}
            </span>
          )}
          <FaChevronUp className="w-2.5 h-2.5 opacity-50 ml-0.5" />
        </button>
      </div>
    );
  }

  /* ── Expandido ───────────────────────────────────────────────── */
  return (
    <div className="fixed bottom-6 right-6 z-40 w-72 flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
         style={{ maxHeight: '30rem' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 text-white flex-shrink-0">
        <FaClipboardList className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-sm font-bold flex-1">Mis órdenes</span>
        {pending.length > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            overdueCount > 0 ? 'bg-red-500 text-white' : 'bg-amber-400 text-slate-900'
          }`}>
            {pending.length}
          </span>
        )}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Actualizar"
          className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <FaSyncAlt className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => toggle(true)}
          title="Minimizar"
          className="p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <FaChevronDown className="w-3 h-3" />
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-1.5 text-slate-400">
            <FaCheck className="w-5 h-5 text-emerald-400" />
            <p className="text-xs font-medium text-emerald-600">Todo al día</p>
          </div>
        ) : (
          pending.map(r => {
            const overdue = isOverdue(r.dueDate);
            return (
              <div
                key={r.id}
                className={`flex items-start gap-2.5 px-3 py-2.5 transition-colors ${
                  overdue ? 'bg-red-50' : 'hover:bg-slate-50'
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleComplete(r)}
                  disabled={!!toggling[r.id]}
                  title="Marcar completada"
                  className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    overdue
                      ? 'border-red-300 hover:border-red-500 hover:bg-red-100'
                      : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50'
                  } ${toggling[r.id] ? 'opacity-40 cursor-wait' : 'cursor-pointer'}`}
                >
                  {toggling[r.id] && <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />}
                </button>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">{r.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[r.priority] || PRIORITY_DOT.medium}`} />
                    {r.dueDate && (
                      <span className={`flex items-center gap-0.5 text-[10px] ${overdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                        {overdue ? <FaExclamationTriangle className="w-2 h-2" /> : <FaCalendarAlt className="w-2 h-2" />}
                        {fmtDate(r.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-100 flex-shrink-0">
        <button
          onClick={() => navigate('/reminders-board')}
          className="w-full text-xs text-slate-400 hover:text-amber-600 text-center font-medium transition-colors py-0.5"
        >
          Ver tablero completo →
        </button>
      </div>
    </div>
  );
}
