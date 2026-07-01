import { useState, useRef, useEffect } from 'react';
import api from '../utils/axios';

const SUGGESTIONS = [
  'How many works are currently pending?',
  '¿Cuántos trabajos se instalaron este mes?',
  'What is the current backlog?',
  '¿Cuántos trabajos hay en mantenimiento?',
  'How many works were installed this year?',
  '¿Cuántos trabajos hay en Miami?',
];

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  inProgress: 'bg-indigo-100 text-indigo-800',
  installed: 'bg-green-100 text-green-800',
  maintenance: 'bg-purple-100 text-purple-800',
  finalApproved: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
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
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
        }`}
      >
        {msg.content}
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
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hi! I\'m ZurcherAI. I can answer questions about your works, installations, backlog, revenue, and more. What would you like to know?\n\n¡Hola! Soy ZurcherAI. Puedo responder preguntas sobre tus trabajos, instalaciones, backlog, ingresos y más. ¿En qué te puedo ayudar?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;

    const userMsg = { role: 'user', content: q };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setError(null);

    // Build history (exclude the initial greeting, last 10 pairs max)
    const history = updatedMessages
      .slice(1, -1)
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const { data } = await api.post('/ai/query', { question: q, history });
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error connecting to AI service. Please try again.';
      setError(msg);
      setMessages(prev => prev.slice(0, -1)); // remove the user message on error
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

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content:
          'Chat cleared. Ask me anything about your works, backlog, revenue, and more!\n\nChat limpiado. ¡Pregúntame lo que necesites!'
      }
    ]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold">AI</span>
            ZurcherAI
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Business intelligence assistant — powered by Claude</p>
        </div>
        <button
          onClick={clearChat}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
        >
          Clear chat
        </button>
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2 font-medium">SUGGESTED QUESTIONS</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="text-xs bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-700 text-gray-600 rounded-full px-3 py-1.5 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat window */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-2xl p-4 border border-gray-200">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
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
          placeholder="Ask about works, backlog, revenue, locations... / Pregunta sobre trabajos, backlog, ingresos..."
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
      <p className="text-center text-xs text-gray-400 mt-2">Press Enter to send · Shift+Enter for new line</p>
    </div>
  );
}
