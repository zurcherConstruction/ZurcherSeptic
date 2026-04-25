import React from 'react';
import { FaTimes, FaFilePdf, FaFileImage, FaFileExcel, FaFileWord, FaFileAlt, FaDownload, FaEye } from 'react-icons/fa';

const DocumentDetailsModal = ({ document, onClose, onPreview, onDownload }) => {
  if (!document) return null;

  const parseFileUrls = (fileUrl) => {
    if (!fileUrl) return [];
    
    try {
      const parsed = typeof fileUrl === 'string' ? JSON.parse(fileUrl) : fileUrl;
      return Array.isArray(parsed) ? parsed : [{ url: parsed }];
    } catch (e) {
      return [{ url: fileUrl }];
    }
  };

  const getFileIcon = (file) => {
    const format = file.format?.toLowerCase() || file.url?.split('.').pop()?.toLowerCase();
    
    if (format === 'pdf') {
      return <FaFilePdf className="text-red-500 text-3xl" />;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(format)) {
      return <FaFileImage className="text-blue-500 text-3xl" />;
    } else if (['xls', 'xlsx'].includes(format)) {
      return <FaFileExcel className="text-green-500 text-3xl" />;
    } else if (['doc', 'docx'].includes(format)) {
      return <FaFileWord className="text-blue-600 text-3xl" />;
    }
    return <FaFileAlt className="text-gray-500 text-3xl" />;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const files = parseFileUrls(document.fileUrl);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[55] p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold truncate">
              {document.title}
            </h2>
            {document.category && (
              <p className="text-xs sm:text-sm text-blue-100 mt-1">
                {document.category.icon} {document.category.name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1.5 sm:p-2 transition-colors flex-shrink-0"
          >
            <FaTimes className="text-lg sm:text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Description */}
          {document.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Descripción</h3>
              <p className="text-sm sm:text-base text-gray-600 whitespace-pre-wrap">
                {document.description}
              </p>
            </div>
          )}

          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Etiquetas</h3>
              <div className="flex flex-wrap gap-2">
                {document.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs sm:text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Archivos ({files.length})
            </h3>
            <div className="space-y-3">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      {getFileIcon(file)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base text-gray-800 break-all">
                        {file.originalFilename || `Archivo ${index + 1}`}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                        {file.format && (
                          <span className="px-2 py-1 bg-gray-100 rounded">
                            {file.format.toUpperCase()}
                          </span>
                        )}
                        {file.size && (
                          <span className="px-2 py-1 bg-gray-100 rounded">
                            {formatBytes(file.size)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                      <button
                        onClick={() => onPreview(file)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Vista previa"
                      >
                        <FaEye className="text-base sm:text-lg" />
                      </button>
                      <button
                        onClick={() => onDownload(file)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Descargar"
                      >
                        <FaDownload className="text-base sm:text-lg" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {document.notes && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Notas Adicionales</h3>
              <p className="text-sm sm:text-base text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                {document.notes}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Información</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div>
                <span className="text-gray-500">Creado:</span>
                <p className="text-gray-800 font-medium">{formatDate(document.createdAt)}</p>
              </div>
              <div>
                <span className="text-gray-500">Actualizado:</span>
                <p className="text-gray-800 font-medium">{formatDate(document.updatedAt)}</p>
              </div>
              {document.creator && (
                <div>
                  <span className="text-gray-500">Creado por:</span>
                  <p className="text-gray-800 font-medium">{document.creator.name}</p>
                </div>
              )}
              {document.updater && (
                <div>
                  <span className="text-gray-500">Modificado por:</span>
                  <p className="text-gray-800 font-medium">{document.updater.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 sm:px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm sm:text-base transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetailsModal;
