import React from 'react';
import {
  FaTimes, FaClock, FaStar, FaRegStar, FaEdit, FaListOl,
  FaTag, FaExclamationTriangle, FaFileAlt, FaLightbulb, FaDollarSign,
} from 'react-icons/fa';

const DIFFICULTY = {
  easy:   { label: 'Fácil',   cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  medium: { label: 'Media',   cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
  hard:   { label: 'Difícil', cls: 'bg-rose-100 text-rose-700 border border-rose-200' },
};

const ProcedureViewModal = ({ procedure, onClose, onEdit }) => {
  if (!procedure) return null;

  const diff = DIFFICULTY[procedure.difficulty] || DIFFICULTY.medium;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[55] p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white px-5 py-4 flex items-start justify-between flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              {procedure.isFavorite
                ? <FaStar className="text-yellow-300 text-xs flex-shrink-0" />
                : <FaRegStar className="text-violet-300 text-xs flex-shrink-0" />}
              {procedure.category?.icon && <span className="text-base">{procedure.category.icon}</span>}
              <h2 className="text-lg sm:text-xl font-bold leading-snug">{procedure.title}</h2>
            </div>
            {procedure.category && (
              <p className="text-xs text-violet-200 mb-2">{procedure.category.name}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${diff.cls}`}>{diff.label}</span>
              {procedure.estimatedTime && (
                <span className="flex items-center gap-1 text-xs text-violet-200">
                  <FaClock className="text-[10px]" /> {procedure.estimatedTime}
                </span>
              )}
              {procedure.cost && (
                <span className="flex items-center gap-1 text-xs text-violet-200">
                  <FaDollarSign className="text-[10px]" /> {procedure.cost}
                </span>
              )}
              {procedure.steps?.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-violet-200">
                  <FaListOl className="text-[10px]" /> {procedure.steps.length} pasos
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="hover:bg-white hover:bg-opacity-20 rounded-xl p-1.5 transition-colors flex-shrink-0">
            <FaTimes className="text-base" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Descripción */}
          {procedure.description && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Descripción</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-100">
                {procedure.description}
              </p>
            </section>
          )}

          {/* Requisitos */}
          {procedure.requirements && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <FaExclamationTriangle className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800 mb-1 uppercase tracking-wide">Requisitos previos</p>
                <p className="text-sm text-amber-700">{procedure.requirements}</p>
              </div>
            </div>
          )}

          {/* Pasos */}
          {procedure.steps?.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Proceso paso a paso
              </h3>
              <div className="space-y-3">
                {procedure.steps.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
                      {step.order ?? i + 1}
                    </div>
                    <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                      <p className="font-semibold text-sm text-slate-800 mb-1">{step.title}</p>
                      {step.description && (
                        <p className="text-sm text-slate-600 whitespace-pre-wrap mb-2">{step.description}</p>
                      )}
                      {(step.tips || step.notes) && (
                        <div className="flex items-start gap-1.5 bg-blue-50 border border-blue-100 rounded-lg p-2.5 text-xs text-blue-700 mt-1">
                          <FaLightbulb className="mt-0.5 flex-shrink-0" />
                          {step.tips || step.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notas */}
          {procedure.notes && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Notas adicionales</h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{procedure.notes}</p>
              </div>
            </section>
          )}

          {/* Attachments */}
          {procedure.attachments?.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Archivos adjuntos</h3>
              <div className="space-y-2">
                {procedure.attachments.map((att, i) => (
                  <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 border border-slate-200 rounded-xl hover:border-violet-300 hover:bg-violet-50 transition-colors">
                    <FaFileAlt className="text-violet-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700 truncate">{att.name || `Archivo ${i + 1}`}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Tags */}
          {procedure.tags?.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Etiquetas</h3>
              <div className="flex flex-wrap gap-2">
                {procedure.tags.map((tag, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-3 py-1 rounded-full font-medium">
                    <FaTag className="text-[10px]" />{tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Metadata */}
          {(procedure.creator || procedure.createdAt) && (
            <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3 text-xs">
              {procedure.creator && (
                <div>
                  <span className="block text-slate-400 font-medium mb-0.5">Creado por</span>
                  <span className="text-slate-700">{procedure.creator.name}</span>
                </div>
              )}
              {procedure.createdAt && (
                <div>
                  <span className="block text-slate-400 font-medium mb-0.5">Fecha creación</span>
                  <span className="text-slate-700">
                    {new Date(procedure.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
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
              className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
              <FaEdit className="text-xs" /> Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcedureViewModal;
