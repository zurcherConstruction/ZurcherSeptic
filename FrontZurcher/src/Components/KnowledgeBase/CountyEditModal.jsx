import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { FaTimes, FaPlus, FaTrash } from 'react-icons/fa';
import { createCounty, updateCounty } from '../../Redux/Actions/knowledgeBaseActions';
import api from '../../utils/axios';

const REGIONS = [
  'Costa Oeste / Suroeste',
  'Centro de Florida',
  'Sur de Florida',
  'Costa Central-Este',
  'Norte de Florida',
  'Panhandle',
];

const SYSTEM_TYPES = ['REGULAR', 'ATU', 'DRIP'];

const SYSTEM_COLORS = {
  REGULAR: { btn: 'bg-blue-600 border-blue-600',   ring: 'focus:ring-blue-500',  accent: 'bg-blue-50 text-blue-800'   },
  ATU:     { btn: 'bg-violet-600 border-violet-600', ring: 'focus:ring-violet-500', accent: 'bg-violet-50 text-violet-800' },
  DRIP:    { btn: 'bg-emerald-600 border-emerald-600', ring: 'focus:ring-emerald-500', accent: 'bg-emerald-50 text-emerald-800' },
};

const emptyPhone   = () => ({ label: '', number: '', notes: '' });
const emptyEmail   = () => ({ label: '', email: '', notes: '' });
const emptyWebsite = () => ({ label: '', url: '', description: '' });
const emptyStep    = (order) => ({ order, title: '', description: '', notes: '' });
const emptySysReq  = (systemType) => ({
  systemType,
  requiredDocs: [],
  steps: [emptyStep(1)],
  fees: '',
  turnaroundTime: '',
  notes: '',
});

