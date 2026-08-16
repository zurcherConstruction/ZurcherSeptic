import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { bankAccountActions, bankTransactionActions } from '../../Redux/Actions/bankAccountActions';
import {
  FaArrowLeft, 
  FaArrowUp, 
  FaArrowDown, 
  FaExchangeAlt,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaFileInvoice,
  FaReceipt,
  FaPlus
} from 'react-icons/fa';

const BankAccountDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter') || 'all';
  const setFilter = (v) => setSearchParams(p => { if (v === 'all') p.delete('filter'); else p.set('filter', v); return p; });

  useEffect(() => {
    if (id) {
      fetchAccountDetails();
      fetchTransactions();
    }
  }, [id]);

  const fetchAccountDetails = async () => {
    try {
      const response = await bankAccountActions.getById(id);
      if (response.error) {
        toast.error(response.message || 'Error al cargar los detalles de la cuenta');
      } else {
        setAccount(response.account);
      }
    } catch (error) {
      console.error('Error fetching account:', error);
      toast.error('Error al cargar los detalles de la cuenta');
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await bankTransactionActions.getByAccount(id);
      if (response.error) {
        toast.error(response.message || 'Error al cargar las transacciones');
      } else {
        setTransactions(response.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Error al cargar las transacciones');
    } finally {
      setLoading(false);
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
    
    // Si es un string en formato YYYY-MM-DD, parsearlo sin conversión UTC
    if (typeof dateString === 'string' && dateString.includes('-')) {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day); // Crear Date con valores locales
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    
    // Fallback para otros formatos
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit':
        return <FaArrowDown className="text-green-600" />;
      case 'withdrawal':
        return <FaArrowUp className="text-red-600" />;
      case 'transfer_in':
      case 'transfer_out':
      case 'transfer':
        return <FaExchangeAlt className="text-blue-600" />;
      default:
        return <FaMoneyBillWave className="text-gray-600" />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'deposit':
        return 'bg-green-50 border-green-200';
      case 'withdrawal':
        return 'bg-red-50 border-red-200';
      case 'transfer_in':
      case 'transfer_out':
      case 'transfer':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getTransactionLabel = (type) => {
    switch (type) {
      case 'deposit':
        return 'Depósito';
      case 'withdrawal':
        return 'Retiro';
      case 'transfer_in':
        return 'Transferencia (Entrada)';
      case 'transfer_out':
        return 'Transferencia (Salida)';
      case 'transfer':
        return 'Transferencia';
      default:
        return 'Transacción';
    }
  };

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'transfer') {
      return t.transactionType === 'transfer' || 
             t.transactionType === 'transfer_in' || 
             t.transactionType === 'transfer_out';
    }
    return t.transactionType === filter;
  });

  if (loading && !account) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando detalles de la cuenta...</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Cuenta no encontrada</p>
          <button
            onClick={() => navigate('/bank-accounts')}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/bank-accounts')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition-colors"
        >
          <FaArrowLeft />
          Volver al Dashboard
        </button>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{account.accountName}</h1>
              <p className="text-blue-100">
                {account.accountType === 'checking' ? 'Cuenta Corriente' : 'Cuenta de Ahorros'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-blue-100 text-sm mb-1">Balance Actual</p>
              <p className="text-5xl font-bold">{formatCurrency(account.currentBalance)}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-blue-500">
            <div>
              <p className="text-blue-200 text-sm mb-1">Total Depósitos</p>
              <p className="text-2xl font-bold">{formatCurrency(account.totalDeposits || 0)}</p>
            </div>
            <div>
              <p className="text-blue-200 text-sm mb-1">Total Retiros</p>
              <p className="text-2xl font-bold">{formatCurrency(account.totalWithdrawals || 0)}</p>
            </div>
            <div>
              <p className="text-blue-200 text-sm mb-1">Transacciones</p>
              <p className="text-2xl font-bold">{transactions.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('deposit')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'deposit'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Depósitos
          </button>
          <button
            onClick={() => setFilter('withdrawal')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'withdrawal'
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Retiros
          </button>
          <button
            onClick={() => setFilter('transfer')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'transfer'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Transferencias
          </button>
        </div>

        <button
          onClick={() => navigate('/bank-accounts/new-transaction', { state: { accountId: id } })}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <FaPlus />
          Nueva Transacción
        </button>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">
            Historial de Transacciones ({filteredTransactions.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando transacciones...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <FaMoneyBillWave className="text-6xl text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              No hay transacciones
            </h3>
            <p className="text-gray-600">
              {filter === 'all' 
                ? 'Aún no hay movimientos en esta cuenta'
                : `No hay ${getTransactionLabel(filter).toLowerCase()}s registrados`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.idTransaction}
                className={`p-6 hover:bg-gray-50 transition-colors border-l-4 ${
                  transaction.transactionType === 'deposit' || transaction.transactionType === 'transfer_in'
                    ? 'border-l-green-500'
                    : transaction.transactionType === 'withdrawal' || transaction.transactionType === 'transfer_out'
                    ? 'border-l-red-500'
                    : 'border-l-blue-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`p-3 rounded-lg ${getTransactionColor(transaction.transactionType)}`}>
                      {getTransactionIcon(transaction.transactionType)}
                    </div>

                    {/* Details */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold text-sm px-2 py-1 rounded ${
                          transaction.transactionType === 'deposit' || transaction.transactionType === 'transfer_in'
                            ? 'bg-green-100 text-green-700'
                            : transaction.transactionType === 'withdrawal' || transaction.transactionType === 'transfer_out'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {getTransactionLabel(transaction.transactionType)}
                        </span>
                      </div>
                      <p className="text-gray-800 font-medium mb-1">
                        {transaction.description}
                      </p>
                      {transaction.notes && (
                        <p className="text-sm text-gray-600 mb-2">{transaction.notes}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <FaCalendarAlt className="text-xs" />
                          {formatDate(transaction.date)}
                        </div>
                        <span>•</span>
                        <span>{formatTime(transaction.createdAt)}</span>
                        {transaction.createdBy && (
                          <>
                            <span>•</span>
                            <span className="text-gray-600">
                              Por: {transaction.createdBy.name}
                            </span>
                          </>
                        )}
                        {transaction.relatedIncomeId && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1 text-blue-600">
                              <FaFileInvoice className="text-xs" />
                              <span>Income</span>
                            </div>
                          </>
                        )}
                        {transaction.relatedExpenseId && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1 text-red-600">
                              <FaReceipt className="text-xs" />
                              <span>Expense</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${
                      transaction.transactionType === 'deposit' || transaction.transactionType === 'transfer_in'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {(transaction.transactionType === 'deposit' || transaction.transactionType === 'transfer_in') ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Balance: {formatCurrency(transaction.balanceAfter)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BankAccountDetail;
