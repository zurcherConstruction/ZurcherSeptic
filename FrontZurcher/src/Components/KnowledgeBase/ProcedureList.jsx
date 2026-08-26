import React, { useState, useEffect, useCallback, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  FaClock, FaStar, FaRegStar, FaPlus, FaEdit, FaTrash,
  FaListOl, FaDollarSign, FaExclamationTriangle, FaEye,
  FaChevronDown, FaChevronUp, FaLightbulb, FaMapMarkerAlt,
  FaCheckCircle, FaTimesCircle,
} from 'react-icons/fa';
import { fetchProcedures, deleteProcedure, toggleProcedureFavorite } from '../../Redux/Actions/knowledgeBaseActions';
import ProcedureModal from './ProcedureModal';
import ProcedureViewModal from './ProcedureViewModal';
import CountyProcedureModal from './CountyProcedureModal';
import CountyProcedureViewModal from './CountyProcedureViewModal';

const isCountyProcedure = (procedure) =>
  procedure?.steps?.[0]?.__type === 'countyProcedure';

const DIFFICULTY = {
  easy:   { label: 'Fácil',   cls: 'bg-emerald-100 text-emerald-700' },
  medium: { label: 'Media',   cls: 'bg-amber-100 text-amber-700'     },
  hard:   { label: 'Difícil', cls: 'bg-rose-100 text-rose-700'       },
};