const CountyEditModal = ({ county, onClose, onSaved }) => {
  const dispatch  = useDispatch();
  const isEditing = !!county;

  const [form, setForm] = useState({
    name: '',
    region: '',
    phones: [emptyPhone()],
    emails: [emptyEmail()],
    websites: [emptyWebsite()],
    systemRequirements: [],
    generalNotes: '',
    attachments: [],
  });

  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (county) {
      setForm({
        name:               county.name               || '',
        region:             county.region             || '',
        phones:             county.phones?.length     ? county.phones   : [emptyPhone()],
        emails:             county.emails?.length     ? county.emails   : [emptyEmail()],
        websites:           county.websites?.length   ? county.websites : [emptyWebsite()],
        systemRequirements: county.systemRequirements || [],
        generalNotes:       county.generalNotes       || '',
        attachments:        county.attachments        || [],
      });
    }
  }, [county]);

  // ── Helpers genéricos ──────────────────────────────────────────────────────
  const setArr = (key, idx, field, val) =>
    setForm(prev => {
      const arr = [...prev[key]];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...prev, [key]: arr };
    });

  const addItem    = (key, factory) => setForm(prev => ({ ...prev, [key]: [...prev[key], factory()] }));
  const removeItem = (key, idx)     => setForm(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));

  // ── System Requirements ────────────────────────────────────────────────────
  const toggleSysReq = (st) =>
    setForm(prev => {
      const exists = prev.systemRequirements.find(r => r.systemType === st);
      if (exists) return { ...prev, systemRequirements: prev.systemRequirements.filter(r => r.systemType !== st) };
      return { ...prev, systemRequirements: [...prev.systemRequirements, emptySysReq(st)] };
    });

  const updateSysReq = (st, field, val) =>
    setForm(prev => ({
      ...prev,
      systemRequirements: prev.systemRequirements.map(r => r.systemType === st ? { ...r, [field]: val } : r),
    }));

  const addReqDoc    = (st)          => setForm(prev => ({ ...prev, systemRequirements: prev.systemRequirements.map(r => r.systemType === st ? { ...r, requiredDocs: [...r.requiredDocs, ''] } : r) }));
  const updateReqDoc = (st, i, val)  => setForm(prev => ({ ...prev, systemRequirements: prev.systemRequirements.map(r => { if (r.systemType !== st) return r; const d = [...r.requiredDocs]; d[i] = val; return { ...r, requiredDocs: d }; }) }));
  const removeReqDoc = (st, i)       => setForm(prev => ({ ...prev, systemRequirements: prev.systemRequirements.map(r => r.systemType !== st ? r : { ...r, requiredDocs: r.requiredDocs.filter((_, j) => j !== i) }) }));

  const addStep    = (st)            => setForm(prev => ({ ...prev, systemRequirements: prev.systemRequirements.map(r => r.systemType !== st ? r : { ...r, steps: [...(r.steps || []), emptyStep((r.steps?.length || 0) + 1)] }) }));
  const updateStep = (st, i, f, v)   => setForm(prev => ({ ...prev, systemRequirements: prev.systemRequirements.map(r => r.systemType !== st ? r : { ...r, steps: r.steps.map((s, j) => j === i ? { ...s, [f]: v } : s) }) }));
  const removeStep = (st, i)         => setForm(prev => ({ ...prev, systemRequirements: prev.systemRequirements.map(r => r.systemType !== st ? r : { ...r, steps: r.steps.filter((_, j) => j !== i) }) }));

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUploadFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      const res = await api.post('/knowledge-base/counties/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm(prev => ({ ...prev, attachments: [...prev.attachments, ...res.data] }));
    } catch {
      setError('Error al subir archivos');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (i) =>
    setForm(prev => ({ ...prev, attachments: prev.attachments.filter((_, j) => j !== i) }));

  // ── Guardar ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre del condado es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        phones:   form.phones.filter(p => p.number),
        emails:   form.emails.filter(em => em.email),
        websites: form.websites.filter(w => w.url),
      };
      if (isEditing) {
        await dispatch(updateCounty(county.id, payload));
      } else {
        await dispatch(createCounty(payload));
      }
      onSaved?.();
      onClose();
    } catch {
      setError('Error al guardar. Verificá los datos e intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const inp  = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white';
  const lbl  = 'block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide';

  const TABS = [
    { id: 'info',    label: '📋 Info'      },
    { id: 'contact', label: '📞 Contacto'  },
    { id: 'systems', label: '⚙️ Sistemas'  },
    { id: 'docs',    label: '📄 Docs'      },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[55] p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white px-4 sm:px-5 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-base sm:text-lg truncate">
            {isEditing ? `Editar — ${county.name}` : 'Nuevo Condado'}
          </h2>
          <button onClick={onClose}
            className="hover:bg-white hover:bg-opacity-20 rounded-xl p-1.5 transition-colors flex-shrink-0 ml-3">
            <FaTimes />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 flex overflow-x-auto flex-shrink-0 bg-white">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-5 py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                activeTab === tab.id
                  ? 'border-teal-500 text-teal-600 bg-teal-50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm flex-shrink-0">{error}</div>
        )}

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

            {/* ── TAB: INFO ── */}
            {activeTab === 'info' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Nombre del Condado *</label>
                    <input type="text" className={inp} value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Ej: Lee" required />
                  </div>
                  <div>
                    <label className={lbl}>Región</label>
                    <select className={inp} value={form.region}
                      onChange={e => setForm(p => ({ ...p, region: e.target.value }))}>
                      <option value="">Seleccionar región...</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={lbl}>Notas Generales</label>
                  <textarea className={inp} rows={4} value={form.generalNotes}
                    onChange={e => setForm(p => ({ ...p, generalNotes: e.target.value }))}
                    placeholder="Información general sobre este condado..." />
                </div>
              </>
            )}

            {/* ── TAB: CONTACTO ── */}
            {activeTab === 'contact' && (
              <div className="space-y-6">

                {/* Teléfonos */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-700">Teléfonos</h4>
                    <button type="button" onClick={() => addItem('phones', emptyPhone)}
                      className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 px-2.5 py-1.5 rounded-lg hover:bg-teal-50 transition-colors">
                      <FaPlus className="text-[10px]" /> Agregar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.phones.map((p, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                        <div className="flex gap-2">
                          <input className={inp} placeholder="Etiqueta (Ej: Permisos)"
                            value={p.label} onChange={e => setArr('phones', i, 'label', e.target.value)} />
                          <button type="button" onClick={() => removeItem('phones', i)}
                            className="flex-shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                            <FaTrash className="text-xs" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input className={inp} placeholder="(239) 000-0000"
                            value={p.number} onChange={e => setArr('phones', i, 'number', e.target.value)} />
                          <input className={inp} placeholder="Notas opcionales"
                            value={p.notes} onChange={e => setArr('phones', i, 'notes', e.target.value)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Emails */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-700">Emails</h4>
                    <button type="button" onClick={() => addItem('emails', emptyEmail)}
                      className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 px-2.5 py-1.5 rounded-lg hover:bg-teal-50 transition-colors">
                      <FaPlus className="text-[10px]" /> Agregar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.emails.map((em, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                        <div className="flex gap-2">
                          <input className={inp} placeholder="Etiqueta (Ej: NOC)"
                            value={em.label} onChange={e => setArr('emails', i, 'label', e.target.value)} />
                          <button type="button" onClick={() => removeItem('emails', i)}
                            className="flex-shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                            <FaTrash className="text-xs" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input type="email" className={inp} placeholder="correo@condado.gov"
                            value={em.email} onChange={e => setArr('emails', i, 'email', e.target.value)} />
                          <input className={inp} placeholder="Notas opcionales"
                            value={em.notes} onChange={e => setArr('emails', i, 'notes', e.target.value)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Websites */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-700">Links / Portales</h4>
                    <button type="button" onClick={() => addItem('websites', emptyWebsite)}
                      className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 px-2.5 py-1.5 rounded-lg hover:bg-teal-50 transition-colors">
                      <FaPlus className="text-[10px]" /> Agregar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.websites.map((w, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                        <div className="flex gap-2">
                          <input className={inp} placeholder="Etiqueta (Ej: Portal NOC)"
                            value={w.label} onChange={e => setArr('websites', i, 'label', e.target.value)} />
                          <button type="button" onClick={() => removeItem('websites', i)}
                            className="flex-shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                            <FaTrash className="text-xs" />
                          </button>
                        </div>
                        <input type="url" className={inp} placeholder="https://..."
                          value={w.url} onChange={e => setArr('websites', i, 'url', e.target.value)} />
                        <input className={inp} placeholder="Descripción del link..."
                          value={w.description} onChange={e => setArr('websites', i, 'description', e.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: SISTEMAS ── */}
            {activeTab === 'systems' && (
              <div className="space-y-5">

                {/* Toggle buttons */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Seleccioná los sistemas que aplican a este condado
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SYSTEM_TYPES.map(st => {
                      const active = form.systemRequirements.some(r => r.systemType === st);
                      const cfg    = SYSTEM_COLORS[st];
                      return (
                        <button key={st} type="button" onClick={() => toggleSysReq(st)}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                            active
                              ? `${cfg.btn} text-white shadow-sm`
                              : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                          }`}>
                          {active ? `✓ ${st}` : `+ ${st}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Per-system sections */}
                {form.systemRequirements.map(req => {
                  const cfg = SYSTEM_COLORS[req.systemType] || SYSTEM_COLORS.REGULAR;
                  return (
                    <div key={req.systemType} className="border border-slate-200 rounded-2xl overflow-hidden">
                      {/* System header */}
                      <div className={`px-4 py-3 flex items-center gap-2 ${cfg.accent}`}>
                        <span className="text-sm font-bold">{req.systemType}</span>
                      </div>

                      <div className="p-4 space-y-4 bg-white">
                        {/* Tiempo y costo */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className={lbl}>Tiempo estimado</label>
                            <input className={inp} placeholder="Ej: 2-3 semanas"
                              value={req.turnaroundTime || ''}
                              onChange={e => updateSysReq(req.systemType, 'turnaroundTime', e.target.value)} />
                          </div>
                          <div>
                            <label className={lbl}>Tarifas / Fees</label>
                            <input className={inp} placeholder="Ej: $450 + $75 NOC"
                              value={req.fees || ''}
                              onChange={e => updateSysReq(req.systemType, 'fees', e.target.value)} />
                          </div>
                        </div>

                        {/* Documentos requeridos */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className={lbl}>Documentos requeridos</label>
                            <button type="button" onClick={() => addReqDoc(req.systemType)}
                              className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 px-2 py-1 rounded-lg hover:bg-teal-50 transition-colors">
                              <FaPlus className="text-[10px]" /> Agregar
                            </button>
                          </div>
                          {req.requiredDocs.length === 0 && (
                            <p className="text-xs text-slate-400 italic">Sin documentos aún</p>
                          )}
                          <div className="space-y-2">
                            {req.requiredDocs.map((doc, di) => (
                              <div key={di} className="flex gap-2">
                                <input className={inp} placeholder="Ej: Signed NOC form"
                                  value={doc} onChange={e => updateReqDoc(req.systemType, di, e.target.value)} />
                                <button type="button" onClick={() => removeReqDoc(req.systemType, di)}
                                  className="flex-shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                                  <FaTrash className="text-xs" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Pasos */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <label className={lbl}>Proceso paso a paso</label>
                            <button type="button" onClick={() => addStep(req.systemType)}
                              className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 px-2 py-1 rounded-lg hover:bg-teal-50 transition-colors">
                              <FaPlus className="text-[10px]" /> Agregar paso
                            </button>
                          </div>
                          <div className="space-y-3">
                            {req.steps?.map((step, si) => (
                              <div key={si} className="flex gap-3 items-start">
                                <div className={`flex-shrink-0 w-7 h-7 ${cfg.btn.split(' ')[0]} text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm`}>
                                  {si + 1}
                                </div>
                                <div className="flex-1 space-y-2">
                                  <input className={inp} placeholder="Título del paso"
                                    value={step.title}
                                    onChange={e => updateStep(req.systemType, si, 'title', e.target.value)} />
                                  <textarea className={inp} rows={2} placeholder="Descripción detallada..."
                                    value={step.description}
                                    onChange={e => updateStep(req.systemType, si, 'description', e.target.value)} />
                                  <input className={inp} placeholder="Notas / Tips"
                                    value={step.notes}
                                    onChange={e => updateStep(req.systemType, si, 'notes', e.target.value)} />
                                </div>
                                <button type="button" onClick={() => removeStep(req.systemType, si)}
                                  className="flex-shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors mt-1">
                                  <FaTrash className="text-xs" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Notas del sistema */}
                        <div>
                          <label className={lbl}>Notas adicionales ({req.systemType})</label>
                          <textarea className={inp} rows={2}
                            placeholder="Observaciones específicas para este tipo de sistema..."
                            value={req.notes || ''}
                            onChange={e => updateSysReq(req.systemType, 'notes', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {form.systemRequirements.length === 0 && (
                  <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-sm font-medium text-slate-500">Activá al menos un tipo de sistema arriba</p>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: DOCUMENTOS ── */}
            {activeTab === 'docs' && (
              <div>
                {form.attachments.length > 0 && (
                  <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-700">
                    <span>⚠️</span>
                    <span>Guardá los cambios para que los archivos queden guardados en el condado.</span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700">Archivos adjuntos</h4>
                    <p className="text-xs text-slate-400 mt-0.5">PDFs, imágenes, videos</p>
                  </div>
                  <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-medium transition-colors ${uploading ? 'opacity-60 cursor-wait' : ''}`}>
                    {uploading ? 'Subiendo...' : <><FaPlus className="text-[10px]" /> Subir archivos</>}
                    <input
                      type="file" multiple className="hidden"
                      accept="image/*,application/pdf,video/mp4,video/quicktime,video/x-msvideo"
                      onChange={handleUploadFiles} disabled={uploading}
                    />
                  </label>
                </div>

                {form.attachments.length === 0 && (
                  <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                    <div className="text-4xl mb-3">📁</div>
                    <p className="text-sm font-medium text-slate-500">Sin documentos adjuntos</p>
                    <p className="text-xs mt-1">PDFs, JPG, PNG, GIF, WEBP, MP4</p>
                  </div>
                )}

                <div className="space-y-2">
                  {form.attachments.map((att, i) => {
                    const isImage = att.mimeType?.startsWith('image/');
                    const isPDF   = att.mimeType === 'application/pdf';
                    return (
                      <div key={i} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                        {/* Image preview */}
                        {isImage && (
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                              src={att.url} alt={att.originalFilename}
                              className="w-full h-40 object-cover hover:opacity-90 transition-opacity"
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          </a>
                        )}
                        {/* File row */}
                        <div className="flex items-center gap-3 p-3 bg-slate-50">
                          <span className="text-xl flex-shrink-0">
                            {isPDF ? '📄' : isImage ? '🖼️' : att.mimeType?.startsWith('video/') ? '🎬' : '📎'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-800 truncate font-medium">{att.originalFilename || 'Archivo'}</p>
                            {att.size && <p className="text-xs text-slate-400">{(att.size / 1024).toFixed(0)} KB</p>}
                          </div>
                          <a href={att.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-teal-600 hover:text-teal-800 font-semibold flex-shrink-0 px-2 py-1 hover:bg-teal-50 rounded-lg transition-colors">
                            Abrir ↗
                          </a>
                          <button type="button" onClick={() => removeAttachment(i)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors flex-shrink-0">
                            <FaTrash className="text-xs" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer sticky */}
          <div className="flex-shrink-0 border-t border-slate-100 px-4 sm:px-5 py-3 bg-slate-50 flex justify-between items-center gap-3 rounded-b-2xl">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving || uploading}
              className="px-5 sm:px-8 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl disabled:opacity-50 text-sm font-semibold transition-colors shadow-sm">
              {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear condado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CountyEditModal;
