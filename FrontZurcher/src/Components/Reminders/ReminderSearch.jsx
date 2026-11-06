// 🔎 Buscador de órdenes de trabajo: por dirección o palabras, en el título, la descripción y las notas,
// en pendientes y realizadas. Al hacer clic se abre el detalle de la orden.
import { useEffect, useState } from 'react';
import { FaSearch, FaTimes, FaCheckCircle, FaRegClock, FaMapMarkerAlt, FaComment } from 'react-icons/fa';
import api from '../../utils/axios';

const STATUS_FILTERS = [
  { k: 'all', label: 'Todas' },
  { k: 'pending', label: 'Pendientes' },
  { k: 'done', label: 'Realizadas' },
];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '');

// Resalta las palabras buscadas
function Highlight({ text, terms }) {
  if (!text) return null;
  if (!terms?.length) return text;
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = String(text).split(new RegExp(`(${escaped.join('|')})`, 'gi'));
  return parts.map((part, i) => (
    terms.some(t => t.toLowerCase() === part.toLowerCase())
      ? <mark key={i} className="bg-amber-200 text-slate-900 rounded px-0.5">{part}</mark>
      : part
  ));
}

// Fragmento del texto alrededor de la primera coincidencia
function snippet(text, terms, size = 160) {
  const value = String(text || '');
  if (value.length <= size) return value;
  const lower = value.toLowerCase();
  const pos = Math.min(...terms.map(t => lower.indexOf(t.toLowerCase())).filter(p => p >= 0), Infinity);
  if (!Number.isFinite(pos)) return `${value.slice(0, size)}…`;
  const start = Math.max(0, pos - 50);
  return `${start > 0 ? '…' : ''}${value.slice(start, start + size)}${start + size < value.length ? '…' : ''}`;
}

export function useReminderSearch() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [results, setResults] = useState(null);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/reminders/search', { params: { q, status } });
        if (!cancelled) {
          setResults(data.results || []);
          setTerms(data.terms || []);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, status]);

  return { query, setQuery, status, setStatus, results, terms, loading, active: query.trim().length >= 2 };
}

export function ReminderSearchBar({ search }) {
  const { query, setQuery, status, setStatus } = search;
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
      <div className="relative flex-1">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por dirección o palabras en las órdenes y sus notas…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-sm"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" title="Limpiar">
            <FaTimes className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {query.trim().length >= 2 && (
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1 self-start sm:self-auto">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.k}
              onClick={() => setStatus(f.k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                status === f.k ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReminderSearchResults({ search, onOpen }) {
  const { results, terms, loading } = search;

  if (loading && !results) {
    return <p className="text-center text-sm text-slate-400 py-16">Buscando…</p>;
  }
  if (!results) return null;
  if (!results.length) {
    return (
      <div className="text-center py-16">
        <FaSearch className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">No hay órdenes de trabajo ni notas con esas palabras.</p>
        <p className="text-slate-400 text-xs mt-1">Probá con menos palabras o solo el número de la dirección.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">
        {results.length === 60 ? 'Más de 60' : results.length} resultado{results.length !== 1 ? 's' : ''}
        {loading && <span className="ml-2 text-slate-400">actualizando…</span>}
      </p>
      <div className="space-y-3">
        {results.map(r => (
          <button
            key={r.id}
            onClick={() => onOpen(r)}
            className="w-full text-left bg-white border border-slate-200 hover:border-amber-300 hover:shadow-md rounded-2xl p-4 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-slate-800 text-sm"><Highlight text={r.title} terms={terms} /></p>
              {r.done ? (
                <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  <FaCheckCircle className="w-3 h-3" /> Realizada{r.completedAt ? ` ${fmtDate(r.completedAt)}` : ''}
                </span>
              ) : (
                <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  <FaRegClock className="w-3 h-3" /> Pendiente
                </span>
              )}
            </div>

            {r.linkedEntityLabel && (
              <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                <FaMapMarkerAlt className="w-3 h-3 text-slate-400" /> <Highlight text={r.linkedEntityLabel} terms={terms} />
              </p>
            )}
            {r.description && (
              <p className="text-xs text-slate-500 mt-1.5"><Highlight text={snippet(r.description, terms)} terms={terms} /></p>
            )}

            {r.matchedComments.length > 0 && (
              <div className="mt-2.5 space-y-1.5 border-l-2 border-amber-200 pl-3">
                {r.matchedComments.map(c => (
                  <div key={c.id} className="text-xs">
                    <span className="text-slate-400">{c.author || 'Sistema'} · {fmtDate(c.createdAt)}: </span>
                    <span className="text-slate-700"><Highlight text={snippet(c.message, terms)} terms={terms} /></span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-[11px] text-slate-400">
              <span>Creada {fmtDate(r.createdAt)}{r.creator ? ` por ${r.creator}` : ''}</span>
              {r.assignees.length > 0 && <span>Para: {r.assignees.map(a => a.name).filter(Boolean).join(', ')}</span>}
              {r.commentsCount > 0 && (
                <span className="inline-flex items-center gap-1"><FaComment className="w-2.5 h-2.5" /> {r.commentsCount} nota{r.commentsCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
