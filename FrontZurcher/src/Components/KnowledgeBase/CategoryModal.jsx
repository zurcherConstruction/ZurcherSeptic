import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { FaTimes } from 'react-icons/fa';
import api from '../../utils/axios';
import { fetchCategoriesSuccess } from '../../Redux/Reducer/knowledgeBaseReducer';

const EMOJI_OPTIONS = [
  '📚','📋','📄','📞','🔧','🏗️','🏠','🗺️','👷','🔍',
  '💼','⚙️','🛠️','📌','📎','🏢','👤','💡','✅','⚠️',
  '🌎','📊','🗂️','📝','🔑','🏛️','🚛','💧','🔩','📐',
];

const COLOR_OPTIONS = [
  '#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444',
  '#06B6D4','#84CC16','#EC4899','#F97316','#6366F1',
  '#14B8A6','#64748B','#A855F7','#22C55E','#E11D48',
];

const CategoryModal = ({ category, onClose, onSaved }) => {
  const dispatch = useDispatch();
  const isEditing = !!category;

  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: '📚',
    color: '#3B82F6',
    order: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (category) {
      setForm({
        name:        category.name        || '',
        description: category.description || '',
        icon:        category.icon        || '📚',
        color:       category.color       || '#3B82F6',
        order:       category.order       ?? 0,
      });
    }
  }, [category]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      if (isEditing) {
        await api.put(`/knowledge-base/categories/${category.id}`, form);
      } else {
        await api.post('/knowledge-base/categories', form);
      }
      const res = await api.get('/knowledge-base/categories');
      dispatch(fetchCategoriesSuccess(res.data));
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar categoría');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-base sm:text-lg">
            {isEditing ? 'Editar Categoría' : 'Nueva Categoría'}
          </h2>
          <button onClick={onClose}
            className="hover:bg-white hover:bg-opacity-20 rounded-xl p-1.5 transition-colors">
            <FaTimes />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{error}</div>
            )}

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-4xl leading-none">{form.icon}</span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate" style={{ color: form.color }}>
                  {form.name || 'Vista previa'}
                </p>
                {form.description && (
                  <p className="text-xs text-slate-500 truncate">{form.description}</p>
                )}
              </div>
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nombre *</label>
              <input className={inp} value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Proveedores" required />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Descripción</label>
              <input className={inp} value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Breve descripción..." />
            </div>

            {/* Ícono */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Ícono</label>
              <div className="grid grid-cols-10 gap-1">
                {EMOJI_OPTIONS.map(emoji => (
                  <button key={emoji} type="button"
                    onClick={() => setForm(p => ({ ...p, icon: emoji }))}
                    className={`text-xl sm:text-2xl p-1.5 rounded-lg border-2 transition-all ${
                      form.icon === emoji
                        ? 'border-blue-500 bg-blue-50 scale-110'
                        : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                    }`}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Color</label>
              <div className="flex flex-wrap gap-2.5">
                {COLOR_OPTIONS.map(color => (
                  <button key={color} type="button"
                    onClick={() => setForm(p => ({ ...p, color }))}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      form.color === color ? 'border-slate-700 scale-110 shadow-md' : 'border-white shadow hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>

            {/* Orden */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Orden de visualización</label>
              <input type="number" className={inp} value={form.order} min={0}
                onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 0 }))} />
            </div>

            {/* Footer inside form so submit button works */}
            <div className="flex justify-between gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold transition-colors shadow-sm">
                {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear categoría'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CategoryModal;
