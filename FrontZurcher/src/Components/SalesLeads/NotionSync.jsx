// 🔗 Notion: botón de sincronización (Notion ↔ Leads) y link a la página de cada prospecto
import { useEffect, useState } from 'react';
import api from '../../utils/axios';

export const notionPageUrl = (pageId) => `https://www.notion.so/${String(pageId).replace(/-/g, '')}`;

const timeAgo = (iso) => {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : new Date(iso).toLocaleDateString('es-AR');
};

export function NotionBadge({ lead, className = '' }) {
  if (!lead?.notionPageId) return null;
  return (
    <a
      href={notionPageUrl(lead.notionPageId)}
      target="_blank"
      rel="noreferrer"
      onClick={e => e.stopPropagation()}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full bg-stone-100 text-stone-700 border border-stone-300 hover:bg-stone-200 ${className}`}
      title="Abrir el prospecto en Notion"
    >
      🗒️ Notion
    </a>
  );
}

export function NotionSyncButton({ onSynced }) {
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const loadStatus = () => api.get('/notion/status').then(({ data }) => setStatus(data)).catch(() => setStatus(null));
  useEffect(() => { loadStatus(); }, []);

  if (!status?.configured) return null;

  const sync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/notion/sync');
      const r = data.result || {};
      const parts = [
        r.leadsCreated && `${r.leadsCreated} lead(s) nuevos`,
        r.leadsLinked && `${r.leadsLinked} vinculados`,
        r.leadsUpdated && `${r.leadsUpdated} leads actualizados`,
        r.pagesCreated && `${r.pagesCreated} agregados a Notion`,
        r.pagesUpdated && `${r.pagesUpdated} actualizados en Notion`,
        (r.tasksCreated || r.tasksUpdated) && `${(r.tasksCreated || 0) + (r.tasksUpdated || 0)} tarea(s) de seguimiento`,
      ].filter(Boolean);
      const warnings = [
        r.unmatchedPeople?.length && `Responsables de Notion sin empleado con el mismo email: ${r.unmatchedPeople.join(', ')}`,
        r.errors?.length && `${r.errors.length} error(es): ${r.errors.slice(0, 3).join(' · ')}`,
      ].filter(Boolean);
      alert(`🗒️ Notion sincronizado.\n${parts.length ? parts.join(' · ') : 'No había cambios.'}${warnings.length ? `\n\n⚠️ ${warnings.join('\n⚠️ ')}` : ''}`);
      onSynced?.();
    } catch (err) {
      alert(`No se pudo sincronizar con Notion: ${err.response?.data?.error || err.message}`);
    } finally {
      setSyncing(false);
      loadStatus();
    }
  };

  return (
    <div className="inline-flex items-center rounded-lg bg-white/10 border border-white/20 overflow-hidden">
      <button
        onClick={sync}
        disabled={syncing || status.running}
        className="inline-flex items-center gap-2 px-3 py-2 text-white hover:bg-white/20 text-sm font-medium disabled:opacity-60"
        title={`Sincroniza los prospectos de Notion con los Leads (los cambios se sincronizan solos en segundos; este botón fuerza una revisión completa). Última: ${timeAgo(status.lastRunAt)}`}
      >
        🗒️ <span className="hidden md:inline">{syncing || status.running ? 'Sincronizando…' : 'Notion'}</span>
      </button>
      <a
        href={status.databaseUrl}
        target="_blank"
        rel="noreferrer"
        className="px-2 py-2 text-white/80 hover:text-white hover:bg-white/20 text-sm border-l border-white/20"
        title="Abrir Seguimiento de Prospectos en Notion"
      >
        ↗
      </a>
    </div>
  );
}
