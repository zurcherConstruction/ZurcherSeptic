import React, { useState, useRef } from 'react';
import { XMarkIcon, PaperClipIcon, PaperAirplaneIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../utils/axios';

const SendProposalModal = ({ lead, onClose, onSent }) => {
  const DEFAULT_MESSAGE = `As per our recent conversation, please find attached the requested proposals for your septic system project.

<strong>If you decide to move forward, we'll just need the following to get started and schedule your installation as soon as possible:

Both Approval for Health Department:
  • Permit
  • Site Plan</strong>

Our team handles the entire process from start to finish, making it simple and hassle-free for you.

Please feel free to reply to this email or contact us at sales@zurcherseptic.com if you have any questions. We look forward to working with you!`;

  const [formData, setFormData] = useState({
    to: lead?.applicantEmail || '',
    clientName: lead?.applicantName || '',
    subject: `Septic System Proposal — Zurcher Septic`,
    personalMessage: DEFAULT_MESSAGE
  });
  const [attachments, setAttachments] = useState([]); // max 2 PDFs
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const remaining = 2 - attachments.length;
    const toAdd = files.slice(0, remaining).filter(f => f.type === 'application/pdf');
    if (toAdd.length < files.length) {
      setError('Solo se permiten archivos PDF (máximo 2).');
    } else {
      setError('');
    }
    setAttachments(prev => [...prev, ...toAdd]);
    // Reset input so same file can be re-added after removal
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.to.includes('@')) {
      setError('El email del destinatario no es válido.');
      return;
    }

    setSending(true);
    try {
      const payload = new FormData();
      payload.append('to', formData.to);
      payload.append('clientName', formData.clientName);
      payload.append('subject', formData.subject);
      payload.append('personalMessage', formData.personalMessage);
      if (lead?.id) payload.append('leadId', lead.id);
      attachments.forEach(file => payload.append('attachments', file));

      await api.post('/sales/send-proposal', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Crear nota automática en el lead. Si el mensaje es el genérico por
      // defecto, no lo volcamos completo en la nota (queda ilegible en la
      // lista/Excel) — solo indicamos que se envió la cotización.
      const attachmentNames = attachments.map(f => f.name).join(', ');
      const isDefaultMessage = formData.personalMessage.trim() === DEFAULT_MESSAGE.trim();
      const customMessageSnippet = !isDefaultMessage && formData.personalMessage
        ? `\nMensaje: "${formData.personalMessage.substring(0, 120)}${formData.personalMessage.length > 120 ? '...' : ''}"`
        : '';
      const noteText = `📧 Cotización enviada a ${formData.to}${
        attachmentNames ? ` con adjuntos: ${attachmentNames}` : ''
      }${customMessageSnippet}`;

      await api.post('/lead-notes', {
        leadId: lead.id,
        message: noteText,
        noteType: 'follow_up',
        priority: 'medium'
      }).catch(() => {}); // no bloquear si falla la nota

      onSent?.(lead.id);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar la propuesta. Intenta nuevamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-lg overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a3a5c] to-[#2563a8] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0">
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="text-white font-bold text-base sm:text-lg truncate">✉️ Send Proposal</h2>
            <p className="text-blue-200 text-xs sm:text-sm mt-0.5 truncate">
              {lead?.propertyAddress || lead?.applicantName || 'Client'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors flex-shrink-0">
            <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {sent ? (
          /* Success state */
          <div className="p-6 sm:p-10 text-center">
            <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🎉</div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">Proposal Sent!</h3>
            <p className="text-gray-500 text-sm mb-4 sm:mb-6">
              The email was sent successfully to <strong className="break-all">{formData.to}</strong>.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">

            {/* Preview banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
              <img
                src="https://res.cloudinary.com/dt4ah1jmy/image/upload/v1774963095/flayer1_c1hnl4.jpg"
                alt="flyer preview"
                className="h-12 w-16 sm:h-14 sm:w-20 object-cover rounded-lg border border-blue-200 flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-700">Email includes</p>
                <p className="text-xs text-blue-600">Company flyer · CTA button to website · Your message</p>
              </div>
            </div>

            {/* To */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Client Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="to"
                value={formData.to}
                onChange={handleChange}
                required
                placeholder="client@email.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Client name */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Client Name</label>
              <input
                type="text"
                name="clientName"
                value={formData.clientName}
                onChange={handleChange}
                placeholder="John Smith"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Personal message */}
            <div>
              <div className="flex items-center justify-between mb-1 gap-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700">
                  Personal Message
                </label>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, personalMessage: DEFAULT_MESSAGE }))}
                  className="text-xs text-blue-500 hover:text-blue-700 underline whitespace-nowrap"
                >
                  Reset to default
                </button>
              </div>
              <textarea
                name="personalMessage"
                value={formData.personalMessage}
                onChange={handleChange}
                rows={4}
                placeholder="We visited your property and we'd love to help you with..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* PDF attachments */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Attach Budget PDF <span className="text-gray-400 text-xs">(max 2 files)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />

              {attachments.length < 2 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors w-full justify-center"
                >
                  <PaperClipIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Click to attach a PDF</span>
                </button>
              )}

              {attachments.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-2 sm:px-3 py-2 mt-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-green-600 text-base sm:text-lg flex-shrink-0">📄</span>
                    <span className="text-sm text-green-800 font-medium truncate">{file.name}</span>
                    <span className="text-xs text-green-500 whitespace-nowrap">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs sm:text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                ⚠️ {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#1a3a5c] to-[#2563a8] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                {sending ? 'Sending...' : 'Send Proposal'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default SendProposalModal;
