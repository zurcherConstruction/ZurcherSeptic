import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ArrowsRightLeftIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import api from '../../utils/axios';

// Razón de coincidencia
const TYPE_LABELS = {
  phone: { icon: '📞', text: 'Mismo teléfono' },
  email: { icon: '✉️', text: 'Mismo email' },
  name:  { icon: '👤', text: 'Mismo nombre'  },
};

// Combina byPhone/byEmail/byName en una lista única sin repetir grupos
function buildUnifiedGroups(data) {
  const groupMap = new Map();
  const process = (list, type) => {
    (list || []).forEach(group => {
      const key = [...group].map(l => l.id).sort().join(',');
      if (!groupMap.has(key)) {
        groupMap.set(key, { leads: group, types: [type] });
      } else {
        groupMap.get(key).types.push(type);
      }
    });
  };
  process(data.byPhone, 'phone');
  process(data.byEmail, 'email');
  process(data.byName,  'name');
  // Más duplicados primero
  return [...groupMap.values()].sort((a, b) => b.leads.length - a.leads.length);
}

const STATUS_LABELS = {
  new: 'Nuevo', contacted: 'Contactado', no_answer: 'No Contesta',
  interested: 'Interesado', quoted: 'Cotizado', negotiating: 'Negociando',
  won: 'Ganado', lost: 'Perdido', archived: 'Archivado',
};
const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700', contacted: 'bg-cyan-100 text-cyan-700',
  no_answer: 'bg-yellow-100 text-yellow-700', interested: 'bg-green-100 text-green-700',
  quoted: 'bg-purple-100 text-purple-700', negotiating: 'bg-orange-100 text-orange-700',
  won: 'bg-emerald-100 text-emerald-700', lost: 'bg-red-100 text-red-700',
  archived: 'bg-gray-100 text-gray-600',
};

const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

// ── Un grupo de duplicados ────────────────────────────────────────────────────
const DuplicateGroup = ({ group, onMerge }) => {
  const { leads, types } = group;
  const [expanded, setExpanded] = useState(false);

  // Ganador por defecto = el de actividad más reciente
  const defaultWinner = [...leads].sort((a, b) =>
    new Date(b.lastActivityDate || b.createdAt) - new Date(a.lastActivityDate || a.createdAt)
  )[0];
  const [keepId, setKeepId] = useState(defaultWinner?.id);
  const [merging, setMerging] = useState(false);

  const winner = leads.find(l => l.id === keepId) || leads[0];

  const handleMerge = async () => {
    const mergeIds = leads.filter(l => l.id !== keepId).map(l => l.id);
    if (!window.confirm(
      `¿Unificar ${mergeIds.length} registro(s) en "${winner.applicantName}"?\n\n` +
      `Las notas se moverán al registro conservado y los demás serán eliminados.`
    )) return;
    setMerging(true);
    try {
      await api.post('/sales-leads/merge', { keepId, mergeIds });
      onMerge();
    } catch (e) {
      alert('Error al unificar: ' + (e.response?.data?.error || e.message));
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-2.5 bg-white shadow-sm">
      {/* ─── Fila principal (siempre visible) ─── */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          {expanded
            ? <ChevronDownIcon className="h-4 w-4" />
            : <ChevronRightIcon className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(v => !v)}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 text-sm">{winner.applicantName}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[winner.status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[winner.status] || winner.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-gray-400">
            {winner.applicantPhone && <span><PhoneIcon className="h-3 w-3 inline mr-0.5" />{winner.applicantPhone}</span>}
            {winner.applicantEmail && <span><EnvelopeIcon className="h-3 w-3 inline mr-0.5" />{winner.applicantEmail}</span>}
          </div>
        </div>

        {/* Razones + badge */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {types.map(t => (
            <span key={t} title={TYPE_LABELS[t]?.text} className="text-sm">
              {TYPE_LABELS[t]?.icon}
            </span>
          ))}
          <span className="ml-1.5 text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">
            {leads.length} registros
          </span>
        </div>
      </div>

      {/* ─── Desplegable ─── */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2 bg-gray-50">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Elige el registro a conservar <span className="text-yellow-500">★</span>
          </p>

          {leads.map(lead => (
            <div
              key={lead.id}
              onClick={() => setKeepId(lead.id)}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                keepId === lead.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {keepId === lead.id
                  ? <StarSolid className="h-4 w-4 text-yellow-400" />
                  : <StarIcon className="h-4 w-4 text-gray-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm">{lead.applicantName}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[lead.status] || lead.status}
                  </span>
                  {keepId === lead.id && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">CONSERVAR</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-gray-500">
                  {lead.applicantPhone && <span><PhoneIcon className="h-3 w-3 inline mr-0.5" />{lead.applicantPhone}</span>}
                  {lead.applicantEmail && <span><EnvelopeIcon className="h-3 w-3 inline mr-0.5" />{lead.applicantEmail}</span>}
                  {lead.propertyAddress && <span>📍 {lead.propertyAddress}</span>}
                  <span className="text-gray-400">Alta: {fmtDate(lead.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <p className="flex-1 text-xs text-gray-500">
              Las notas de los {leads.length - 1} registro(s) descartados pasarán a <strong>{winner.applicantName}</strong>.
            </p>
            <button
              onClick={handleMerge}
              disabled={merging}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-60 flex-shrink-0"
            >
              <ArrowsRightLeftIcon className="h-4 w-4" />
              {merging ? 'Unificando...' : 'Unificar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Modal principal ───────────────────────────────────────────────────────────
const LeadMergeModal = ({ onClose, onMerged }) => {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales-leads/group-duplicates');
      setGroups(buildUnifiedGroups(res.data));
    } catch (e) {
      alert('Error al cargar duplicados: ' + (e.response?.data?.error || e.message));
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleMerge = () => {
    load();
    if (onMerged) onMerged();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center gap-3">
              <ArrowsRightLeftIcon className="h-6 w-6 text-orange-600" />
              <div>
                <h2 className="text-lg font-bold text-gray-900">Contactos Duplicados</h2>
                <p className="text-xs text-gray-500">
                  {loading
                    ? 'Analizando contactos...'
                    : groups.length === 0
                      ? 'No se encontraron duplicados 🎉'
                      : `${groups.length} grupo${groups.length !== 1 ? 's' : ''} con registros duplicados`}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Leyenda de iconos */}
          {!loading && groups.length > 0 && (
            <div className="px-6 py-2 bg-orange-50 border-b border-orange-100 flex items-center gap-4 text-xs text-orange-700 flex-shrink-0 flex-wrap">
              <span className="font-semibold">Coincide por:</span>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <span key={k}>{v.icon} {v.text}</span>
              ))}
            </div>
          )}

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-200 border-t-orange-600" />
                <p className="text-sm text-gray-500">Analizando todos los contactos...</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircleIcon className="h-14 w-14 text-green-400 mx-auto mb-3" />
                <p className="font-semibold text-gray-700 text-lg">¡Sin duplicados!</p>
                <p className="text-sm text-gray-400 mt-1">Todos los contactos son únicos.</p>
              </div>
            ) : (
              groups.map((group, i) => (
                <DuplicateGroup key={i} group={group} onMerge={handleMerge} />
              ))
            )}
          </div>

          {/* Footer */}
          {!loading && groups.length > 0 && (
            <div className="px-6 py-3 border-t bg-gray-50 rounded-b-2xl flex-shrink-0">
              <p className="text-xs text-gray-500">
                ⚠️ La unificación es <strong>irreversible</strong>. Las notas se mueven al registro conservado y los demás son eliminados.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadMergeModal;
