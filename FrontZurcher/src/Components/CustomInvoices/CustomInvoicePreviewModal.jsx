import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';

/**
 * Modal que muestra el PDF del Custom Invoice dentro de la página.
 * Props:
 *   invoiceId  — UUID del invoice
 *   onClose    — función para cerrar el modal
 */
export default function CustomInvoicePreviewModal({ invoiceId, onClose }) {
  const navigate = useNavigate();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const urlRef = useRef(null);

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);
    api.get(`/custom-invoices/${invoiceId}/download`, { responseType: 'blob' })
      .then(res => {
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPdfUrl(url);
      })
      .catch(() => setError('No se pudo cargar el PDF del invoice.'))
      .finally(() => setLoading(false));

    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [invoiceId]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 shrink-0">
        <button
          onClick={() => navigate(`/custom-invoices/${invoiceId}`)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition"
        >
          ✏️ Editar
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition"
        >
          ✕ Cerrar
        </button>
      </div>

      {/* Área del PDF */}
      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-3" />
              <p className="text-white text-sm">Cargando PDF...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center bg-white rounded-xl p-8 max-w-sm mx-4">
              <p className="text-4xl mb-4">📄</p>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Error al cargar</h2>
              <p className="text-gray-500 text-sm">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && pdfUrl && (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Custom Invoice PDF"
          />
        )}
      </div>
    </div>
  );
}
