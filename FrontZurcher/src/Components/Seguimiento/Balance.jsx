import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { balanceActions } from '../../Redux/Actions/balanceActions';
import ExpandableCard from './ExpandableCard';
import { 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  format,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isValid,
  parseISO
} from 'date-fns';
import './Balance.css';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const formatExpenseTypeLabel = (label) => {
  if (label === 'Gasto Flota') return 'Gasto Vehículos/Máquinas';
  return label;
};

const Balance = () => {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailAnalysis, setDetailAnalysis] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // CORREGIR: Inicializar con fechas válidas
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    };
  });
  
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    profit: 0,
    profitMargin: 0
  });

  // Configurar rangos de fechas según el período
  const setupDateRange = (selectedPeriod) => {
    const now = new Date();
    let start, end;

    switch (selectedPeriod) {
      case 'week':
        start = startOfWeek(now);
        end = endOfWeek(now);
        break;
      case 'biweekly':
        start = subDays(now, 14);
        end = now;
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'year':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }

    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    };
  };

  // Obtener datos financieros
// Obtener datos financieros - MEJORADO
const fetchFinancialData = async (selectedPeriod) => {
  setLoading(true);
  setLoadingDetails(true);
  try {
    const range = setupDateRange(selectedPeriod);
    setDateRange(range);

    const filters = {
      startDate: range.start,
      endDate: range.end,
      type: '',
      typeIncome: '',
      typeExpense: '',
      staffId: ''
    };

    // Obtener datos generales del balance
    const response = await balanceActions.getGeneralBalance(filters);
    
    if (response && !response.error) {
      setData(response);
      
      // MEJORAR: Asegurar que los valores sean números
      const totalIncome = parseFloat(response.totalIncome || 0);
      const totalExpense = parseFloat(response.totalExpense || 0);
      const profit = totalIncome - totalExpense;
      const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;
      
      setSummary({
        totalIncome,
        totalExpense,
        profit,
        profitMargin
      });
    } else {
      // AGREGAR: Manejo de errores de la API
      console.error('Error in API response:', response?.message);
      setData(null);
      setSummary({
        totalIncome: 0,
        totalExpense: 0,
        profit: 0,
        profitMargin: 0
      });
    }

    // 🎯 NUEVO: Obtener análisis detallado para las tarjetas expandibles
    const detailFilters = {
      startDate: range.start,
      endDate: range.end
    };

    const detailResponse = await balanceActions.getDetailAnalysis(detailFilters);
    
    if (detailResponse && !detailResponse.error) {
      setDetailAnalysis(detailResponse);
    } else {
      console.error('Error in detail analysis:', detailResponse?.message);
      setDetailAnalysis(null);
    }

  } catch (error) {
    console.error('Error fetching financial data:', error);
    setData(null);
    setSummary({
      totalIncome: 0,
      totalExpense: 0,
      profit: 0,
      profitMargin: 0
    });
    setDetailAnalysis(null);
  } finally {
    setLoading(false);
    setLoadingDetails(false);
  }
};

  useEffect(() => {
    fetchFinancialData(period);
  }, [period]);

  // CORREGIR: Función auxiliar para validar fechas
  const isValidDate = (dateString) => {
    if (!dateString) return false;
    const date = parseISO(dateString);
    return isValid(date);
  };

  // CORREGIR: Función auxiliar para formatear fechas de manera segura
  const safeFormatDate = (dateString, formatString) => {
    if (!isValidDate(dateString)) return 'Fecha inválida';
    try {
      return format(parseISO(dateString), formatString);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Fecha inválida';
    }
  };

  // Procesar datos para gráficos de línea (tendencia temporal)
