import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  fetchMonthlyAttendance, 
  markAttendance,
  fetchAvailableYears,
  deleteAttendance
} from '../Redux/Actions/staffAttendanceActions';
import {
  updateFilters,
  setSelectedDate,
  clearError
} from '../Redux/Reducer/staffAttendanceReducer';
import { fetchStaff } from '../Redux/Actions/adminActions';

const StaffAttendance = () => {
  const dispatch = useDispatch();
  
  // Redux state
  const { 
    monthlyData, 
    availableYears, 
    loading, 
    error, 
    filters 
  } = useSelector(state => state.staffAttendance);
  
  // Redux state: staff general
  const { staffList, loading: adminLoading } = useSelector(state => state.admin);

  // Local state
  const [selectedStaffForMarking, setSelectedStaffForMarking] = useState(null);
  const [attendanceForm, setAttendanceForm] = useState({
    staffId: '',
    workDate: '',
    isPresent: true,
    notes: ''
  });
  const [showModal, setShowModal] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    dispatch(fetchStaff()); // 🆕 Cargar lista de staff
    dispatch(fetchAvailableYears());
    
    // Establecer filtros iniciales y cargar datos
    const currentDate = new Date();
    dispatch(updateFilters({
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1 
    }));
    
    dispatch(fetchMonthlyAttendance({ 
      year: currentDate.getFullYear(), 
      month: currentDate.getMonth() + 1 
    }));
  }, [dispatch]); // Solo depender de dispatch

  // Cargar datos cuando cambien los filtros
  useEffect(() => {
    if (filters.year && filters.month) {
      dispatch(fetchMonthlyAttendance({ 
        year: filters.year, 
        month: filters.month 
      }));
    }
  }, [dispatch, filters.year, filters.month]);

  // Generar días del calendario
  const generateCalendarDays = () => {
    if (!monthlyData || !monthlyData.year || !monthlyData.month) {
      return [];
    }
    const year = monthlyData.year;
    const month = monthlyData.month;
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Empezar el domingo

    const days = [];
    const currentDate = new Date(startDate);
    
    // Generar 42 días (6 semanas × 7 días)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  // Obtener asistencias para una fecha específica
  const getAttendancesForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return monthlyData?.days?.[dateStr] || [];
  };

  // Manejar cambio de mes
  const handleMonthChange = (direction) => {
    let newMonth = filters.month + direction;
    let newYear = filters.year;
    
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    
    dispatch(updateFilters({ month: newMonth, year: newYear }));
  };

  // Manejar cambio de año
  const handleYearChange = (newYear) => {
    dispatch(updateFilters({ year: parseInt(newYear) }));
  };

  // Abrir modal para marcar asistencia
  const openMarkingModal = (date, staff = null) => {
    const dateStr = date.toISOString().split('T')[0];
    
    // Si se específica un staff, buscar su asistencia existente
    let existingAttendance = null;
    if (staff) {
      const dayAttendances = getAttendancesForDate(date);
      existingAttendance = dayAttendances.find(att => att.staff.id === staff.id);
    }
    
    setAttendanceForm({
      staffId: staff?.id || '',
      workDate: dateStr,
      isPresent: existingAttendance?.isPresent ?? true,
      notes: existingAttendance?.notes || ''
    });
    
    setSelectedStaffForMarking(staff);
    setShowModal(true);
  };

  // Manejar envío del formulario
  const handleSubmitAttendance = async (e) => {
    e.preventDefault();
    
    if (!attendanceForm.staffId || !attendanceForm.workDate) {
      alert('Staff y fecha son requeridos');
      return;
    }
    
    try {
      await dispatch(markAttendance(attendanceForm));
      setShowModal(false);
      setAttendanceForm({ staffId: '', workDate: '', isPresent: true, notes: '' });
      setSelectedStaffForMarking(null);
    } catch (error) {
      console.error('Error al marcar asistencia:', error);
      alert('Error al marcar asistencia: ' + error);
    }
  };

  // Formatear fecha para mostrar
  const formatDisplayDate = (year, month) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${months[month - 1]} ${year}`;
  };

  // Obtener color para una fecha según asistencias
  const getDayColor = (date, attendances) => {
    if (attendances.length === 0) return 'bg-gray-50'; // Sin datos
    
    const presentCount = attendances.filter(att => att.isPresent).length;
    const totalCount = attendances.length;
    
    if (presentCount === totalCount) return 'bg-green-100 border-green-300'; // Todos presentes
    if (presentCount === 0) return 'bg-red-100 border-red-300'; // Todos ausentes
    return 'bg-yellow-100 border-yellow-300'; // Mixto
  };

  const calendarDays = generateCalendarDays();

  if (loading.monthly || adminLoading || !monthlyData?.year) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-blue-600">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-2">Cargando asistencias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Control Mensual Del Equipo Zurcher Septic</h1>
        <p className="text-gray-600">Registra y visualiza la asistencia diaria del equipo</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">
          <div className="flex justify-between items-center">
            <span>{error}</span>
            <button 
              onClick={() => dispatch(clearError())}
              className="text-red-500 hover:text-red-700 font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {/* Navegación de mes */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleMonthChange(-1)}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            disabled={loading.monthly}
          >
            ← Mes Anterior
          </button>
          
          <h2 className="text-xl font-semibold text-gray-800 min-w-[200px] text-center">
            {monthlyData && monthlyData.year && monthlyData.month 
              ? formatDisplayDate(monthlyData.year, monthlyData.month)
              : 'Cargando...'
            }
          </h2>
          
          <button
            onClick={() => handleMonthChange(1)}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            disabled={loading.monthly}
          >
            Mes Siguiente →
          </button>
        </div>

        {/* Selector de año */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Año:</label>
          <select
            value={filters.year}
            onChange={(e) => handleYearChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading.monthly}
          >
            {Array.isArray(availableYears) && availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
            {/* Asegurar que el año actual esté disponible */}
            {Array.isArray(availableYears) && !availableYears.includes(new Date().getFullYear()) && (
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            )}
          </select>
        </div>
      </div>

      {/* Staff Summary Table */}
      {monthlyData?.staffSummaries && monthlyData.staffSummaries.length > 0 && (
        <div className="mb-6 bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h3 className="text-lg font-semibold text-gray-800">Resumen Mensual del Personal</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Personal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Días Trabajados</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Días Ausente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Días</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trabajos Realizados</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mantenimientos</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthlyData.staffSummaries.map((summary, index) => (
                  <tr key={summary.isExternal ? `ext-${summary.customName}` : summary.staff?.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {summary.staff?.name || summary.customName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {summary.isExternal ? (
                        <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 text-xs font-medium">Externo</span>
                      ) : summary.staff?.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                      {summary.workingDays}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">
                      {summary.absentDays}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {summary.totalDays}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-semibold">
                      {summary.installations || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 font-semibold">
                      {summary.maintenances || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Calendar Header */}
        <div className="grid grid-cols-7 bg-gray-50 text-center py-2 font-semibold text-gray-700 border-b">
          <div>Dom</div>
          <div>Lun</div>
          <div>Mar</div>
          <div>Mié</div>
          <div>Jue</div>
          <div>Vie</div>
          <div>Sáb</div>
        </div>

        {/* Calendar Body */}
        <div className="grid grid-cols-7 gap-1 p-1">
          {calendarDays.map((date, index) => {
            const isCurrentMonth = date.getMonth() === (monthlyData?.month || 1) - 1;
            const isToday = date.toDateString() === new Date().toDateString();
            const attendances = getAttendancesForDate(date);
            const dayColor = getDayColor(date, attendances);
            
            return (
              <div
                key={index}
                className={`min-h-[120px] p-2 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                  isCurrentMonth 
                    ? `${dayColor} text-gray-900 border-gray-300` 
                    : 'bg-gray-100 text-gray-400 border-gray-200'
                } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => isCurrentMonth && openMarkingModal(date)}
              >
                {/* Número del día */}
                <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-600' : ''}`}>
                  {date.getDate()}
                </div>
                
                {/* Asistencias del día */}
                {isCurrentMonth && attendances.length > 0 && (
                  <div className="space-y-1">
                    {attendances.slice(0, 3).map((attendance, idx) => (
                      <div
                        key={idx}
                        className={`text-xs p-1 rounded truncate ${
                          attendance.isPresent 
                            ? 'bg-green-200 text-green-800' 
                            : 'bg-red-200 text-red-800'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openMarkingModal(date, attendance.staff || null);
                        }}
                      >
                        {attendance.staff?.name || attendance.customName || 'Externo'}
                      </div>
                    ))}
                    {attendances.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{attendances.length - 3} más...
                      </div>
                    )}
                  </div>
                )}
                
                {/* Indicador para agregar */}
                {isCurrentMonth && attendances.length === 0 && (
                  <div className="text-xs text-gray-400 italic">
                    Click para agregar
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal para marcar asistencia */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {selectedStaffForMarking ? 'Editar Asistencia' : 'Marcar Asistencia'}
            </h3>
            
            <form onSubmit={handleSubmitAttendance} className="space-y-4">
              {/* Staff Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Staff
                </label>
                <select
                  value={attendanceForm.staffId}
                  onChange={(e) => setAttendanceForm(prev => ({ ...prev, staffId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={!!selectedStaffForMarking}
                >
                  <option value="">Seleccionar staff...</option>
                  {staffList && staffList.map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} - {staff.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  value={attendanceForm.workDate}
                  onChange={(e) => setAttendanceForm(prev => ({ ...prev, workDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Estado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="isPresent"
                      checked={attendanceForm.isPresent === true}
                      onChange={() => setAttendanceForm(prev => ({ ...prev, isPresent: true }))}
                      className="mr-2"
                    />
                    Presente
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="isPresent"
                      checked={attendanceForm.isPresent === false}
                      onChange={() => setAttendanceForm(prev => ({ ...prev, isPresent: false }))}
                      className="mr-2"
                    />
                    Ausente
                  </label>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={attendanceForm.notes}
                  onChange={(e) => setAttendanceForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows="3"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Medio día, overtime, enfermo..."
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedStaffForMarking(null);
                    setAttendanceForm({ staffId: '', workDate: '', isPresent: true, notes: '' });
                  }}
                  className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading.marking}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {loading.marking ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffAttendance;