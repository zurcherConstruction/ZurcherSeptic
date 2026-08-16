import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { bankAccountActions, bankTransactionActions } from '../../Redux/Actions/bankAccountActions';
import {
  FaArrowLeft,
  FaFilePdf,
  FaFileExcel,
  FaSearch,
  FaArrowUp,
  FaArrowDown,
  FaExchangeAlt,
  FaCalendarAlt
} from 'react-icons/fa';

const BankAccountMonthlyReport = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1));
  const year  = parseInt(searchParams.get('year')  || new Date().getFullYear());
  const setMonth = (m) => setSearchParams(prev => { prev.set('month', String(m)); return prev; });
  const setYear  = (y) => setSearchParams(prev => { prev.set('year',  String(y)); return prev; });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);

  const months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let i = currentYear; i >= currentYear - 5; i--) {
    years.push(i);
  }

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await bankAccountActions.getAll();
      if (response.error) {
        toast.error(response.message || 'Error al cargar las cuentas');
      } else {
        const activeAccounts = response.accounts?.filter(acc => acc.isActive) || [];
        setAccounts(activeAccounts);
        if (activeAccounts.length > 0) {
          setSelectedAccount(activeAccounts[0].idBankAccount);
        }
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Error al cargar las cuentas bancarias');
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedAccount) {
      toast.error('Selecciona una cuenta bancaria');
      return;
    }

    try {
      setLoading(true);
      const response = await bankTransactionActions.getMonthlyReport(selectedAccount, month, year);
      
      if (response.error) {
        toast.error(response.message || 'Error al generar el reporte');
        setReportData(null);
      } else {
        setReportData(response.data);
        toast.success('Reporte generado exitosamente');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Error al generar el reporte');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedAccount) {
      toast.error('Selecciona una cuenta bancaria');
      return;
    }

    try {
      setLoadingPDF(true);
      const response = await bankTransactionActions.downloadMonthlyReportPDF(selectedAccount, month, year);
      
      if (response.error) {
        toast.error(response.message || 'Error al descargar el PDF');
      } else {
        toast.success('PDF descargado exitosamente');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Error al descargar el PDF');
    } finally {
      setLoadingPDF(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!selectedAccount) {
      toast.error('Selecciona una cuenta bancaria');
      return;
    }

    try {
      setLoadingExcel(true);
      const response = await bankTransactionActions.downloadMonthlyReportExcel(selectedAccount, month, year);
      
      if (response.error) {
        toast.error(response.message || 'Error al descargar el Excel');
      } else {
        toast.success('Excel descargado exitosamente');
      }
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Error al descargar el Excel');
    } finally {
      setLoadingExcel(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    if (typeof dateString === 'string' && dateString.includes('-')) {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit':
        return <FaArrowUp className="text-green-500" />;
      case 'withdrawal':
        return <FaArrowDown className="text-red-500" />;
      case 'transfer_in':
        return <FaExchangeAlt className="text-blue-500 rotate-90" />;
      case 'transfer_out':
        return <FaExchangeAlt className="text-orange-500 -rotate-90" />;
      default:
        return <FaCalendarAlt className="text-gray-500" />;
    }
  };

  const getTransactionLabel = (type) => {
    const labels = {
      deposit: 'Depósito',
      withdrawal: 'Retiro',
      transfer_in: 'Transfer IN',
      transfer_out: 'Transfer OUT'
    };
    return labels[type] || type;
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'deposit':
        return 'text-green-600';
      case 'withdrawal':
        return 'text-red-600';
      case 'transfer_in':
        return 'text-blue-600';
      case 'transfer_out':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  const selectedAccountData = accounts.find(acc => acc.idBankAccount === selectedAccount);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/bank-accounts')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FaArrowLeft className="text-xl" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Reportes Mensuales</h1>
              <p className="text-gray-600 mt-1">Visualiza y descarga reportes de tus cuentas bancarias</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FaCalendarAlt className="text-blue-600" />
            Seleccionar Período
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Selector de Cuenta */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cuenta Bancaria
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {accounts.map(account => (
                  <option key={account.idBankAccount} value={account.idBankAccount}>
                    {account.accountName} - {formatCurrency(account.currentBalance)}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Mes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mes
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Año */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Año
              </label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {years.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Botón Generar */}
            <div className="flex items-end">
              <button
                onClick={handleGenerateReport}
                disabled={loading || !selectedAccount}
                className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Generando...
                  </>
                ) : (
                  <>
                    <FaSearch />
                    Generar Reporte
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Reporte */}
        {reportData && (
          <>
            {/* Resumen */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">
                  Resumen - {reportData.summary.accountName} ({reportData.summary.monthName} {reportData.summary.year})
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadPDF}
                    disabled={loadingPDF}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                  >
                    {loadingPDF ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <FaFilePdf />
                    )}
                    PDF
                  </button>
                  <button
                    onClick={handleDownloadExcel}
                    disabled={loadingExcel}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                  >
                    {loadingExcel ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <FaFileExcel />
                    )}
                    Excel
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Balance Inicial</p>
                  <p className="text-xl font-semibold">{formatCurrency(reportData.summary.initialBalance)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Depósitos</p>
                  <p className="text-xl font-semibold text-green-600">{formatCurrency(reportData.summary.totalDeposits)}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Retiros</p>
                  <p className="text-xl font-semibold text-red-600">{formatCurrency(reportData.summary.totalWithdrawals)}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Balance Final</p>
                  <p className="text-xl font-semibold text-blue-600">{formatCurrency(reportData.summary.finalBalance)}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Cambio Neto</p>
                  <p className={`text-xl font-semibold ${reportData.summary.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(reportData.summary.netChange)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Transacciones</p>
                  <p className="text-xl font-semibold">{reportData.summary.totalTransactions}</p>
                </div>
              </div>
            </div>

            {/* Tabla de Transacciones */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold">Transacciones del Período</h2>
              </div>

              {reportData.transactions.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <p className="text-lg">No hay transacciones en este período</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Monto
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Balance
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Descripción
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Creado Por
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.transactions.map((tx) => {
                        const isCredit = tx.transactionType === 'deposit' || tx.transactionType === 'transfer_in';
                        return (
                          <tr key={tx.idBankTransaction} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(tx.date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {getTransactionIcon(tx.transactionType)}
                                <span className={`text-sm font-medium ${getTransactionColor(tx.transactionType)}`}>
                                  {getTransactionLabel(tx.transactionType)}
                                </span>
                              </div>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                              {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                              {formatCurrency(tx.balanceAfterTransaction)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                              {tx.description || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {tx.createdBy 
                                ? tx.createdBy.name
                                : 'N/A'
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Estado vacío cuando no hay reporte */}
        {!reportData && !loading && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <FaCalendarAlt className="mx-auto text-6xl text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Selecciona un período
            </h3>
            <p className="text-gray-500">
              Selecciona una cuenta, mes y año, luego haz clic en "Generar Reporte"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankAccountMonthlyReport;
