const { Op, Sequelize } = require('sequelize');
const { Budget, Income, Expense, SupplierInvoice, FixedExpense, FixedExpensePayment, BankTransaction, BankAccount, Staff } = require('../data');

const FinancialDashboardController = {
  /**
   * Obtener dashboard financiero simplificado - SOLO Expenses como fuente única
   */
  async getFinancialDashboard(req, res) {
    try {
      // 🚫 PREVENIR CACHÉ - Headers críticos + timestamp único
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, private, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${timestamp}-${randomId}"`,
        'Vary': 'Accept-Encoding',
        'X-Timestamp': timestamp.toString(),
        'X-Cache-Buster': randomId,
        'Surrogate-Control': 'no-store',
        'Clear-Site-Data': '"cache"'
      });
      
      const { startDate, endDate, month, year } = req.query;

      // 🚨 FECHA MÍNIMA: Solo contar transacciones desde el 1 de diciembre 2025 en adelante
      const MINIMUM_DATE = '2025-12-01';
      const minimumDateObj = new Date(MINIMUM_DATE);
      minimumDateObj.setHours(0, 0, 0, 0);

      // Construir filtro de fechas
      let dateFilter = {};
      let filterDescription = '';
      
      if (startDate && endDate) {
        const effectiveStartDate = new Date(startDate) >= minimumDateObj ? startDate : MINIMUM_DATE;
        
        dateFilter = {
          [Op.and]: [
            { createdAt: { [Op.gte]: new Date(effectiveStartDate) } },
            { createdAt: { [Op.lte]: new Date(endDate + 'T23:59:59') } }
          ]
        };
        filterDescription = `Rango: ${effectiveStartDate} a ${endDate} (mínimo: ${MINIMUM_DATE})`;
      } else if (month && year) {
        const monthNum = parseInt(month, 10);
        const yearNum = parseInt(year, 10);
        
        if (monthNum < 1 || monthNum > 12 || isNaN(monthNum) || isNaN(yearNum)) {
          return res.status(400).json({ error: 'Invalid month or year parameters' });
        }
        
        let firstDay = new Date(`${yearNum}-${String(monthNum).padStart(2, '0')}-01T00:00:00.000Z`);
        
        const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
        const nextYear = monthNum === 12 ? yearNum + 1 : yearNum;
        const lastDay = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`);
        lastDay.setMilliseconds(lastDay.getMilliseconds() - 1);
        
        if (firstDay < minimumDateObj) {
          firstDay = minimumDateObj;
        }
        
        dateFilter = {
          [Op.and]: [
            { createdAt: { [Op.gte]: firstDay } },
            { createdAt: { [Op.lte]: lastDay } }
          ]
        };
        filterDescription = `MES ESPECÍFICO: ${monthNum}/${yearNum} (${firstDay.toISOString().split('T')[0]} a ${lastDay.toISOString().split('T')[0]})`;
      } else {
        dateFilter = {
          createdAt: { [Op.gte]: minimumDateObj }
        };
        filterDescription = `Desde ${MINIMUM_DATE} en adelante (datos reales)`;
      }

      // =============================================================
      // 1. INGRESOS (Income como fuente única)
      // =============================================================
      const incomeFilter = {
        date: { [Op.gte]: MINIMUM_DATE }
      };
      
      if (startDate && endDate) {
        const effectiveStartDate = new Date(startDate) >= minimumDateObj ? startDate : MINIMUM_DATE;
        incomeFilter.date = {
          [Op.between]: [effectiveStartDate, endDate]
        };
      } else if (month && year) {
        const monthStr = String(month).padStart(2, '0');
        const yearMonth = `${year}-${monthStr}`;
        const firstDayStr = `${yearMonth}-01`;
        
        if (firstDayStr < MINIMUM_DATE) {
          incomeFilter.date = {
            [Op.and]: [
              { [Op.gte]: MINIMUM_DATE },
              { [Op.like]: `${yearMonth}%` }
            ]
          };
        } else {
          incomeFilter.date = {
            [Op.like]: `${yearMonth}%`
          };
        }
      }

      const allIncomes = await Income.findAll({
        where: incomeFilter,
        attributes: ['amount', 'paymentMethod', 'typeIncome', 'date'],
        include: [{
          model: require('../data').Work,
          as: 'work',
          attributes: ['propertyAddress', 'notes'],
          required: false
        }]
      });

      const totalIncome = allIncomes.reduce((sum, inc) => 
        sum + parseFloat(inc.amount || 0), 0
      );

      const initialPaymentsCount = allIncomes.filter(inc => inc.typeIncome === 'Factura Pago Inicial Budget').length;
      const finalPaymentsCount = allIncomes.filter(inc => inc.typeIncome === 'Factura Pago Final Budget').length;

      // Desglose de ingresos por método de pago
      const incomeByPaymentMethod = {};
      
      allIncomes.forEach(income => {
        const method = income.paymentMethod || 'No especificado';
        const amount = parseFloat(income.amount || 0);
        incomeByPaymentMethod[method] = (incomeByPaymentMethod[method] || 0) + amount;
      });

      // =============================================================
      // 2. GASTOS - FUENTE ÚNICA: SOLO EXPENSES PAID
      // =============================================================
      
      // Filtro de fechas para expenses (usan campo 'date' string YYYY-MM-DD)
      const expenseFilter = {
        paymentStatus: { [Op.in]: ['paid', 'paid_via_invoice', 'paid_via_credit_card', 'partial'] }, // Dashboard: solo gastos pagados
        date: { [Op.gte]: MINIMUM_DATE }
      };
      
      if (startDate && endDate) {
        const effectiveStartDate = new Date(startDate) >= minimumDateObj ? startDate : MINIMUM_DATE;
        expenseFilter.date = { [Op.between]: [effectiveStartDate, endDate] };
      } else if (month && year) {
        const monthNum = parseInt(month, 10);
        const yearNum = parseInt(year, 10);
        const monthStr = String(monthNum).padStart(2, '0');
        const yearMonth = `${yearNum}-${monthStr}`;
        const firstDayStr = `${yearMonth}-01`;
        
        if (firstDayStr < MINIMUM_DATE) {
          expenseFilter.date = {
            [Op.and]: [
              { [Op.gte]: MINIMUM_DATE },
              { [Op.like]: `${yearMonth}%` }
            ]
          };
        } else {
          expenseFilter.date = { [Op.like]: `${yearMonth}%` };
        }
      }

      const allExpenses = await Expense.findAll({
        where: expenseFilter,
        attributes: [
          'idExpense', 'amount', 'typeExpense', 'paymentMethod', 'date', 'notes', 
          'supplierInvoiceItemId', 'relatedFixedExpenseId', 'workId', 'paymentStatus',
          'vendor', 'paymentDetails', 'verified'
        ],
        include: [
          {
            model: FixedExpense,
            as: 'fixedExpense',
            attributes: ['name', 'description', 'category'],
            required: false
          },
          {
            model: require('../data').Work,
            as: 'work',
            attributes: ['propertyAddress', 'notes'],
            required: false
          },
          {
            model: require('../data').SimpleWork,
            as: 'simpleWork',
            attributes: ['id', 'workNumber', 'propertyAddress', 'workType'],
            required: false
          }
        ],
        order: [['date', 'DESC']]
      });

      // Desglose por método de pago
      const expensesByPaymentMethod = {};
      
      allExpenses.forEach(expense => {
        const method = expense.paymentMethod || 'No especificado';
        const amount = parseFloat(expense.amount || 0);
        if (!expensesByPaymentMethod[method]) expensesByPaymentMethod[method] = 0;
        expensesByPaymentMethod[method] += amount;
      });

      // Desglose por typeExpense para categorización visual
      const expensesByType = {};
      
      allExpenses.forEach(expense => {
        const type = expense.typeExpense || 'Sin Clasificar';
        const amount = parseFloat(expense.amount || 0);
        if (!expensesByType[type]) {
          expensesByType[type] = { total: 0, count: 0 };
        }
        expensesByType[type].total += amount;
        expensesByType[type].count++;
      });

      // =============================================================
      // 3. CLASIFICACIÓN VISUAL (para compatibilidad con frontend)
      // =============================================================
      
      // Simular categorías visuales basadas en typeExpense
      const materialesiniciales = expensesByType['Materiales Iniciales'] || { total: 0, count: 0 };
      const materiales = expensesByType['Materiales'] || { total: 0, count: 0 };
      const gastosfijos = expensesByType['Gasto Fijo'] || { total: 0, count: 0 };
      const inspeccion = expensesByType['Inspección Inicial'] || { total: 0, count: 0 };
      const gastosGenerales = expensesByType['Gastos Generales'] || { total: 0, count: 0 };
      const comisiones = expensesByType['Comisión Vendedor'] || { total: 0, count: 0 };

      // =============================================================
      // 4. RESUMEN PARA EL FRONTEND
      // =============================================================

      const response = {
        success: true,
        data: {
          period: filterDescription,
          
          // Totales principales
          summary: {
            totalIncome: totalIncome,
            totalEgresos: totalExpenses, // 🎯 FUENTE ÚNICA
            balanceNeto: totalIncome - totalExpenses,
            efficiency: totalExpenses > 0 ? ((totalIncome / totalExpenses) * 100) : 0
          },

          // Conteos
          counts: {
            incomeCount: allIncomes.length,
            expensesCount: allExpenses.length, // 🎯 FUENTE ÚNICA
            initialPaymentsCount: initialPaymentsCount,
            finalPaymentsCount: finalPaymentsCount,
            
            // Para compatibilidad visual (categorías basadas en typeExpense)
            fixedExpensesCount: gastosfijos.count,
            supplierExpensesCount: materiales.count,
            commissionsCount: comisiones.count
          },

          // Desglose de ingresos
          incomeByPaymentMethod: Object.entries(incomeByPaymentMethod).map(([method, amount]) => ({
            method,
            amount: parseFloat(amount)
          })),

          // Desglose de gastos por método de pago
          expensesByPaymentMethod: Object.entries(expensesByPaymentMethod).map(([method, amount]) => ({
            method,
            amount: parseFloat(amount)
          })),

          // Detalles de ingresos
          incomeDetails: allIncomes.map(income => ({
            id: income.idIncome,
            amount: parseFloat(income.amount),
            date: income.date,
            type: income.typeIncome,
            notes: income.notes,
            paymentMethod: income.paymentMethod,
            workId: income.workId,
            propertyAddress: income.work?.propertyAddress || 'Sin dirección',
            workNotes: income.work?.notes || 'Sin notas'
          })),

          // 🎯 Categorización visual (basada en typeExpense)
          visualCategories: {
            'Materiales Iniciales': {
              total: materialesiniciales.total,
              count: materialesiniciales.count
            },
            'Materiales': {
              total: materiales.total,
              count: materiales.count
            },
            'Gastos Fijos': {
              total: gastosfijos.total,
              count: gastosfijos.count
            },
            'Inspección Inicial': {
              total: inspeccion.total,
              count: inspeccion.count
            },
            'Gastos Generales': {
              total: gastosGenerales.total,
              count: gastosGenerales.count
            },
            'Comisiones': {
              total: comisiones.total,
              count: comisiones.count
            }
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('❌ Error in financial dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener dashboard financiero',
        error: error.message
      });
    }
  },

  /**
   * Obtener dashboard financiero DETALLADO - SOLO Expenses como fuente única
   */
  async getDetailedFinancialDashboard(req, res) {
    try {
      // 🚫 PREVENIR CACHÉ - Headers críticos + timestamp único
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, private, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${timestamp}-${randomId}"`,
        'X-Timestamp': timestamp.toString(),
        'X-Cache-Buster': randomId,
        'Surrogate-Control': 'no-store'
      });

      const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.query;

      // 🚨 FECHA MÍNIMA
      const MINIMUM_DATE = '2025-12-01';

      // =============================================================
      // 1. INGRESOS DETALLADOS
      // =============================================================
      
      const incomeFilter = {
        date: { [Op.gte]: MINIMUM_DATE }
      };

      if (month && year) {
        const monthStr = String(month).padStart(2, '0');
        const yearMonth = `${year}-${monthStr}`;
        const firstDayStr = `${yearMonth}-01`;
        
        if (firstDayStr < MINIMUM_DATE) {
          incomeFilter.date = {
            [Op.and]: [
              { [Op.gte]: MINIMUM_DATE },
              { [Op.like]: `${yearMonth}%` }
            ]
          };
        } else {
          incomeFilter.date = { [Op.like]: `${yearMonth}%` };
        }
      }

      const allIncomes = await Income.findAll({
        where: incomeFilter,
        include: [{
          model: require('../data').Work,
          as: 'work',
          attributes: ['propertyAddress', 'notes'],
          required: false
        }],
        order: [['date', 'DESC']]
      });

      // =============================================================
      // 2. GASTOS DETALLADOS - FUENTE ÚNICA: SOLO EXPENSES PAID
      // =============================================================

      const expenseFilter = {
        paymentStatus: { [Op.in]: ['paid', 'paid_via_invoice', 'paid_via_credit_card', 'partial'] }, // Dashboard: solo gastos pagados
        date: { [Op.gte]: MINIMUM_DATE }
      };

      if (month && year) {
        const monthStr = String(month).padStart(2, '0');
        const yearMonth = `${year}-${monthStr}`;
        const firstDayStr = `${yearMonth}-01`;
        
        if (firstDayStr < MINIMUM_DATE) {
          expenseFilter.date = {
            [Op.and]: [
              { [Op.gte]: MINIMUM_DATE },
              { [Op.like]: `${yearMonth}%` }
            ]
          };
        } else {
          expenseFilter.date = { [Op.like]: `${yearMonth}%` };
        }
      }

      const allExpenses = await Expense.findAll({
        where: expenseFilter,
        include: [
          {
            model: require('../data').Work,
            as: 'work',
            attributes: ['propertyAddress', 'notes'],
            required: false
          },
          {
            model: require('../data').FixedExpense,
            as: 'fixedExpense',
            attributes: ['name', 'description', 'category'],
            required: false
          },
          {
            model: require('../data').SimpleWork,
            as: 'simpleWork',
            attributes: ['id', 'workNumber', 'propertyAddress', 'workType'],
            required: false
          }
        ],
        order: [['date', 'DESC']]
      });


      // =============================================================
      // 3. CLASIFICACIÓN CORRECTA POR ORIGEN (proveedores, fijos, directos)
      // =============================================================

      const expensesByOrigin = {
        'Proveedores': [],              // supplierInvoiceItemId no null
        'Gastos Fijos': [],             // relatedFixedExpenseId no null  
        'Materiales': [],               // typeExpense = Materiales (directos)
        'Materiales Iniciales': [],     // typeExpense = Materiales Iniciales (directos)
        'Gastos Generales': [],         // typeExpense = Gastos Generales (directos)
        'Inspección Inicial': [],       // typeExpense = Inspección Inicial (directos)
        'Comisión Vendedor': [],        // typeExpense = Comisión Vendedor (directos)
        'Workers': [],                  // typeExpense = Workers (directos)
        'Diseño': [],                   // typeExpense = Diseño (directos)
        'Fee de Inspección': [],    // typeExpense = Fee de Inspección (directos)
        'Inspección Final': [],         // typeExpense = Inspección Final (directos)
        'Comprobante Gasto': [],        // typeExpense = Comprobante Gasto (directos)
        'Sin Clasificar': []
      };

      // Contadores por origen
      let proveedoresTotal = 0;
      let gastosFijosTotal = 0;
      let gastosDirectosTotal = 0;

      allExpenses.forEach(expense => {
        let category;
        
        // 🔍 DEBUG: Logging para comisiones específicamente
        if (expense.typeExpense === 'Comisión Vendedor') {
          console.log('🎯 COMISIÓN ENCONTRADA:', {
            idExpense: expense.idExpense,
            amount: expense.amount,
            typeExpense: expense.typeExpense,
            supplierInvoiceItemId: expense.supplierInvoiceItemId,
            relatedFixedExpenseId: expense.relatedFixedExpenseId,
            notes: expense.notes
          });
        }
        
        // 🏢 PRIORIDAD 1: Si viene de proveedor (SupplierInvoice)
        if (expense.supplierInvoiceItemId) {
          category = 'Proveedores';
          proveedoresTotal += parseFloat(expense.amount || 0);
        }
        // 🏦 PRIORIDAD 2: Si viene de gasto fijo (FixedExpense) — por relación directa O por typeExpense
        else if (expense.relatedFixedExpenseId || expense.typeExpense === 'Gasto Fijo') {
          category = 'Gastos Fijos';
          gastosFijosTotal += parseFloat(expense.amount || 0);
        }
        // 📂 PRIORIDAD 3: Gastos directos - usar typeExpense
        else {
          category = expense.typeExpense || 'Sin Clasificar';
          gastosDirectosTotal += parseFloat(expense.amount || 0);
        }
        
        if (expensesByOrigin[category]) {
          expensesByOrigin[category].push(expense);
        } else {
          expensesByOrigin['Sin Clasificar'].push(expense);
        }
      });

      // =============================================================
      // 4. TOTALES Y CONTEOS
      // =============================================================

      const totalIncome = allIncomes.reduce((sum, inc) => 
        sum + parseFloat(inc.amount || 0), 0
      );

      const totalExpenses = allExpenses.reduce((sum, exp) => 
        sum + parseFloat(exp.amount || 0), 0
      );

      // Conteo por método de pago
      const expensesByPaymentMethod = {};
      
      allExpenses.forEach(expense => {
        const method = expense.paymentMethod || 'No especificado';
        const amount = parseFloat(expense.amount || 0);
        expensesByPaymentMethod[method] = (expensesByPaymentMethod[method] || 0) + amount;
      });

      const incomeByPaymentMethod = {};
      
      allIncomes.forEach(income => {
        const method = income.paymentMethod || 'No especificado';
        const amount = parseFloat(income.amount || 0);
        incomeByPaymentMethod[method] = (incomeByPaymentMethod[method] || 0) + amount;
      });

      // =============================================================
      // 5. RESPUESTA ESTRUCTURADA PARA FRONTEND
      // =============================================================

      const response = {
        success: true,
        data: {
          period: `${month}/${year}`,
          
          // Totales principales
          summary: {
            totalIncome: totalIncome,
            totalEgresos: totalExpenses, // 🎯 Compatibilidad con frontend
            balanceNeto: totalIncome - totalExpenses
          },

          // Conteos
          counts: {
            totalIncomes: allIncomes.length,
            totalExpenses: allExpenses.length,
            // Para compatibilidad con frontend existente
            expensesCount: allExpenses.filter(exp => !['Gasto Fijo', 'Comisión Vendedor'].includes(exp.typeExpense)).length,
            fixedExpensesCount: allExpenses.filter(exp => exp.typeExpense === 'Gasto Fijo').length,
            supplierExpensesCount: allExpenses.filter(exp => exp.typeExpense === 'Materiales').length,
            commissionsCount: allExpenses.filter(exp => exp.typeExpense === 'Comisión Vendedor').length
          },

          // Detalles de ingresos
          incomeDetails: allIncomes.map(income => ({
            id: income.idIncome,
            amount: parseFloat(income.amount),
            date: income.date,
            type: income.typeIncome,
            notes: income.notes,
            paymentMethod: income.paymentMethod,
            workId: income.workId,
            propertyAddress: income.work?.propertyAddress || 'Sin dirección',
            workNotes: income.work?.notes || 'Sin notas'
          })),

          // Detalles de gastos por categoría (compatible con frontend existente)
          expenseDetails: {
            // Gastos regulares (todos los expenses menos fijos y comisiones)
            regularExpenses: allExpenses
              .filter(exp => !['Gasto Fijo', 'Comisión Vendedor'].includes(exp.typeExpense))
              .map(expense => ({
                id: expense.idExpense,
                amount: parseFloat(expense.amount),
                date: expense.date,
                type: expense.typeExpense,
                paymentMethod: expense.paymentMethod,
                notes: expense.notes || 'Sin notas',
                category: 'Regular'
              })),

            // Gastos fijos (simulando FixedExpensePayments)
            fixedExpensePayments: allExpenses
              .filter(exp => exp.typeExpense === 'Gasto Fijo')
              .map(expense => ({
                id: expense.idExpense,
                amount: parseFloat(expense.amount),
                date: expense.date,
                name: expense.notes || 'Gasto Fijo',
                paymentMethod: expense.paymentMethod,
                workId: expense.workId,
                propertyAddress: expense.work?.propertyAddress || 'Sin dirección',
                category: 'Gasto Fijo'
              })),

            // Facturas de proveedores (simulando SupplierInvoices)
            supplierInvoices: allExpenses
              .filter(exp => exp.typeExpense === 'Materiales')
              .map(expense => ({
                id: expense.idExpense,
                amount: parseFloat(expense.amount),
                date: expense.date,
                supplier: expense.notes || 'Sin proveedor',
                notes: expense.notes,
                paymentMethod: expense.paymentMethod,
                workId: expense.workId,
                propertyAddress: expense.work?.propertyAddress || 'Sin dirección',
                category: 'Proveedor'
              })),

            // Comisiones (simulando Budget.commissionAmount)
            commissions: allExpenses
              .filter(exp => exp.typeExpense === 'Comisión Vendedor')
              .map(expense => ({
                id: expense.idExpense,
                amount: parseFloat(expense.amount),
                date: expense.date,
                notes: expense.notes || 'Comisión',
                typeExpense: expense.typeExpense,
                paymentMethod: expense.paymentMethod,
                workId: expense.workId,
                propertyAddress: expense.work?.propertyAddress || 'Sin dirección',
                workNotes: expense.work?.notes || 'Sin notas',
                category: 'Comisión'
              })),

            // 🎯 CLASIFICACIÓN REAL POR ORIGEN
            byCategory: Object.entries(expensesByOrigin).map(([category, expenses]) => ({
              name: category, // Cambio para compatibilidad con frontend
              category,
              total: expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0),
              count: expenses.length,
              items: expenses.map(expense => ({
                id: expense.idExpense,
                amount: parseFloat(expense.amount),
                date: expense.date,
                paymentMethod: expense.paymentMethod,
                notes: expense.notes || 'Sin notas',
                description: expense.fixedExpense 
                  ? `${expense.fixedExpense.name} - ${expense.fixedExpense.description || 'Sin descripción'} (${expense.fixedExpense.category})` 
                  : expense.notes || 'Sin descripción',
                vendor: expense.vendor || 'Sin vendor',
                paymentDetails: expense.paymentDetails || null,
                verified: expense.verified || false,
                paymentStatus: expense.paymentStatus,
                typeExpense: expense.typeExpense,
                supplierInvoiceItemId: expense.supplierInvoiceItemId,
                relatedFixedExpenseId: expense.relatedFixedExpenseId,
                workId: expense.workId,
                propertyAddress: expense.work?.propertyAddress || 'Sin dirección',
                workNotes: expense.work?.notes || 'Sin notas',
                // Información adicional de gasto fijo si existe
                fixedExpenseName: expense.fixedExpense?.name || null,
                fixedExpenseDescription: expense.fixedExpense?.description || null,
                fixedExpenseCategory: expense.fixedExpense?.category || null,
                // Flags para identificación
                hasNotes: !!expense.notes,
                hasVendor: !!expense.vendor
              }))
            })).filter(cat => cat.count > 0), // Solo mostrar categorías con datos

            // 📊 RESUMEN POR ORIGEN PRINCIPAL
            summaryByOrigin: {
              proveedores: {
                total: proveedoresTotal,
                count: expensesByOrigin['Proveedores'].length
              },
              gastosFijos: {
                total: gastosFijosTotal,
                count: expensesByOrigin['Gastos Fijos'].length
              },
              gastosDirectos: {
                total: gastosDirectosTotal,
                count: allExpenses.length - expensesByOrigin['Proveedores'].length - expensesByOrigin['Gastos Fijos'].length
              }
            }
          },

          // Desglose por método de pago
          expensesByPaymentMethod: Object.entries(expensesByPaymentMethod).map(([method, amount]) => ({
            method,
            amount: parseFloat(amount)
          })),

          incomeByPaymentMethod: Object.entries(incomeByPaymentMethod).map(([method, amount]) => ({
            method,
            amount: parseFloat(amount)
          })),

          // Items excluidos para debugging (vacío en la nueva lógica)
          excludedItems: {
            duplicateExpenses: []
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('❌ Error in detailed financial dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener dashboard detallado',
        error: error.message
      });
    }
  }
};

module.exports = FinancialDashboardController;