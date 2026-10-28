import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSelector } from 'react-redux';
import { FaPlus, FaTrash, FaBars, FaTimes, FaPen } from 'react-icons/fa';
import api from '../utils/axios';

const SUGGESTIONS = {
  common: [
    '¿Cuántos trabajos hay por estado?',
    '¿Qué inspecciones están programadas esta semana?',
    '¿Qué visitas de mantenimiento están pendientes este mes?',
    'Muéstrame todo sobre la obra en ...',
    '¿Cuántos leads nuevos entraron este mes y de qué fuente?',
    '¿Hay correos de clientes sin responder sobre inspecciones?',
  ],
  owner: [
    '¿Cuánto ingresamos y gastamos por mes este año?',
    '¿Qué facturas de proveedores están vencidas?',
  ],
};

const markdownComponents = {
  p: props => <p className="mb-2 last:mb-0" {...props} />,
  ul: props => <ul className="list-disc pl-5 mb-2 space-y-0.5" {...props} />,
  ol: props => <ol className="list-decimal pl-5 mb-2 space-y-0.5" {...props} />,
  h1: props => <h3 className="font-bold text-base mt-2 mb-1" {...props} />,
  h2: props => <h3 className="font-bold text-base mt-2 mb-1" {...props} />,
  h3: props => <h4 className="font-semibold mt-2 mb-1" {...props} />,
  a: props => <a className="text-blue-600 underline" target="_blank" rel="noreferrer" {...props} />,
  code: props => <code className="bg-gray-100 rounded px-1 text-xs" {...props} />,
  table: props => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-xs border border-gray-200" {...props} />
    </div>
  ),
  th: props => <th className="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-semibold" {...props} />,
  td: props => <td className="border border-gray-200 px-2 py-1 align-top" {...props} />,
};

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0 mt-1">
          AI
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm whitespace-pre-wrap'
            : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
        }`}
      >
        {isUser ? msg.content : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0">
        AI
      </div>
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        <span className="text-xs text-gray-400 ml-2">Consultando el sistema…</span>
      </div>
    </div>
  );
}

function ConversationList({ conversations, activeId, onSelect, onNew, onDelete, onRename }) {
  return (
    <div className="flex flex-col h-full">
      <button
        onClick={onNew}
        className="flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm rounded-lg px-3 py-2 mb-3 transition-colors"
      >
        <FaPlus className="w-3 h-3" /> Nueva conversación
      </button>
      <div className="flex-1 overflow-y-auto space-y-1">
        {conversations.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">Aún no tienes conversaciones</p>
        )}
        {conversations.map(c => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`group flex items-center gap-1 rounded-lg px-2 py-2 cursor-pointer text-sm ${
              c.id === activeId ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <span className="flex-1 truncate" title={c.title}>{c.title}</span>
            <button
              onClick={e => { e.stopPropagation(); onRename(c); }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 p-1"
              title="Renombrar"
            >
              <FaPen className="w-3 h-3" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(c); }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-1"
              title="Eliminar"
            >
              <FaTrash className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const { currentStaff } = useSelector(state => state.auth);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [showList, setShowList] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const suggestions = currentStaff?.role === 'owner'
    ? [...SUGGESTIONS.common, ...SUGGESTIONS.owner]
    : SUGGESTIONS.common;

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/ai/conversations');
      setConversations(data.conversations);
    } catch {
      setError('No se pudieron cargar tus conversaciones.');
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const selectConversation = async (id) => {
    if (loading) return;
    setActiveId(id);
    setShowList(false);
    setError(null);
    setLoadingMessages(true);
    try {
      const { data } = await api.get(`/ai/conversations/${id}/messages`);
      setMessages(data.messages);
    } catch {
      setError('No se pudo cargar la conversación.');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const newConversation = () => {
    if (loading) return;
    setActiveId(null);
    setMessages([]);
    setError(null);
    setShowList(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const deleteConversation = async (c) => {
    if (!window.confirm(`¿Eliminar la conversación "${c.title}"?`)) return;
    try {
      await api.delete(`/ai/conversations/${c.id}`);
      setConversations(prev => prev.filter(x => x.id !== c.id));
      if (c.id === activeId) newConversation();
    } catch {
      setError('No se pudo eliminar la conversación.');
    }
  };

  const renameConversation = async (c) => {
    const title = window.prompt('Nuevo nombre de la conversación', c.title);
    if (!title || !title.trim() || title === c.title) return;
    try {
      await api.patch(`/ai/conversations/${c.id}`, { title: title.trim() });
      setConversations(prev => prev.map(x => (x.id === c.id ? { ...x, title: title.trim() } : x)));
    } catch {
      setError('No se pudo renombrar la conversación.');
    }
  };

  const sendMessage = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post('/ai/chat', { question: q, conversationId: activeId });
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
      if (!activeId) {
        setActiveId(data.conversationId);
        setConversations(prev => [{ id: data.conversationId, title: data.title, lastMessageAt: new Date().toISOString() }, ...prev]);
      } else {
        // Mover la conversación activa arriba de la lista
        setConversations(prev => {
          const current = prev.find(c => c.id === activeId);
          return current ? [current, ...prev.filter(c => c.id !== activeId)] : prev;
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error de conexión con el servicio de IA. Intenta de nuevo.');
      setMessages(prev => prev.slice(0, -1));
      setInput(q);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const listProps = {
    conversations,
    activeId,
    onSelect: selectConversation,
    onNew: newConversation,
    onDelete: deleteConversation,
    onRename: renameConversation,
  };

  return (
    <div className="flex h-[calc(100vh-140px)] max-w-6xl mx-auto gap-4">
      {/* Lista de conversaciones (escritorio) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-white border border-gray-200 rounded-2xl p-3">
        <ConversationList {...listProps} />
      </aside>

      {/* Lista de conversaciones (móvil) */}
      {showList && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowList(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white p-3 shadow-xl flex flex-col">
            <button onClick={() => setShowList(false)} className="self-end text-gray-500 mb-2">
              <FaTimes />
            </button>
            <ConversationList {...listProps} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setShowList(true)} className="md:hidden text-gray-600 p-2 border border-gray-200 rounded-lg">
            <FaBars />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold">AI</span>
              ZurcherAI
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Consulta obras, permisos, presupuestos, mantenimiento, leads y correos de la empresa
            </p>
          </div>
        </div>

        {/* Chat window */}
        <div className="flex-1 overflow-y-auto bg-gray-50 rounded-2xl p-4 border border-gray-200">
          {loadingMessages && <p className="text-center text-sm text-gray-400">Cargando…</p>}

          {!loadingMessages && messages.length === 0 && (
            <div className="max-w-xl mx-auto mt-6">
              <p className="text-sm text-gray-600 mb-4">
                Hola{currentStaff?.name ? ` ${currentStaff.name.split(' ')[0]}` : ''}. Pregúntame lo que necesites sobre el sistema.
                Tus conversaciones se guardan y solo tú puedes verlas.
              </p>
              <p className="text-xs text-gray-500 mb-2 font-medium">SUGERENCIAS</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => (s.endsWith('...') ? (setInput(s.replace('...', '')), inputRef.current?.focus()) : sendMessage(s))}
                    className="text-xs bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-700 text-gray-600 rounded-full px-3 py-1.5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => <Message key={msg.id || i} msg={msg} />)}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Input */}
        <div className="mt-3 flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta… / Ask anything…"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 disabled:opacity-60 transition-all"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors shrink-0"
          >
            {loading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">Enter para enviar · Shift+Enter para nueva línea · Solo lectura: la IA no modifica nada</p>
      </div>
    </div>
  );
}
