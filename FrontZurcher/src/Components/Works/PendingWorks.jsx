import React, { useState, useEffect } from "react";
import { useDispatch, useSelector }  from "react-redux";
import { fetchWorks, updateWork } from "../../Redux/Actions/workActions";
import { fetchSimpleWorks, updateSimpleWork } from "../../Redux/Actions/simpleWorkActions";
import { fetchStaff } from "../../Redux/Actions/adminActions";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { Calendar as BigCalendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "moment-timezone";
import "react-big-calendar/lib/css/react-big-calendar.css";
import socket from "../../utils/io";
import logo from "../../assets/logoseptic.png";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { UserIcon, CalendarDaysIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { XMarkIcon, CalendarDaysIcon as CalendarIcon } from "@heroicons/react/24/outline";

const PendingWorks = () => {
  const dispatch = useDispatch();
  const { works } = useSelector((state) => state.work);
  const { simpleWorks } = useSelector((state) => state.simpleWork);
  const { staffList: staff, loading: staffLoading, error: staffError } = useSelector((state) => state.admin);
  
  // ✅ Obtener el rol del usuario para permisos
  const { user, currentStaff } = useSelector((state) => state.auth);
  const authStaff = currentStaff || user;
  const userRole = authStaff?.role || '';
  
  // ✅ Solo owner y recept pueden editar, admin solo ve
  const canEdit = userRole === 'owner' || userRole === 'recept' || userRole === 'capataz';
  const isReadOnly = !canEdit;

  const [selectedWork, setSelectedWork] = useState(null);
  const [selectedType, setSelectedType] = useState('work'); // 'work' o 'simpleWork'
  const [startDate, setStartDate] = useState(new Date());
  const [selectedStaff, setSelectedStaff] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const localizer = momentLocalizer(moment);

  // ✅ Función para verificar si un trabajo tiene permiso vencido
  const hasExpiredPermit = (work) => {
    const permit = work?.Permit; // El Permit está directamente en work, no en budget
    if (!permit) return false;
    return permit.expirationStatus === 'expired';
  };

  // Filtrar trabajos
  // Mostrar trabajos pending solo si:
  // El budget está en estado 'approved' (ya tiene firma + pago inicial)
  // ✅ EXCLUIR trabajos de mantenimiento (status legacy_maintenance)
  const pendingWorks = works.filter((work) => {
    if (work.status === "pending") {
      const budget = work.budget;
      if (!budget) return false;
      
      // ✅ Excluir mantenimiento legacy
      if (budget.status === 'legacy_maintenance') return false;
      
      // ✅ SIMPLIFICADO: Budget 'approved' = Firmado + Pago completo
      // El hook Budget.beforeUpdate ya manejó la transición signed → approved
      return budget.status === 'approved';
    }
    return false;
  });
  
  // ✅ EXCLUIR trabajos de mantenimiento de assigned e inProgress también
  const assignedWorks = works.filter((work) => 
    work.status === "assigned" && work.budget?.status !== 'legacy_maintenance'
  );
  const inProgressWorks = works.filter((work) => 
    work.status === "inProgress" && work.budget?.status !== 'legacy_maintenance'
  );

  // ✅ SimpleWorks filtrados por estado
  const pendingSimpleWorks = (simpleWorks || []).filter((sw) => sw.status === 'approved');
  const assignedSimpleWorks = (simpleWorks || []).filter((sw) => sw.status === 'in_progress' && sw.assignedStaffId);

  useEffect(() => {
    dispatch(fetchStaff());
    dispatch(fetchWorks(1, 'all')); // ✅ Obtener todos los trabajos para gestión completa
    dispatch(fetchSimpleWorks({ status: 'all', limit: 100 })); // ⚡ OPTIMIZADO: Reducido de 500 a 100
  }, [dispatch]);

  // Cuando seleccionas un trabajo, carga sus datos actuales
  useEffect(() => {
    if (selectedWork) {
      if (selectedType === 'simpleWork') {
        setStartDate(selectedWork.startDate ? moment(selectedWork.startDate).toDate() : new Date());
        setSelectedStaff(selectedWork.assignedStaffId || "");
        setEditMode(['approved', 'in_progress'].includes(selectedWork.status));
      } else {
        setStartDate(selectedWork.startDate ? moment(selectedWork.startDate).toDate() : new Date());
        setSelectedStaff(selectedWork.staffId || "");
        setEditMode(['pending', 'assigned', 'inProgress'].includes(selectedWork.status));
      }
    } else {
      setEditMode(false);
    }
  }, [selectedWork, selectedType]);

  // ✅ Helpers para seleccionar Work o SimpleWork
  const handleSelectWork = (work) => {
    setSelectedWork(work);
    setSelectedType('work');
  };
  const handleSelectSimpleWork = (sw) => {
    setSelectedWork(sw);
    setSelectedType('simpleWork');
  };

  const handleAssignOrUpdate = async () => {
    if (!selectedWork || !selectedStaff) {
      toast.error("Por favor selecciona un trabajo y un miembro del staff.");
      return;
    }

    // ✅ Validar permiso vencido solo para Works regulares
    if (selectedType === 'work' && hasExpiredPermit(selectedWork)) {
      toast.error("No se puede asignar este trabajo porque el permiso está vencido. Por favor, renueva el permiso primero.");
      return;
    }

    // Tomar la fecha seleccionada del calendario y enviarla como string YYYY-MM-DD sin conversión de zona horaria
    let rawDate;
    if (startDate instanceof Date) {
      // Si es un objeto Date, formatear a YYYY-MM-DD
      rawDate = startDate.toISOString().split('T')[0];
    } else if (typeof startDate === 'string') {
      // Si ya es string (de react-calendar), usar tal cual
      rawDate = startDate;
    } else {
      // Fallback: usar moment
      rawDate = moment(startDate).format('YYYY-MM-DD');
    }
    try {
      if (selectedType === 'simpleWork') {
        // ✅ Asignar SimpleWork
        await dispatch(
          updateSimpleWork(selectedWork.id, {
            startDate: rawDate,
            assignedStaffId: selectedStaff,
            assignedDate: rawDate,
            status: "in_progress",
          })
        );
        toast.success(editMode ? "SimpleWork modificado correctamente." : "SimpleWork asignado correctamente.");
        dispatch(fetchSimpleWorks({ status: 'all' })); // Refrescar lista
      } else {
        // ✅ Asignar Work regular
        await dispatch(
          updateWork(selectedWork.idWork, {
            startDate: rawDate,
            staffId: selectedStaff,
            status: "assigned",
          })
        );
        toast.success(editMode ? "Asignación modificada correctamente." : "Trabajo asignado correctamente.");
      }
      setSelectedWork(null);
      setSelectedStaff("");
    } catch (error) {
      console.error("Error al asignar/modificar el trabajo:", error);
      toast.error("Hubo un error al guardar la asignación.");
    }
  };

  // Nueva función para suspender/cancelar trabajo
  const handleCancelWork = async () => {
    if (!selectedWork) return;
    if (!window.confirm("¿Seguro que deseas suspender/cancelar este trabajo?")) return;
    try {
      if (selectedType === 'simpleWork') {
        await dispatch(
          updateSimpleWork(selectedWork.id, {
            status: "cancelled",
          })
        );
        dispatch(fetchSimpleWorks({ status: 'all' }));
      } else {
        await dispatch(
          updateWork(selectedWork.idWork, {
            ...selectedWork,
            status: "cancelled",
          })
        );
      }
      toast.success("Trabajo suspendido/cancelado correctamente.");
      setSelectedWork(null);
      setSelectedStaff("");
    } catch (error) {
      console.error("Error al cancelar el trabajo:", error);
      toast.error("Hubo un error al cancelar el trabajo.");
    }
  };

  const events = [
    // ✅ Works regulares
    ...works
      .filter((work) => {
        if (!work.startDate || hasExpiredPermit(work)) return false;
        if (work.status === 'maintenance' || work.budget?.status === 'legacy_maintenance') return false;
        return true;
      })
      .map((work) => {
        const staffMember = staff.find((member) => member.id === work.staffId);
        const staffName = staffMember ? staffMember.name : "Sin asignar";
        const startMiami = moment.tz(work.startDate, "America/New_York").toDate();
        return {
          title: `${work.propertyAddress} - (${staffName})`,
          start: startMiami,
          end: startMiami,
          work,
          eventType: 'work',
        };
      }),
    // ✅ SimpleWorks con fecha asignada
    ...(simpleWorks || [])
      .filter((sw) => sw.startDate && sw.assignedStaffId)
      .map((sw) => {
        const staffMember = staff.find((member) => member.id === sw.assignedStaffId);
        const staffName = staffMember ? staffMember.name : "Sin asignar";
        const startMiami = moment.tz(sw.startDate, "America/New_York").toDate();
        return {
          title: `⚡ ${sw.propertyAddress || sw.workType || 'SimpleWork'} - (${staffName})`,
          start: startMiami,
          end: startMiami,
          work: sw,
          eventType: 'simpleWork',
        };
      }),
  ];

  const eventStyleGetter = (event) => {
    if (event.eventType === 'simpleWork') {
      return {
        style: {
          backgroundColor: "#f97316", // naranja para SimpleWorks
          color: "white",
          borderRadius: "5px",
          padding: "5px",
          textAlign: "center",
          border: "2px solid #ea580c",
        },
      };
    }
    return {
      style: {
        backgroundColor: event.work.status === "assigned" ? "#2563eb" : "#4CAF50",
        color: "white",
        borderRadius: "5px",
        padding: "5px",
        textAlign: "center",
        border: event.work.status === "assigned" ? "2px solid #1d4ed8" : "2px solid #22c55e",
      },
    };
  };
  const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  return (
    <div className="p-4 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <h1 className="text-2xl font-bold mb-6 text-blue-900 flex items-center gap-2">
        <CalendarDaysIcon className="h-7 w-7 text-blue-500" />
        Gestión de Asignaciones
      </h1>
      <div className="flex flex-col md:flex-row gap-6">
        {/* Panel izquierdo: Trabajos pendientes y asignados */}
        <div className="w-full md:w-1/3 bg-white shadow-xl rounded-xl p-4 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Trabajos Pendientes</h2>
          {pendingWorks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40">
              <img src={logo} alt="No pending works" className="w-24 h-24 mb-2" />
              <p className="text-md font-medium text-gray-400">No hay trabajos pendientes</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {pendingWorks.map((work) => {
                const isExpired = hasExpiredPermit(work);
                return (
                  <li
                    key={work.idWork}
                    className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-blue-50 ${
                      selectedType === 'work' && selectedWork?.idWork === work.idWork ? "bg-blue-100 border-blue-400" : "bg-gray-50"
                    } ${isExpired ? "border-red-400 bg-red-50" : ""}`}
                    onClick={() => handleSelectWork(work)}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-blue-700">{work.propertyAddress}</span>
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">Pendiente</span>
                      </div>
                      {isExpired && (
                        <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
                          <XCircleIcon className="h-4 w-4" />
                          <span>Permiso Vencido - No se puede asignar</span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Trabajos Asignados</h2>
          {assignedWorks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20">
              <XCircleIcon className="h-8 w-8 text-gray-300 mb-1" />
              <p className="text-md font-medium text-gray-400">No hay trabajos asignados</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {assignedWorks.map((work) => (
                <li
                  key={work.idWork}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-blue-50 ${selectedType === 'work' && selectedWork?.idWork === work.idWork ? "bg-blue-100 border-blue-400" : "bg-gray-50"}`}
                  onClick={() => handleSelectWork(work)}
                >
                  <span className="font-semibold text-blue-700">{work.propertyAddress}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">Asignado</span>
                  <span className="ml-2 text-xs text-gray-500">{work.startDate ? moment.tz(work.startDate, "America/New_York").format("MM-DD-YYYY HH:mm") : "Sin fecha"}</span>
                </li>
              ))}
            </ul>
          )}
          <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Trabajos En Progreso</h2>
          {inProgressWorks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20">
              <XCircleIcon className="h-8 w-8 text-gray-300 mb-1" />
              <p className="text-md font-medium text-gray-400">No hay trabajos en progreso</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {inProgressWorks.map((work) => (
                <li
                  key={work.idWork}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-blue-50 ${selectedType === 'work' && selectedWork?.idWork === work.idWork ? "bg-blue-100 border-blue-400" : "bg-gray-50"}`}
                  onClick={() => handleSelectWork(work)}
                >
                  <span className="font-semibold text-blue-700">{work.propertyAddress}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">En Progreso</span>
                  <span className="ml-2 text-xs text-gray-500">{work.startDate ? moment.tz(work.startDate, "America/New_York").format("MM-DD-YYYY HH:mm") : "Sin fecha"}</span>
                </li>
              ))}
            </ul>
          )}

          {/* ✅ SECCION SIMPLEWORKS */}
          <div className="border-t-2 border-orange-200 mt-6 pt-4">
            <h2 className="text-lg font-semibold text-orange-700 mb-2 flex items-center gap-2">
              <WrenchScrewdriverIcon className="h-5 w-5 text-orange-500" />
              SimpleWorks Pendientes
            </h2>
            {pendingSimpleWorks.length === 0 && assignedSimpleWorks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-20">
                <XCircleIcon className="h-8 w-8 text-gray-300 mb-1" />
                <p className="text-md font-medium text-gray-400">No hay SimpleWorks pendientes</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {/* ✅ Pendientes (Aprobados) - Color verde/azul */}
                {pendingSimpleWorks.map((sw) => (
                  <li
                    key={sw.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-blue-50 ${
                      selectedType === 'simpleWork' && selectedWork?.id === sw.id ? "bg-blue-100 border-blue-400" : "bg-blue-50 border-blue-200"
                    }`}
                    onClick={() => handleSelectSimpleWork(sw)}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-blue-700">{sw.propertyAddress || sw.workType || 'Sin dirección'}</span>
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-200 text-blue-800 font-medium">⚡ Aprobado</span>
                      </div>
                      {sw.workType && (
                        <span className="text-xs text-gray-600">{sw.workType}</span>
                      )}
                    </div>
                  </li>
                ))}
                
                {/* ✅ Asignados (En Progreso) - Color amarillo/naranja */}
                {assignedSimpleWorks.map((sw) => (
                  <li
                    key={sw.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-yellow-50 ${
                      selectedType === 'simpleWork' && selectedWork?.id === sw.id ? "bg-yellow-100 border-yellow-500" : "bg-yellow-50 border-yellow-300"
                    }`}
                    onClick={() => handleSelectSimpleWork(sw)}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-yellow-800">{sw.propertyAddress || sw.workType || 'Sin dirección'}</span>
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-yellow-300 text-yellow-900 font-medium">⚡ En Progreso</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {sw.workType && (
                          <span className="text-xs text-gray-600">{sw.workType}</span>
                        )}
                        {sw.startDate && (
                          <span className="text-xs text-gray-500">• {moment.tz(sw.startDate, "America/New_York").format("MM-DD-YYYY")}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {/* Panel central: Detalle y asignación/modificación */}
        <div className="flex-1 bg-white shadow-xl rounded-xl p-6 flex flex-col gap-4">
          {!selectedWork ? (
            <div className="flex flex-col items-center justify-center h-full py-16">
              <UserIcon className="h-16 w-16 text-blue-200 mb-4" />
              <p className="text-lg text-gray-500 font-medium">Selecciona un trabajo para asignar o modificar</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-blue-800 mb-2 flex items-center gap-2">
                {selectedType === 'simpleWork' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-medium">⚡ SimpleWork</span>
                )}
                {selectedWork.propertyAddress || selectedWork.workType || 'Sin dirección'}
                {selectedType === 'work' && selectedWork.status === "assigned" ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                ) : selectedType === 'simpleWork' && selectedWork.status === "in_progress" ? (
                  <CheckCircleIcon className="h-5 w-5 text-orange-500" />
                ) : (
                  <ArrowPathIcon className="h-5 w-5 text-yellow-500" />
                )}
              </h2>

              {/* ✅ Alerta de permiso vencido - solo para Works regulares */}
              {selectedType === 'work' && hasExpiredPermit(selectedWork) && (
                <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <XCircleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-red-700 uppercase">Permiso Vencido</h3>
                      <p className="text-sm text-red-600 mt-1">
                        {selectedWork.Permit?.expirationMessage || 
                         'Este trabajo no puede ser asignado hasta que se renueve el permiso.'}
                      </p>
                      <p className="text-xs text-red-500 mt-2">
                        Por favor, actualiza el permiso en la sección de Budgets antes de asignar este trabajo.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de instalación</label>
                  <Calendar
                    onChange={setStartDate}
                    value={startDate}
                    minDate={getToday()}
                    className={`rounded-lg border border-gray-200 shadow-sm ${
                      isReadOnly ? 'opacity-60 pointer-events-none' : ''
                    }`}
                    tileDisabled={isReadOnly ? () => true : undefined}
                  />
                  {isReadOnly && (
                    <p className="text-xs text-gray-500 mt-2">⚠️ View only - No edit permissions</p>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Miembro del staff asignado</label>
                  {staffLoading && <p>Cargando miembros del staff...</p>}
                  {staffError && <p className="text-red-500">Error: {staffError}</p>}
                  {!staffLoading && !staffError && (
                    <>
                      <select
                        value={selectedStaff}
                        onChange={(e) => setSelectedStaff(e.target.value)}
                        disabled={isReadOnly}
                        className={`border p-2 rounded w-full focus:ring-2 focus:ring-blue-400 ${
                          isReadOnly ? 'bg-gray-100 cursor-not-allowed' : 'bg-gray-50'
                        }`}
                      >
                        <option value="">Selecciona un miembro del staff</option>
                        {staff.filter(member => member.role === 'worker').map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      {isReadOnly && (
                        <p className="text-xs text-gray-500 mt-2">⚠️ View only - No edit permissions</p>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAssignOrUpdate}
                  className={`flex-1 py-3 rounded-lg font-semibold text-white transition-all duration-200 ${
                    !selectedWork || !selectedStaff || isReadOnly || (selectedType === 'work' && hasExpiredPermit(selectedWork))
                      ? "bg-gray-300 cursor-not-allowed"
                      : selectedType === 'simpleWork' 
                        ? "bg-orange-500 hover:bg-orange-600 shadow-md hover:scale-[1.02]"
                        : "bg-blue-600 hover:bg-blue-700 shadow-md hover:scale-[1.02]"
                  }`}
                  disabled={!selectedWork || !selectedStaff || isReadOnly || (selectedType === 'work' && hasExpiredPermit(selectedWork))}
                  title={
                    selectedType === 'work' && hasExpiredPermit(selectedWork) 
                      ? "No se puede asignar - Permiso vencido" 
                      : isReadOnly 
                      ? "View only - No edit permissions" 
                      : ""
                  }
                >
                  {editMode ? "Guardar cambios" : selectedType === 'simpleWork' ? "Asignar SimpleWork" : "Asignar trabajo"}
                </button>
                <button
                  onClick={() => setSelectedWork(null)}
                  className="flex-1 py-3 rounded-lg font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-all duration-200"
                >
                  Cancelar
                </button>
                {/* Botón para suspender/cancelar trabajo */}
                {selectedWork && selectedWork.status !== "cancelled" && (
                  <button
                    onClick={handleCancelWork}
                    disabled={isReadOnly}
                    className={`flex-1 py-3 text-xs rounded-lg font-semibold border transition-all duration-200 ${
                      isReadOnly
                        ? 'bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed'
                        : 'bg-red-500 hover:bg-red-600 text-white border-red-600'
                    }`}
                    title={isReadOnly ? "View only - No edit permissions" : "Cancelar trabajo"}
                  >
                    Cancelar trabajo
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {/* Botón para abrir el calendario en modal */}
        <div className="flex flex-col justify-center items-center md:items-end md:justify-start">
          <button
            onClick={() => setCalendarOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md font-semibold transition-all duration-200"
          >
            <CalendarIcon className="h-5 w-5" />
            Ver calendario
          </button>
        </div>
      </div>
      {/* Modal del calendario (React puro) - ✅ RESPONSIVE */}
      {calendarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-2 sm:p-4">
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col">
            {/* Header fijo con botón cerrar */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b flex-shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-blue-800 flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                  Calendario de trabajos
                </h2>
                {/* Leyenda de colores */}
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-600"></span> Asignado</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-500"></span> En Progreso</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-500"></span> ⚡ SimpleWork</span>
                </div>
              </div>
              <button
                onClick={() => setCalendarOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1"
                aria-label="Cerrar calendario"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            {/* Contenedor del calendario con scroll */}
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              <div className="min-w-[600px]" style={{ height: 'max(500px, 60vh)' }}>
                <BigCalendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: '100%' }}
                  eventPropGetter={eventStyleGetter}
                  messages={{
                    next: 'Siguiente',
                    previous: 'Anterior',
                    today: 'Hoy',
                    month: 'Mes',
                    week: 'Semana',
                    day: 'Día',
                    agenda: 'Agenda',
                    date: 'Fecha',
                    time: 'Hora',
                    event: 'Trabajo',
                    noEventsInRange: 'No hay trabajos en este rango.',
                    showMore: (total) => `+ Ver ${total} más`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PendingWorks;