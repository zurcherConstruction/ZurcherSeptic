import { useState } from 'react';
import { DEFAULT_TERMS_SECTIONS } from './defaultTerms';

function genId() {
  return 'tc-custom-' + Math.random().toString(36).slice(2, 9);
}

export default function TermsEditor({ customTerms, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  const terms = customTerms || DEFAULT_TERMS_SECTIONS;
  const isCustomized = customTerms !== null && customTerms !== undefined;

  function toggle(id) {
    const updated = terms.map(t => t.id === id ? { ...t, enabled: t.enabled === false ? true : false } : t);
    onChange(updated);
  }

  function startEdit(term) {
    setEditingId(term.id);
    setEditDraft({
      title: term.title,
      content: term.content || '',
      bulletPoints: term.bulletPoints ? term.bulletPoints.join('\n') : '',
    });
  }

  function saveEdit() {
    const updated = terms.map(t => {
      if (t.id !== editingId) return t;
      const bullets = editDraft.bulletPoints
        ? editDraft.bulletPoints.split('\n').map(l => l.trim()).filter(Boolean)
        : undefined;
      return {
        ...t,
        title: editDraft.title,
        content: editDraft.content || undefined,
        bulletPoints: bullets && bullets.length > 0 ? bullets : undefined,
      };
    });
    onChange(updated);
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function removeTerm(id) {
    const updated = terms.filter(t => t.id !== id);
    onChange(updated);
  }

  function addTerm() {
    const newTerm = {
      id: genId(),
      number: '',
      title: 'Nueva cláusula',
      content: 'Descripción de la cláusula...',
      enabled: true,
    };
    onChange([...terms, newTerm]);
    setEditingId(newTerm.id);
    setEditDraft({ title: newTerm.title, content: newTerm.content, bulletPoints: '' });
  }

  function resetToDefaults() {
    if (window.confirm('¿Restaurar todos los Términos y Condiciones a los valores predeterminados? Se perderán los cambios.')) {
      onChange(null);
    }
  }

  const enabledCount = terms.filter(t => t.enabled !== false).length;

  return (
    <div className="border border-gray-200 rounded-lg mt-4">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700"
      >
        <span className="flex items-center gap-2">
          <span>📋 Términos y Condiciones</span>
          {isCustomized && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Personalizados</span>
          )}
          <span className="text-xs text-gray-500">({enabledCount} de {terms.length} activos)</span>
        </span>
        <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="p-4 space-y-2">
          <p className="text-xs text-gray-500 mb-3">
            Activa, desactiva, edita o agrega cláusulas. Los cambios se guardan con el presupuesto y afectan el PDF generado.
          </p>

          {terms.map((term) => (
            <div
              key={term.id}
              className={`border rounded-md p-3 ${term.enabled === false ? 'bg-gray-50 opacity-60 border-gray-200' : 'bg-white border-gray-300'}`}
            >
              {editingId === term.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-medium"
                    value={editDraft.title}
                    onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                    placeholder="Título de la cláusula"
                  />
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Texto (párrafo)</label>
                    <textarea
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      rows={3}
                      value={editDraft.content}
                      onChange={e => setEditDraft(d => ({ ...d, content: e.target.value }))}
                      placeholder="Contenido de la cláusula..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Puntos (una línea por punto, reemplaza los bullets originales)</label>
                    <textarea
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      rows={3}
                      value={editDraft.bulletPoints}
                      onChange={e => setEditDraft(d => ({ ...d, bulletPoints: e.target.value }))}
                      placeholder="Punto 1&#10;Punto 2&#10;..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveEdit} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Guardar</button>
                    <button type="button" onClick={cancelEdit} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${term.enabled === false ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {term.number ? `${term.number} ` : ''}{term.title}
                    </p>
                    {term.content && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{term.content.slice(0, 100)}{term.content.length > 100 ? '…' : ''}</p>
                    )}
                    {term.bulletPoints && (
                      <p className="text-xs text-gray-400 mt-0.5">{term.bulletPoints.length} punto{term.bulletPoints.length !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggle(term.id)}
                      className={`text-xs px-2 py-0.5 rounded ${term.enabled === false ? 'bg-gray-200 text-gray-600 hover:bg-green-100 hover:text-green-700' : 'bg-green-100 text-green-700 hover:bg-gray-200 hover:text-gray-600'}`}
                      title={term.enabled === false ? 'Activar' : 'Desactivar'}
                    >
                      {term.enabled === false ? 'OFF' : 'ON'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(term)}
                      className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTerm(term.id)}
                      className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-500 hover:bg-red-100"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={addTerm}
              className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded text-sm hover:bg-teal-100"
            >
              + Agregar cláusula
            </button>
            {isCustomized && (
              <button
                type="button"
                onClick={resetToDefaults}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded text-sm hover:bg-gray-100"
              >
                ↩ Restaurar predeterminados
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
