// 🤖 ZurcherAI — panel lateral disponible en todas las pantallas internas (owner / admin)
// Se abre con el botón del header o con Ctrl+K, y mantiene la conversación al navegar.
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaTimes, FaExpand, FaHistory, FaPlus, FaArrowLeft } from 'react-icons/fa';
import useAIChat from './useAIChat';
import AIChatView, { AIAvatar } from './AIChatView';
import ConversationList from './ConversationList';

export const AI_TOGGLE_EVENT = 'zurcherai:toggle';

export function toggleAIPanel() {
  window.dispatchEvent(new Event(AI_TOGGLE_EVENT));
}

export default function AIPanel() {
  const navigate = useNavigate();
  const { currentStaff } = useSelector(state => state.auth);
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(80);
  const chat = useAIChat({ enabled: everOpened });

  // El panel empieza justo debajo del header (su alto cambia según el tamaño de pantalla)
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return undefined;
    const update = () => setHeaderHeight(header.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // En pantallas grandes el contenido se corre a la izquierda en vez de quedar tapado (ver index.css)
  useEffect(() => {
    document.documentElement.classList.toggle('ai-panel-open', open);
    return () => document.documentElement.classList.remove('ai-panel-open');
  }, [open]);

  const setPanelOpen = useCallback((value) => {
    setOpen(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      if (next) setEverOpened(true);
      return next;
    });
  }, []);

  // Botón del header y atajo Ctrl+K / Cmd+K
  useEffect(() => {
    const toggle = () => setPanelOpen(o => !o);
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Escape') {
        setPanelOpen(false);
      }
    };
    window.addEventListener(AI_TOGGLE_EVENT, toggle);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(AI_TOGGLE_EVENT, toggle);
      window.removeEventListener('keydown', onKey);
    };
  }, [setPanelOpen]);

  useEffect(() => {
    if (open && !showHistory) setTimeout(() => chat.inputRef.current?.focus(), 250);
  }, [open, showHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // En el celular el panel ocupa toda la pantalla: se cierra al abrir un enlace
  const handleNavigate = (path) => {
    navigate(path);
    if (window.innerWidth < 768) setPanelOpen(false);
  };

  const expand = () => {
    setPanelOpen(false);
    navigate(chat.activeId ? `/ai-assistant?c=${chat.activeId}` : '/ai-assistant');
  };

  const activeTitle = chat.conversations.find(c => c.id === chat.activeId)?.title;

  return (
    <>
      {/* Fondo oscuro solo en móvil */}
      <div
        className={`fixed inset-0 bg-black/40 z-[55] md:hidden transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setPanelOpen(false)}
      />
      <aside
        className={`fixed z-[60] md:z-[45] inset-0 md:inset-auto md:top-[var(--ai-header-h)] md:bottom-0 md:right-0 md:w-[420px] xl:w-[460px]
          bg-white md:border-l border-gray-200 shadow-2xl flex flex-col
          transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ '--ai-header-h': `${headerHeight}px` }}
        aria-hidden={!open}
      >
        {/* Encabezado */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white px-4 py-3 flex items-center gap-3 shrink-0 border-b-2 border-[#f6d02c]">
          {showHistory ? (
            <button onClick={() => setShowHistory(false)} className="p-1.5 rounded-lg hover:bg-white/10" title="Volver">
              <FaArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <AIAvatar size="w-9 h-9" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold leading-tight">
              Zurcher <span className="text-[#f6d02c]">AI</span>
            </p>
            <p className="text-[11px] text-gray-400 truncate">
              {showHistory ? 'Tus conversaciones' : activeTitle || 'Asistente de Zurcher Construction'}
            </p>
          </div>
          {!showHistory && (
            <>
              <button onClick={() => { chat.newConversation(); }} className="p-2 rounded-lg hover:bg-white/10" title="Nueva conversación">
                <FaPlus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setShowHistory(true)} className="p-2 rounded-lg hover:bg-white/10" title="Historial">
                <FaHistory className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button onClick={expand} className="p-2 rounded-lg hover:bg-white/10 hidden md:block" title="Pantalla completa">
            <FaExpand className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setPanelOpen(false)} className="p-2 rounded-lg hover:bg-white/10" title="Cerrar (Esc)">
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 min-h-0">
          {everOpened && (showHistory ? (
            <div className="h-full p-3 bg-white">
              <ConversationList chat={chat} onAfterSelect={() => setShowHistory(false)} />
            </div>
          ) : (
            <AIChatView chat={chat} staff={currentStaff} onNavigate={handleNavigate} compact />
          ))}
        </div>
      </aside>
    </>
  );
}
