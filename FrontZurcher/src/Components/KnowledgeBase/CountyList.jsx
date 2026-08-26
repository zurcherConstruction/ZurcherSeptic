import React, { useState, useEffect, useCallback, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaPlus, FaEdit, FaTrash, FaEye, FaPhone, FaEnvelope, FaGlobe, FaMapMarkerAlt } from 'react-icons/fa';
import { fetchCounties, deleteCounty } from '../../Redux/Actions/knowledgeBaseActions';
import CountyViewModal from './CountyViewModal';
import CountyEditModal from './CountyEditModal';

const SYSTEM_BADGE = {
  REGULAR: 'bg-blue-100 text-blue-700 border border-blue-200',
  ATU:     'bg-violet-100 text-violet-700 border border-violet-200',
  DRIP:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
};

const CountyList = memo(({ searchQuery }) => {
  const dispatch = useDispatch();
  const counties = useSelector(state => state.knowledgeBase.counties);
  const loading  = useSelector(state => state.knowledgeBase.loading);

  const [selectedCounty, setSelectedCounty] = useState(null);
  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [regionFilter, setRegionFilter] = useState('');

  const load = useCallback(() => {
    const p = {};
    if (searchQuery) p.search = searchQuery;
    dispatch(fetchCounties(p));
  }, [searchQuery, dispatch]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async id => {
    if (!confirm('¿Eliminar este condado?')) return;
    await dispatch(deleteCounty(id));
    load();
  };

  const handleView = county => { setSelectedCounty(county); setShowView(true); };
  const handleEdit = (county = null) => { setSelectedCounty(county); setShowView(false); setShowEdit(true); };
  const handleEditFromView = () => { setShowView(false); setShowEdit(true); };
  const handleSaved = () => load();

  const regions = [...new Set(counties.map(c => c.region).filter(Boolean))].sort();
  const filtered = regionFilter ? counties.filter(c => c.region === regionFilter) : counties;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Condados de Florida</h3>
          {counties.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">{counties.length} condados registrados</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {regions.length > 0 && (
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
            >
              <option value="">Todas las regiones</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          <button
            onClick={() => handleEdit(null)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
          >
            <FaPlus className="text-xs" /> Nuevo Condado
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && counties.length === 0 && (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-600 border-t-transparent" />
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <FaMapMarkerAlt className="text-5xl mb-3 opacity-30" />
          <p className="font-medium text-slate-500">No hay condados registrados aún</p>
          <p className="text-sm mt-1">Agrega el primero con "Nuevo Condado"</p>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(county => (
            <div
              key={county.id}
              className="group relative bg-white border border-l-4 border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
              style={{ borderLeftColor: '#0D9488' }}
              onClick={() => handleView(county)}
            >
              {/* Actions */}
              <div
                className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => e.stopPropagation()}
              >
                <button onClick={() => handleView(county)}
                  className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors" title="Ver">
                  <FaEye className="text-xs" />
                </button>
                <button onClick={() => handleEdit(county)}
                  className="p-1.5 rounded-lg hover:bg-teal-50 text-slate-400 hover:text-teal-600 transition-colors" title="Editar">
                  <FaEdit className="text-xs" />
                </button>
                <button onClick={() => handleDelete(county.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
                  <FaTrash className="text-xs" />
                </button>
              </div>

              {/* Name + region */}
              <div className="pr-24 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg flex-shrink-0">🗺️</span>
                  <h4 className="font-bold text-slate-800 text-sm sm:text-base">{county.name}</h4>
                </div>
                {county.region && (
                  <p className="text-xs text-slate-400 mt-0.5 ml-7">{county.region}</p>
                )}
              </div>

              {/* System badges */}
              {county.systemRequirements?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {county.systemRequirements.map(req => (
                    <span key={req.systemType}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SYSTEM_BADGE[req.systemType] || 'bg-slate-100 text-slate-600'}`}>
                      {req.systemType}
                      {req.steps?.length > 0 && ` · ${req.steps.length} pasos`}
                    </span>
                  ))}
                </div>
              )}

              {/* Contact preview */}
              <div className="space-y-1">
                {county.phones?.filter(p => p.number).slice(0, 2).map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <FaPhone className="text-teal-400 flex-shrink-0" />
                    {p.label && <span className="text-slate-400 font-medium">{p.label}:</span>}
                    <a href={`tel:${p.number}`} onClick={e => e.stopPropagation()}
                      className="text-blue-600 hover:underline">{p.number}</a>
                  </div>
                ))}
                {county.emails?.filter(e => e.email).slice(0, 1).map((em, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <FaEnvelope className="text-teal-400 flex-shrink-0" />
                    <a href={`mailto:${em.email}`} onClick={e => e.stopPropagation()}
                      className="text-blue-600 hover:underline truncate">{em.email}</a>
                  </div>
                ))}
                {county.websites?.filter(w => w.url).slice(0, 1).map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <FaGlobe className="text-teal-400 flex-shrink-0" />
                    <span className="text-teal-600 truncate">{w.label || w.url}</span>
                  </div>
                ))}
              </div>

              {county.generalNotes && (
                <p className="mt-2.5 text-xs text-slate-400 italic line-clamp-1 border-t border-slate-100 pt-2">
                  "{county.generalNotes}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showView && selectedCounty && (
        <CountyViewModal
          county={selectedCounty}
          onClose={() => { setShowView(false); setSelectedCounty(null); }}
          onEdit={handleEditFromView}
        />
      )}

      {showEdit && (
        <CountyEditModal
          county={selectedCounty}
          onClose={() => { setShowEdit(false); setSelectedCounty(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
});

CountyList.displayName = 'CountyList';
export default CountyList;
