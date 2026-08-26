import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCategories, createContact, updateContact } from '../../Redux/Actions/knowledgeBaseActions';

const ContactModal = ({ contact, isEditing, onClose, defaultCategoryId }) => {
  const dispatch = useDispatch();
  const { categories } = useSelector((state) => state.knowledgeBase);
  const [tagInput, setTagInput] = useState('');
  const [formData, setFormData] = useState({
    categoryId: defaultCategoryId || '',
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    secondaryPhone: '',
    secondaryEmail: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    website: '',
    contactType: '',
    notes: '',
    tags: []
  });

  useEffect(() => {
    if (categories.length === 0) {
      dispatch(fetchCategories());
    }
    if (contact) {
      setFormData({
        categoryId: contact.categoryId || '',
        companyName: contact.companyName || '',
        contactPerson: contact.contactPerson || '',
        phone: contact.phone || '',
        email: contact.email || '',
        secondaryPhone: contact.secondaryPhone || '',
        secondaryEmail: contact.secondaryEmail || '',
        address: contact.address || '',
        city: contact.city || '',
        state: contact.state || '',
        zipCode: contact.zipCode || '',
        website: contact.website || '',
        contactType: contact.contactType || '',
        notes: contact.notes || '',
        tags: contact.tags || []
      });
    }
  }, [contact]); // Removido dispatch de dependencias para evitar loop

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await dispatch(updateContact(contact.id, formData));
      } else {
        await dispatch(createContact(formData));
      }
      onClose();
    } catch (error) {
      console.error('Error guardando contacto:', error);
      alert('Error al guardar el contacto');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-8">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800">
            {isEditing ? 'Editar Contacto' : 'Nuevo Contacto'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              name="categoryId"
              value={formData.categoryId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar categoría</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la Empresa *
            </label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Contact Person */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Persona de Contacto
            </label>
            <input
              type="text"
              name="contactPerson"
              value={formData.contactPerson}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Contact Type — material */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🧱</span>
              <label className="text-sm font-bold text-amber-800">
                ¿Qué suministra / qué tipo de servicio ofrece?
              </label>
            </div>
            <p className="text-xs text-amber-600 mb-2">Un solo valor: el material o servicio principal</p>
            <input
              type="text"
              name="contactType"
              value={formData.contactType}
              onChange={handleChange}
              placeholder="ej: Arena, Tierra, Grava, HDPE Pipe, Inspección privada..."
              className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-sm"
            />
          </div>

          {/* Phone and Secondary Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono Principal
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono Secundario
              </label>
              <input
                type="tel"
                name="secondaryPhone"
                value={formData.secondaryPhone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Email and Secondary Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Principal
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Secundario
              </label>
              <input
                type="email"
                name="secondaryEmail"
                value={formData.secondaryEmail}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* City, State, Zip */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ciudad
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código Postal
              </label>
              <input
                type="text"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sitio Web
            </label>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Service Areas */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">📍</span>
              <label className="text-sm font-bold text-teal-800">
                ¿En qué counties o ciudades trabaja?
              </label>
            </div>
            <p className="text-xs text-teal-600 mb-2">Podés agregar varios — uno por vez</p>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {formData.tags.map((tag, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs bg-white text-teal-700 border border-teal-300 px-2.5 py-1 rounded-full font-medium">
                    📍 {tag}
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, tags: p.tags.filter((_, j) => j !== i) }))}
                      className="ml-0.5 text-teal-400 hover:text-teal-700 font-bold leading-none text-sm"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const t = tagInput.trim().toLowerCase();
                    if (t && !formData.tags.includes(t)) {
                      setFormData(p => ({ ...p, tags: [...p.tags, t] }));
                    }
                    setTagInput('');
                  }
                }}
                placeholder="ej: Miami-Dade, Broward, Palm Beach... Enter para agregar"
                className="flex-1 px-3 py-2 border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const t = tagInput.trim().toLowerCase();
                  if (t && !formData.tags.includes(t)) {
                    setFormData(p => ({ ...p, tags: [...p.tags, t] }));
                  }
                  setTagInput('');
                }}
                className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
              >
                + Agregar
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isEditing ? 'Guardar Cambios' : 'Crear Contacto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContactModal;
