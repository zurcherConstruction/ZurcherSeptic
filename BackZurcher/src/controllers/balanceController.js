const { Income, Expense, Receipt, Staff, Work, Budget, FinalInvoice, SimpleWork, FixedExpense } = require('../data');
const { Sequelize, Op, literal } = require('sequelize');

const getIncomesAndExpensesByWorkId = async (req, res) => {
  const { workId } = req.params;
  try {
    const incomes = await Income.findAll({
      where: { workId },
      include: [{
        model: Receipt,
        as: 'Receipts',
        required: false,
        on: { // Condición de JOIN explícita
          [Op.and]: [
            literal(`"Receipts"."relatedModel" = 'Income'`), // Asegura que el recibo es de tipo Income
            // Asume que la PK de Income es 'idIncome' y es UUID
            // y se une con Receipt.relatedId (que es STRING)
            literal(`"Income"."idIncome" = CAST("Receipts"."relatedId" AS UUID)`)
          ]
        },
        attributes: ['idReceipt', 'fileUrl', 'mimeType', 'originalName', 'notes'],
      }]
    });
    const expenses = await Expense.findAll({
      where: { workId },
      include: [{
        model: Receipt,
        as: 'Receipts',
        required: false,
        on: { // Condición de JOIN explícita
          [Op.and]: [
            literal(`"Receipts"."relatedModel" = 'Expense'`), // Asegura que el recibo es de tipo Expense
            // Asume que la PK de Expense es 'idExpense' y es UUID
            // y se une con Receipt.relatedId (que es STRING)
            literal(`"Expense"."idExpense" = CAST("Receipts"."relatedId" AS UUID)`)
          ]
        },
        attributes: ['idReceipt', 'fileUrl', 'mimeType', 'originalName', 'notes'],
      }]
    });

    res.status(200).json({ incomes, expenses });
  } catch (error) {
    res.status(500).json({
      message: 'Error al obtener ingresos y gastos',
      error: error.message
    });
  }
};

