// 🤖 ZurcherAI — página completa (/ai-assistant). El panel lateral (AI/AIPanel.jsx) ofrece lo mismo desde cualquier pantalla.
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa';
import useAIChat from './AI/useAIChat';
import AIChatView, { AIAvatar } from './AI/AIChatView';
import ConversationList from './AI/ConversationList';

export default function AIAssistant() {
  const { currentStaff } = useSelector(state => state.auth);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showList, setShowList] = useState(false);
  const chat = useAIChat({ initialConversationId: searchParams.get('c') });
  const activeTitle = chat.conversations.find(c => c.id === chat.activeId)?.title;

  return (
    <div className="flex h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] max-w-7xl mx-auto gap-4">
      {/* Conversaciones (escritorio) */}
      <aside className="hidden md:flex w-72 shrink-0 flex-col bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
        <ConversationList chat={chat} />
      </aside>

      {/* Conversaciones (móvil) */}
      {showList && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowList(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-80 max-w-[85%] bg-white p-3 shadow-xl flex flex-col">
            <button onClick={() => setShowList(false)} className="self-end text-gray-500 p-1 mb-2">
              <FaTimes />
            </button>
            <ConversationList chat={chat} onAfterSelect={() => setShowList(false)} />
          </aside>
        </div>
      )}

      <section className="flex-1 flex flex-col min-w-0 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white px-4 py-3 flex items-center gap-3 border-b-2 border-[#f6d02c] shrink-0">
          <button onClick={() => setShowList(true)} className="md:hidden p-2 rounded-lg hover:bg-white/10">
            <FaBars />
          </button>
          <AIAvatar size="w-10 h-10" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight">
              Zurcher <span className="text-[#f6d02c]">AI</span>
            </h1>
            <p className="text-xs text-gray-400 truncate">
              {activeTitle || 'Obras, permisos, presupuestos, finanzas, correos y archivos de la empresa'}
            </p>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <AIChatView chat={chat} staff={currentStaff} onNavigate={navigate} />
        </div>
      </section>
    </div>
  );
}
