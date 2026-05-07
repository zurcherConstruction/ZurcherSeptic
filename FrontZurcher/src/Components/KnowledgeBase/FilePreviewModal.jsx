import React from 'react';
import { FaTimes, FaDownload, FaExternalLinkAlt } from 'react-icons/fa';

const FilePreviewModal = ({ file, onClose }) => {
  if (!file) return null;

  const getFormat = () => {
    if (file.format) return file.format.toLowerCase();
    if (file.mimeType) {
      if (file.mimeType === 'application/pdf') return 'pdf';
      if (file.mimeType.startsWith('image/')) return file.mimeType.split('/')[1];
    }
    return file.url?.split('?')[0].split('.').pop()?.toLowerCase() || '';
  };

  const isImage = () => {
    const fmt = getFormat();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fmt);
  };

  const isPDF = () => getFormat() === 'pdf';

  const isOfficeDoc = () => {
    const fmt = getFormat();
    return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fmt);
  };

  const getGoogleViewerUrl = () => {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(file.url)}&embedded=true`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[98vh] overflow-hidden flex flex-col">
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
        <div className="flex-1 min-h-0 overflow-hidden bg-gray-100">
          {isImage() ? (
            <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
              <img
                src={file.url}
                alt={file.originalFilename || 'Preview'}
                className="max-w-full max-h-full object-contain rounded shadow-lg"
              />
            </div>
          ) : isPDF() || isOfficeDoc() ? (
            <iframe
              src={getGoogleViewerUrl()}
              title={file.originalFilename || 'Document Preview'}
              className="w-full h-full border-0"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;

