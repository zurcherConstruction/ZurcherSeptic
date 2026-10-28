// 🤖 ZurcherAI — vista del chat (mensajes + caja de texto). La usan el panel lateral y la página completa.
import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FaMicrophone, FaStop, FaVolumeUp, FaFilePdf, FaFileExcel, FaCopy, FaCheck,
  FaDownload, FaExternalLinkAlt, FaTimes, FaPaperPlane,
} from 'react-icons/fa';
import logo from '../../../public/logo.png';
import { exportAnswerToPdf, exportAnswerToExcel, answerHasTables, canSpeak } from '../../utils/aiAnswerTools';
import { OPEN_LINK_PREFIX, EXPORT_LINK_PREFIX, resolveOpenLink, isCompanyImage, thumbnailUrl } from './aiLinks';

const SUGGESTIONS = {
  common: [
    '¿Qué inspecciones están programadas esta semana?',
    '¿Qué visitas de mantenimiento están pendientes?',
    'Muéstrame las fotos de la obra en ...',
    '¿Qué correos importantes llegaron hoy?',
    '¿Cuántos leads nuevos entraron este mes?',
    'Pasame en Excel las obras en curso',
  ],
  owner: [
    '¿Cuánto ingresamos y gastamos este mes?',
    '¿Qué facturas de proveedores están vencidas?',
  ],
};

export function AIAvatar({ size = 'w-8 h-8', pulse = false }) {
  return (
    <div className={`${size} rounded-full bg-gray-900 ring-2 ring-[#f6d02c] flex items-center justify-center shrink-0 overflow-hidden ${pulse ? 'animate-pulse' : ''}`}>
      <img src={logo} alt="Zurcher AI" className="w-full h-full object-cover" />
    </div>
  );
}

const baseMarkdown = {
  p: props => <p className="mb-2 last:mb-0" {...props} />,
  ul: props => <ul className="list-disc pl-5 mb-2 space-y-0.5" {...props} />,
  ol: props => <ol className="list-decimal pl-5 mb-2 space-y-0.5" {...props} />,
  h1: props => <h3 className="font-bold text-base mt-3 mb-1 text-gray-900" {...props} />,
  h2: props => <h3 className="font-bold text-base mt-3 mb-1 text-gray-900" {...props} />,
  h3: props => <h4 className="font-semibold mt-2 mb-1 text-gray-900" {...props} />,
  strong: props => <strong className="font-semibold text-gray-900" {...props} />,
  code: props => <code className="bg-gray-100 rounded px-1 text-xs" {...props} />,
  table: props => (
    <div className="overflow-x-auto my-2 rounded-lg border border-gray-200">
      <table className="min-w-full text-xs" {...props} />
    </div>
  ),
  thead: props => <thead className="bg-gray-900 text-white" {...props} />,
  th: props => <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap" {...props} />,
  tr: props => <tr className="even:bg-gray-50 border-t border-gray-100" {...props} />,
  td: props => <td className="px-2 py-1.5 align-top" {...props} />,
};

