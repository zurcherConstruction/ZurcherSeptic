import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  PhoneIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  ChatBubbleLeftEllipsisIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckSolid } from '@heroicons/react/24/solid';
import api from '../../utils/axios';
import MentionTextarea from '../Common/MentionTextarea';

// ── Constantes ─────────────────────────────────────────────────────────────
const PRESETS = [
  { key: 'auto',     icon: '🤖', label: 'Automático',      desc: 'Mix inteligente por score' },
  { key: 'new',      icon: '🆕', label: 'Nuevos',          desc: 'Sin contactar aún' },
  { key: 'alerts',   icon: '🔔', label: 'Con alertas',     desc: 'Tienen recordatorio activo' },
  { key: 'inactive', icon: '📅', label: 'Sin actividad',   desc: 'Más de 7 días sin contacto' },
  { key: 'priority', icon: '⭐', label: 'Alta prioridad',  desc: 'Priority = high' },
];

const STATUS_LABELS = {
  new: 'Nuevo', contacted: 'Contactado', no_answer: 'No contesta',
  interested: 'Interesado', quoted: 'Cotizado', negotiating: 'Negociando',
  won: 'Ganado', lost: 'Perdido',
};
const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-cyan-100 text-cyan-700',
  no_answer: 'bg-yellow-100 text-yellow-700',
  interested: 'bg-green-100 text-green-700',
  quoted: 'bg-purple-100 text-purple-700',
  negotiating: 'bg-orange-100 text-orange-700',
  won: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-red-100 text-red-700',
};

