import React, { useState } from 'react';
import {
  FaTimes, FaPhone, FaEnvelope, FaGlobe, FaEdit,
  FaFileAlt, FaEye, FaChevronDown, FaChevronUp, FaLightbulb,
  FaDownload,
} from 'react-icons/fa';

const SYSTEM_COLORS = {
  REGULAR: { badge: 'bg-blue-100 text-blue-800 border border-blue-200',   header: 'bg-blue-50',   btn: 'bg-blue-600' },
  ATU:     { badge: 'bg-violet-100 text-violet-800 border border-violet-200', header: 'bg-violet-50', btn: 'bg-violet-600' },
  DRIP:    { badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200', header: 'bg-emerald-50', btn: 'bg-emerald-600' },
};

const CountyViewModal = ({ county, onClose, onEdit }) => {
  const [expandedSystem, setExpandedSystem] = useState(null);
  const [viewerDoc,      setViewerDoc]      = useState(null);

  if (!county) return null;

  const toggle = (st) => setExpandedSystem(prev => prev === st ? null : st);

  return (
    <>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[55] p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white px-5 py-4 flex items-start justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl">🗺️</span>
              <h2 className="text-xl sm:text-2xl font-bold">Condado {county.name}</h2>
            </div>
            {county.region && <p className="text-sm text-teal-100 ml-7">{county.region}</p>}
          </div>
          <button onClick={onClose}
            className="hover:bg-white hover:bg-opacity-20 rounded-xl p-1.5 transition-colors flex-shrink-0 ml-4">
            <FaTimes className="text-base" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Teléfonos */}
          {county.phones?.filter(p => p.number).length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Teléfonos</h3>
              <div className="space-y-2">
                {county.phones.filter(p => p.number).map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <FaPhone className="text-teal-500 flex-shrink-0 text-sm" />
                    <div className="flex-1">
                      {p.label && <span className="text-[10px] font-semibold text-slate-400 uppercase block">{p.label}</span>}
                      <a href={`tel:${p.number}`} className="text-sm text-blue-600 hover:underline font-medium">{p.number}</a>
                      {p.notes && <span className="text-xs text-slate-400 ml-2">— {p.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Emails */}
          {county.emails?.filter(e => e.email).length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Emails</h3>
              <div className="space-y-2">
                {county.emails.filter(e => e.email).map((em, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <FaEnvelope className="text-teal-500 flex-shrink-0 text-sm" />
                    <div className="flex-1">
                      {em.label && <span className="text-[10px] font-semibold text-slate-400 uppercase block">{em.label}</span>}
                      <a href={`mailto:${em.email}`} className="text-sm text-blue-600 hover:underline font-medium">{em.email}</a>
                      {em.notes && <span className="text-xs text-slate-400 ml-2">— {em.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Links */}
          {county.websites?.filter(w => w.url).length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Portales / Links</h3>
              <div className="space-y-2">
                {county.websites.filter(w => w.url).map((w, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <FaGlobe className="text-teal-500 flex-shrink-0 mt-0.5 text-sm" />
                    <div className="flex-1 min-w-0">
                      {w.label && <span className="text-[10px] font-semibold text-slate-400 uppercase block">{w.label}</span>}
                      <a href={w.url} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline break-all font-medium">{w.url}</a>
                      {w.description && <p className="text-xs text-slate-500 mt-0.5">{w.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notas generales */}
          {county.generalNotes && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Notas Generales</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{county.generalNotes}</p>
              </div>
            </section>
          )}

          {/* Requisitos por Sistema */}
          {county.systemRequirements?.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Requisitos por Sistema</h3>
              <div className="space-y-2">
                {county.systemRequirements.map(req => {
                  const isOpen  = expandedSystem === req.systemType;
                  const cfg     = SYSTEM_COLORS[req.systemType] || { badge: 'bg-slate-100 text-slate-700', header: 'bg-slate-50', btn: 'bg-slate-600' };
                  return (
                    <div key={req.systemType} className="border border-slate-200 rounded-2xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggle(req.systemType)}
                        className={`w-full flex items-center justify-between px-4 py-3 ${cfg.header} hover:brightness-95 transition-all`}
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${cfg.badge}`}>{req.systemType}</span>
                          <div className="flex gap-3 text-xs text-slate-500">
                            {req.turnaroundTime && <span>⏱ {req.turnaroundTime}</span>}
                            {req.fees && <span>💰 {req.fees}</span>}
                            {req.steps?.length > 0 && <span>📋 {req.steps.length} pasos</span>}
                            {req.requiredDocs?.length > 0 && <span>📄 {req.requiredDocs.length} docs</span>}
                          </div>
                        </div>
                        {isOpen ? <FaChevronUp className="text-slate-400 text-xs flex-shrink-0" /> : <FaChevronDown className="text-slate-400 text-xs flex-shrink-0" />}
                      </button>

                      {isOpen && (
                        <div className="p-4 space-y-4 border-t border-slate-200 bg-white">
                          {req.requiredDocs?.length > 0 && (
                            <div>
                              <h5 className="text-xs font-semibold text-slate-500 mb-2">Documentos requeridos</h5>
                              <ul className="space-y-1.5">
                                {req.requiredDocs.map((doc, i) => (
                                  <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                                    <span className={`w-5 h-5 ${cfg.btn} text-white rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0`}>
                                      {i + 1}
                                    </span>
                                    {doc}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {req.steps?.length > 0 && (
                            <div>
                              <h5 className="text-xs font-semibold text-slate-500 mb-3">Proceso paso a paso</h5>
                              <div className="space-y-3">
                                {req.steps.map((step, si) => (
                                  <div key={si} className="flex gap-3">
                                    <div className={`flex-shrink-0 w-7 h-7 ${cfg.btn} text-white rounded-full flex items-center justify-center text-xs font-bold`}>
                                      {step.order ?? si + 1}
                                    </div>
                                    <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                                      <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                                      {step.description && (
                                        <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{step.description}</p>
                                      )}
                                      {step.notes && (
                                        <div className="flex items-start gap-1.5 mt-2 bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
                                          <FaLightbulb className="mt-0.5 flex-shrink-0" />{step.notes}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {req.notes && (
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                              <p className="text-xs font-semibold text-slate-500 mb-1">Notas específicas</p>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{req.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Attachments */}
          {county.attachments?.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Documentos adjuntos ({county.attachments.length})
              </h3>
              <div className="space-y-2">
                {county.attachments.map((att, i) => {
                  const isImage = att.mimeType?.startsWith('image/');
                  const isPDF   = att.mimeType === 'application/pdf';
                  const isVideo = att.mimeType?.startsWith('video/');
                  return (
                    <div key={i}
                      className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl bg-slate-50 hover:border-teal-300 hover:bg-teal-50 transition-colors cursor-pointer"
                      onClick={() => setViewerDoc(att)}
                    >
                      <span className="text-xl flex-shrink-0">
                        {isPDF ? '📄' : isImage ? '🖼️' : isVideo ? '🎬' : '📎'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 truncate font-medium">
                          {att.originalFilename || 'Archivo'}
                        </p>
                        {att.size && (
                          <p className="text-xs text-slate-400">{(att.size / 1024).toFixed(0)} KB</p>
                        )}
                      </div>
                      <FaEye className="text-slate-400 text-sm flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-slate-100 px-5 py-3 bg-slate-50 flex justify-between items-center rounded-b-2xl">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
            Cerrar
          </button>
          {onEdit && (
            <button onClick={onEdit}
              className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
              <FaEdit className="text-xs" /> Editar
            </button>
          )}
        </div>
      </div>
    </div>

    {/* ── Viewer overlay (PDF / imagen) — igual que Fleet ── */}

    {viewerDoc && (
      <div className="fixed inset-0 bg-black/90 z-[65] flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/60 flex-shrink-0">
          <span className="text-white text-sm font-medium truncate max-w-xs">
            {viewerDoc.originalFilename || 'Archivo'}
          </span>
          <div className="flex items-center gap-2">
            <a href={viewerDoc.url} target="_blank" rel="noopener noreferrer" download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors">
              <FaDownload className="text-[10px]" /> Descargar
            </a>
            <button onClick={() => setViewerDoc(null)}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-hidden">
          {viewerDoc.mimeType?.startsWith('image/') ? (
            <img
              src={viewerDoc.url}
              alt={viewerDoc.originalFilename}
              className="w-full h-full object-contain p-4"
            />
          ) : viewerDoc.mimeType === 'application/pdf' ? (
            <object
              data={viewerDoc.url}
              type="application/pdf"
              className="w-full h-full"
            >
              {/* Fallback si el browser no puede renderizar el PDF inline */}
              <div className="flex flex-col items-center justify-center h-full text-white gap-4">
                <span className="text-5xl">📄</span>
                <p className="text-sm text-white/70">El browser no puede mostrar el PDF aquí.</p>
                <a href={viewerDoc.url} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-xl text-sm font-medium transition-colors">
                  Abrir en pestaña nueva
                </a>
              </div>
            </object>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white gap-4">
              <span className="text-6xl">📎</span>
              <p className="text-sm">{viewerDoc.originalFilename}</p>
              <a href={viewerDoc.url} target="_blank" rel="noopener noreferrer" download
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-xl text-sm font-medium transition-colors">
                Descargar archivo
              </a>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
};

export default CountyViewModal;
