import { FaPlus, FaTrash, FaPen, FaRegCommentDots } from 'react-icons/fa';

function relativeDay(date) {
  if (!date) return '';
  const d = new Date(date);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return d.toLocaleDateString();
}

export default function ConversationList({ chat, onAfterSelect }) {
  const { conversations, activeId, selectConversation, newConversation, deleteConversation, renameConversation } = chat;

  return (
    <div className="flex flex-col h-full min-h-0">
      <button
        onClick={() => { newConversation(); onAfterSelect?.(); }}
        className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl px-3 py-2.5 mb-3 transition-colors shadow-sm"
      >
        <FaPlus className="w-3 h-3 text-[#f6d02c]" /> Nueva conversación
      </button>
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {conversations.length === 0 && (
          <div className="text-center mt-8 text-gray-400">
            <FaRegCommentDots className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">Aún no tienes conversaciones</p>
          </div>
        )}
        {conversations.map(c => (
          <div
            key={c.id}
            onClick={() => { selectConversation(c.id); onAfterSelect?.(); }}
            className={`group flex items-center gap-1 rounded-xl px-3 py-2 cursor-pointer text-sm border transition-colors ${
              c.id === activeId
                ? 'bg-yellow-50 border-[#f6d02c] text-gray-900'
                : 'border-transparent hover:bg-gray-100 text-gray-700'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="truncate" title={c.title}>{c.title}</p>
              <p className="text-[10px] text-gray-400">{relativeDay(c.lastMessageAt || c.createdAt)}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); renameConversation(c); }}
              className="sm:opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 p-1"
              title="Renombrar"
            >
              <FaPen className="w-3 h-3" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); deleteConversation(c); }}
              className="sm:opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-1"
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
