import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { fetchMonthlyActivityReport } from '../../Redux/Actions/salesLeadActions';
import {
  XMarkIcon,
  ChartBarIcon,
  PhoneIcon,
  EnvelopeIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

const MonthlyActivityReport = ({ onClose }) => {
  const dispatch = useDispatch();
  
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('current');
  
  // Calcular rango de fechas del mes (día 1 00:00 → último día 23:59)
  const getMonthRange = (monthType) => {
    const now = new Date();
    let startDate, endDate;
    
    if (monthType === 'current') {
      // Mes actual
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (monthType === 'last') {
      // Mes pasado
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };
  
  // Cargar datos
  useEffect(() => {
    loadReport();
  }, [selectedMonth]);
  
  const loadReport = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { startDate, endDate } = getMonthRange(selectedMonth);
      const result = await dispatch(fetchMonthlyActivityReport({ startDate, endDate })).unwrap();
      setReportData(result);
    } catch (err) {
      setError(err.message || 'Error al cargar reporte');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-4xl w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            <span className="ml-3 text-lg">Cargando reporte mensual...</span>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold mb-2">Error</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  const { summary, staffActivity } = reportData || {};
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <ChartBarIcon className="h-8 w-8" />
                Reporte Mensual de Actividad
              </h2>
              <p className="text-purple-100 mt-2">
                📅 {summary?.monthName || 'Mes actual'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          {/* Selector de mes */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setSelectedMonth('current')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedMonth === 'current'
                  ? 'bg-white text-purple-600'
                  : 'bg-purple-500 text-white hover:bg-purple-400'
              }`}
            >
              Mes Actual
            </button>
            <button
              onClick={() => setSelectedMonth('last')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedMonth === 'last'
                  ? 'bg-white text-purple-600'
                  : 'bg-purple-500 text-white hover:bg-purple-400'
              }`}
            >
              Mes Pasado
            </button>
          </div>
        </div>
        
        {/* Resumen general */}
        <div className="p-6 border-b bg-gray-50">
          <h3 className="text-lg font-bold mb-4 text-gray-800">📊 Resumen General del Mes</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Nuevos Leads */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500">
              <div className="text-gray-600 text-sm flex items-center gap-2">
                <span className="text-xl">🆕</span>
                Nuevos Leads
              </div>
              <div className="text-3xl font-bold text-green-600 mt-1">{summary?.newLeads || 0}</div>
            </div>
            
            {/* Contactados */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-500">
              <div className="text-gray-600 text-sm flex items-center gap-2">
                <span className="text-xl">📞</span>
                Contactados
              </div>
              <div className="text-3xl font-bold text-blue-600 mt-1">{summary?.contactedLeads || 0}</div>
            </div>
            
            {/* Total Actividades */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-indigo-500">
              <div className="text-gray-600 text-sm flex items-center gap-2">
                <CalendarDaysIcon className="h-5 w-5" />
                Actividades
              </div>
              <div className="text-3xl font-bold text-indigo-600 mt-1">{summary?.totalNotes || 0}</div>
            </div>
            
            {/* Sin Contacto */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-yellow-500">
              <div className="text-gray-600 text-sm flex items-center gap-2">
                <span className="text-xl">🚫</span>
                Sin Contacto
              </div>
              <div className="text-3xl font-bold text-yellow-600 mt-1">{summary?.noContactLeads || 0}</div>
            </div>
            
            {/* Total Staff */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-purple-500">
              <div className="text-gray-600 text-sm flex items-center gap-2">
                <UserGroupIcon className="h-5 w-5" />
                Staff Activo
              </div>
              <div className="text-3xl font-bold text-purple-600 mt-1">{summary?.totalStaff || 0}</div>
              <div className="text-xs text-gray-500 mt-1">
                {summary?.avgNotesPerStaff || 0} promedio
              </div>
            </div>
          </div>
        </div>
        
        {/* Desglose por staff */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-lg font-bold mb-4">📊 Actividad por Staff</h3>
          
          {!staffActivity || staffActivity.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CalendarDaysIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>No hay actividad registrada para este mes</p>
            </div>
          ) : (
            <div className="space-y-6">
              {staffActivity.map((staff) => (
                <div key={staff.staffId} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  {/* Header del staff */}
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border-b">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-lg flex items-center gap-2">
                          👤 {staff.staffName}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {staff.totalNotes} actividades totales
                        </p>
                      </div>
                      
                      {/* Métricas clave */}
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          {staff.contactRate}%
                        </div>
                        <div className="text-xs text-gray-500">Tasa de Contacto</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Estadísticas */}
                  <div className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <PhoneIcon className="h-5 w-5 text-green-600 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-green-700">{staff.callsSuccessful}</div>
                        <div className="text-xs text-gray-600">Llamadas OK</div>
                      </div>
                      
                      <div className="bg-yellow-50 rounded-lg p-3 text-center">
                        <XCircleIcon className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-yellow-700">{staff.callsNoAnswer}</div>
                        <div className="text-xs text-gray-600">No Contestó</div>
                      </div>
                      
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <EnvelopeIcon className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-blue-700">{staff.emails}</div>
                        <div className="text-xs text-gray-600">Emails</div>
                      </div>
                      
                      <div className="bg-purple-50 rounded-lg p-3 text-center">
                        <UserGroupIcon className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-purple-700">{staff.meetings}</div>
                        <div className="text-xs text-gray-600">Reuniones</div>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <CheckCircleIcon className="h-5 w-5 text-gray-600 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-gray-700">{staff.followUps}</div>
                        <div className="text-xs text-gray-600">Seguimientos</div>
                      </div>
                    </div>
                    
                    {/* Desglose semanal */}
                    {staff.weeklyBreakdown && Object.keys(staff.weeklyBreakdown).length > 0 && (
                      <div className="border-t pt-3">
                        <h5 className="text-sm font-semibold mb-2 text-gray-700">📅 Actividad por Semana</h5>
                        <div className="grid grid-cols-4 gap-3">
                          {Object.entries(staff.weeklyBreakdown).map(([week, count]) => (
                            <div key={week} className="bg-purple-50 rounded-lg p-3 text-center">
                              <div className="text-xs font-medium text-gray-600 mb-1">{week}</div>
                              <div className="text-2xl font-bold text-purple-700">{count}</div>
                              <div className="text-xs text-gray-500">actividades</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonthlyActivityReport;
