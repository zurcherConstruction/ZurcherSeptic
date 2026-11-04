// 💲 Consumo de ZurcherAI (solo owner): costo por empleado, chat de la web y proyección mensual
import { useEffect, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import api from '../../utils/axios';

const usd = (n) => (n == null ? '—' : `$${Number(n).toFixed(2)}`);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—');
const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', recept: 'Recepción' };
const PERIODS = [7, 30, 90];

export default function AIUsageModal({ onClose }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api.get('ai/usage', { params: { days } })
      .then(r => setData(r.data))
      .catch(() => setError('No se pudo cargar el consumo'));
  }, [days]);

  const maxQuestions = Math.max(1, ...(data?.staff || []).map(s => s.questions));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">💲 Consumo de ZurcherAI</h2>
            <p className="text-xs text-gray-500">Costo estimado según los precios públicos de la API de Claude</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><FaTimes /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex gap-2">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setDays(p)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${days === p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'}`}
              >
                Últimos {p} días
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {!data && !error && <p className="text-sm text-gray-400">Cargando…</p>}

          {data && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">Gastado en el período</p>
                  <p className="text-2xl font-bold text-gray-900">{usd(data.totalCostUsd)}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-700">Proyección mensual</p>
                  <p className="text-2xl font-bold text-amber-800">{usd(data.projectedMonthlyUsd)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">Chat de la web (clientes)</p>
                  <p className="text-2xl font-bold text-gray-900">{usd(data.webbot.costUsd)}</p>
                  <p className="text-[11px] text-gray-400">{data.webbot.messages} mensajes</p>
                </div>
              </div>

              {data.trackingSince ? (
                <p className="text-[11px] text-gray-500">
                  El costo se registra desde el {fmtDate(data.trackingSince)} ({data.trackedDays} días): la proyección mejora a medida que pasan los días.
                  La cantidad de preguntas incluye también los días anteriores.
                </p>
              ) : (
                <p className="text-[11px] text-amber-700">
                  Todavía no hay costos registrados: se empiezan a medir desde ahora. Mientras tanto, la tabla muestra la cantidad de preguntas de cada persona.
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-2">Empleado</th>
                      <th className="py-2 pr-2">Preguntas</th>
                      <th className="py-2 pr-2 text-right">Conversaciones</th>
                      <th className="py-2 pr-2 text-right">Costo</th>
                      <th className="py-2 pr-2 text-right">Por pregunta</th>
                      <th className="py-2 text-right">Última</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.staff.length === 0 && (
                      <tr><td colSpan={6} className="py-4 text-center text-gray-400">Sin consultas en este período</td></tr>
                    )}
                    {data.staff.map(s => (
                      <tr key={s.staffId} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-2">
                          <p className="font-medium text-gray-800">{s.name}</p>
                          <p className="text-[11px] text-gray-400">{ROLE_LABELS[s.role] || s.role}</p>
                        </td>
                        <td className="py-2 pr-2 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400" style={{ width: `${(s.questions / maxQuestions) * 100}%` }} />
                            </div>
                            <span className="text-gray-700 font-semibold w-8 text-right">{s.questions}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-2 text-right text-gray-600">{s.conversations}</td>
                        <td className="py-2 pr-2 text-right font-semibold text-gray-900">{s.trackedQuestions ? usd(s.costUsd) : '—'}</td>
                        <td className="py-2 pr-2 text-right text-gray-600">{s.avgCostPerQuestion != null ? `$${s.avgCostPerQuestion.toFixed(3)}` : '—'}</td>
                        <td className="py-2 text-right text-gray-500">{fmtDate(s.lastQuestionAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-gray-400">
                Lo que más encarece una pregunta: conversaciones muy largas (cada pregunta vuelve a leer todo el historial),
                volver a una conversación después de varios minutos, y pedidos que obligan a revisar muchos registros o archivos.
                Para temas nuevos conviene empezar una conversación nueva.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
