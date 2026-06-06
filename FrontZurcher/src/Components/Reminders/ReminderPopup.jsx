import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchMyReminders, toggleComplete } from '../../Redux/Actions/reminderActions';
import { FaBell, FaTimes, FaCheck, FaCalendarAlt, FaExternalLinkAlt, FaHardHat, FaFileAlt } from 'react-icons/fa';
import { formatDateOnlyInDisplayTz, isDateOnlyOverdueInDisplayTz } from '../../utils/timezoneDisplay';

const POPUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const getPopupKey = (staffId) => `reminder_popup_last_shown_${staffId}`;

const PRIORITY_CONFIG = {
  low:    { label: 'Baja',    pill: 'bg-slate-100 text-slate-500',   border: 'border-l-slate-300' },
  medium: { label: 'Media',   pill: 'bg-sky-100 text-sky-700',       border: 'border-l-sky-400' },
  high:   { label: 'Alta',    pill: 'bg-amber-100 text-amber-700',   border: 'border-l-amber-400' },
  urgent: { label: 'Urgente', pill: 'bg-rose-100 text-rose-700',     border: 'border-l-rose-500' },
};

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export default function ReminderPopup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { reminders } = useSelector(s => s.reminders);
  const { isAuthenticated, currentStaff } = useSelector(s => s.auth);

  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState({});

  const pendingReminders = reminders.filter(r => !r.myAssignment?.completed && !dismissed[r.id]);

  const shouldShowPopup = useCallback(() => {
    if (!currentStaff?.id) return false;
    const last = localStorage.getItem(getPopupKey(currentStaff.id));
    if (!last) return true;
    return Date.now() - parseInt(last, 10) > POPUP_INTERVAL_MS;
  }, [currentStaff?.id]);

  // Fetch reminders when authenticated
  useEffect(() => {
    if (isAuthenticated && currentStaff) {
      dispatch(fetchMyReminders());
    }
  }, [isAuthenticated, currentStaff, dispatch]);

  // Show popup when reminders are loaded and it's time
  useEffect(() => {
    if (!isAuthenticated) return;
    if (pendingReminders.length > 0 && shouldShowPopup()) {
      setVisible(true);
    }
  }, [reminders, isAuthenticated, shouldShowPopup]);

  // Schedule re-check every hour
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      dispatch(fetchMyReminders());
    }, POPUP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, dispatch]);

  const handleDismiss = () => {
    if (currentStaff?.id) localStorage.setItem(getPopupKey(currentStaff.id), Date.now().toString());
    setVisible(false);
  };

  const handleComplete = async (id) => {
    await dispatch(toggleComplete(id));
    setDismissed(p => ({ ...p, [id]: true }));
  };

  const handleDismissOne = (id) => {
    setDismissed(p => ({ ...p, [id]: true }));
  };

  // Auto-close when all visible items are dismissed
  useEffect(() => {
    if (visible && pendingReminders.length === 0) {
      if (currentStaff?.id) localStorage.setItem(getPopupKey(currentStaff.id), Date.now().toString());
      setVisible(false);
    }
  }, [pendingReminders, visible, currentStaff?.id]);

  if (!visible || pendingReminders.length === 0) return null;

  const isOverdue = (r) => r.dueDate && isDateOnlyOverdueInDisplayTz(r.dueDate);

  const urgentCount = pendingReminders.filter(r => r.priority === 'urgent').length;
  const overdueCount = pendingReminders.filter(r => isOverdue(r)).length;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden
                      animate-[slide-up_0.3s_ease-out] sm:animate-none">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-5 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
                  <FaBell className="w-5 h-5 text-white" />
                </div>
                {pendingReminders.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg">
                    {pendingReminders.length}
                  </span>
                )}
              </div>
              <div>
                <h2 className="font-bold text-white text-base leading-tight">Recordatorios pendientes</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {urgentCount > 0 && (
                    <span className="text-rose-400 font-semibold">{urgentCount} urgente{urgentCount !== 1 ? 's' : ''} · </span>
                  )}
                  {overdueCount > 0 && (
                    <span className="text-amber-400 font-semibold">{overdueCount} vencido{overdueCount !== 1 ? 's' : ''} · </span>
                  )}
                  {pendingReminders.length} total
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
              title="Cerrar (recordar en 1 hora)"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Reminder list */}
        <div className="overflow-y-auto flex-1 p-3 space-y-2 bg-slate-50">
          {pendingReminders.map(r => {
            const pCfg = PRIORITY_CONFIG[r.priority] || PRIORITY_CONFIG.medium;
            const overdue = isOverdue(r);

            return (
              <div
                key={r.id}
                className={`bg-white rounded-xl border-l-4 shadow-sm flex items-start gap-3 px-4 py-3 transition-all hover:shadow-md ${
                  overdue ? 'border-l-rose-500' : pCfg.border
                }`}
              >
                <button
                  onClick={() => handleComplete(r.id)}
                  title="Marcar como completado"
                  className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 transition-all flex items-center justify-center group"
                >
                  <FaCheck className="w-3 h-3 text-transparent group-hover:text-emerald-400 transition-colors" />
                </button>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm leading-snug">{cap(r.title)}</p>
                  {r.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{cap(r.description)}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pCfg.pill}`}>
                      {pCfg.label}
                    </span>
                    {r.dueDate && (
                      <span className={`text-xs flex items-center gap-1 font-medium ${
                        overdue ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full' : 'text-slate-400'
                      }`}>
                        <FaCalendarAlt className="w-3 h-3" />
                        {overdue && 'Vencido · '}
                        {formatDateOnlyInDisplayTz(r.dueDate, { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {r.linkedEntityType && r.linkedEntityId && (
                      <button
                        onClick={() => {
                          handleDismiss();
                          navigate(r.linkedEntityType === 'work' ? `/work/${r.linkedEntityId}` : '/budgets');
                        }}
                        title={`Ir al ${r.linkedEntityType === 'work' ? 'trabajo' : 'presupuesto'}`}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
                          r.linkedEntityType === 'work'
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                        }`}
                      >
                        {r.linkedEntityType === 'work'
                          ? <FaHardHat className="w-3 h-3" />
                          : <FaFileAlt className="w-3 h-3" />}
                        {r.linkedEntityLabel
                          ? r.linkedEntityLabel.length > 22 ? r.linkedEntityLabel.slice(0, 22) + '…' : r.linkedEntityLabel
                          : (r.linkedEntityType === 'work' ? 'Ver trabajo' : 'Ver presupuesto')}
                        <FaExternalLinkAlt className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDismissOne(r.id)}
                  className="flex-shrink-0 mt-0.5 p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Ocultar este recordatorio"
                >
                  <FaTimes className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100 flex justify-between items-center bg-white flex-shrink-0">
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
            Se mostrará de nuevo en 1 hora
          </p>
          <button
            onClick={handleDismiss}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-xl font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
