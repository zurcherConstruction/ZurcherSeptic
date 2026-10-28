// 🤖 ZurcherAI — estado y acciones del chat (compartido por la página y el panel lateral)
import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../utils/axios';
import { SpeechRecognitionAPI, speak, stopSpeaking } from '../../utils/aiAnswerTools';

export default function useAIChat({ enabled = true, initialConversationId = null } = {}) {
  const [conversations, setConversations] = useState([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [listening, setListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState(() => {
    try { return localStorage.getItem('zurcherai.voiceLang') || 'es-US'; } catch { return 'es-US'; }
  });
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);
  const initialLoadedRef = useRef(false);

  const focusInput = (delay = 50) => setTimeout(() => inputRef.current?.focus(), delay);

  // --- Conversaciones ---

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/ai/conversations');
      setConversations(data.conversations);
      setConversationsLoaded(true);
    } catch {
      setError('No se pudieron cargar tus conversaciones.');
    }
  }, []);

  useEffect(() => {
    if (enabled && !conversationsLoaded) loadConversations();
  }, [enabled, conversationsLoaded, loadConversations]);

  const stopVoice = () => {
    stopSpeaking();
    setSpeakingIndex(null);
  };

  const selectConversation = useCallback(async (id) => {
    if (loading) return;
    stopVoice();
    setActiveId(id);
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
  }, [loading]);

  useEffect(() => {
    if (enabled && initialConversationId && !initialLoadedRef.current) {
      initialLoadedRef.current = true;
      selectConversation(initialConversationId);
    }
  }, [enabled, initialConversationId, selectConversation]);

  const newConversation = () => {
    if (loading) return;
    stopVoice();
    setActiveId(null);
    setMessages([]);
    setError(null);
    focusInput();
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

  // --- Envío ---

  const sendMessage = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;
    if (listening) recognitionRef.current?.stop();

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
      focusInput(100);
    }
  };

  // --- Excel generado por la IA ---

  const downloadExport = useCallback(async (exportId) => {
    if (!activeId) return;
    try {
      const response = await api.get(`/ai/conversations/${activeId}/exports/${exportId}`, { responseType: 'blob' });
      const disposition = response.headers['content-disposition'] || '';
      const fileName = disposition.match(/filename="?([^"]+)"?/)?.[1] || 'ZurcherAI.xlsx';
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo descargar el Excel.');
    }
  }, [activeId]);

  // --- Voz ---

  useEffect(() => () => {
    stopSpeaking();
    recognitionRef.current?.abort();
  }, []);

  const toggleSpeak = (index, content) => {
    if (speakingIndex === index) {
      stopVoice();
      return;
    }
    setSpeakingIndex(index);
    speak(content, { onEnd: () => setSpeakingIndex(current => (current === index ? null : current)) });
  };

  // Dictado: el texto se agrega a la caja para revisarlo antes de enviar
  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = voiceLang;
    recognition.interimResults = true;
    recognition.continuous = true;
    const baseText = input.trim() ? `${input.trim()} ` : '';
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
      setInput(baseText + transcript);
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('El navegador no tiene permiso para usar el micrófono.');
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError('No se pudo usar el dictado por voz. Intenta de nuevo.');
      }
    };
    recognition.onend = () => {
      setListening(false);
      focusInput();
    };
    recognitionRef.current = recognition;
    stopVoice();
    setError(null);
    recognition.start();
    setListening(true);
  };

  const changeVoiceLang = () => {
    const next = voiceLang === 'es-US' ? 'en-US' : 'es-US';
    setVoiceLang(next);
    try { localStorage.setItem('zurcherai.voiceLang', next); } catch { /* sin storage */ }
  };

  return {
    conversations, activeId, messages, input, setInput, loading, loadingMessages, error, setError, inputRef,
    selectConversation, newConversation, deleteConversation, renameConversation, sendMessage, downloadExport,
    speakingIndex, toggleSpeak, stopVoice,
    canDictate: !!SpeechRecognitionAPI, listening, toggleListening, voiceLang, changeVoiceLang,
  };
}