function ToolbarButton({ onClick, title, children, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
        active ? 'text-blue-700 bg-blue-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

function Message({ msg, question, isSpeaking, onToggleSpeak, onDownloadExport, onNavigate, onOpenImage }) {
  const isUser = msg.role === 'user';
  const contentRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [hasTables, setHasTables] = useState(false);

  useEffect(() => {
    if (!isUser) setHasTables(answerHasTables(contentRef.current));
  }, [isUser, msg.content]);

  const components = useMemo(() => ({
    ...baseMarkdown,
    a: ({ href = '', children }) => {
      // Excel generado por la IA
      if (href.startsWith(EXPORT_LINK_PREFIX)) {
        return (
          <button
            onClick={() => onDownloadExport(href.slice(EXPORT_LINK_PREFIX.length))}
            className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg px-3 py-1.5 my-1 shadow-sm"
          >
            <FaDownload className="w-3 h-3" /> {children}
          </button>
        );
      }
      // Registro del sistema (obra, invoice, simple work...)
      if (href.startsWith(OPEN_LINK_PREFIX)) {
        const path = resolveOpenLink(href);
        if (!path) return <span className="font-medium">{children}</span>;
        return (
          <button
            onClick={() => onNavigate(path)}
            className="inline-flex items-center gap-1 text-blue-700 font-medium hover:text-blue-900 hover:underline decoration-[#f6d02c] decoration-2 underline-offset-2 text-left"
            title="Abrir en el sistema"
          >
            {children}
            <FaExternalLinkAlt className="w-2.5 h-2.5 opacity-60 shrink-0" />
          </button>
        );
      }
      return <a href={href} className="text-blue-700 underline" target="_blank" rel="noreferrer">{children}</a>;
    },
    img: ({ src = '', alt }) => (isCompanyImage(src) ? (
      <button
        onClick={() => onOpenImage({ src, alt })}
        className="inline-block align-top m-1 rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-[#f6d02c] transition-all"
        title={alt || 'Ver imagen'}
      >
        <img src={thumbnailUrl(src, 320)} alt={alt || ''} loading="lazy" className="w-32 h-24 sm:w-40 sm:h-28 object-cover" />
      </button>
    ) : null),
  }), [onDownloadExport, onNavigate, onOpenImage]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* sin permiso de portapapeles */ }
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4 gap-2">
      <AIAvatar />
      <div className="min-w-0 max-w-[92%]">
        <div className="bg-white text-gray-700 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
          <div ref={contentRef}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {msg.content}
            </ReactMarkdown>
          </div>
        </div>
        <div className="flex flex-wrap gap-0.5 mt-1 ml-1">
          {canSpeak && (
            <ToolbarButton onClick={onToggleSpeak} title={isSpeaking ? 'Detener' : 'Escuchar'} active={isSpeaking}>
              {isSpeaking ? <FaStop className="w-3 h-3" /> : <FaVolumeUp className="w-3 h-3" />}
              <span>{isSpeaking ? 'Detener' : 'Escuchar'}</span>
            </ToolbarButton>
          )}
          <ToolbarButton onClick={copy} title="Copiar texto">
            {copied ? <FaCheck className="w-3 h-3 text-green-600" /> : <FaCopy className="w-3 h-3" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => exportAnswerToPdf(contentRef.current, { question })} title="Descargar como PDF">
            <FaFilePdf className="w-3 h-3" /> <span>PDF</span>
          </ToolbarButton>
          {hasTables && (
            <ToolbarButton onClick={() => exportAnswerToExcel(contentRef.current, { question })} title="Descargar las tablas en Excel">
              <FaFileExcel className="w-3 h-3" /> <span>Excel</span>
            </ToolbarButton>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4 gap-2">
      <AIAvatar pulse />
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
        <span className="w-2 h-2 bg-[#f6d02c] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-[#f6d02c] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-[#f6d02c] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        <span className="text-xs text-gray-500 ml-2">Consultando el sistema…</span>
      </div>
    </div>
  );
}

function ImageLightbox({ image, onClose }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] bg-black/85 flex flex-col items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white p-2" title="Cerrar">
        <FaTimes className="w-5 h-5" />
      </button>
      <img
        src={thumbnailUrl(image.src, 1600)}
        alt={image.alt || ''}
        className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain"
        onClick={e => e.stopPropagation()}
      />
      <div className="mt-3 flex items-center gap-4 text-sm text-white/90" onClick={e => e.stopPropagation()}>
        {image.alt && <span>{image.alt}</span>}
        <a href={image.src} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#f6d02c] hover:underline">
          <FaExternalLinkAlt className="w-3 h-3" /> Original
        </a>
      </div>
    </div>
  );
}

export default function AIChatView({ chat, staff, onNavigate, compact = false }) {
  const bottomRef = useRef(null);
  const [image, setImage] = useState(null);
  const {
    messages, input, setInput, loading, loadingMessages, error, setError, inputRef, sendMessage, downloadExport,
    speakingIndex, toggleSpeak, canDictate, listening, toggleListening, voiceLang, changeVoiceLang,
  } = chat;

  const suggestions = staff?.role === 'owner' ? [...SUGGESTIONS.owner, ...SUGGESTIONS.common] : SUGGESTIONS.common;
  const firstName = (staff?.name || staff?.username || '').split(' ')[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const pickSuggestion = (s) => {
    if (s.endsWith('...')) {
      setInput(s.replace('...', ''));
      inputRef.current?.focus();
    } else {
      sendMessage(s);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mensajes */}
      <div className={`flex-1 overflow-y-auto min-h-0 ${compact ? 'px-3 py-4' : 'px-4 py-5'} bg-gray-50`}>
        {loadingMessages && <p className="text-center text-sm text-gray-400 mt-6">Cargando conversación…</p>}

        {!loadingMessages && messages.length === 0 && (
          <div className="max-w-xl mx-auto mt-2">
            <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-5 shadow-lg relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-[#f6d02c]/10" />
              <div className="flex items-center gap-3 relative">
                <AIAvatar size="w-11 h-11" />
                <div>
                  <p className="text-base font-semibold">Hola{firstName ? `, ${firstName}` : ''} 👋</p>
                  <p className="text-xs text-gray-300">Soy Zurcher AI. Consulto obras, permisos, finanzas, correos y archivos por ti.</p>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-3 relative">
                Escribe o dicta tu pregunta. Te dejo enlaces directos a cada obra, invoice o documento. Tus conversaciones son privadas.
              </p>
            </div>
            <p className="text-[11px] text-gray-500 mt-5 mb-2 font-semibold tracking-wide">PRUEBA CON</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => pickSuggestion(s)}
                  className="text-xs bg-white border border-gray-200 hover:border-[#f6d02c] hover:bg-yellow-50 text-gray-700 rounded-full px-3 py-1.5 transition-colors shadow-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message
            key={msg.id || i}
            msg={msg}
            question={messages[i - 1]?.role === 'user' ? messages[i - 1].content : undefined}
            isSpeaking={speakingIndex === i}
            onToggleSpeak={() => toggleSpeak(i, msg.content)}
            onDownloadExport={downloadExport}
            onNavigate={onNavigate}
            onOpenImage={setImage}
          />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700"><FaTimes className="w-3 h-3" /></button>
        </div>
      )}

      {/* Caja de texto */}
      <div className={`${compact ? 'p-3' : 'p-4'} bg-white border-t border-gray-200`}>
        <div className={`flex items-end gap-2 rounded-2xl border bg-white px-2 py-1.5 transition-all ${
          listening ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-300 focus-within:border-gray-900 focus-within:ring-2 focus-within:ring-[#f6d02c]/40'
        }`}>
          {canDictate && (
            <div className="flex flex-col items-center shrink-0">
              <button
                onClick={toggleListening}
                disabled={loading}
                title={listening ? 'Detener dictado' : 'Dictar por voz'}
                className={`rounded-xl p-2.5 transition-colors disabled:opacity-50 ${
                  listening ? 'bg-red-600 text-white animate-pulse' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {listening ? <FaStop className="w-4 h-4" /> : <FaMicrophone className="w-4 h-4" />}
              </button>
              <button
                onClick={changeVoiceLang}
                disabled={listening}
                title="Idioma del dictado"
                className="text-[9px] font-semibold text-gray-400 hover:text-gray-700 -mt-0.5"
              >
                {voiceLang === 'es-US' ? 'ES' : 'EN'}
              </button>
            </div>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={listening ? 'Escuchando… habla ahora' : 'Pregúntale a Zurcher AI…'}
            rows={1}
            disabled={loading}
            className="flex-1 min-w-0 resize-none bg-transparent outline-none px-1 py-2.5 text-sm text-gray-800 placeholder-gray-400 disabled:opacity-60"
            style={{ maxHeight: '140px', overflowY: 'auto' }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            title="Enviar"
            className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-[#f6d02c] disabled:text-white rounded-xl p-2.5 transition-colors shrink-0 mb-0.5"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : <FaPaperPlane className="w-4 h-4" />}
          </button>
        </div>
        {!compact && (
          <p className="text-center text-[11px] text-gray-400 mt-2">
            Enter para enviar · Shift+Enter nueva línea · Ctrl+K abre Zurcher AI desde cualquier pantalla · Solo lectura
          </p>
        )}
      </div>

      {image && <ImageLightbox image={image} onClose={() => setImage(null)} />}
    </div>
  );
}