const ProcedureList = memo(({ categoryId, searchQuery, showFavoritesOnly }) => {
  const dispatch    = useDispatch();
  const procedures  = useSelector(state => state.knowledgeBase.procedures);
  const categories  = useSelector(state => state.knowledgeBase.categories);
  const loading     = useSelector(state => state.knowledgeBase.loading);

  const currentCategory = categories.find(c => c.id === categoryId);
  const isCountyCategory = currentCategory?.name?.toLowerCase() === 'condados';

  const [selectedProcedure,  setSelectedProcedure]  = useState(null);
  const [showModal,          setShowModal]          = useState(false);
  const [showCountyModal,    setShowCountyModal]    = useState(false);
  const [showViewModal,      setShowViewModal]      = useState(false);
  const [showCountyViewModal,setShowCountyViewModal]= useState(false);
  const [isEditing,  setIsEditing]  = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    const p = {};
    if (categoryId)       p.categoryId = categoryId;
    if (searchQuery)      p.search     = searchQuery;
    if (showFavoritesOnly) p.favorite  = 'true';
    dispatch(fetchProcedures(p));
  }, [categoryId, searchQuery, showFavoritesOnly]);

  useEffect(() => { load(); }, [load]);

  const handleToggleFavorite = id => dispatch(toggleProcedureFavorite(id));

  const handleDelete = async id => {
    if (!confirm('¿Eliminar este procedimiento?')) return;
    await dispatch(deleteProcedure(id));
    load();
  };

  const handleOpen = (p = null) => {
    setSelectedProcedure(p);
    setIsEditing(!!p);
    if (p ? isCountyProcedure(p) : isCountyCategory) {
      setShowCountyModal(true);
    } else {
      setShowModal(true);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setShowCountyModal(false);
    setSelectedProcedure(null);
    setIsEditing(false);
    load();
  };

  const handleView = (p) => {
    setSelectedProcedure(p);
    if (isCountyProcedure(p)) {
      setShowCountyViewModal(true);
    } else {
      setShowViewModal(true);
    }
  };

  const handleEditFromView = () => {
    setShowViewModal(false);
    setShowCountyViewModal(false);
    setIsEditing(true);
    if (isCountyProcedure(selectedProcedure)) {
      setShowCountyModal(true);
    } else {
      setShowModal(true);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Procedimientos</h3>
          {procedures.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">{procedures.length} registros</p>
          )}
        </div>
        <button
          onClick={() => handleOpen()}
          className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl transition-colors shadow-sm ${
            isCountyCategory
              ? 'bg-teal-600 hover:bg-teal-700'
              : 'bg-violet-600 hover:bg-violet-700'
          }`}
        >
          <FaPlus className="text-xs" />
          {isCountyCategory ? 'Nuevo Condado' : 'Nuevo Procedimiento'}
        </button>
      </div>

      {/* Loading */}
      {loading && procedures.length === 0 && (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-600 border-t-transparent" />
        </div>
      )}

      {/* Empty */}
      {!loading && procedures.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <FaListOl className="text-5xl mb-3 opacity-30" />
          <p className="font-medium text-slate-500">No hay procedimientos aún</p>
          <p className="text-sm mt-1">Agrega el primero con "Nuevo Procedimiento"</p>
        </div>
      )}

      {/* Cards */}
      {procedures.length > 0 && (
        <div className="space-y-3">
          {procedures.map(procedure => {
            const diff       = DIFFICULTY[procedure.difficulty] || DIFFICULTY.medium;
            const isExpanded = expandedId === procedure.id;
            const isCounty   = isCountyProcedure(procedure);
            const countyData = isCounty ? procedure.steps[0] : null;

            return (
              <div
                key={procedure.id}
                className="group bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-md transition-all overflow-hidden"
                style={isCounty
                  ? { borderLeftColor: '#0D9488', borderLeftWidth: 3 }
                  : procedure.category?.color
                    ? { borderLeftColor: procedure.category.color, borderLeftWidth: 3 }
                    : {}
                }
              >
                {/* Card header — clickable to view */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => handleView(procedure)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center flex-wrap gap-2 mb-1.5">
                        {procedure.isFavorite && <FaStar className="text-amber-400 text-xs flex-shrink-0" />}
                        {isCounty
                          ? <FaMapMarkerAlt className="text-teal-500 flex-shrink-0 text-sm" />
                          : procedure.category?.icon && <span className="text-base flex-shrink-0">{procedure.category.icon}</span>
                        }
                        <h4 className="font-semibold text-slate-800 text-sm sm:text-base leading-snug">{procedure.title}</h4>
                        {isCounty ? (
                          <>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">Condado</span>
                            {countyData.isOSTDS && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">OSTDS/DEP</span>
                            )}
                          </>
                        ) : (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${diff.cls}`}>{diff.label}</span>
                        )}
                      </div>

                      {/* County quick-summary */}
                      {isCounty ? (
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            {countyData.initialInspection?.required
                              ? <FaCheckCircle className="text-teal-500" />
                              : <FaTimesCircle className="text-slate-300" />
                            }
                            Insp. inicial
                          </span>
                          <span className="flex items-center gap-1">
                            {countyData.finalInspection?.required
                              ? <FaCheckCircle className="text-teal-500" />
                              : <FaTimesCircle className="text-slate-300" />
                            }
                            Insp. final
                          </span>
                          {countyData.systemFees?.atu && (
                            <span className="flex items-center gap-1">
                              <FaDollarSign className="text-slate-300" /> ATU: {countyData.systemFees.atu}
                            </span>
                          )}
                          {countyData.systemFees?.pbts && (
                            <span className="flex items-center gap-1">
                              <FaDollarSign className="text-slate-300" /> PBTS: {countyData.systemFees.pbts}
                            </span>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Description */}
                          {procedure.description && (
                            <p className="text-xs text-slate-500 line-clamp-2 mb-2">{procedure.description}</p>
                          )}

                          {/* Meta chips */}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {procedure.estimatedTime && (
                              <span className="flex items-center gap-1">
                                <FaClock className="text-slate-300" /> {procedure.estimatedTime}
                              </span>
                            )}
                            {procedure.cost && (
                              <span className="flex items-center gap-1">
                                <FaDollarSign className="text-slate-300" /> {procedure.cost}
                              </span>
                            )}
                            {procedure.steps?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <FaListOl className="text-slate-300" /> {procedure.steps.length} pasos
                              </span>
                            )}
                            {procedure.category?.name && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                                style={{ backgroundColor: (procedure.category.color || '#8B5CF6') + '20', color: procedure.category.color || '#8B5CF6' }}>
                                {procedure.category.name}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div
                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <button onClick={() => handleToggleFavorite(procedure.id)}
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-500 transition-colors"
                        title={procedure.isFavorite ? 'Quitar favorito' : 'Favorito'}>
                        {procedure.isFavorite ? <FaStar className="text-amber-400 text-xs" /> : <FaRegStar className="text-xs" />}
                      </button>
                      <button onClick={() => handleView(procedure)}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors" title="Ver">
                        <FaEye className="text-xs" />
                      </button>
                      <button onClick={() => handleOpen(procedure)}
                        className={`p-1.5 rounded-lg transition-colors ${isCounty
                          ? 'hover:bg-teal-50 text-slate-400 hover:text-teal-600'
                          : 'hover:bg-violet-50 text-slate-400 hover:text-violet-600'
                        }`} title="Editar">
                        <FaEdit className="text-xs" />
                      </button>
                      <button onClick={() => handleDelete(procedure.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
                        <FaTrash className="text-xs" />
                      </button>
                    </div>
                  </div>

                  {/* Requirements (normal procedures only) */}
                  {!isCounty && procedure.requirements && (
                    <div className="mt-3 flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg" onClick={e => e.stopPropagation()}>
                      <FaExclamationTriangle className="text-amber-500 mt-0.5 flex-shrink-0 text-xs" />
                      <p className="text-xs text-amber-700 line-clamp-2">
                        <span className="font-semibold">Requisitos: </span>{procedure.requirements}
                      </p>
                    </div>
                  )}

                  {/* County notes preview */}
                  {isCounty && procedure.description && (
                    <p className="mt-2 text-xs text-slate-400 line-clamp-1 italic">{procedure.description}</p>
                  )}

                  {/* Tags (normal procedures only) */}
                  {!isCounty && procedure.tags?.filter(t => t !== 'county-procedure').length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                      {procedure.tags.filter(t => t !== 'county-procedure').map((tag, i) => (
                        <span key={i} className="text-[10px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expand toggle — normal procedures only */}
                {!isCounty && procedure.steps?.length > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : procedure.id); }}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-500 hover:text-violet-600 hover:bg-slate-50 border-t border-slate-100 transition-colors"
                  >
                    {isExpanded ? <><FaChevronUp className="text-[10px]" /> Ocultar pasos</> : <><FaChevronDown className="text-[10px]" /> Ver {procedure.steps.length} pasos</>}
                  </button>
                )}

                {/* Steps expanded — normal procedures only */}
                {!isCounty && isExpanded && procedure.steps && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
                    {procedure.steps.map((step, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex-shrink-0 w-7 h-7 bg-violet-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                          {step.order ?? i + 1}
                        </div>
                        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                          <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                          {step.description && (
                            <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{step.description}</p>
                          )}
                          {step.tips && (
                            <div className="flex items-start gap-1.5 mt-2 bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
                              <FaLightbulb className="mt-0.5 flex-shrink-0" /> {step.tips}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {procedure.notes && (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-600">
                        <span className="font-semibold text-slate-700">Notas: </span>{procedure.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ProcedureModal procedure={selectedProcedure} isEditing={isEditing} onClose={handleClose} defaultCategoryId={categoryId} />
      )}

      {showCountyModal && (
        <CountyProcedureModal procedure={selectedProcedure} onClose={handleClose} defaultCategoryId={categoryId} />
      )}

      {showViewModal && selectedProcedure && (
        <ProcedureViewModal
          procedure={selectedProcedure}
          onClose={() => { setShowViewModal(false); setSelectedProcedure(null); }}
          onEdit={handleEditFromView}
        />
      )}

      {showCountyViewModal && selectedProcedure && (
        <CountyProcedureViewModal
          procedure={selectedProcedure}
          onClose={() => { setShowCountyViewModal(false); setSelectedProcedure(null); }}
          onEdit={handleEditFromView}
        />
      )}
    </div>
  );
});

ProcedureList.displayName = 'ProcedureList';
export default ProcedureList;