const getBalanceByWorkId = async (req, res) => {
  const { workId } = req.params;
  const { type } = req.query;

  try {
    // Consultar ingresos y agruparlos por tipo
    const incomes = await Income.findAll({
      where: { workId },
      attributes: [
        'typeIncome',
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total'],
        [Sequelize.fn('COUNT', Sequelize.col('typeIncome')), 'count']
      ],
      group: ['typeIncome']
    });

    // Consultar gastos y agruparlos por tipo
    const expenses = await Expense.findAll({
      where: { workId },
      attributes: [
        'typeExpense',
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total'],
        [Sequelize.fn('COUNT', Sequelize.col('typeExpense')), 'count']
      ],
      group: ['typeExpense']
    });

    // Calcular totales
    const totalIncome = incomes.reduce((sum, income) =>
      sum + parseFloat(income.getDataValue('total') || 0), 0
    );
    const totalExpense = expenses.reduce((sum, expense) =>
      sum + parseFloat(expense.getDataValue('total') || 0), 0
    );
    const balance = totalIncome - totalExpense;

    // Formatear los datos para el gráfico
    const incomesData = incomes.map(income => ({
      name: income.typeIncome || 'Sin clasificar',
      value: parseFloat(income.getDataValue('total')) || 0,
      count: parseInt(income.getDataValue('count')) || 0,
      type: 'income'
    }));

    const expensesData = expenses.map(expense => ({
      name: expense.typeExpense || 'Sin clasificar',
      value: parseFloat(expense.getDataValue('total')) || 0,
      count: parseInt(expense.getDataValue('count')) || 0,
      type: 'expense'
    }));

    // Preparar respuesta
    const responseData = {
      totalIncome,
      totalExpense,
      balance,
      details: {
        incomes: incomesData,
        expenses: expensesData
      }
    };

    // Filtrar por tipo si se especifica
    if (type === 'income') {
      responseData.details = { incomes: incomesData };
    } else if (type === 'expense') {
      responseData.details = { expenses: expensesData };
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error en getBalanceByWorkId:", error);
    res.status(500).json({
      message: 'Error al obtener el balance',
      error: error.message
    });
  }
};

const getGeneralBalance = async (req, res) => {
  const { type, startDate, endDate, workId, typeIncome, typeExpense, staffId, includeSupplierExpenses } = req.query;

  try {
    // Condiciones WHERE para Income
    const incomeWhere = {};
    if (startDate && endDate) {
      // 🔧 FIX: Ajustar fechas para incluir TODO el día de inicio y fin
      // Crear fecha de inicio a las 00:00:00 del día
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      // Crear fecha de fin a las 23:59:59 del día
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      incomeWhere.date = {
        [Op.between]: [start, end]
      };
    }
    if (workId) incomeWhere.workId = workId;
    if (typeIncome) incomeWhere.typeIncome = typeIncome;
    if (staffId) incomeWhere.staffId = staffId;

    // Condiciones WHERE para Expense (usando misma lógica que FinancialDashboardController)
    const expenseWhere = {
      paymentStatus: { [Op.in]: ['paid', 'paid_via_invoice', 'paid_via_credit_card', 'partial', 'unpaid'] }, // 🔧 INCLUIR todos los gastos reales
      [Op.and]: [
        Sequelize.where(
          Sequelize.cast(Sequelize.col('typeExpense'), 'TEXT'),
          { [Op.notILike]: '%comisión%' }
        )
      ]
    };
    
    // 🆕 Si includeSupplierExpenses es 'true', mostrar también gastos de supplier invoices
    // Si no, excluirlos (comportamiento original para balance)
    if (includeSupplierExpenses !== 'true') {
      expenseWhere.supplierInvoiceItemId = null; // Excluir gastos auto-generados por pagos de proveedores
    }
    
    if (startDate && endDate) {
      // 🔧 FIX: Usar las mismas fechas ajustadas
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      expenseWhere.date = {
        [Op.between]: [start, end]
      };
    }
    if (workId) expenseWhere.workId = workId;
    if (typeExpense) expenseWhere.typeExpense = typeExpense;
    if (staffId) expenseWhere.staffId = staffId;

    const needsIncomes = type === 'income' || !type;
    const needsExpenses = type === 'expense' || !type;

    // Ejecutar las dos queries principales EN PARALELO, omitiendo la que no se necesita
    const [allIncomes, allExpenses] = await Promise.all([
      needsIncomes
        ? Income.findAll({
            where: incomeWhere,
            order: [['date', 'DESC']],
            include: [
              { model: Staff, as: 'Staff', attributes: ['id', 'name', 'email'], required: false },
              {
                model: Work, as: 'work', attributes: ['idWork', 'propertyAddress'], required: false,
                include: [
                  { model: Budget, as: 'budget', attributes: ['idBudget', 'paymentInvoice', 'paymentProofType', 'paymentProofAmount'] },
                  { model: FinalInvoice, as: 'finalInvoice', required: false, attributes: ['id', 'status', 'finalAmountDue'] }
                ]
              },
              { model: SimpleWork, as: 'simpleWork', attributes: ['id', 'workNumber', 'propertyAddress', 'workType'], required: false }
            ]
          })
        : Promise.resolve([]),
      needsExpenses
        ? Expense.findAll({
            where: expenseWhere,
            order: [['date', 'DESC']],
            include: [
              { model: Staff, as: 'Staff', attributes: ['id', 'name', 'email'], required: false },
              { model: Work, as: 'work', attributes: ['idWork', 'propertyAddress'], required: false },
              { model: SimpleWork, as: 'simpleWork', attributes: ['id', 'workNumber', 'propertyAddress', 'workType'], required: false },
              { model: FixedExpense, as: 'fixedExpense', attributes: ['idFixedExpense', 'name', 'category', 'frequency'], required: false }
            ]
          })
        : Promise.resolve([])
    ]);

    const nonDuplicatedExpenses = allExpenses;

    // IDs para las queries de receipts
    const incomeIds    = allIncomes.map(i => i.idIncome.toString());
    const expenseIds   = nonDuplicatedExpenses.map(e => e.idExpense.toString());
    const finalInvIds  = allIncomes
      .map(i => i.work?.finalInvoice?.id)
      .filter(Boolean)
      .map(String);

    // Ejecutar las tres queries de receipts EN PARALELO
    const [incomeReceipts, finalInvoiceReceipts, expenseReceipts] = await Promise.all([
      incomeIds.length
        ? Receipt.findAll({
            where: { relatedModel: 'Income', relatedId: { [Op.in]: incomeIds } },
            attributes: ['idReceipt', 'relatedId', 'fileUrl', 'mimeType', 'originalName', 'notes']
          })
        : Promise.resolve([]),
      finalInvIds.length
        ? Receipt.findAll({
            where: { relatedModel: 'FinalInvoice', relatedId: { [Op.in]: finalInvIds } },
            attributes: ['idReceipt', 'relatedId', 'fileUrl', 'mimeType', 'originalName', 'notes']
          })
        : Promise.resolve([]),
      expenseIds.length
        ? Receipt.findAll({
            where: { relatedModel: 'Expense', relatedId: { [Op.in]: expenseIds } },
            attributes: ['idReceipt', 'relatedId', 'fileUrl', 'mimeType', 'originalName', 'notes']
          })
        : Promise.resolve([])
    ]);

    // Asociar receipts a incomes manualmente + comprobantes de Budget y FinalInvoice
    const incomesWithReceipts = allIncomes.map(income => {
      const receipts = incomeReceipts.filter(receipt =>
        receipt.relatedId === income.idIncome.toString()
      );

      // Si es un pago inicial de Budget, agregar el comprobante del Budget
      if (income.typeIncome === 'Factura Pago Inicial Budget' && income.work?.budget?.paymentInvoice) {
        receipts.push({
          idReceipt: `budget-${income.work.budget.idBudget}`,
          fileUrl: income.work.budget.paymentInvoice,
          mimeType: income.work.budget.paymentProofType === 'image' ? 'image/png' : 'application/pdf',
          originalName: `Comprobante_Pago_Inicial_Budget_${income.work.budget.idBudget}`,
          notes: `Comprobante de pago inicial del Budget #${income.work.budget.idBudget}`,
          source: 'budget'
        });
      }

      // AGREGAR: Si es un pago final de Budget, agregar los comprobantes de FinalInvoice
      if (income.typeIncome === 'Factura Pago Final Budget' && income.work?.finalInvoice) {
  const finalInvoiceId = income.work.finalInvoice.id;
        const finalInvoiceReceiptsForThisIncome = finalInvoiceReceipts.filter(receipt =>
          receipt.relatedId === finalInvoiceId.toString()
        );

        finalInvoiceReceiptsForThisIncome.forEach(receipt => {
          receipts.push({
            ...receipt.toJSON(),
            source: 'finalInvoice' // Identificador para saber que viene de FinalInvoice
          });
        });
      }

      return {
        ...income.toJSON(),
        Receipts: receipts
      };
    });

    // Asociar receipts a expenses manualmente (usar expenses no duplicados)
    const expensesWithReceipts = nonDuplicatedExpenses.map(expense => {
      const receipts = expenseReceipts.filter(receipt =>
        receipt.relatedId === expense.idExpense.toString()
      );
      return {
        ...expense.toJSON(),
        Receipts: receipts
      };
    });

    // Calcular totales (usar expenses no duplicados)
    const totalIncome = allIncomes.reduce((sum, income) => sum + parseFloat(income.amount || 0), 0);
    const totalExpense = nonDuplicatedExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
    const balance = totalIncome - totalExpense;

    // Agrupar ingresos por tipo
    const incomesByType = allIncomes.reduce((acc, income) => {
      const type = income.typeIncome || 'Sin tipo';
      if (!acc[type]) {
        acc[type] = { value: 0, count: 0 };
      }
      acc[type].value += parseFloat(income.amount || 0);
      acc[type].count += 1;
      return acc;
    }, {});

    // Agrupar gastos por tipo (usar expenses no duplicados)
    const expensesByType = nonDuplicatedExpenses.reduce((acc, expense) => {
      const type = expense.typeExpense || 'Sin tipo';
      if (!acc[type]) {
        acc[type] = { value: 0, count: 0 };
      }
      acc[type].value += parseFloat(expense.amount || 0);
      acc[type].count += 1;
      return acc;
    }, {});

    // Convertir a arrays para la respuesta
    const incomeDetails = Object.entries(incomesByType).map(([name, data]) => ({
      name,
      value: data.value,
      count: data.count
    }));

    const expenseDetails = Object.entries(expensesByType).map(([name, data]) => ({
      name,
      value: data.value,
      count: data.count
    }));

    // Filtrar los datos según el parámetro 'type'
    let responseData = {
      totalIncome,
      totalExpense,
      balance,
      details: {
        incomes: incomeDetails,
        expenses: expenseDetails
      },
      list: {}
    };

    if (type === 'income' || !type) {
      responseData.list.incomes = incomesWithReceipts;
    }
    if (type === 'expense' || !type) {
      responseData.list.expenses = expensesWithReceipts;
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error("Error en getGeneralBalance:", error);
    res.status(500).json({
      message: 'Error al obtener el balance general',
      error: error.message
    });
  }
};

module.exports = {
  getIncomesAndExpensesByWorkId,
  getBalanceByWorkId,
  getGeneralBalance
};