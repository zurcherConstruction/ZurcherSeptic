import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaTimes, FaTachometerAlt, FaClock } from 'react-icons/fa';
import { logFleetMileage } from '../../Redux/Actions/fleetActions';
import { toast } from 'react-toastify';

export default function MileageLogModal({ asset, onClose, onSuccess }) {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.fleet);

  const isVehicle = asset.assetType === 'vehicle' || asset.assetType === 'trailer';
  const isMachine = asset.assetType === 'machine' || asset.assetType === 'equipment';

  const [form, setForm] = useState({
    mileage: '',
    hours: '',
    recordedAt: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.mileage && !form.hours) {
      return toast.error('Ingresa mileaje o horas para actualizar');
    }

    // Validar que el nuevo mileaje sea mayor al actual
    if (form.mileage && asset.currentMileage && parseFloat(form.mileage) < parseFloat(asset.currentMileage)) {
      return toast.error(`El mileaje no puede ser menor al actual (${asset.currentMileage} mi)`);
    }
    if (form.hours && asset.currentHours && parseFloat(form.hours) < parseFloat(asset.currentHours)) {
      return toast.error(`Las horas no pueden ser menores a las actuales (${asset.currentHours} hs)`);
    }

    try {
      await dispatch(logFleetMileage(asset.id, {
        mileage: form.mileage || null,
        hours: form.hours || null,
        recordedAt: form.recordedAt,
        notes: form.notes,
      }));
      toast.success('Actualizado correctamente');
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || 'Error al actualizar');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Actualizar Mileaje / Horas</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Asset info */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="font-medium text-gray-800 text-sm">{asset.name}</p>
            <div className="flex gap-4 mt-1">
              {isVehicle && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <FaTachometerAlt className="text-blue-400" />
                  Actual: <strong>{Number(asset.currentMileage || 0).toLocaleString()} mi</strong>
                </span>
              )}
              {isMachine && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <FaClock className="text-orange-400" />
                  Actual: <strong>{Number(asset.currentHours || 0).toLocaleString()} hs</strong>
                </span>
              )}
            </div>
          </div>

          {/* Nuevo mileaje */}
          {isVehicle && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nuevo mileaje (millas)
              </label>
              <div className="relative">
                <FaTachometerAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
                <input
                  type="number"
                  name="mileage"
                  value={form.mileage}
                  onChange={handleChange}
                  placeholder={`> ${asset.currentMileage || 0}`}
                  min={asset.currentMileage || 0}
                  step="0.1"
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Nuevas horas */}
          {isMachine && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nuevas horas trabajadas
              </label>
              <div className="relative">
                <FaClock className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" />
                <input
                  type="number"
                  name="hours"
                  value={form.hours}
                  onChange={handleChange}
                  placeholder={`> ${asset.currentHours || 0}`}
                  min={asset.currentHours || 0}
                  step="0.1"
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>
          )}

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de registro</label>
            <input
              type="date"
              name="recordedAt"
              value={form.recordedAt}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Observaciones..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-50">
              {loading ? 'Guardando...' : 'Actualizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
