import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaTimes, FaCheckSquare, FaSquare } from 'react-icons/fa';
import { createProcedure, updateProcedure } from '../../Redux/Actions/knowledgeBaseActions';

const WHO_OPTIONS = ['HD', 'Privado', 'Ambos'];

const emptyInspection = () => ({
  required: true,
  adminFee: '',
  inspectionCost: '',
  estimatedDays: '',
  whoCanDo: 'HD',
});

const emptyForm = (categoryId) => ({
  categoryId: categoryId || '',
  countyName: '',
  isOSTDS: false,
  initialInspection: emptyInspection(),
  finalInspection: emptyInspection(),
  systemFees: { atu: '', pbts: '' },
  finalDocuments: {
    operatingPermit: false,
    maintenanceContract: false,
    noticePBTS: false,
    other: '',
  },
  hdVsPrivate: { privateCost: '', hdSavings: '' },
  notes: '',
});

const parseFromProcedure = (procedure) => {
  const data = procedure.steps?.[0] || {};
  return {
    categoryId:          procedure.categoryId || '',
    countyName:          procedure.title || '',
    isOSTDS:             data.isOSTDS            ?? false,
    initialInspection:   data.initialInspection  ?? emptyInspection(),
    finalInspection:     data.finalInspection    ?? emptyInspection(),
    systemFees:          data.systemFees         ?? { atu: '', pbts: '' },
    finalDocuments:      data.finalDocuments     ?? { operatingPermit: false, maintenanceContract: false, noticePBTS: false, other: '' },
    hdVsPrivate:         data.hdVsPrivate        ?? { privateCost: '', hdSavings: '' },
    notes:               procedure.description   || '',
  };
};

// ── Sección de Inspección reutilizable ────────────────────────────────────────
const InspectionSection = ({ label, data, onChange }) => {
  const inp = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
  const lbl = 'block text-xs font-semibold text-slate-500 mb-1.5';

  return (
    <div className="space-y-4">
      {/* ¿Requiere? */}
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
        <button type="button"
          onClick={() => onChange('required', !data.required)}
          className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
            data.required ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
          }`}>
          {data.required && <span className="text-[10px] font-bold">✓</span>}
        </button>
        <span className="text-sm font-medium text-slate-700">¿Requiere {label.toLowerCase()}?</span>
      </div>

      {data.required && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2">
          <div>
            <label className={lbl}>Fee administrativo</label>
            <input className={inp} placeholder="Ej: $75" value={data.adminFee}
              onChange={e => onChange('adminFee', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Costo de la inspección</label>
            <input className={inp} placeholder="Ej: $150" value={data.inspectionCost}
              onChange={e => onChange('inspectionCost', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Demora estimada (días)</label>
            <input className={inp} placeholder="Ej: 10-14" value={data.estimatedDays}
              onChange={e => onChange('estimatedDays', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>¿Quién puede hacerla?</label>
            <div className="flex gap-2">
              {WHO_OPTIONS.map(opt => (
                <button key={opt} type="button"
                  onClick={() => onChange('whoCanDo', opt)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border-2 transition-all ${
                    data.whoCanDo === opt
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Checkbox con label ─────────────────────────────────────────────────────────
const CheckRow = ({ label, checked, onChange }) => (
  <button type="button"
    onClick={onChange}
    className="flex items-center gap-3 w-full text-left py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors">
    <span className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
      checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
    }`}>
      {checked && <span className="text-[10px] font-bold">✓</span>}
    </span>
    <span className="text-sm text-slate-700">{label}</span>
  </button>
);

// ── Section header ─────────────────────────────────────────────────────────────
const SectionTitle = ({ num, title }) => (
  <div className="flex items-center gap-3 mb-4">
    <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
      {num}
    </span>
    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</h3>
  </div>
);

