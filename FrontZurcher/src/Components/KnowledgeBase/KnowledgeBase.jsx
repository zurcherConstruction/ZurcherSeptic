import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  FaBook, FaSearch, FaStar, FaPlus, FaRegStar, FaEdit, FaTrash,
  FaPhone, FaClipboardList, FaFileAlt, FaMapMarkerAlt,
} from 'react-icons/fa';
import { fetchCategories } from '../../Redux/Actions/knowledgeBaseActions';
import { fetchCategoriesSuccess } from '../../Redux/Reducer/knowledgeBaseReducer';
import ContactList from './ContactList';
import ProcedureList from './ProcedureList';
import DocumentList from './DocumentList';
import CountyList from './CountyList';
import CategoryModal from './CategoryModal';
import api from '../../utils/axios';

const TABS = [
  { key: 'contacts',   label: 'Contactos',      icon: <FaPhone />,        accent: 'blue'   },
  { key: 'procedures', label: 'Procedimientos',  icon: <FaClipboardList />, accent: 'violet' },
  { key: 'documents',  label: 'Documentos',      icon: <FaFileAlt />,       accent: 'amber'  },
  { key: 'counties',   label: 'Condados',        icon: <FaMapMarkerAlt />,  accent: 'teal'   },
];

const TAB_ACTIVE = {
  blue:   'border-blue-500 text-blue-600',
  violet: 'border-violet-500 text-violet-600',
  amber:  'border-amber-500 text-amber-600',
  teal:   'border-teal-500 text-teal-600',
};

