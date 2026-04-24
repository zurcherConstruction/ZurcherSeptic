import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaBook, FaSearch, FaStar, FaPlus, FaRegStar } from 'react-icons/fa';
import { fetchCategories } from '../../Redux/Actions/knowledgeBaseActions';
import ContactList from './ContactList';
import ProcedureList from './ProcedureList';
import DocumentList from './DocumentList';

const KnowledgeBase = () => {
  const dispatch = useDispatch();
  const categories = useSelector((state) => state.knowledgeBase.categories); // Selector específico
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeTab, setActiveTab] = useState('contacts'); // contacts, procedures, documents
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    // Solo hacer fetch si no hay categorías en Redux
    if (categories.length === 0) {
      dispatch(fetchCategories());
    }
  }, [dispatch]); // Solo al montar, pero verifica Redux

  const getCategoryIcon = (icon) => {
    return icon || '📚';
  };

  const getTabCount = (category) => {
    if (!category) return 0;
    switch (activeTab) {
      case 'contacts':
        return category.contactsCount || 0;
      case 'procedures':
        return category.proceduresCount || 0;
      case 'documents':
        return category.documentsCount || 0;
      default:
        return 0;
    }
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <FaBook className="text-2xl sm:text-3xl text-blue-600" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Base de Conocimiento</h1>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg flex items-center space-x-1 sm:space-x-2 transition-colors text-sm sm:text-base ${
                showFavoritesOnly
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showFavoritesOnly ? <FaStar className="text-sm sm:text-base" /> : <FaRegStar className="text-sm sm:text-base" />}
              <span className="hidden sm:inline">Favoritos</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm sm:text-base" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Sidebar - Categories */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-800">Categorías</h2>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base ${
                  selectedCategory === null
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg sm:text-xl mr-2">📚</span>
                Todas las categorías
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full text-left px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base ${
                    selectedCategory?.id === category.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                  style={{
                    borderLeft: selectedCategory?.id === category.id
                      ? `4px solid ${category.color || '#3B82F6'}`
                      : 'none'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg sm:text-xl">{getCategoryIcon(category.icon)}</span>
                      <span className="font-medium truncate">{category.name}</span>
                    </div>
                    <span className="text-xs sm:text-sm opacity-75 ml-1">
                      {(category.contactsCount || 0) + (category.proceduresCount || 0) + (category.documentsCount || 0)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-md">
            {/* Tabs */}
            <div className="border-b border-gray-200 overflow-x-auto">
              <nav className="flex space-x-1 px-2 sm:px-4 min-w-max" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('contacts')}
                  className={`px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'contacts'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="hidden sm:inline">📞 </span>Contactos
                  {selectedCategory && (
                    <span className="ml-1 sm:ml-2 bg-blue-100 text-blue-600 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                      {selectedCategory.contactsCount || 0}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('procedures')}
                  className={`px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'procedures'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="hidden sm:inline">📋 </span>Procedimientos
                  {selectedCategory && (
                    <span className="ml-1 sm:ml-2 bg-blue-100 text-blue-600 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                      {selectedCategory.proceduresCount || 0}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'documents'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="hidden sm:inline">📄 </span>Documentos
                  {selectedCategory && (
                    <span className="ml-1 sm:ml-2 bg-blue-100 text-blue-600 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                      {selectedCategory.documentsCount || 0}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="p-3 sm:p-6">
              {activeTab === 'contacts' && (
                <ContactList
                  categoryId={selectedCategory?.id || null}
                  searchQuery={searchQuery}
                  showFavoritesOnly={showFavoritesOnly}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