const daysSince = (date) => {
  if (!date) return null;
  const diff = Math.floor((Date.now() - new Date(date)) / 86400000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  return `hace ${diff}d`;
};

// ── Tarjeta de un lead en la cola ──────────────────────────────────────────
const CallCard = ({ lead, index, done, skipped, onDone, onSkip, onViewNotes }) => {
  const [noteMode, setNoteMode] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [newStatus, setNewStatus] = useState(lead.status);
  const [reminderDate, setReminderDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPhone = () => {
    if (!lead.applicantPhone) return;
    navigator.clipboard.writeText(lead.applicantPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleMarkDone = () => {
    setNoteMode(true);
  };

  const handleSaveAndDone = async () => {
    if (!noteText.trim()) {
      return;
    }
    setSaving(true);
    try {
      await api.post('/lead-notes', {
        leadId: lead.id,
        message: noteText.trim(),
        noteType: 'phone_call',
        ...(reminderDate ? { reminderDate, isReminderActive: true } : {}),
      });
      if (newStatus && newStatus !== lead.status) {
        await api.put(`/sales-leads/${lead.id}`, { status: newStatus });
      }
      onDone(lead.id);
    } catch (e) {
      alert('Error al guardar nota: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  if (done || skipped) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
        done
          ? 'bg-green-50 border-green-200'
          : 'bg-gray-50 border-gray-200 opacity-60'
      }`}>
        {done
          ? <CheckSolid className="h-5 w-5 text-green-500 flex-shrink-0" />
          : <ArrowRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
        <span className={`text-sm font-medium line-through ${done ? 'text-green-700' : 'text-gray-400'}`}>
          {lead.applicantName}
        </span>
        {done && <span className="ml-auto text-xs text-green-600 font-medium">✓ Llamado</span>}
        {skipped && <span className="ml-auto text-xs text-gray-400">Omitido</span>}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 transition-all ${
      noteMode ? 'border-blue-400 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm'
    }`}>
      {/* ─ Info principal ─ */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Número */}
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0 mt-0.5">
          {index + 1}
        </div>

        {/* Datos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 text-sm">{lead.applicantName}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[lead.status] || lead.status}
            </span>
          </div>

          {/* Teléfono */}
          {lead.applicantPhone ? (
            <button
              onClick={copyPhone}
              className="flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800 font-medium group"
              title="Copiar teléfono"
            >
              <PhoneIcon className="h-3 w-3" />
              {lead.applicantPhone}
              {copied
                ? <span className="text-green-600 ml-1">✓ copiado</span>
                : <ClipboardDocumentIcon className="h-3 w-3 opacity-0 group-hover:opacity-60 ml-0.5" />}
            </button>
          ) : (
            <span className="text-xs text-gray-400 mt-1 block">Sin teléfono</span>
          )}

          {/* Última actividad */}
          <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
            <ClockIcon className="h-3 w-3" />
            {lead.lastActivityDate
              ? `Último contacto ${daysSince(lead.lastActivityDate)}`
              : 'Sin contacto previo'}
          </div>
        </div>

        {/* Botón notas */}
        <button
          onClick={() => onViewNotes(lead)}
          className="flex-shrink-0 text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          title="Ver notas"
        >
          <ChatBubbleLeftEllipsisIcon className="h-4 w-4" />
        </button>
      </div>

      {/* ─ Botones de acción ─ */}
      {!noteMode && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <button
            onClick={handleMarkDone}
            className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
          >
            <CheckCircleIcon className="h-4 w-4" />
            Llamado — Agregar nota
          </button>
          <button
            onClick={() => onSkip(lead.id)}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Omitir
          </button>
        </div>
      )}

      {/* ─ Formulario nota rápida ─ */}
      {noteMode && (
        <div className="px-4 pb-4 pt-1 space-y-2">
          <p className="text-xs font-semibold text-blue-700">
            Nota del llamado <span className="font-normal text-blue-500">(obligatoria)</span>
          </p>
          <MentionTextarea
            value={noteText}
            onChange={setNoteText}
            placeholder="¿Cómo resultó el llamado? Usa @ para etiquetar a un compañero..."
            rows={3}
          />
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Actualizar estado del contacto</label>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
            >
              <option value="new">🔵 Nuevo</option>
              <option value="contacted">📞 Contactado</option>
              <option value="no_answer">🔇 No contestó</option>
              <option value="interested">✅ Interesado</option>
              <option value="quoted">💵 Cotizado</option>
              <option value="negotiating">🤝 Negociando</option>
              <option value="lost">❌ Perdido</option>
              <option value="won">🏆 Ganado</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Recordatorio (opcional)</label>
            <input
              type="date"
              value={reminderDate}
              onChange={e => setReminderDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAndDone}
              disabled={saving || !noteText.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
            >
              <CheckSolid className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar y marcar llamado'}
            </button>
            <button
              onClick={() => { setNoteMode(false); setNoteText(''); setNewStatus(lead.status); setReminderDate(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2 rounded-lg hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Persistencia diaria ─────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10);
const storageKey = (preset) => `callQueue_${TODAY}_${preset}`;

function saveState(preset, queue, doneIds, skippedIds) {
  try {
    localStorage.setItem(storageKey(preset), JSON.stringify({
      queue,
      doneIds: [...doneIds],
      skippedIds: [...skippedIds],
    }));
    // también guardar cuál fue el último preset activo
    localStorage.setItem(`callQueue_${TODAY}_lastPreset`, preset);
  } catch {}
}

function loadState(preset) {
  try {
    const raw = localStorage.getItem(storageKey(preset));
    if (!raw) return null;
    const s = JSON.parse(raw);
    return {
      queue: s.queue || [],
      doneIds: new Set(s.doneIds || []),
      skippedIds: new Set(s.skippedIds || []),
    };
  } catch { return null; }
}

function loadLastPreset() {
  return localStorage.getItem(`callQueue_${TODAY}_lastPreset`) || 'auto';
}

// ── Panel principal ─────────────────────────────────────────────────────────
const DailyCallQueue = ({ onClose, onOpenNotes }) => {
  const initialPreset = loadLastPreset();
  const savedForPreset = loadState(initialPreset);
  const [preset, setPreset] = useState(initialPreset);
  const [queue, setQueue] = useState(savedForPreset?.queue || []);
  const [doneIds, setDoneIds] = useState(savedForPreset?.doneIds || new Set());
  const [skippedIds, setSkippedIds] = useState(savedForPreset?.skippedIds || new Set());
  const [loading, setLoading] = useState(!savedForPreset);

  const load = async (p = preset, reset = false) => {
    setLoading(true);
    const newDone = reset ? new Set() : doneIds;
    const newSkipped = reset ? new Set() : skippedIds;
    setDoneIds(newDone);
    setSkippedIds(newSkipped);
    try {
      const res = await api.get(`/sales-leads/call-queue?preset=${p}&limit=20`);
      setQueue(res.data);
      saveState(p, res.data, newDone, newSkipped);
    } catch (e) {
      alert('Error al cargar cola: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!savedForPreset) load();
  }, []);

  const handlePreset = (key) => {
    // Guardar estado actual del preset activo antes de cambiar
    saveState(preset, queue, doneIds, skippedIds);

    const saved = loadState(key);
    if (saved) {
      // Restaurar estado guardado del nuevo preset
      setPreset(key);
      setQueue(saved.queue);
      setDoneIds(saved.doneIds);
      setSkippedIds(saved.skippedIds);
      localStorage.setItem(`callQueue_${TODAY}_lastPreset`, key);
    } else {
      // Primer uso de este preset: cargar desde la API
      setPreset(key);
      load(key, true);
    }
  };

  const handleDone = (id) => {
    setDoneIds(prev => {
      const next = new Set([...prev, id]);
      saveState(preset, queue, next, skippedIds);
      return next;
    });
  };
  const handleSkip = (id) => {
    setSkippedIds(prev => {
      const next = new Set([...prev, id]);
      saveState(preset, queue, doneIds, next);
      return next;
    });
  };

  const handleReset = () => {
    // Borrar solo el preset actual
    localStorage.removeItem(storageKey(preset));
    load(preset, true);
  };

  const totalActive = queue.filter(l => !doneIds.has(l.id) && !skippedIds.has(l.id)).length;
  const totalDone   = doneIds.size;
  const total       = queue.length;
  const allProcessed = total > 0 && totalActive === 0;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">

        {/* ─ Header ─ */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-700 to-blue-500 flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">📋 Cola de Llamadas</h2>
            <p className="text-blue-100 text-xs mt-0.5">
              {loading ? 'Generando lista...' : `${total} contactos · ${totalDone} completados`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              title="Generar nueva cola"
              className="text-white/70 hover:text-white text-xs font-medium bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Nueva cola
            </button>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* ─ Presets ─ */}
        <div className="px-4 py-3 border-b bg-gray-50 flex-shrink-0">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Tipo de lista</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => handlePreset(p.key)}
                title={p.desc}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                  preset === p.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─ Barra de progreso ─ */}
        {total > 0 && !loading && (
          <div className="px-4 py-2.5 border-b flex-shrink-0 bg-white">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-600">Progreso</span>
              <span className="text-xs font-bold text-blue-700">{totalDone}/{total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${total > 0 ? (totalDone / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* ─ Lista ─ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600" />
              <p className="text-sm text-gray-500">Seleccionando contactos...</p>
            </div>

          ) : queue.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-3">📭</p>
              <p className="font-semibold text-gray-600">Sin contactos para este filtro</p>
              <p className="text-sm text-gray-400 mt-1">Probá otro tipo de lista</p>
            </div>

          ) : allProcessed ? (
            <div className="text-center py-12">
              <p className="text-5xl mb-3">🎉</p>
              <p className="text-xl font-bold text-green-700">¡Lista completada!</p>
              <p className="text-sm text-gray-500 mt-1">
                Completaste {totalDone} llamado{totalDone !== 1 ? 's' : ''} hoy.
              </p>
              <button
                onClick={() => load(preset)}
                className="mt-5 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl mx-auto transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Generar más
              </button>
            </div>

          ) : (
            // Activos primero, luego completados/omitidos al final
            <>
              {queue
                .filter(l => !doneIds.has(l.id) && !skippedIds.has(l.id))
                .map((lead, i) => (
                  <CallCard
                    key={lead.id}
                    lead={lead}
                    index={queue.indexOf(lead)}
                    done={false}
                    skipped={false}
                    onDone={handleDone}
                    onSkip={handleSkip}
                    onViewNotes={onOpenNotes}
                  />
                ))
              }
              {/* Separador para completados */}
              {(doneIds.size > 0 || skippedIds.size > 0) && (
                <p className="text-xs text-gray-400 font-medium pt-2 pb-1">✓ Procesados</p>
              )}
              {queue
                .filter(l => doneIds.has(l.id) || skippedIds.has(l.id))
                .map(lead => (
                  <CallCard
                    key={lead.id}
                    lead={lead}
                    index={queue.indexOf(lead)}
                    done={doneIds.has(lead.id)}
                    skipped={skippedIds.has(lead.id)}
                    onDone={handleDone}
                    onSkip={handleSkip}
                    onViewNotes={onOpenNotes}
                  />
                ))
              }
            </>
          )}
        </div>

        {/* ─ Footer ─ */}
        {!loading && queue.length > 0 && !allProcessed && (
          <div className="px-4 py-3 border-t bg-gray-50 flex-shrink-0">
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-blue-600 py-1.5 rounded-lg hover:bg-blue-50 transition-colors font-medium"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Regenerar lista con el mismo filtro
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default DailyCallQueue;