// ── Modal principal ────────────────────────────────────────────────────────────
const CountyProcedureModal = ({ procedure, onClose, defaultCategoryId }) => {
  const dispatch    = useDispatch();
  const categories  = useSelector(state => state.knowledgeBase.categories);
  const isEditing   = !!procedure;

  const [form, setForm]       = useState(emptyForm(defaultCategoryId));
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (procedure) {
      setForm(parseFromProcedure(procedure));
    } else {
      setForm(emptyForm(defaultCategoryId));
    }
  }, [procedure, defaultCategoryId]);

  const set = (field, val) => setForm(p => ({ ...p, [field]: val }));

  const setInspection = (type, field, val) =>
    setForm(p => ({ ...p, [type]: { ...p[type], [field]: val } }));

  const setDocs = (field, val) =>
    setForm(p => ({ ...p, finalDocuments: { ...p.finalDocuments, [field]: val } }));

  const setFees = (field, val) =>
    setForm(p => ({ ...p, systemFees: { ...p.systemFees, [field]: val } }));

  const setHdPrivate = (field, val) =>
    setForm(p => ({ ...p, hdVsPrivate: { ...p.hdVsPrivate, [field]: val } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.countyName.trim()) { setError('El nombre del condado es requerido'); return; }
    if (!form.categoryId) { setError('La categoría es requerida'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        categoryId:  form.categoryId,
        title:       form.countyName.trim(),
        description: form.notes.trim() || null,
        steps: [{
          __type:             'countyProcedure',
          isOSTDS:            form.isOSTDS,
          initialInspection:  form.initialInspection,
          finalInspection:    form.finalInspection,
          systemFees:         form.systemFees,
          finalDocuments:     form.finalDocuments,
          hdVsPrivate:        form.hdVsPrivate,
        }],
        difficulty: 'medium',
        tags: ['county-procedure'],
      };
      if (isEditing) {
        await dispatch(updateProcedure(procedure.id, payload));
      } else {
        await dispatch(createProcedure(payload));
      }
      onClose();
    } catch {
      setError('Error al guardar. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
  const lbl = 'block text-xs font-semibold text-slate-500 mb-1.5';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[55] p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-base sm:text-lg">
              {isEditing ? `Editar — ${procedure.title}` : 'Nuevo Procedimiento de Condado'}
            </h2>
            <p className="text-blue-200 text-xs mt-0.5">Formulario estructurado de permitting</p>
          </div>
          <button onClick={onClose}
            className="hover:bg-white hover:bg-opacity-20 rounded-xl p-1.5 transition-colors flex-shrink-0 ml-3">
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{error}</div>
            )}

            {/* ── 1. Datos generales ── */}
            <section>
              <SectionTitle num="1" title="Datos generales" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Nombre del County *</label>
                  <input className={inp} placeholder="Ej: Lee, Collier, Charlotte..."
                    value={form.countyName}
                    onChange={e => set('countyName', e.target.value)} required />
                </div>
                <div>
                  <label className={lbl}>Categoría</label>
                  <select className={inp} value={form.categoryId}
                    onChange={e => set('categoryId', e.target.value)} required>
                    <option value="">Seleccionar...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <button type="button"
                  onClick={() => set('isOSTDS', !form.isOSTDS)}
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                    form.isOSTDS ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 bg-white'
                  }`}>
                  {form.isOSTDS && <span className="text-[10px] font-bold">✓</span>}
                </button>
                <div>
                  <span className="text-sm font-semibold text-slate-700">Pertenece a OSTDS.FloridaDEP.gov</span>
                  <p className="text-xs text-slate-500 mt-0.5">El permitting lo maneja el DEP en vez del Health Department local</p>
                </div>
              </div>
            </section>

            {/* ── 2. Inspección Inicial ── */}
            <section>
              <SectionTitle num="2" title="Inspección Inicial" />
              <InspectionSection
                label="Inspección Inicial"
                data={form.initialInspection}
                onChange={(f, v) => setInspection('initialInspection', f, v)}
              />
            </section>

            {/* ── 3. Inspección Final ── */}
            <section>
              <SectionTitle num="3" title="Inspección Final" />
              <InspectionSection
                label="Inspección Final"
                data={form.finalInspection}
                onChange={(f, v) => setInspection('finalInspection', f, v)}
              />
            </section>

            {/* ── 4. Fees por sistema ── */}
            <section>
              <SectionTitle num="4" title="Fees según tipo de sistema" />
              <p className="text-xs text-slate-400 mb-3 -mt-2">Se suman a los costos de arriba — aplica solo si el sistema es ATU o PBTS</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Fee adicional ATU</label>
                  <input className={inp} placeholder="Ej: $200" value={form.systemFees.atu}
                    onChange={e => setFees('atu', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Fee adicional PBTS</label>
                  <input className={inp} placeholder="Ej: $150" value={form.systemFees.pbts}
                    onChange={e => setFees('pbts', e.target.value)} />
                </div>
              </div>
            </section>

            {/* ── 5. Documentos finales ── */}
            <section>
              <SectionTitle num="5" title="Documentos finales requeridos" />
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                <CheckRow label="Operating Permit"
                  checked={form.finalDocuments.operatingPermit}
                  onChange={() => setDocs('operatingPermit', !form.finalDocuments.operatingPermit)} />
                <CheckRow label="Contrato de Servicio de Mantenimiento"
                  checked={form.finalDocuments.maintenanceContract}
                  onChange={() => setDocs('maintenanceContract', !form.finalDocuments.maintenanceContract)} />
                <CheckRow label="Notice certificado por PBTS"
                  checked={form.finalDocuments.noticePBTS}
                  onChange={() => setDocs('noticePBTS', !form.finalDocuments.noticePBTS)} />
                <div className="px-3 py-2.5">
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Otro (especificar)</label>
                  <input className={inp} placeholder="Documento adicional requerido..."
                    value={form.finalDocuments.other}
                    onChange={e => setDocs('other', e.target.value)} />
                </div>
              </div>
            </section>

            {/* ── 6. Comparativa HD vs Privado ── */}
            <section>
              <SectionTitle num="6" title="Comparativa HD vs Privado" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Costo total estimado si se usa Privado</label>
                  <input className={inp} placeholder="Ej: $850 (Sebring)" value={form.hdVsPrivate.privateCost}
                    onChange={e => setHdPrivate('privateCost', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Ahorro estimado usando HD</label>
                  <input className={inp} placeholder="Ej: ~$300 (Lee)" value={form.hdVsPrivate.hdSavings}
                    onChange={e => setHdPrivate('hdSavings', e.target.value)} />
                </div>
              </div>
            </section>

            {/* ── 7. Notas ── */}
            <section>
              <SectionTitle num="7" title="Notas / Particularidades" />
              <textarea className={inp} rows={4}
                placeholder="Casos atípicos, cambios de autoridad, contactos, direcciones, observaciones..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)} />
            </section>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-slate-100 px-5 py-3 bg-slate-50 flex justify-between items-center gap-3 rounded-b-2xl">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 text-sm font-semibold transition-colors shadow-sm">
              {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear procedimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CountyProcedureModal;
