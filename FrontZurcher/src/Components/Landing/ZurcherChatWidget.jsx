// 🌐 Asistente virtual de la landing para clientes interesados (público, sin login)
// Responde dudas (servicios, zonas, precios de referencia, reparaciones, desagotes) y registra al
// interesado como Sales Lead. La conversación vive solo en esta pestaña (sessionStorage).
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { FaTimes, FaPaperPlane, FaWhatsapp, FaPhoneAlt, FaCheckCircle, FaRedo, FaCalendarAlt } from 'react-icons/fa';
import api from '../../utils/axios';
import { OPEN_QUOTE_EVENT } from './FloatingQuoteButton';

const LOGO = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1770244237/logo_v2cxn3.png';
const PHONE = '(954) 636-8200';
const WHATSAPP = 'https://wa.me/19546368200?text=' + encodeURIComponent("Hello, I'm interested in your septic system services.");
const STORAGE_KEY = 'zurcher.webchat';

// Idioma: inglés por defecto; el visitante puede cambiar a español (EN/ES en el encabezado)
const TEXTS = {
  en: {
    teaser: 'Need help with your septic system? 👋',
    title: 'Zurcher Septic',
    subtitle: 'Virtual assistant · replies instantly',
    launcher: 'Chat with us · Free quote',
    welcome: "Hi! 👋 I'm the **Zurcher Septic** assistant. I can help with quotes, new installations, repairs, pumping and maintenance across South Florida. How can I help you today?",
    switchLang: '¿Prefiere español? Español',
    starters: ['I have a septic problem', 'Do you serve my area?', 'ATU maintenance contract', 'Septic pumping'],
    quote: 'Schedule Free Quote',
    quoteFallback: 'I need a free quote',
    translating: 'Translating…',
    placeholder: 'Type your message…',
    saved: 'Your details were sent to our team. We will contact you soon.',
    footer: 'AI assistant · Talk to a person:',
    restart: 'New conversation',
    error: 'We could not reach the chat. Please call or WhatsApp us at ' + PHONE,
  },
  es: {
    teaser: '¿Necesitas ayuda con tu sistema séptico? 👋',
    title: 'Zurcher Septic',
    subtitle: 'Asistente virtual · responde al instante',
    launcher: 'Chatea con nosotros · Presupuesto gratis',
    welcome: '¡Hola! 👋 Soy el asistente de **Zurcher Septic**. Te ayudo con presupuestos, instalaciones, reparaciones, desagotes y mantenimiento en el sur de Florida. ¿En qué te puedo ayudar?',
    switchLang: 'Prefer English? English',
    starters: ['Tengo un problema con mi séptico', '¿Trabajan en mi zona?', 'Contrato de mantenimiento ATU', 'Desagote (pumping)'],
    quote: 'Pedir presupuesto gratis',
    quoteFallback: 'Quiero un presupuesto gratis',
    translating: 'Traduciendo…',
    placeholder: 'Escribe tu mensaje…',
    saved: 'Tus datos fueron enviados a nuestro equipo. Te contactaremos pronto.',
    footer: 'Asistente con IA · Hablar con una persona:',
    restart: 'Nueva conversación',
    error: 'No pudimos conectar con el chat. Llámanos o escríbenos por WhatsApp al ' + PHONE,
  },
};

const newSessionId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function loadState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.sessionId) return saved;
  } catch { /* storage no disponible */ }
  return { sessionId: newSessionId(), messages: [], leadSaved: false, lang: 'en' };
}

const markdown = {
  p: props => <p className="mb-1.5 last:mb-0" {...props} />,
  ul: props => <ul className="list-disc pl-4 mb-1.5 space-y-0.5" {...props} />,
  ol: props => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5" {...props} />,
  strong: props => <strong className="font-semibold text-slate-900" {...props} />,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline">{children}</a>,
};

