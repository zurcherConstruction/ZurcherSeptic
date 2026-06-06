// filepath: src/Components/Common/PdfModal.jsx
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';


const PdfModal = ({ isOpen, onClose, pdfUrl, title, contentType = 'pdf' }) => {
  if (!isOpen || !pdfUrl) return null;

  // Detect if it's a mobile device
  const isMobile = window.innerWidth < 997;
  const isImage = contentType === 'image';
  const workerUrl = 'https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[95vh] sm:h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-3 sm:p-4 border-b">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-700 truncate pr-2">{title || (isImage ? "Image Viewer" : "Vista Previa del PDF")}</h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isImage && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm underline"
                title="Abrir en nueva pestaña"
              >
                Nueva pestaña
              </a>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1"
              title="Cerrar"
            >
              <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </div>
        <div className="flex-grow overflow-auto bg-gray-100 flex items-center justify-center p-4">
          {isImage ? (
            <img 
              src={pdfUrl} 
              alt={title || "Document Image"}
              className="max-w-full max-h-full object-contain rounded shadow-lg"
              style={{ 
                maxHeight: 'calc(95vh - 8rem)',
                width: 'auto',
                height: 'auto'
              }}
            />
          ) : (
            <div className="w-full h-full bg-white rounded overflow-hidden">
              <Worker workerUrl={workerUrl}>
                <Viewer
                  fileUrl={pdfUrl}
                  renderError={() => (
                    <div className="h-full flex items-center justify-center p-6 text-center">
                      <div>
                        <p className="text-gray-700 font-medium mb-3">No se pudo mostrar este PDF dentro del modal.</p>
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                        >
                          Abrir PDF en nueva pestaña
                        </a>
                      </div>
                    </div>
                  )}
                />
              </Worker>
            </div>
          )}
        </div>
        {isMobile && (
          <div className="p-2 sm:p-3 bg-gray-50 border-t text-xs sm:text-sm text-gray-600 text-center">
            <p>Para mejor navegación en móvil, <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">abrir en nueva pestaña</a></p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PdfModal;