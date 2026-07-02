import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaBell, FaSave, FaUserCog } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { fetchNotificationRoutings, saveNotificationRoutings } from '../../Redux/Actions/notificationRoutingActions';
import { fetchStaff } from '../../Redux/Actions/adminActions';

const CATEGORIES = ['Obras', 'Presupuestos', 'Flota', 'Knowledge Base', 'Legal'];

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  recept: 'Recept',
  finance: 'Finance',
};

const ELIGIBLE_ROLES = ['owner', 'admin', 'recept', 'finance'];

export default function NotificationRoutingSettings() {
  const dispatch  = useDispatch();
  const { routings, loading } = useSelector(s => s.notificationRouting);
  const { staffList: staff }  = useSelector(s => s.admin);

  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(fetchNotificationRoutings());
    dispatch(fetchStaff());
  }, [dispatch]);

  // Inicializa el draft cuando llegan los datos
  useEffect(() => {
    const map = {};
    routings.forEach(r => { map[r.eventType] = r.staffId || ''; });
    setDraft(map);
  }, [routings]);

  const eligibleStaff = (staff || []).filter(
    s => ELIGIBLE_ROLES.includes(s.role) && s.isActive !== false
  );

  const handleChange = (eventType, staffId) => {
    setDraft(prev => ({ ...prev, [eventType]: staffId }));
  };

  const handleSave = async () => {
    const payload = Object.entries(draft)
      .filter(([, staffId]) => staffId)
      .map(([eventType, staffId]) => ({ eventType, staffId }));

    if (!payload.length) {
      toast.error('Asigná al menos un responsable');
      return;
    }
    setSaving(true);
    try {
      await dispatch(saveNotificationRoutings(payload));
      toast.success('Configuración guardada');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const groupedByCategory = CATEGORIES.map(cat => ({
    category: cat,
    items: routings.filter(r => r.category === cat),
  }));

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <FaUserCog className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Routing de Alertas</h1>
            <p className="text-sm text-slate-500">Definí quién recibe cada tipo de alerta automática</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Cargando...</div>
        ) : (
          <div className="space-y-6">
            {groupedByCategory.map(({ category, items }) => (
              items.length === 0 ? null : (
                <div key={category} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  {/* Categoría header */}
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                    <FaBell className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{category}</span>
                  </div>

                  {/* Filas de eventos */}
                  <div className="divide-y divide-slate-50">
                    {items.map(r => (
                      <div key={r.eventType} className="px-5 py-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{r.label}</p>
                          {r.staff && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              Actual: <span className="text-amber-600 font-medium">{r.staff.name}</span>
                              <span className="ml-1 text-slate-300">({ROLE_LABELS[r.staff.role] || r.staff.role})</span>
                            </p>
                          )}
                          {!r.staff && (
                            <p className="text-xs text-slate-400 mt-0.5">Sin asignar — no se genera recordatorio</p>
                          )}
                        </div>

                        <select
                          value={draft[r.eventType] || ''}
                          onChange={e => handleChange(r.eventType, e.target.value)}
                          className="flex-shrink-0 w-48 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 bg-white"
                        >
                          <option value="">— Sin asignar —</option>
                          {eligibleStaff.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({ROLE_LABELS[s.role] || s.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}

            {/* Guardar */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                <FaSave className="w-3.5 h-3.5" />
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