export default function ZurcherChatWidget() {
  const [open, setOpen] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
  const [state, setState] = useState(loadState);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(null); // { content, status } mientras responde
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const lang = state.lang === 'es' ? 'es' : 'en';
  const TEXT = TEXTS[lang];

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* sin storage */ }
  }, [state]);

  // Invitación a los 8 segundos, una vez por sesión
  useEffect(() => {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(`${STORAGE_KEY}.teaser`) === '1'; } catch { /* sin storage */ }
    if (dismissed) return undefined;
    const timer = setTimeout(() => setShowTeaser(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  const hideTeaser = () => {
    setShowTeaser(false);
    try { sessionStorage.setItem(`${STORAGE_KEY}.teaser`, '1'); } catch { /* sin storage */ }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth', block: 'end' });
  }, [state.messages, draft, loading, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  const openChat = () => {
    hideTeaser();
    setOpen(true);
  };

  const restart = () => {
    if (loading) return;
    setState(s => ({ sessionId: newSessionId(), messages: [], leadSaved: false, lang: s.lang }));
    setError(null);
  };

  // Cambia el idioma; si el chat ya empezó, traduce también las respuestas anteriores
  const setLang = async (value) => {
    if (value === lang || loading) return;
    setState(s => ({ ...s, lang: value }));
    const answers = state.messages.map((m, i) => ({ ...m, i })).filter(m => m.role === 'assistant');
    if (!answers.length) return;

    setLoading(true);
    setError(null);
    setDraft({ content: '', status: TEXTS[value].translating });
    try {
      const response = await fetch(new URL('public-ai/translate', api.defaults.baseURL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: answers.map(m => m.content), lang: value }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(body.texts)) throw new Error();
      const byIndex = new Map(answers.map((m, k) => [m.i, body.texts[k]]));
      setState(s => ({
        ...s,
        messages: s.messages.map((m, i) => (byIndex.has(i) && byIndex.get(i) ? { ...m, content: byIndex.get(i) } : m)),
      }));
    } catch {
      // Si falla, las respuestas viejas quedan como estaban; las nuevas ya salen en el idioma elegido
    } finally {
      setDraft(null);
      setLoading(false);
    }
  };

  // Abre el modal "Schedule Free Quote" de la página; si la página no tiene, lo pide por el chat
  const openQuote = () => {
    const event = new CustomEvent(OPEN_QUOTE_EVENT, { detail: { handled: false } });
    window.dispatchEvent(event);
    if (event.detail.handled) {
      hideTeaser();
      setOpen(false);
    } else {
      openChat();
      send(TEXT.quoteFallback);
    }
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const messages = [...state.messages, { role: 'user', content }];
    setState(s => ({ ...s, messages }));
    setInput('');
    setLoading(true);
    setError(null);
    setDraft({ content: '', status: null });

    let answer = '';
    let leadSaved = state.leadSaved;
    try {
      const response = await fetch(new URL('public-ai/chat', api.defaults.baseURL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId, messages, leadSaved: state.leadSaved, lang }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || TEXT.error);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          let event = 'message';
          let data = '';
          for (const line of raw.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7).trim();
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (!data) continue;
          const payload = JSON.parse(data);
          if (event === 'delta') setDraft(d => ({ content: (d?.content || '') + payload.text, status: null }));
          else if (event === 'reset') setDraft({ content: '', status: null });
          else if (event === 'status') setDraft(d => ({ content: d?.content || '', status: payload.label }));
          else if (event === 'done') { answer = payload.answer; leadSaved = payload.leadSaved; }
          else if (event === 'error') { leadSaved = payload.leadSaved || leadSaved; throw new Error(payload.error); }
        }
      }
      if (!answer) throw new Error(TEXT.error);
      setState(s => ({ ...s, leadSaved, messages: [...s.messages, { role: 'assistant', content: answer }] }));
    } catch (err) {
      setError(err.message || TEXT.error);
      // Se quita la pregunta que no tuvo respuesta para poder reintentar
      setState(s => ({ ...s, leadSaved, messages: s.messages.slice(0, -1) }));
      setInput(content);
    } finally {
      setDraft(null);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const allMessages = [{ role: 'assistant', content: TEXT.welcome }, ...state.messages];

  return (
    <>
      {/* Botón flotante único: chat + presupuesto gratis */}
      {!open && (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex items-end gap-2">
          {showTeaser && (
            <div className="relative bg-white text-slate-800 text-sm rounded-2xl rounded-br-sm shadow-xl border border-slate-200 px-4 py-3 max-w-[230px] mb-2 animate-[fadeIn_400ms_ease-out]">
              <button onClick={hideTeaser} className="absolute -top-2 -left-2 bg-white border border-slate-200 rounded-full p-1 text-slate-400 hover:text-slate-700 shadow" aria-label="Close">
                <FaTimes className="w-2.5 h-2.5" />
              </button>
              <button onClick={openChat} className="text-left">{TEXT.teaser}</button>
            </div>
          )}
          <button onClick={openChat} aria-label={TEXT.launcher} className="group relative flex items-center gap-3">
            <span className="hidden md:block opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-4 py-2 rounded-lg shadow-lg font-semibold whitespace-nowrap pointer-events-none">
              {TEXT.launcher}
            </span>
            <span className="relative block group-hover:scale-105 transition-transform">
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full blur-lg opacity-60 animate-pulse" />
              <span className="relative w-16 h-16 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-blue-500 overflow-hidden">
                <img src={LOGO} alt="Zurcher Septic" className="w-12 h-12 object-contain" />
              </span>
              <span className="absolute -top-1 -right-1 bg-gradient-to-br from-blue-600 to-cyan-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg border-2 border-white">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.4 1.2 4.6 3.1 6.1L4.3 21l4-2.1c1.2.4 2.4.6 3.7.6 5.5 0 10-3.8 10-8.5S17.5 3 12 3z" />
                </svg>
              </span>
              <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
            </span>
          </button>
        </div>
      )}

      {/* Ventana del chat */}
      {open && (
        <div className="fixed z-[60] inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:h-[600px] sm:max-h-[calc(100vh-3rem)] bg-white sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-[fadeIn_250ms_ease-out]">
          {/* Encabezado */}
          <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 text-white px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="relative">
              <img src={LOGO} alt="Zurcher Septic" className="w-10 h-10 rounded-full bg-white object-contain p-0.5" />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold leading-tight">{TEXT.title}</p>
              <p className="text-[11px] text-blue-100 truncate">{TEXT.subtitle}</p>
            </div>
            <div className="flex rounded-lg bg-white/15 p-0.5 text-[11px] font-bold" role="group" aria-label="Language">
              {['en', 'es'].map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  disabled={loading}
                  className={`px-2 py-1 rounded-md transition-colors ${lang === l ? 'bg-white text-blue-700' : 'text-white/80 hover:text-white'}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={restart} title={TEXT.restart} className="p-2 rounded-lg hover:bg-white/15"><FaRedo className="w-3.5 h-3.5" /></button>
            <button onClick={() => setOpen(false)} title="Close" className="p-2 rounded-lg hover:bg-white/15"><FaTimes className="w-4 h-4" /></button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-3 py-4 bg-slate-50 min-h-0">
            {allMessages.map((m, i) => (
              m.role === 'user' ? (
                <div key={i} className="flex justify-end mb-3">
                  <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-sm whitespace-pre-wrap shadow-sm">{m.content}</div>
                </div>
              ) : (
                <div key={i} className="flex gap-2 mb-3">
                  <img src={LOGO} alt="" className="w-7 h-7 rounded-full bg-white border border-slate-200 object-contain p-0.5 shrink-0 mt-0.5" />
                  <div className="max-w-[85%] bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm shadow-sm">
                    <ReactMarkdown components={markdown}>{m.content}</ReactMarkdown>
                  </div>
                </div>
              )
            ))}

            {/* Respuesta en vivo */}
            {draft && (
              <div className="flex gap-2 mb-3">
                <img src={LOGO} alt="" className="w-7 h-7 rounded-full bg-white border border-slate-200 object-contain p-0.5 shrink-0 mt-0.5 animate-pulse" />
                <div className="max-w-[85%] bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm shadow-sm">
                  {draft.content ? (
                    <ReactMarkdown components={markdown}>{draft.content}</ReactMarkdown>
                  ) : (
                    <span className="flex items-center gap-1.5 py-1">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      {draft.status && <span className="text-xs text-slate-500 ml-1">{draft.status}</span>}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Botones para empezar */}
            {state.messages.length === 0 && !loading && (
              <div className="flex flex-wrap gap-2 pl-9">
                <button
                  onClick={openQuote}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-full px-3 py-1.5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <FaCalendarAlt className="w-3 h-3" /> {TEXT.quote}
                </button>
                {TEXT.starters.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-400 rounded-full px-3 py-1.5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
                <button
                  onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
                  className="text-xs text-slate-500 hover:text-blue-700 underline underline-offset-2 px-1 py-1.5"
                >
                  {TEXT.switchLang}
                </button>
              </div>
            )}

            {state.leadSaved && (
              <div className="flex items-start gap-2 text-xs text-green-800 bg-green-50 border border-green-200 rounded-xl px-3 py-2 mt-1">
                <FaCheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-600" /> {TEXT.saved}
              </div>
            )}
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mt-1">{error}</div>}
            <div ref={bottomRef} />
          </div>

          {/* Caja de texto */}
          <div className="p-3 border-t border-slate-200 bg-white shrink-0">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 px-2 py-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value.slice(0, 1500))}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={TEXT.placeholder}
                rows={1}
                disabled={loading}
                className="flex-1 min-w-0 resize-none bg-transparent outline-none px-1 py-2 text-sm text-slate-800 placeholder-slate-400 disabled:opacity-60"
                style={{ maxHeight: '110px' }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'; }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                aria-label="Send"
                className="bg-gradient-to-br from-blue-600 to-cyan-500 disabled:from-slate-300 disabled:to-slate-300 text-white rounded-xl p-2.5 mb-0.5 shrink-0"
              >
                <FaPaperPlane className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 mt-2 text-[11px] text-slate-400">
              {state.messages.length > 0 ? (
                <button onClick={openQuote} className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium truncate">
                  <FaCalendarAlt className="w-3 h-3 shrink-0" /> {TEXT.quote}
                </button>
              ) : (
                <span className="truncate">{TEXT.footer}</span>
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                <a href={WHATSAPP} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-green-600 hover:text-green-700 font-medium">
                  <FaWhatsapp className="w-3.5 h-3.5" /> WhatsApp
                </a>
                <span>·</span>
                <a href="tel:+19546368200" className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium">
                  <FaPhoneAlt className="w-3 h-3" /> {PHONE}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
