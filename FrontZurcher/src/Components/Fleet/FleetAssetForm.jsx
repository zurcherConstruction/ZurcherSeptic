import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaTimes, FaCamera, FaTruck, FaCogs } from 'react-icons/fa';
import { createFleetAsset, updateFleetAsset, uploadFleetAssetImage } from '../../Redux/Actions/fleetActions';
import { toast } from 'react-toastify';

const initialForm = {
  assetType: 'vehicle',
  companyType: 'zurcher',
  companyOtherName: '',
  name: '',
  brand: '',
  model: '',
  year: '',
  licensePlate: '',
  serialNumber: '',
  color: '',
  fuelType: 'diesel',
  currentMileage: '',
  currentHours: '',
  purchaseDate: '',
  purchasePrice: '',
  insuranceExpiry: '',
  registrationExpiry: '',
  notes: '',
  assignedToId: '',
};

export default function FleetAssetForm({ onClose, onSuccess, assetToEdit }) {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.fleet);
  const { staffList } = useSelector((state) => state.admin);

  const [form, setForm] = useState(() => {
    if (!assetToEdit) return initialForm;
    // Solo campos editables, sin id ni campos de audit
    const { id, createdAt, updatedAt, assignedTo, maintenances, mileageLogs, ...editableFields } = assetToEdit;
    return { ...initialForm, ...editableFields };
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(assetToEdit?.imageUrl || null);
  const fileInputRef = useRef();

  const isVehicle = form.assetType === 'vehicle' || form.assetType === 'trailer';
  const isMachine = form.assetType === 'machine' || form.assetType === 'equipment';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name === 'companyType' && value !== 'other') {
        return { ...prev, companyType: value, companyOtherName: '' };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('El nombre es requerido');

    try {
      const payload = { ...form };
      // Limpiar campos vacíos opcionales
      ['year', 'currentMileage', 'currentHours', 'purchasePrice', 'assignedToId',
       'purchaseDate', 'insuranceExpiry', 'registrationExpiry'].forEach((k) => {
        if (!payload[k] || payload[k] === '') delete payload[k];
      });

      if (payload.companyType !== 'other') {
        delete payload.companyOtherName;
      }

      let assetId;
      if (assetToEdit?.id) {
        // Modo edición
        await dispatch(updateFleetAsset(assetToEdit.id, payload));
        assetId = assetToEdit.id;
        toast.success('Activo actualizado exitosamente');
      } else {
        // Modo creación — nunca enviar id
        delete payload.id;
        const asset = await dispatch(createFleetAsset(payload));
        assetId = asset?.id;
        toast.success(`${form.assetType === 'vehicle' ? 'Vehículo' : 'Activo'} registrado exitosamente`);
      }

      // Subir imagen si hay una seleccionada
      if (imageFile && assetId) {
        await dispatch(uploadFleetAssetImage(assetId, imageFile));
      }

      onSuccess?.();
    } catch (err) {
      toast.error(err.message || 'Error al guardar');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            {assetToEdit ? 'Editar Activo' : 'Nuevo Vehículo / Máquina'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Imagen */}
          <div className="flex justify-center">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-32 h-32 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 hover:border-blue-400 cursor-pointer overflow-hidden flex items-center justify-center group"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="preview" className="w-full h-full object-contain bg-white" />
              ) : (
                <div className="text-center text-gray-400 group-hover:text-blue-400">
                  <FaCamera className="text-2xl mx-auto mb-1" />
                  <span className="text-xs">Agregar foto</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <FaCamera className="text-white text-xl" />
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de activo *</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'vehicle', label: 'Vehículo', icon: FaTruck },
                { value: 'machine', label: 'Maquinaria', icon: FaCogs },
                { value: 'equipment', label: 'Equipo', icon: FaCogs },
                { value: 'trailer', label: 'Remolque', icon: FaTruck },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, assetType: value }))}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 text-xs font-medium transition-colors ${
                    form.assetType === value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Icon className="text-lg" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empresa *</label>
              <select
                name="companyType"
                value={form.companyType}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="zurcher">ZURCHER</option>
                <option value="invertech">INVERTECH</option>
                <option value="other">OTRA</option>
              </select>
            </div>
            {form.companyType === 'other' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de empresa *</label>
                <input
                  type="text"
                  name="companyOtherName"
                  value={form.companyOtherName || ''}
                  onChange={handleChange}
                  placeholder="Ej: Mi Empresa SRL"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            )}
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre descriptivo *</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ej: Ford F-250 2020 Blanca"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Marca / Modelo / Año */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input type="text" name="brand" value={form.brand} onChange={handleChange}
                placeholder="Ford, CAT..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <input type="text" name="model" value={form.model} onChange={handleChange}
                placeholder="F-250, 320D..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
              <input type="number" name="year" value={form.year} onChange={handleChange}
                placeholder="2020" min="1980" max="2030" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Placa / Serie / Color */}
          <div className="grid grid-cols-3 gap-3">
            {isVehicle && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Placa / Patente</label>
                <input type="text" name="licensePlate" value={form.licensePlate} onChange={handleChange}
                  placeholder="ABC-1234" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
              </div>
            )}
            {isMachine && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Serie</label>
                <input type="text" name="serialNumber" value={form.serialNumber} onChange={handleChange}
                  placeholder="SN-XXXXXXX" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input type="text" name="color" value={form.color} onChange={handleChange}
                placeholder="Blanco, Rojo..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {isVehicle && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Combustible</label>
                <select name="fuelType" value={form.fuelType} onChange={handleChange}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="diesel">Diesel</option>
                  <option value="gasoline">Gasolina</option>
                  <option value="electric">Eléctrico</option>
                  <option value="hybrid">Híbrido</option>
                  <option value="propane">Propano</option>
                </select>
              </div>
            )}
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 gap-3">
            {(isVehicle || form.currentMileage) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mileaje actual (mi)</label>
                <input type="number" name="currentMileage" value={form.currentMileage} onChange={handleChange}
                  placeholder="0" min="0" step="0.1" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            {(isMachine || form.currentHours) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horas trabajadas</label>
                <input type="number" name="currentHours" value={form.currentHours} onChange={handleChange}
                  placeholder="0" min="0" step="0.1" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>

          {/* Asignado a */}
          {staffList && staffList.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asignado a</label>
              <select name="assignedToId" value={form.assignedToId} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Sin asignar</option>
                {staffList.filter((s) => s.isActive).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Fechas / Seguro */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Venc. Seguro</label>
              <input type="date" name="insuranceExpiry" value={form.insuranceExpiry} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Venc. Registración</label>
              <input type="date" name="registrationExpiry" value={form.registrationExpiry} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
              placeholder="Observaciones adicionales..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-50">
              {loading ? 'Guardando...' : (assetToEdit ? 'Actualizar' : 'Registrar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
