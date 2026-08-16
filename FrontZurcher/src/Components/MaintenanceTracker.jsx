import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchMaintenanceWorks } from "../Redux/Actions/workActions";
import { Link, useSearchParams } from "react-router-dom";

const MaintenanceTracker = () => {
  const dispatch = useDispatch();
  const { works, loading, error } = useSelector((state) => state.work);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearchState] = useState(searchParams.get('q') || '');
  const setSearch = (v) => { setSearchState(v); setSearchParams(p => { if (v) p.set('q', v); else p.delete('q'); return p; }, { replace: true }); };
  const [filteredData, setFilteredData] = useState([]);
  const hasFetched = useRef(false);

  // ✅ Fetch inicial solo una vez (endpoint optimizado para maintenance)
  useEffect(() => {
    if (!hasFetched.current) {
      console.log('📊 [MaintenanceTracker] Cargando works en mantenimiento...');
      hasFetched.current = true;
      dispatch(fetchMaintenanceWorks()); // Endpoint optimizado
    }
  }, []);

  // ✅ Refresco automático cada 10 min
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log('🔄 [MaintenanceTracker] Auto-refresh maintenance works...');
      dispatch(fetchMaintenanceWorks()); // Endpoint optimizado
    }, 600000); // 10 minutos

    return () => {
      console.log('🛑 [MaintenanceTracker] Limpiando interval...');
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (works) {
      // Ya vienen filtrados del backend (solo maintenance)
      const maintenanceWorks = works;

      // Filtrar por búsqueda
      const filtered = maintenanceWorks.filter((work) =>
        work.propertyAddress?.toLowerCase().includes(search.toLowerCase())
      );
      // Ordenar por próxima visita programada (más cercana primero)
      const sorted = filtered.sort((a, b) => {
        const getNextVisitDate = (work) => {
          if (!work.maintenanceVisits || work.maintenanceVisits.length === 0) {
            return new Date('9999-12-31'); // Sin visitas va al final
          }

          // Encontrar la próxima visita futura o la más reciente
          const now = new Date();
          const futureVisits = work.maintenanceVisits
            .filter(v => v.scheduledDate && new Date(v.scheduledDate) >= now)
            .sort((x, y) => new Date(x.scheduledDate) - new Date(y.scheduledDate));

          if (futureVisits.length > 0) {
            return new Date(futureVisits[0].scheduledDate);
          }

          // Si no hay visitas futuras, ordenar por la última visita
          const lastVisit = work.maintenanceVisits
            .sort((x, y) => new Date(y.scheduledDate || y.createdAt) - new Date(x.scheduledDate || x.createdAt))[0];
          
          return new Date(lastVisit.scheduledDate || lastVisit.createdAt);
        };

        return getNextVisitDate(a) - getNextVisitDate(b);
      });

      setFilteredData(sorted);
    } else {
      setFilteredData([]);
    }
  }, [works, search]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  const getNextVisitInfo = (work) => {
    if (!work.maintenanceVisits || work.maintenanceVisits.length === 0) {
      return { visitNumber: 0, date: null, isPast: false };
    }

    const now = new Date();
    const futureVisits = work.maintenanceVisits
      .filter(v => v.scheduledDate && new Date(v.scheduledDate) >= now)
      .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

    if (futureVisits.length > 0) {
      const nextVisit = futureVisits[0];
      return {
        visitNumber: nextVisit.visitNumber || work.maintenanceVisits.findIndex(v => v.id === nextVisit.id) + 1,
        date: nextVisit.scheduledDate,
        status: nextVisit.status,
        isPast: false
      };
    }

    // Si no hay visitas futuras, mostrar la última
    const lastVisit = work.maintenanceVisits
      .sort((a, b) => new Date(b.actualVisitDate || b.scheduledDate || b.createdAt) - new Date(a.actualVisitDate || a.scheduledDate || a.createdAt))[0];

    return {
      visitNumber: lastVisit.visitNumber || work.maintenanceVisits.length,
      date: lastVisit.actualVisitDate || lastVisit.scheduledDate || lastVisit.createdAt,
      status: lastVisit.status,
      isPast: true
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDaysUntil = (dateString) => {
    if (!dateString) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateString);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDateBadge = (dateString, isPast) => {
    if (!dateString) return null;

    if (isPast) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
          Last visit
        </span>
      );
    }

    const days = getDaysUntil(dateString);
    
    if (days < 0) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 font-semibold">
          Overdue ({Math.abs(days)} days)
        </span>
      );
    } else if (days === 0) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 font-semibold">
          Today
        </span>
      );
    } else if (days <= 7) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 font-semibold">
          In {days} days
        </span>
      );
    } else if (days <= 30) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
          In {days} days
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
          {formatDate(dateString)}
        </span>
      );
    }
  };

  return (
    <div className="max-w-7xl p-2 mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">🔧 Maintenance Tracker</h1>
        <p className="text-gray-600">
          {filteredData.length} {filteredData.length === 1 ? 'property' : 'properties'} in maintenance
        </p>
      </div>

      <input
        type="text"
        placeholder="Search by Address"
        value={search}
        onChange={handleSearch}
        className="border border-gray-300 p-2 md:p-3 mb-6 w-full rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading && <p className="text-blue-500 text-center">Loading maintenance works...</p>}
      {error && <p className="text-red-500 text-center">Error: {error}</p>}

      {!loading && !error && filteredData.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No maintenance works found</p>
        </div>
      )}

      {!loading && !error && filteredData.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Property Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visit #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next/Last Visit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((work) => {
                const { idWork, propertyAddress } = work;
                const visitInfo = getNextVisitInfo(work);

                return (
                  <tr key={idWork} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {propertyAddress || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {visitInfo.visitNumber > 0 ? (
                          <span className="font-semibold text-blue-600">
                            Visit #{visitInfo.visitNumber}
                          </span>
                        ) : (
                          <span className="text-gray-400">No visits</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(visitInfo.date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getDateBadge(visitInfo.date, visitInfo.isPast)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <Link
                        to={`/work/${idWork}`}
                        className="inline-block px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Work Detail
                      </Link>
                      <Link
                        to="/maintenance/works"
                        state={{ selectedWorkId: idWork }}
                        className="inline-block px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Visits
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MaintenanceTracker;
