import React, { useState, useEffect, useCallback, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  FaFileAlt, FaFilePdf, FaFileImage, FaFileExcel, FaFileWord,
  FaStar, FaRegStar, FaPlus, FaEdit, FaTrash, FaDownload, FaEye 
} from 'react-icons/fa';
import { fetchDocuments, deleteDocument, toggleDocumentFavorite, fetchCategories } from '../../Redux/Actions/knowledgeBaseActions';
import DocumentModal from './DocumentModal';
import FilePreviewModal from './FilePreviewModal';
import DocumentDetailsModal from './DocumentDetailsModal';

const DocumentList = memo(({ categoryId, searchQuery, showFavoritesOnly }) => {
  const dispatch = useDispatch();
  const documents = useSelector((state) => state.knowledgeBase.documents);
  const loading = useSelector((state) => state.knowledgeBase.loading);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [documentForDetails, setDocumentForDetails] = useState(null);

  const loadDocumentsData = useCallback(() => {
    const params = {};
    if (categoryId) params.categoryId = categoryId;
    if (searchQuery) params.search = searchQuery;
    if (showFavoritesOnly) params.favorite = 'true';
    
    dispatch(fetchDocuments(params));
  }, [categoryId, searchQuery, showFavoritesOnly]);

  useEffect(() => {
    loadDocumentsData();
  }, [loadDocumentsData]);

  const handleToggleFavorite = (documentId) => {
    dispatch(toggleDocumentFavorite(documentId));
  };

  const handleDelete = async (documentId) => {
    if (!confirm('¿Estás seguro de eliminar este documento?')) return;
    await dispatch(deleteDocument(documentId));
    loadDocumentsData();
  };

  const handleOpenModal = (document = null) => {
    setSelectedDocument(document);
    setIsEditing(!!document);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedDocument(null);
    setIsEditing(false);
    loadDocumentsData();
    // Recargar categorías para actualizar contadores
    dispatch(fetchCategories());
  };

  const getFileIcon = (file) => {
    // file puede ser un string (formato) o un objeto con property format
    const format = typeof file === 'string' ? file : file?.format;
    const ext = format?.toLowerCase();
    
    if (ext === 'pdf') {
      return <FaFilePdf className="text-red-500 text-3xl" />;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return <FaFileImage className="text-blue-500 text-3xl" />;
    } else if (['xls', 'xlsx'].includes(ext)) {
      return <FaFileExcel className="text-green-500 text-3xl" />;
    } else if (['doc', 'docx'].includes(ext)) {
      return <FaFileWord className="text-blue-600 text-3xl" />;
    }
    return <FaFileAlt className="text-gray-500 text-3xl" />;
  };

  const getFileTypeBadge = (fileType) => {
    const badges = {
      PDF: 'bg-red-100 text-red-600',
      Image: 'bg-blue-100 text-blue-600',
      Excel: 'bg-green-100 text-green-600',
      Word: 'bg-blue-100 text-blue-700',
      Other: 'bg-gray-100 text-gray-600'
    };
    return badges[fileType] || badges.Other;
  };

  const parseFileUrls = (fileUrl) => {
    if (!fileUrl) return [];
    
    try {
      const parsed = typeof fileUrl === 'string' ? JSON.parse(fileUrl) : fileUrl;
      return Array.isArray(parsed) ? parsed : [{ url: parsed }];
    } catch (e) {
      // Si no es JSON, es una URL simple
      return [{ url: fileUrl }];
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDownloadFile = async (file) => {
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.originalFilename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando archivo:', error);
      // Fallback: abrir en nueva pestaña
      window.open(file.url, '_blank');
    }
  };

  const handleShowDetails = (document) => {
    setDocumentForDetails(document);
    setShowDetailsModal(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800">
          Documentos {documents.length > 0 && `(${documents.length})`}
        </h3>
        <button
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center sm:justify-start space-x-2 transition-colors text-sm sm:text-base"
        >
          <FaPlus />
          <span>Nuevo Documento</span>
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-8 sm:py-12">
          <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 text-sm sm:text-base">Cargando documentos...</p>
        </div>
      ) : documents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {documents.map((document) => {
            const files = parseFileUrls(document.fileUrl);
            const firstFile = files[0] || {};
            
            return (
            <div
              key={document.id}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">{getFileIcon({ format: firstFile.format || firstFile.url?.split('.').pop() })}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm sm:text-base text-gray-800 line-clamp-1">
                      {document.title}
                    </h4>
                    {files.length > 1 && (
                      <span className="text-[10px] sm:text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
                        {files.length} archivos
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Category Badge */}
              {document.category && (
                <div className="mb-2 sm:mb-3">
                  <span className="text-[10px] sm:text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded flex items-center space-x-1 w-fit">
                    <span>{document.category.icon}</span>
                    <span className="truncate">{document.category.name}</span>
                  </span>
                </div>
              )}

              {/* Description */}
              {document.description && (
                <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 line-clamp-2">
                  {document.description}
                </p>
              )}

              {/* Tags */}
              {document.tags && document.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
                  {document.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="text-[10px] sm:text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Archivos */}
              {(() => {
                const files = parseFileUrls(document.fileUrl);
                return files.length > 0 && (
                  <div className="mb-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-600">
                      Archivos ({files.length}):
                    </p>
                    {files.map((file, fileIndex) => (
                      <div
                        key={fileIndex}
                        className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded"
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          {getFileIcon({ format: file.format || file.url?.split('.').pop() })}
                          <span className="truncate text-gray-700">
                            {file.originalFilename || `Archivo ${fileIndex + 1}`}
                          </span>
                          {file.size && (
                            <span className="text-gray-500">({formatBytes(file.size)})</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => setPreviewFile(file)}
                            className="text-blue-600 hover:text-blue-700 transition-colors p-1"
                            title="Vista previa"
                          >
                            <FaEye size={12} />
                          </button>
                          <button
                            onClick={() => handleDownloadFile(file)}
                            className="text-green-600 hover:text-green-700 transition-colors p-1"
                            title="Descargar"
                          >
                            <FaDownload size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-gray-200">
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <button
                    onClick={() => handleToggleFavorite(document.id)}
                    className="text-yellow-500 hover:text-yellow-600 transition-colors p-1"
                    title={document.isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                  >
                    {document.isFavorite ? <FaStar className="text-sm sm:text-base" /> : <FaRegStar className="text-sm sm:text-base" />}
                  </button>
                  <button
                    onClick={() => handleShowDetails(document)}
                    className="text-indigo-600 hover:text-indigo-700 transition-colors p-1"
                    title="Ver detalles completos"
                  >
                    <FaEye className="text-sm sm:text-base" />
                  </button>
                </div>
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <button
                    onClick={() => handleOpenModal(document)}
                    className="text-blue-600 hover:text-blue-700 transition-colors p-1"
                    title="Editar"
                  >
                    <FaEdit className="text-sm sm:text-base" />
                  </button>
                  <button
                    onClick={() => handleDelete(document.id)}
                    className="text-red-600 hover:text-red-700 transition-colors p-1"
                    title="Eliminar"
                  >
                    <FaTrash className="text-sm sm:text-base" />
                  </button>
                </div>
              </div>

              {/* Notes (if any) */}
              {document.notes && (
                <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100">
                  <p className="text-[10px] sm:text-xs text-gray-500 italic line-clamp-2">
                    {document.notes}
                  </p>
                </div>
              )}
            </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 sm:py-12 bg-gray-50 rounded-lg px-4">
          <FaFileAlt className="mx-auto text-4xl sm:text-5xl text-gray-300 mb-3 sm:mb-4" />
          <p className="text-gray-600 text-base sm:text-lg mb-2">No hay documentos</p>
          <p className="text-gray-500 text-xs sm:text-sm mb-3 sm:mb-4">
            {searchQuery
              ? 'No se encontraron documentos con ese criterio'
              : 'Comienza agregando tu primer documento'}
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center space-x-2 transition-colors text-sm sm:text-base"
          >
            <FaPlus />
            <span>Agregar Documento</span>
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <DocumentModal
          document={selectedDocument}
          isEditing={isEditing}
          onClose={handleCloseModal}
          defaultCategoryId={categoryId}
        />
      )}

      {/* Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Details Modal */}
      {showDetailsModal && documentForDetails && (
        <DocumentDetailsModal
          document={documentForDetails}
          onClose={() => {
            setShowDetailsModal(false);
            setDocumentForDetails(null);
          }}
          onPreview={(file) => {
            setPreviewFile(file);
            setShowDetailsModal(false);
          }}
          onDownload={(file) => handleDownloadFile(file)}
        />
      )}
    </div>
  );
});

DocumentList.displayName = 'DocumentList';

export default DocumentList;