const KnowledgeBase = () => {
  const dispatch = useDispatch();
  const categories = useSelector((state) => state.knowledgeBase.categories);
  const contacts   = useSelector((state) => state.knowledgeBase.contacts);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [subCategoryFilter, setSubCategoryFilter] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'contacts';
  const setActiveTab = (v) => setSearchParams(prev => { prev.set('tab', v); return prev; });
  const [searchQuery, setSearchQueryState] = useState(searchParams.get('q') || '');
  const setSearchQuery = (v) => {
    setSearchQueryState(v);
    setSearchParams(p => { if (v) p.set('q', v); else p.delete('q'); return p; }, { replace: true });
  };
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    setSubCategoryFilter(null);
  };

  // Sub-categories for sidebar: unique contactType values (material) + unique tags (service areas)
  const subMaterials = selectedCategory && activeTab === 'contacts' && contacts.length > 0
    ? [...new Set(contacts.map(c => c.contactType).filter(Boolean))].sort()
    : [];
  const subAreas = selectedCategory && activeTab === 'contacts' && contacts.length > 0
    ? [...new Set(contacts.flatMap(c => c.tags || []))].sort()
    : [];
  const hasSubItems = subMaterials.length > 0 || subAreas.length > 0;

  useEffect(() => {
    if (categories.length === 0) dispatch(fetchCategories());
  }, [dispatch]);

  const getCategoryIcon = (icon) => icon || '📚';

  const handleDeleteCategory = async (cat, e) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar la categoría "${cat.name}"? Los contactos/procedimientos/documentos dentro no se eliminarán.`)) return;
    try {
      await api.delete(`/knowledge-base/categories/${cat.id}`);
      const res = await api.get('/knowledge-base/categories');
      dispatch(fetchCategoriesSuccess(res.data));
      if (selectedCategory?.id === cat.id) setSelectedCategory(null);
    } catch {
      alert('Error al eliminar la categoría');
    }
  };

  const currentTab = TABS.find(t => t.key === activeTab) || TABS[0];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg px-5 sm:px-8 py-5 sm:py-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center flex-shrink-0">
                <FaBook className="text-xl sm:text-2xl text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold leading-tight">Base de Conocimiento</h1>
                <p className="text-blue-100 text-xs sm:text-sm mt-0.5">
                  Contactos, procedimientos y guías del equipo
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all self-start sm:self-auto ${
                showFavoritesOnly
                  ? 'bg-yellow-400 text-yellow-900 shadow-md'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              {showFavoritesOnly ? <FaStar /> : <FaRegStar />}
              <span>Favoritos</span>
            </button>
          </div>

          {/* Search */}
          <div className="mt-4 relative">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input
              type="text"
              placeholder="Buscar contactos, procedimientos, documentos..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 shadow-sm"
            />
          </div>
        </div>

        {/* ── Body grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Categorías</h2>
                <button
                  onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                  className="w-7 h-7 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm"
                  title="Nueva categoría"
                >
                  <FaPlus className="text-[10px]" />
                </button>
              </div>

              <div className="p-2 space-y-0.5">
                {/* Todas */}
                <button
                  onClick={() => handleSelectCategory(null)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    selectedCategory === null
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-base">📚</span>
                  <span className="flex-1 text-left">Todas</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${selectedCategory === null ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                    {categories.reduce((s, c) => s + (c.contactsCount || 0) + (c.proceduresCount || 0) + (c.documentsCount || 0), 0)}
                  </span>
                </button>

                {categories.map(category => {
                  const count = (category.contactsCount || 0) + (category.proceduresCount || 0) + (category.documentsCount || 0);
                  const isActive = selectedCategory?.id === category.id;
                  const showSubs = isActive && hasSubItems && activeTab === 'contacts';
                  return (
                    <div key={category.id}>
                      <div className={`group relative flex items-center rounded-xl transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                        <button
                          onClick={() => handleSelectCategory(category)}
                          className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-sm min-w-0"
                          style={isActive ? { borderLeft: `3px solid ${category.color || '#3B82F6'}` } : { borderLeft: '3px solid transparent' }}
                        >
                          <span className="text-base flex-shrink-0">{getCategoryIcon(category.icon)}</span>
                          <span className={`flex-1 text-left font-medium truncate ${isActive ? 'text-blue-700' : 'text-slate-600'}`}>
                            {category.name}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                            {count}
                          </span>
                        </button>
                        <div className="flex-shrink-0 flex items-center pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.stopPropagation(); setEditingCategory(category); setShowCategoryModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <FaEdit className="text-[10px]" />
                          </button>
                          <button
                            onClick={e => handleDeleteCategory(category, e)}
                            className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                            title="Eliminar"
                          >
                            <FaTrash className="text-[10px]" />
                          </button>
                        </div>
                      </div>

                      {/* Sub-categories */}
                      {showSubs && (
                        <div className="ml-4 mt-0.5 mb-1 border-l-2 border-slate-200 pl-2 space-y-0.5">
                          {/* Todos */}
                          <button
                            onClick={() => setSubCategoryFilter(null)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              subCategoryFilter === null
                                ? 'bg-blue-100 text-blue-800'
                                : 'text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            <span className="flex-1 text-left">Todos</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{contacts.length}</span>
                          </button>

                          {/* Material types */}
                          {subMaterials.length > 0 && (
                            <>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 pt-1">Material</p>
                              {subMaterials.map(sub => {
                                const n = contacts.filter(c => c.contactType === sub).length;
                                return (
                                  <button key={sub} onClick={() => setSubCategoryFilter(sub)}
                                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                      subCategoryFilter === sub ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span>🧱</span>
                                    <span className="flex-1 text-left truncate capitalize">{sub}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{n}</span>
                                  </button>
                                );
                              })}
                            </>
                          )}

                          {/* Service areas */}
                          {subAreas.length > 0 && (
                            <>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 pt-1">Área</p>
                              {subAreas.map(sub => {
                                const n = contacts.filter(c => c.tags?.includes(sub)).length;
                                return (
                                  <button key={sub} onClick={() => setSubCategoryFilter(sub)}
                                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                      subCategoryFilter === sub ? 'bg-teal-100 text-teal-800' : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span>📍</span>
                                    <span className="flex-1 text-left truncate capitalize">{sub}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{n}</span>
                                  </button>
                                );
                              })}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

              {/* Tabs */}
              <div className="border-b border-slate-200 overflow-x-auto">
                <nav className="flex min-w-max px-2" aria-label="Tabs">
                  {TABS.map(tab => {
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 sm:px-5 py-3.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                          isActive
                            ? TAB_ACTIVE[tab.accent]
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className={isActive ? '' : 'opacity-60'}>{tab.icon}</span>
                        {tab.label}
                        {selectedCategory && activeTab === tab.key && (
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            {tab.key === 'contacts' ? selectedCategory.contactsCount || 0
                              : tab.key === 'procedures' ? selectedCategory.proceduresCount || 0
                              : tab.key === 'documents' ? selectedCategory.documentsCount || 0
                              : ''}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="p-4 sm:p-6">
                {activeTab === 'contacts' && (
                  <ContactList
                    categoryId={selectedCategory?.id || null}
                    searchQuery={searchQuery}
                    showFavoritesOnly={showFavoritesOnly}
                    subCategoryFilter={subCategoryFilter}
                  />
                )}
                {activeTab === 'procedures' && (
                  <ProcedureList
                    categoryId={selectedCategory?.id || null}
                    searchQuery={searchQuery}
                    showFavoritesOnly={showFavoritesOnly}
                  />
                )}
                {activeTab === 'documents' && (
                  <DocumentList
                    categoryId={selectedCategory?.id || null}
                    searchQuery={searchQuery}
                    showFavoritesOnly={showFavoritesOnly}
                  />
                )}
                {activeTab === 'counties' && (
                  <CountyList searchQuery={searchQuery} />
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
          onSaved={() => { setShowCategoryModal(false); setEditingCategory(null); }}
        />
      )}
    </div>
  );
};

export default KnowledgeBase;
