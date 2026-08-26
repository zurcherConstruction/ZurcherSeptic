import React from 'react';
import {
  FaTimes, FaStar, FaRegStar, FaEdit, FaMapMarkerAlt,
  FaCheckCircle, FaTimesCircle, FaDollarSign, FaFileAlt,
  FaStickyNote,
} from 'react-icons/fa';

const WHO_LABEL = { HD: 'Health Dept.', Privado: 'Privado', Ambos: 'HD o Privado' };

const SectionTitle = ({ title }) => (
  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{title}</h3>
);

const InfoRow = ({ label, value, mono }) => (
  value ? (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium text-slate-800 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  ) : null
);

const YesNo = ({ label, value }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
    <span className="text-xs text-slate-500">{label}</span>
    <span className={`flex items-center gap-1.5 text-sm font-semibold ${value ? 'text-teal-600' : 'text-slate-400'}`}>
      {value
        ? <><FaCheckCircle className="text-xs" /> Sí</>
        : <><FaTimesCircle className="text-xs" /> No</>}
    </span>
  </div>
);

const InspectionBlock = ({ title, data }) => {
  if (!data) return null;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">{title}</p>
      {!data.required ? (
        <p className="text-sm text-slate-400 italic flex items-center gap-2">
          <FaTimesCircle className="text-slate-300" /> No requerida
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          <InfoRow label="Fee administrativo" value={data.adminFee} />
          <InfoRow label="Costo inspección"   value={data.inspectionCost} />
          <InfoRow label="Demora estimada"    value={data.estimatedDays ? `${data.estimatedDays} días` : null} />
          <InfoRow label="¿Quién la realiza?" value={WHO_LABEL[data.whoCanDo] || data.whoCanDo} />
        </div>
      )}
    </div>
  );
};

const CountyProcedureViewModal = ({ procedure, onClose, onEdit }) => {
  if (!procedure) return null;
  const data = procedure.steps?.[0] || {};

  const requiredDocs = [
    data.finalDocuments?.operatingPermit     && 'Operating Permit',
    data.finalDocuments?.maintenanceContract && 'Contrato de Servicio de Mantenimiento',
    data.finalDocuments?.noticePBTS          && 'Notice certificado por PBTS',
    data.finalDocuments?.other               && data.finalDocuments.other,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[55] p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white px-5 py-4 flex items-start justify-between flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              {procedure.isFavorite
                ? <FaStar className="text-yellow-300 text-xs flex-shrink-0" />
                : <FaRegStar className="text-teal-300 text-xs flex-shrink-0" />}
              <FaMapMarkerAlt className="text-teal-200 flex-shrink-0 text-sm" />
              <h2 className="text-lg sm:text-xl font-bold leading-snug">{procedure.title}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-500 bg-opacity-40 text-teal-100 border border-teal-400">
                Condado
              </span>
              {data.isOSTDS && (
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500 bg-opacity-40 text-amber-100 border border-amber-400">
                  OSTDS / FloridaDEP
                </span>
              )}
              {procedure.category?.name && (
                <span className="text-xs text-teal-200">{procedure.category.icon} {procedure.category.name}</span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="hover:bg-white hover:bg-opacity-20 rounded-xl p-1.5 transition-colors flex-shrink-0">
            <FaTimes className="text-base" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Inspecciones */}
          <section>
            <SectionTitle title="Inspecciones" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InspectionBlock title="Inspección Inicial" data={data.initialInspection} />
              <InspectionBlock title="Inspección Final"   data={data.finalInspection} />
            </div>
          </section>

          {/* Fees por sistema */}
          {(data.systemFees?.atu || data.systemFees?.pbts) && (
            <section>
              <SectionTitle title="Fees adicionales por sistema" />
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 divide-y divide-slate-100">
                <InfoRow label="Fee adicional ATU"  value={data.systemFees.atu} />
                <InfoRow label="Fee adicional PBTS" value={data.systemFees.pbts} />
              </div>
            </section>
          )}

          {/* Documentos finales */}
          {requiredDocs.length > 0 && (
            <section>
              <SectionTitle title="Documentos finales requeridos" />
              <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {requiredDocs.map((doc, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <FaFileAlt className="text-teal-500 flex-shrink-0 text-xs" />
                    <span className="text-sm text-slate-700">{doc}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* HD vs Privado */}
          {(data.hdVsPrivate?.privateCost || data.hdVsPrivate?.hdSavings) && (
            <section>
              <SectionTitle title="Comparativa HD vs Privado" />
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 divide-y divide-slate-100">
                <InfoRow label="Costo total estimado (Privado)" value={data.hdVsPrivate.privateCost} />
                <InfoRow label="Ahorro estimado usando HD"      value={data.hdVsPrivate.hdSavings} />
              </div>
            </section>
          )}

          {/* Notas */}
          {procedure.description && (
            <section>
              <SectionTitle title="Notas / Particularidades" />
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
                <FaStickyNote className="text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{procedure.description}</p>
              </div>
            </section>
          )}

          {/* Metadata */}
          {(procedure.creator || procedure.createdAt) && (
            <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3 text-xs">
              {procedure.creator && (
                <div>
                  <span className="block text-slate-400 font-medium mb-0.5">Creado por</span>
                  <span className="text-slate-700">{procedure.creator.name}</span>
                </div>
              )}
              {procedure.createdAt && (
                <div>
                  <span className="block text-slate-400 font-medium mb-0.5">Fecha creación</span>
                  <span className="text-slate-700">
                    {new Date(procedure.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-slate-100 px-5 py-3 bg-slate-50 flex justify-between items-center rounded-b-2xl">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
            Cerrar
          </button>
          {onEdit && (
            <button onClick={onEdit}
              className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
              <FaEdit className="text-xs" /> Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CountyProcedureViewModal;