const processTimeSeriesData = () => {
  // MEJORAR: Verificar la estructura de datos
  if (!data?.list) {
   
    return null;
  }
  
  if (!isValidDate(dateRange.start) || !isValidDate(dateRange.end)) {
    
    return null;
  }

  // MEJORAR: Manejar diferentes estructuras de respuesta
  const incomes = data.list.incomes || data.incomes || [];
  const expenses = data.list.expenses || data.expenses || [];
  
 
  
  try {
      // Crear intervalos de tiempo según el período
      let intervals = [];
      const start = parseISO(dateRange.start);
      const end = parseISO(dateRange.end);

      if (!isValid(start) || !isValid(end)) {
        console.error('Invalid date range:', dateRange);
        return null;
      }

      switch (period) {
        case 'week':
        case 'biweekly':
          intervals = eachDayOfInterval({ start, end });
          break;
        case 'month':
          intervals = eachWeekOfInterval({ start, end });
          break;
        case 'year':
          intervals = eachMonthOfInterval({ start, end });
          break;
      }

      const labels = intervals.map(date => {
        switch (period) {
          case 'week':
          case 'biweekly':
            return format(date, 'dd/MM');
          case 'month':
            return format(date, 'dd/MM');
          case 'year':
            return format(date, 'MMM yyyy');
          default:
            return format(date, 'dd/MM');
        }
      });

      // Agrupar datos por intervalos
      const incomeData = new Array(intervals.length).fill(0);
      const expenseData = new Array(intervals.length).fill(0);

      incomes.forEach(income => {
        if (!income.date) return;
        const incomeDate = parseISO(income.date);
        if (!isValid(incomeDate)) return;

        const intervalIndex = intervals.findIndex(interval => {
          if (period === 'year') {
            return format(incomeDate, 'yyyy-MM') === format(interval, 'yyyy-MM');
          } else if (period === 'month') {
            return incomeDate >= interval && incomeDate < new Date(interval.getTime() + 7 * 24 * 60 * 60 * 1000);
          } else {
            return format(incomeDate, 'yyyy-MM-dd') === format(interval, 'yyyy-MM-dd');
          }
        });
        
        if (intervalIndex >= 0) {
          incomeData[intervalIndex] += parseFloat(income.amount || 0);
        }
      });

      expenses.forEach(expense => {
        if (!expense.date) return;
        const expenseDate = parseISO(expense.date);
        if (!isValid(expenseDate)) return;

        const intervalIndex = intervals.findIndex(interval => {
          if (period === 'year') {
            return format(expenseDate, 'yyyy-MM') === format(interval, 'yyyy-MM');
          } else if (period === 'month') {
            return expenseDate >= interval && expenseDate < new Date(interval.getTime() + 7 * 24 * 60 * 60 * 1000);
          } else {
            return format(expenseDate, 'yyyy-MM-dd') === format(interval, 'yyyy-MM-dd');
          }
        });
        
        if (intervalIndex >= 0) {
          expenseData[intervalIndex] += parseFloat(expense.amount || 0);
        }
      });

      const profitData = incomeData.map((income, index) => income - expenseData[index]);

   return {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: incomeData,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.1,
          fill: false,
        },
        {
          label: 'Gastos',
          data: expenseData,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.1,
          fill: false,
        },
        {
          label: 'Ganancia',
          data: profitData,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.1,
          fill: false,
        }
      ]
    };
  } catch (error) {
    console.error('Error processing time series data:', error);
    return null;
  }
};

  // Datos para gráfico de barras por categorías
  const getCategoryData = () => {
    if (!data?.details) return null;

    const incomeCategories = data.details.incomes || [];
    const expenseCategories = data.details.expenses || [];

    return {
      labels: [
        ...incomeCategories.map(cat => cat.name),
        ...expenseCategories.map(cat => formatExpenseTypeLabel(cat.name)),
      ],
      datasets: [
        {
          label: 'Ingresos por Categoría',
          data: [...incomeCategories.map(cat => cat.value), ...new Array(expenseCategories.length).fill(0)],
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
        },
        {
          label: 'Gastos por Categoría',
          data: [...new Array(incomeCategories.length).fill(0), ...expenseCategories.map(cat => cat.value)],
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
        }
      ]
    };
  };

  // Datos para gráfico de dona (distribución)
  const getDistributionData = () => {
    if (!summary.totalIncome && !summary.totalExpense) return null;

    return {
      labels: ['Ingresos', 'Gastos'],
      datasets: [
        {
          data: [summary.totalIncome, summary.totalExpense],
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',
            'rgba(239, 68, 68, 0.8)',
          ],
          borderColor: [
            'rgb(34, 197, 94)',
            'rgb(239, 68, 68)',
          ],
          borderWidth: 2,
        }
      ]
    };
  };

  // Formatear moneda
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Opciones para los gráficos
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Análisis Financiero'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return formatCurrency(value);
          }
        }
      }
    }
  };

  const timeSeriesData = processTimeSeriesData();
  const categoryData = getCategoryData();
  const distributionData = getDistributionData();

  return (
    <div className="balance-dashboard">
      <div className="dashboard-header">
       
        
        {/* Selector de período */}
        <div className="period-selector">
          <button 
            className={period === 'week' ? 'active' : ''}
            onClick={() => setPeriod('week')}
          >
            Semana
          </button>
          <button 
            className={period === 'biweekly' ? 'active' : ''}
            onClick={() => setPeriod('biweekly')}
          >
            Quincena
          </button>
          <button 
            className={period === 'month' ? 'active' : ''}
            onClick={() => setPeriod('month')}
          >
            Mes
          </button>
          <button 
            className={period === 'year' ? 'active' : ''}
            onClick={() => setPeriod('year')}
          >
            Año
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Cargando datos financieros...</div>
      ) : (
        <>
          {/* Resumen de estadísticas */}
          <div className="stats-summary">
            <div className="stat-card income">
              <h3>Total Ingresos</h3>
              <p className="amount">{formatCurrency(summary.totalIncome)}</p>
            </div>
            <div className="stat-card expense">
              <h3>Total Gastos</h3>
              <p className="amount">{formatCurrency(summary.totalExpense)}</p>
            </div>
            <div className={`stat-card profit ${summary.profit >= 0 ? 'positive' : 'negative'}`}>
              <h3>Ganancia</h3>
              <p className="amount">{formatCurrency(summary.profit)}</p>
            </div>
            <div className="stat-card margin">
              <h3>Margen de Ganancia</h3>
              <p className="amount">{summary.profitMargin.toFixed(1)}%</p>
            </div>
          </div>

          {/* 🎯 NUEVA SECCIÓN: Análisis Detallado por Tarjetas Expandibles */}
          {!loadingDetails && detailAnalysis && (
            <>
              {/* Análisis por Método de Pago */}
              <div className="detail-analysis-section">
                <h2>📊 Análisis por Método de Pago</h2>
                <p className="section-description">
                  Detalle expandible de gastos agrupados por método de pago. Click en cada tarjeta para ver todos los gastos.
                </p>
                <div className="expandable-cards-container">
                  {detailAnalysis.paymentMethods?.map((method, index) => (
                    <ExpandableCard
                      key={`payment-${index}`}
                      title={`💳 ${method.method}`}
                      totalAmount={method.totalAmount}
                      paidAmount={method.paidAmount}
                      unpaidAmount={method.unpaidAmount}
                      totalCount={method.totalCount}
                      paidCount={method.paidCount}
                      unpaidCount={method.unpaidCount}
                      items={method.expenses}
                      type="paymentMethod"
                    />
                  ))}
                </div>
              </div>

              {/* Análisis por Tipo de Gasto */}
              <div className="detail-analysis-section">
                <h2>📋 Análisis por Tipo de Gasto</h2>
                <p className="section-description">
                  Detalle expandible de gastos agrupados por categoría/tipo. Click en cada tarjeta para ver todos los gastos.
                </p>
                <div className="expandable-cards-container">
                  {detailAnalysis.expenseTypes?.map((type, index) => (
                    <ExpandableCard
                      key={`type-${index}`}
                      title={`📂 ${formatExpenseTypeLabel(type.type)}`}
                      totalAmount={type.totalAmount}
                      paidAmount={type.paidAmount}
                      unpaidAmount={type.unpaidAmount}
                      totalCount={type.totalCount}
                      paidCount={type.paidCount}
                      unpaidCount={type.unpaidCount}
                      items={type.expenses}
                      type="expenseType"
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {loadingDetails && (
            <div className="loading">Cargando análisis detallado...</div>
          )}

          {/* Gráficos */}
          <div className="charts-container">
            {/* Gráfico de tendencia temporal */}
            {timeSeriesData && (
              <div className="chart-wrapper">
                <h3>Tendencia Temporal</h3>
                <div className="chart">
                  <Line data={timeSeriesData} options={chartOptions} />
                </div>
              </div>
            )}

            {/* Gráfico por categorías */}
            {categoryData && (
              <div className="chart-wrapper">
                <h3>Por Categorías</h3>
                <div className="chart">
                  <Bar data={categoryData} options={chartOptions} />
                </div>
              </div>
            )}

            {/* Gráfico de distribución */}
            {distributionData && (
              <div className="chart-wrapper small">
                <h3>Distribución</h3>
                <div className="chart">
                  <Doughnut 
                    data={distributionData} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                        }
                      }
                    }} 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Información del período - CORREGIR: Usar safeFormatDate */}
          <div className="period-info">
            <p>
              Mostrando datos desde <strong>{safeFormatDate(dateRange.start, 'dd/MM/yyyy')}</strong> 
              hasta <strong>{safeFormatDate(dateRange.end, 'dd/MM/yyyy')}</strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default Balance;