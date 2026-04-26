import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaTimes, FaWrench } from 'react-icons/fa';
import { createMaintenance, updateMaintenance } from '../../Redux/Actions/fleetActions';
import { toast } from 'react-toastify';

const maintenanceTypes = [
  { value: 'preventive', label: 'Preventivo' },
  { value: 'oil_change', label: 'Cambio de aceite' },
  { value: 'tire_change', label: 'Cambio de neumáticos' },
  { value: 'brake_service', label: 'Frenos' },
  { value: 'corrective', label: 'Correctivo (falla)' },
  { value: 'repair', label: 'Reparación' },
  { value: 'inspection', label: 'Inspección' },
  { value: 'cleaning', label: 'Limpieza' },
  { value: 'other', label: 'Otro' },
];

const initialForm = {
  maintenanceType: 'preventive',
  title: '',
  description: '',
  serviceDate: new Date().toISOString().split('T')[0],
  mileageAtService: '',
  hoursAtService: '',
  cost: '',
  performedById: '',
  externalShop: '',
  nextServiceDate: '',
  nextServiceMileage: '',
  nextServiceHours: '',
  status: 'completed',
  notes: '',
};

export default function FleetMaintenanceForm({ assetId, assetName, assetType, onClose, onSuccess, recordToEdit }) {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.fleet);
  const { staffList } = useSelector((state) => state.admin);

  const [form, setForm] = useState(recordToEdit ? {
    ...recordToEdit,
    serviceDate: recordToEdit.serviceDate?.split('T')[0] || '',
    nextServiceDate: recordToEdit.nextServiceDate?.split('T')[0] || '',
  } : initialForm);

  const isVehicle = assetType === 'vehicle' || assetType === 'trailer';
  const isMachine = assetType === 'machine' || assetType === 'equipment';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('El título es requerido');
    if (!form.serviceDate) return toast.error('La fecha del servicio es requerida');

    try {
      const payload = { ...form };
      if (!payload.mileageAtService) delete payload.mileageAtService;
      if (!payload.hoursAtService) delete payload.hoursAtService;
      if (!payload.cost) payload.cost = 0;
      if (!payload.performedById) delete payload.performedById;
      if (!payload.nextServiceDate) delete payload.nextServiceDate;
      if (!payload.nextServiceMileage) delete payload.nextServiceMileage;
      if (!payload.nextServiceHours) delete payload.nextServiceHours;

      if (recordToEdit) {
        await dispatch(updateMaintenance(assetId, recordToEdit.id, payload));
        toast.success('Mantenimiento actualizado');
      } else {
        await dispatch(createMaintenance(assetId, payload));
        toast.success('Mantenimiento registrado');
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
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FaWrench className="text-orange-500" />
              {recordToEdit ? 'Editar Mantenimiento' : 'Nuevo Mantenimiento'}
            </h2>
            <p className="text-sm text-gray-400">{assetName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tipo y Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select name="maintenanceType" value={form.maintenanceType} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                {maintenanceTypes.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select name="status" value={form.status} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="completed">Completado</option>
                <option value="scheduled">Programado</option>
                <option value="in_progress">En Proceso</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título / Descripción corta *</label>
            <input type="text" name="title" value={form.title} onChange={handleChange}
              placeholder='Ej: "Cambio aceite 5000 mi", "Reparación transmisión"'
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              required />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Detalle del trabajo</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={3}
              placeholder="Descripción detallada de lo que se hizo..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>

          {/* Fecha y Costo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del servicio *</label>
              <input type="date" name="serviceDate" value={form.serviceDate} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo ($)</label>
              <input type="number" name="cost" value={form.cost} onChange={handleChange}
                placeholder="0.00" min="0" step="0.01"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>

          {/* Métricas al servicio */}
          <div className="grid grid-cols-2 gap-3">
            {isVehicle && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mileaje al servicio (mi)</label>
                <input type="number" name="mileageAtService" value={form.mileageAtService} onChange={handleChange}
                  placeholder="0" min="0" step="0.1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            )}
            {isMachine && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horas al servicio</label>
                <input type="number" name="hoursAtService" value={form.hoursAtService} onChange={handleChange}
                  placeholder="0" min="0" step="0.1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            )}
          </div>

          {/* Quién realizó */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Realizado por (interno)</label>
              <select name="performedById" value={form.performedById} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">— Seleccionar —</option>
                {(staffList || []).filter((s) => s.isActive).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Taller externo</label>
              <input type="text" name="externalShop" value={form.externalShop} onChange={handleChange}
                placeholder="Nombre del taller / mecánico"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>

          {/* Próximo servicio */}
          <div className="bg-orange-50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-orange-700">Próximo servicio programado</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Fecha</label>
                <input type="date" name="nextServiceDate" value={form.nextServiceDate} onChange={handleChange}
                  className="w-full border border-orange-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              {isVehicle && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">En mileaje (mi)</label>
                  <input type="number" name="nextServiceMileage" value={form.nextServiceMileage} onChange={handleChange}
                    placeholder="0" min="0"
                    className="w-full border border-orange-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              )}
              {isMachine && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">En horas</label>
                  <input type="number" name="nextServiceHours" value={form.nextServiceHours} onChange={handleChange}
                    placeholder="0" min="0"
                    className="w-full border border-orange-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              )}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
              placeholder="Observaciones, repuestos usados..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-50">
              {loading ? 'Guardando...' : (recordToEdit ? 'Actualizar' : 'Registrar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
