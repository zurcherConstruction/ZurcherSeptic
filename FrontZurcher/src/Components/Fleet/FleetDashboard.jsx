import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  FaTruck,
  FaPlus,
  FaSearch,
  FaWrench,
  FaCheckCircle,
  FaExclamationTriangle,
  FaChartBar,
  FaFileExcel,
  FaPrint,
  FaCalendarAlt,
  FaShieldAlt,
  FaIdCard,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';
import { fetchFleetAssets, fetchFleetStats, fetchFleetUpcoming } from '../../Redux/Actions/fleetActions';
import FleetAssetCard from './FleetAssetCard';
import FleetAssetForm from './FleetAssetForm';
import api from '../../utils/axios';
import { formatDateOnly } from '../../utils/dateHelpers';

export default function FleetDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { assets, stats, loading, upcoming } = useSelector((state) => state.fleet);
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const [showForm, setShowForm] = useState(false);
  const [openSection, setOpenSection] = useState('registrations');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [printPeriod, setPrintPeriod] = useState('monthly');

  useEffect(() => {
    dispatch(fetchFleetAssets());
    dispatch(fetchFleetStats());
    dispatch(fetchFleetUpcoming(30));
  }, [dispatch]);

  const filtered = assets.filter((a) => {
    if (a.status === 'retired') return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterType && a.assetType !== filterType) return false;
    if (filterCompany && a.companyType !== filterCompany) return false;

    if (search) {
      const q = search.toLowerCase();
      const haystack = [a.name, a.brand, a.model, a.licensePlate, a.serialNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const now = new Date();
      const params = new URLSearchParams({ month: now.getMonth() + 1, year: now.getFullYear() });
      const response = await api.get(`/fleet/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Fleet_Report_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Error generando el reporte. Intenta nuevamente.');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  };

  const handlePrintReport = async () => {
    let reportData = null;
    try {
      const response = await api.get('/fleet/expense-report', {
        params: {
          period: printPeriod,
          year: currentYear,
          month: currentMonth,
        },
      });
      reportData = response.data?.data || null;
    } catch {
      alert('No se pudo obtener el detalle de gastos por activo para imprimir.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!printWindow) return;

    const now = new Date();
    const reportDate = now.toLocaleDateString('en-US');
    const monthLabel = now.toLocaleString('es', { month: 'long' });
    const periodLabel = printPeriod === 'yearly'
      ? `Anual ${currentYear}`
      : `Mensual ${monthLabel} ${currentYear}`;

    const rows = (reportData?.byAsset || []).map((a, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${a.assetName || ''}</td>
        <td>${a.assetType || ''}</td>
        <td>${a.licensePlate || a.serialNumber || ''}</td>
        <td>${a.company || ''}</td>
        <td>${a.expenseCount || 0}</td>
        <td>${formatCurrency(a.totalAmount || 0)}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Fleet Expense Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
            h1 { margin: 0 0 4px; }
            .meta { color: #6b7280; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
            .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
            .label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 700; }
            .value { font-size: 22px; font-weight: 700; margin-top: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Fleet Expense Report</h1>
          <div class="meta">Generado: ${reportDate} · Periodo: ${periodLabel}</div>

          <div class="grid">
            <div class="card">
              <div class="label">Total del período</div>
              <div class="value">${formatCurrency(reportData?.totalAmount || 0)}</div>
              <div>Transacciones: ${reportData?.totalTransactions || 0}</div>
            </div>
            <div class="card">
              <div class="label">Activos con gastos</div>
              <div class="value">${reportData?.byAsset?.length || 0}</div>
              <div>Detalle por vehículo/maquinaria</div>
            </div>
          </div>

          <h2>Detalle de Gasto Total por Vehículo/Máquina</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Activo</th>
                <th>Tipo</th>
                <th>Placa/Serie</th>
                <th>Empresa</th>
                <th>Transacciones</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="7">Sin gastos de flota en el período seleccionado.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const companyLabel = (item) => {
    if (item.companyType === 'zurcher') return 'ZURCHER';
    if (item.companyType === 'invertech') return 'INVERTECH';
    return item.companyOtherName || 'OTRA';
  };

  const urgencyClass = (days) => {
    if (days <= 7) return { bar: 'bg-red-500', badge: 'bg-red-100 text-red-700 border-red-200', label: 'URGENTE' };
    if (days <= 30) return { bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700 border-orange-200', label: `${days}d` };
    return { bar: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: `${days}d` };
  };

  const fmtDate = (d) => {
    if (!d) return '';
    const formatted = formatDateOnly(d, 'MM-DD-YYYY');
    return formatted === 'N/A' ? '' : formatted;
  };

  const AlertRow = ({ item, onClick }) => {
    const u = urgencyClass(item.daysLeft);
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group"
      >
        <div className={`w-1 h-10 rounded-full flex-shrink-0 ${u.bar}`} />

        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
          {item.imageUrl
            ? <img src={item.imageUrl} alt="" className="w-full h-full object-contain" />
            : <FaTruck className="text-gray-400 text-sm" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-700 transition-colors">
            {item.name}
            {item.maintenanceType && <span className="text-xs font-normal text-gray-400 ml-1">- {item.maintenanceType}</span>}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {companyLabel(item)} - {item.plate} - {fmtDate(item.date)}
          </p>
        </div>

        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${u.badge}`}>
          {u.label}
        </span>
      </div>
    );
  };

  const totalAlerts = upcoming
    ? (upcoming.registrations?.length || 0) + (upcoming.insurances?.length || 0) + (upcoming.services?.length || 0)
    : 0;

  const sections = upcoming ? [
    {
      key: 'registrations',
      label: 'Placas / Registracion',
      icon: FaIdCard,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      items: upcoming.registrations || [],
    },
    {
      key: 'insurances',
      label: 'Poliza de Seguro',
      icon: FaShieldAlt,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      items: upcoming.insurances || [],
    },
    {
      key: 'services',
      label: 'Proximos Services',
      icon: FaWrench,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      items: upcoming.services || [],
    },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-6 md:py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <FaTruck className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Fleet & Equipment</h1>
              <p className="text-blue-100 text-sm mt-0.5">Control de vehiculos, maquinas y equipos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={printPeriod}
              onChange={(e) => setPrintPeriod(e.target.value)}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-3 py-2.5 rounded-xl font-semibold text-sm shadow transition-colors"
            >
              <option value="monthly" className="text-gray-900">Mensual</option>
              <option value="yearly" className="text-gray-900">Anual</option>
            </select>
            <button
              onClick={handlePrintReport}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 px-4 py-2.5 rounded-xl font-semibold text-sm shadow transition-colors"
            >
              <FaPrint /> Imprimir Reporte
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 px-4 py-2.5 rounded-xl font-semibold text-sm shadow transition-colors disabled:opacity-60"
            >
              <FaFileExcel /> {exporting ? 'Exportando...' : 'Exportar Excel'}
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 px-5 py-2.5 rounded-xl font-semibold text-sm shadow transition-colors"
            >
              <FaPlus /> Agregar Activo
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <FaChartBar className="text-blue-600 text-xl" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Total</p>
                <p className="text-3xl font-bold text-gray-800">{stats.totalAssets}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-xl">
                <FaCheckCircle className="text-green-600 text-xl" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Operativos</p>
                <p className="text-3xl font-bold text-green-600">{stats.activeAssets}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex items-center gap-4">
              <div className="bg-amber-100 p-3 rounded-xl">
                <FaWrench className="text-amber-600 text-xl" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">En Taller</p>
                <p className="text-3xl font-bold text-amber-600">{stats.inRepair}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-xl">
                <FaExclamationTriangle className="text-orange-600 text-xl" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Prox. Service</p>
                <p className="text-3xl font-bold text-orange-600">{stats.upcomingMaintenance}</p>
              </div>
            </div>
          </div>
        )}

        {stats?.fleetExpenses && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Gasto Vehículos/Máquinas Mensual</p>
              <p className="text-2xl font-bold text-sky-700 mt-2">{formatCurrency(stats.fleetExpenses.monthly?.amount)}</p>
              <p className="text-sm text-gray-500 mt-1">{stats.fleetExpenses.monthly?.count || 0} transacciones en {String(stats.fleetExpenses.monthly?.month || currentMonth).padStart(2, '0')}/{stats.fleetExpenses.monthly?.year || currentYear}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Gasto Vehículos/Máquinas Anual</p>
              <p className="text-2xl font-bold text-sky-700 mt-2">{formatCurrency(stats.fleetExpenses.yearly?.amount)}</p>
              <p className="text-sm text-gray-500 mt-1">{stats.fleetExpenses.yearly?.count || 0} transacciones en {stats.fleetExpenses.yearly?.year || currentYear}</p>
            </div>
          </div>
        )}

        {upcoming && totalAlerts > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
              <FaCalendarAlt className="text-blue-500" />
              <h2 className="font-bold text-gray-700 text-sm flex-1">Proximos Vencimientos y Services</h2>
              <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full border border-red-200">
                {totalAlerts} {totalAlerts === 1 ? 'alerta' : 'alertas'} - prox. 30 dias
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              {sections.map((sec) => {
                const Icon = sec.icon;
                const isOpen = openSection === sec.key;
                return (
                  <div key={sec.key}>
                    <button
                      onClick={() => setOpenSection(isOpen ? null : sec.key)}
                      className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className={`p-2 rounded-lg ${sec.bg}`}>
                        <Icon className={`text-sm ${sec.color}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-xs font-semibold text-gray-700">{sec.label}</p>
                        <p className="text-xs text-gray-400">{sec.items.length} {sec.items.length === 1 ? 'activo' : 'activos'}</p>
                      </div>
                      {sec.items.length > 0 && (
                        isOpen ? <FaChevronUp className="text-gray-400 text-xs" /> : <FaChevronDown className="text-gray-400 text-xs" />
                      )}
                    </button>
                    {isOpen && sec.items.length > 0 && (
                      <div className="px-2 pb-3 border-t border-gray-50">
                        {sec.items.map((item, i) => (
                          <AlertRow
                            key={`${item.assetId}-${item.maintenanceId || i}`}
                            item={item}
                            onClick={() => navigate(`/fleet/${item.assetId}`)}
                          />
                        ))}
                      </div>
                    )}
                    {sec.items.length === 0 && (
                      <div className="px-4 pb-3 text-xs text-gray-400 italic">Sin vencimientos proximos</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="flex-1 min-w-[180px] relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, marca, placa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="">Todas las empresas</option>
              <option value="zurcher">ZURCHER</option>
              <option value="invertech">INVERTECH</option>
              <option value="other">OTRA</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="">Todos los tipos</option>
              <option value="vehicle">Vehiculos</option>
              <option value="machine">Maquinaria</option>
              <option value="equipment">Equipos</option>
              <option value="trailer">Remolques</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="">Todos los estados</option>
              <option value="active">Operativos</option>
              <option value="in_repair">En Taller</option>
              <option value="inactive">Inactivos</option>
            </select>
            {(search || filterCompany || filterType || filterStatus) && (
              <button
                onClick={() => {
                  setSearch('');
                  setFilterCompany('');
                  setFilterType('');
                  setFilterStatus('');
                }}
                className="px-4 py-2.5 text-sm text-gray-500 hover:text-red-600 border border-gray-200 rounded-xl bg-gray-50 hover:bg-red-50 hover:border-red-200 transition-colors font-medium"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {filtered.length > 0 && (
          <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">
            {filtered.length} {filtered.length === 1 ? 'activo' : 'activos'}
            {(filterCompany || filterType || filterStatus || search) && ' (filtrado)'}
          </p>
        )}

        {loading && assets.length === 0 ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaTruck className="text-3xl text-blue-300" />
            </div>
            {(filterCompany || filterType || filterStatus || search) ? (
              <>
                <p className="text-lg font-semibold text-gray-600">Sin resultados para los filtros aplicados</p>
                <button
                  onClick={() => {
                    setSearch('');
                    setFilterCompany('');
                    setFilterType('');
                    setFilterStatus('');
                  }}
                  className="mt-4 text-sm text-blue-600 hover:underline"
                >
                  Limpiar filtros
                </button>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-gray-600">No hay activos registrados</p>
                <p className="text-sm text-gray-400 mt-1">Agrega el primer vehiculo o maquina de la flota</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-5 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium"
                >
                  <FaPlus /> Agregar Activo
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((asset) => (
              <FleetAssetCard
                key={asset.id}
                asset={asset}
                onClick={() => navigate(`/fleet/${asset.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <FleetAssetForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            dispatch(fetchFleetAssets({}, { force: true }));
            dispatch(fetchFleetStats({ force: true }));
            dispatch(fetchFleetUpcoming(30, { force: true }));
          }}
        />
      )}
    </div>
  );
}
