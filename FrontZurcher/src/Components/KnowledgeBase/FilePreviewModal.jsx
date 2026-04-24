import React from 'react';
import { FaTimes, FaDownload, FaExternalLinkAlt } from 'react-icons/fa';

const FilePreviewModal = ({ file, onClose }) => {
  if (!file) return null;

  const isImage = () => {
    const format = file.format?.toLowerCase() || file.url?.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(format);
  };

  const isPDF = () => {
    const format = file.format?.toLowerCase() || file.url?.split('.').pop()?.toLowerCase();
    return format === 'pdf';
  };

  const isOfficeDoc = () => {
    const format = file.format?.toLowerCase() || file.url?.split('.').pop()?.toLowerCase();
    return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(format);
  };

  const getGoogleViewerUrl = () => {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(file.url)}&embedded=true`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[98vh] sm:max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 text-white px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold truncate flex-1 pr-2">
            {file.originalFilename || 'Vista previa'}
          </h3>
          <div className="flex items-center space-x-1 sm:space-x-3">
            <button
              onClick={async (e) => {
                e.preventDefault();
                try { const response = await fetch(file.url); const blob = await response.blob(); const url = window.URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url;
                
                link.download = file.originalFilename || 'download';
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link); window.URL.revokeObjectURL(url); } catch (error) { console.error('Error descargando:', error); window.open(file.url, '_blank'); }
              }}
              className="p-1.5 sm:p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Descargar"
            >
              <FaDownload className="text-sm sm:text-base" />
            </button>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 sm:p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Abrir en nueva pestaÃ±a"
            >
              <FaExternalLinkAlt className="text-sm sm:text-base" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Cerrar"
            >
              <FaTimes className="text-lg sm:text-xl" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-2 sm:p-4">
          {isImage() ? (
            <img
              src={file.url}
              alt={file.originalFilename || 'Preview'}
              className="max-w-full max-h-full object-contain rounded shadow-lg"
            />
          ) : isPDF() || isOfficeDoc() ? (
            <iframe
              src={getGoogleViewerUrl()}
              title={file.originalFilename || 'Document Preview'}
              className="w-full h-full min-h-[400px] sm:min-h-[600px] border-0 rounded shadow-lg bg-white"
            />
          ) : (
            <div className="text-center py-8 sm:py-12 px-4">
              <p className="text-sm sm:text-base text-gray-600 mb-4">
                Vista previa no disponible para este tipo de archivo
              </p>
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  try { const response = await fetch(file.url); const blob = await response.blob(); const url = window.URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url;
                  
                  link.download = file.originalFilename || 'download';
                  link.target = '_blank';
                  link.rel = 'noopener noreferrer';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link); window.URL.revokeObjectURL(url); } catch (error) { console.error('Error descargando:', error); window.open(file.url, '_blank'); }
                }}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center space-x-2 text-sm sm:text-base"
              >
                <FaDownload />
                <span>Descargar archivo</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;

