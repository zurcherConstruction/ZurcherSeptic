// 🤖 ZurcherAI — piezas del chat: botón de confirmar acciones, 👍/👎, resumen del día y Mis reportes
import { useState } from 'react';
import { FaCheck, FaThumbsUp, FaThumbsDown, FaStar, FaTimes, FaExternalLinkAlt } from 'react-icons/fa';

export const ACTION_LINK_PREFIX = '#ai-action/';

/**
 * Botón "Confirmar" de una acción propuesta por la IA. Nada se hace hasta que el usuario lo toca;
 * después muestra el resultado (y un link para abrirlo) y no se puede repetir.
 */
export function ActionButton({ actionId, label, result, onConfirm, onNavigate }) {
  const [state, setState] = useState('idle');
  const [error, setError] = useState(null);

  if (result) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 bg-green-50 border border-green-200 text-green-800 text-xs font-medium rounded-lg px-3 py-1.5 my-1">
        <FaCheck className="w-3 h-3" /> {result.message || 'Hecho'}
        {result.path && (
          <button onClick={() => onNavigate(result.path)} className="underline hover:text-green-950">Ver</button>
        )}
        {result.url && (
          <a href={result.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline hover:text-green-950">
            Abrir Gmail <FaExternalLinkAlt className="w-2.5 h-2.5" />
          </a>
        )}
      </span>
    );
  }

  const confirm = async () => {
    setState('loading');
    setError(null);
    try {
      await onConfirm(actionId);
      setState('done');
    } catch (err) {
      setError(err.message);
      setState('idle');
    }
  };

  return (
    <span className="inline-flex flex-col items-start my-1">
      <button
        onClick={confirm}
        disabled={state === 'loading'}
        className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white text-xs font-medium rounded-lg px-3 py-1.5 shadow-sm ring-1 ring-[#f6d02c]"
        title="Nada se hace hasta que confirmes"
      >
        {state === 'loading' ? 'Haciendo…' : label}
      </button>
      {error && <span className="text-[11px] text-red-600 mt-1">{error}</span>}
    </span>
  );
}

export function FeedbackButtons({ msg, onRate }) {
  if (!msg.id) return null;
  const rate = (value) => {
    if (msg.rating === value) return onRate(msg.id, 0);
    if (value === -1) {
      const comment = window.prompt('¿Qué estuvo mal? (opcional, nos ayuda a mejorar)') ?? null;
      if (comment === null) return undefined;
      return onRate(msg.id, -1, comment);
    }
    return onRate(msg.id, 1);
  };
  const cls = (active, color) => `flex items-center px-2 py-1 rounded-md text-xs transition-colors ${active ? color : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`;
  return (
    <>
      <button onClick={() => rate(1)} title="Buena respuesta" className={cls(msg.rating === 1, 'text-green-700 bg-green-50')}>
        <FaThumbsUp className="w-3 h-3" />
      </button>
      <button onClick={() => rate(-1)} title="Respuesta incorrecta o poco útil" className={cls(msg.rating === -1, 'text-red-700 bg-red-50')}>
        <FaThumbsDown className="w-3 h-3" />
      </button>
    </>
  );
}

// ☀️ Resumen del día (al abrir ZurcherAI)
export function DailySummaryCard({ summary, onNavigate, onAsk }) {
  if (!summary) return <p className="text-xs text-gray-400 mt-5">Cargando tu resumen del día…</p>;
  const onlyTasks = summary.scope === 'tasks';
  if (!summary.sections?.length) {
    return (
      <p className="text-xs text-gray-500 mt-5">
        {onlyTasks ? '☀️ No tenés tareas pendientes asignadas.' : '☀️ Hoy no tenés tareas, visitas ni pendientes urgentes.'}
      </p>
    );
  }
  return (
    <div className="mt-5">
      <p className="text-[11px] text-gray-500 mb-2 font-semibold tracking-wide">☀️ {onlyTasks ? 'TUS TAREAS' : 'TU DÍA'}</p>
      <div className={`grid grid-cols-1 gap-2 ${onlyTasks ? '' : 'sm:grid-cols-2'}`}>
        {summary.sections.map(section => (
          <div key={section.key} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <button
                onClick={() => section.path && onNavigate(section.path)}
                className={`text-xs font-semibold text-gray-800 text-left ${section.path ? 'hover:underline decoration-[#f6d02c] decoration-2' : ''}`}
              >
                {section.title}
              </button>
              <span className="text-xs font-bold text-gray-900">{section.count}</span>
            </div>
            {section.alert && <p className="text-[11px] text-red-600 font-medium">{section.alert}</p>}
            <ul className="mt-1.5 space-y-0.5">
              {section.items.map((item, i) => (
                <li key={i} className="text-[11px] text-gray-600 flex gap-1.5 min-w-0">
                  <span className={`shrink-0 ${item.urgent ? 'text-red-500' : 'text-gray-300'}`}>•</span>
                  {item.path ? (
                    <button onClick={() => onNavigate(item.path)} className="truncate text-left text-blue-700 hover:underline">{item.text}</button>
                  ) : (
                    <span className="truncate">{item.text}</span>
                  )}
                  {item.meta && <span className={`shrink-0 ml-auto ${item.urgent ? 'text-red-500' : 'text-gray-400'}`}>{item.meta}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button
        onClick={() => onAsk(onlyTasks
          ? 'Revisá las tareas que tengo asignadas y ayudame a organizar mi día: qué hago primero y por qué'
          : 'Revisá los pendientes de hoy de toda la empresa y ayudame a organizar el día y a repartir el trabajo')}
        className="mt-2 text-[11px] text-gray-500 hover:text-gray-900 underline"
      >
        Pedirle a Zurcher AI que me ayude a organizar el día
      </button>
    </div>
  );
}

// ⭐ Mis reportes: preguntas guardadas, un clic para repetirlas
export function SavedPrompts({ prompts, onRun, onDelete, disabled }) {
  if (!prompts?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map(p => (
        <span key={p.id} className="group inline-flex items-center bg-yellow-50 border border-[#f6d02c] rounded-full shadow-sm">
          <button
            onClick={() => onRun(p.prompt)}
            disabled={disabled}
            title={p.prompt}
            className="text-xs text-gray-800 pl-3 pr-1 py-1.5 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <FaStar className="w-2.5 h-2.5 text-[#d4a800]" /> {p.title}
          </button>
          <button onClick={() => onDelete(p)} title="Quitar de Mis reportes" className="text-gray-300 hover:text-red-600 pr-2 pl-0.5">
            <FaTimes className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
    </div>
  );
}

// Menú ⭐ junto a la caja de texto (cuando ya hay una conversación abierta)
export function SavedPromptsMenu({ prompts, onRun, disabled }) {
  const [open, setOpen] = useState(false);
  if (!prompts?.length) return null;
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        title="Mis reportes"
        className="rounded-xl p-2.5 text-[#d4a800] hover:bg-yellow-50 disabled:opacity-50"
      >
        <FaStar className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full mb-2 left-0 z-20 w-64 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1">
            <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 tracking-wide">MIS REPORTES</p>
            {prompts.map(p => (
              <button
                key={p.id}
                onClick={() => { setOpen(false); onRun(p.prompt); }}
                className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-yellow-50 truncate"
                title={p.prompt}
              >
                {p.title}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
