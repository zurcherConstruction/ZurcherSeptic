const { Income, Staff, Receipt, Work, sequelize } = require('../data');
const { Op } = require('sequelize');
const { sendNotifications } = require('../utils/notifications/notificationManager');
const { createDepositTransaction, isBankAccount, getAccountName } = require('../utils/bankTransactionHelper');

// 🔧 Helper: Normalizar fecha de ISO a YYYY-MM-DD (acepta ambos formatos)
const normalizeDateToLocal = (dateInput) => {
  if (!dateInput) return null;
  
  // Si ya es formato YYYY-MM-DD (10 caracteres), devolverlo tal cual
  if (typeof dateInput === 'string' && dateInput.length === 10 && dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateInput;
  }
  
  // Si es formato ISO completo (ej: 2025-10-22T12:34:56.789Z), convertir a fecha local
  try {
    const date = new Date(dateInput);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error('Error normalizando fecha:', dateInput, e);
    return dateInput; // Devolver el original si falla
  }
};

// 💳 Helper: Aplicar ingreso como pago a tarjeta de crédito (FIFO)
// Cuando se registra un ingreso con paymentMethod = tarjeta de crédito, 
// aplicar ese monto como pago sobre los expenses pendientes de esa tarjeta
const applyCreditCardPayment = async ({ 
  creditCardName,  // 'Chase Credit Card' o 'AMEX'
  amount, 
  date, 
  description, 
  relatedIncomeId,
  staffId,
  transaction 
}) => {
  try {
    console.log(`💳 [${creditCardName}] Aplicando ingreso de $${amount} como pago de tarjeta...`);

    const { Expense, SupplierInvoice } = require('../data');
    const paymentAmount = parseFloat(amount);
    
    // 1. Buscar expenses pendientes de esta tarjeta (FIFO: más antiguos primero)
    const pendingExpenses = await Expense.findAll({
      where: {
        paymentMethod: creditCardName,
        paymentStatus: ['unpaid', 'partial']
      },
      order: [['date', 'ASC']], // FIFO
      transaction
    });

    let remainingPayment = paymentAmount;
    const updatedExpenses = [];

    // 2. Aplicar el pago sobre cada expense pendiente
    for (const expense of pendingExpenses) {
      if (remainingPayment <= 0) break;

      const expenseAmount = parseFloat(expense.amount);
      const paidAmount = parseFloat(expense.paidAmount || 0);
      const pendingAmount = expenseAmount - paidAmount;

      if (pendingAmount > 0) {
        const amountToApply = Math.min(remainingPayment, pendingAmount);
        const newPaidAmount = paidAmount + amountToApply;

        // Actualizar el expense
        await expense.update({
          paidAmount: newPaidAmount,
          paymentStatus: newPaidAmount >= expenseAmount ? 'paid' : 'partial',
          paidDate: newPaidAmount >= expenseAmount ? date : expense.paidDate
        }, { transaction });

        updatedExpenses.push({
          idExpense: expense.idExpense,
          notes: expense.notes,
          amount: expenseAmount,
          appliedPayment: amountToApply,
          newStatus: newPaidAmount >= expenseAmount ? 'paid' : 'partial'
        });

        remainingPayment -= amountToApply;
        console.log(`  ✅ Expense "${expense.notes}": $${amountToApply} aplicado (${newPaidAmount >= expenseAmount ? 'PAGADO' : 'PARCIAL'})`);
      }
    }

    console.log(`💳 [${creditCardName}] ${updatedExpenses.length} expense(s) actualizados. Sobrante: $${remainingPayment.toFixed(2)}`);

    // 3. Registrar el pago en SupplierInvoice para tracking
    const paymentRecord = await SupplierInvoice.create({
      invoiceNumber: `${creditCardName === 'AMEX' ? 'AMEX' : 'CC'}-INCOME-CREDIT-${Date.now()}`,
      vendor: creditCardName,
      issueDate: date,
      dueDate: null,
      totalAmount: paymentAmount,
      paymentStatus: 'paid',
      paymentMethod: null, // NULL porque es crédito automático, no viene de cuenta específica
      paymentDetails: `Crédito automático desde ingreso: ${description}`,
      paymentDate: date,
      paidAmount: paymentAmount,
      notes: `💰 Crédito a favor por ingreso (devolución)`,
      transactionType: 'payment',
      isCreditCard: true,
      balanceAfter: 0, // Se recalcula en el frontend
      createdByStaffId: staffId,
      relatedIncomeId: relatedIncomeId // 🆕 Vincular con el Income
    }, { transaction });

    console.log(`✅ [${creditCardName}] Pago registrado en SupplierInvoice ID: ${paymentRecord.idSupplierInvoice}`);

    return {
      success: true,
      updatedExpenses,
      paymentRecordId: paymentRecord.idSupplierInvoice,
      remainingCredit: remainingPayment
    };

  } catch (error) {
    console.error(`❌ [${creditCardName}] Error aplicando pago de tarjeta:`, error.message);
    throw error;
  }
};

// Crear un nuevo ingreso
const createIncome = async (req, res) => {
  let { date, amount, typeIncome, notes, workId, staffId, paymentMethod, paymentDetails, verified, simpleWorkId } = req.body;
  
  // ✅ Normalizar fecha (acepta ISO completo o YYYY-MM-DD)
  date = normalizeDateToLocal(date);
  
  // Iniciar transacción de base de datos
  const transaction = await sequelize.transaction();
  
  try {
    // ✅ VALIDACIÓN: paymentMethod es OBLIGATORIO
    if (!paymentMethod) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'El método de pago es obligatorio',
        message: 'Debe seleccionar un método de pago para registrar el ingreso'
      });
    }

    const newIncome = await Income.create({ 
      date, 
      amount, 
      typeIncome, 
      notes, 
      workId, 
      staffId, 
      paymentMethod, 
      paymentDetails,
      verified: verified || false,
      simpleWorkId: simpleWorkId || null 
    }, { transaction });

    console.log('✅ [INCOME] Ingreso creado:', {
      idIncome: newIncome.idIncome,
      amount,
      typeIncome,
      workId: workId || 'N/A',
      simpleWorkId: simpleWorkId || 'N/A',
      paymentMethod
    });

    // � AUTO-APLICAR COMO PAGO A TARJETA DE CRÉDITO SI CORRESPONDE
    // Cuando el ingreso es recibido por tarjeta de crédito (ej: devoluciones),
    // aplicar automáticamente como pago sobre los expenses pendientes de esa tarjeta
    const { PAYMENT_METHODS } = require('../constants/paymentMethods');
    
    const creditCardMethods = [
      PAYMENT_METHODS.CHASE_CREDIT,  // 'Chase Credit Card'
      PAYMENT_METHODS.AMEX            // 'AMEX'
    ];

    const isCreditCardPayment = creditCardMethods.includes(paymentMethod);

    if (isCreditCardPayment) {
      try {
        console.log(`💳 Ingreso detectado con pago a tarjeta: ${paymentMethod}`);
        
        const creditCardPaymentResult = await applyCreditCardPayment({
          creditCardName: paymentMethod,  // Usar el valor exacto de la constante
          amount,
          date,
          description: `${typeIncome}${notes ? ': ' + notes : ''}${workId ? ` (Work #${workId.slice(0, 8)})` : ''}`,
          relatedIncomeId: newIncome.idIncome,
          staffId,
          transaction
        });

        console.log(`✅ [${paymentMethod}] Ingreso aplicado como pago de tarjeta:`, {
          expensesUpdated: creditCardPaymentResult.updatedExpenses.length,
          remainingCredit: creditCardPaymentResult.remainingCredit
        });

        // Si queda crédito sobrante, informarlo
        if (creditCardPaymentResult.remainingCredit > 0.01) {
          console.log(`💰 [${paymentMethod}] Crédito sobrante: $${creditCardPaymentResult.remainingCredit.toFixed(2)} (no hay más expenses pendientes)`);
        }

      } catch (creditCardError) {
        // Si falla la aplicación del pago a tarjeta, hacer rollback completo
        console.error('❌ Error aplicando ingreso como pago de tarjeta:', creditCardError.message);
        await transaction.rollback();
        return res.status(500).json({ 
          message: 'Error aplicando ingreso como pago de tarjeta de crédito', 
          error: creditCardError.message 
        });
      }
    }

    // �🔧 ACTUALIZAR totalPaid EN SIMPLEWORK SI ES UN PAGO DE SIMPLEWORK
    // No crear SimpleWorkPayment duplicado - el Income con simpleWorkId es la fuente de verdad
    if (simpleWorkId && typeIncome === 'Factura SimpleWork') {
      try {
        const { SimpleWork } = require('../data');
        
        // Verificar que el SimpleWork existe
        const simpleWork = await SimpleWork.findByPk(simpleWorkId, { transaction });
        if (simpleWork) {
          // Calcular totalPaid desde Income (fuente de verdad) + SimpleWorkPayments legacy
          const incomeTotal = await Income.sum('amount', {
            where: { simpleWorkId: simpleWorkId },
            transaction
          }) || 0;

          const { SimpleWorkPayment } = require('../data');
          const paymentTotal = await SimpleWorkPayment.sum('amount', {
            where: { simpleWorkId: simpleWorkId },
            transaction
          }) || 0;

          const totalPaid = parseFloat(incomeTotal) + parseFloat(paymentTotal);

          await simpleWork.update({ 
            totalPaid: totalPaid
          }, { transaction });

          console.log(`✅ [SIMPLEWORK] Pago registrado: ${simpleWork.workNumber} +$${amount} → Total: $${totalPaid}`);
        }
      } catch (simpleWorkError) {
        console.error('⚠️ Error actualizando SimpleWork totalPaid (no crítico):', simpleWorkError.message);
      }
    }
    
    // 🏦 AUTO-CREAR BANK TRANSACTION SI EL PAGO ES A CUENTA BANCARIA
    try {
      await createDepositTransaction({
        paymentMethod,
        amount,
        date,
        description: `Ingreso: ${typeIncome}${workId ? ` (Work #${workId.slice(0, 8)})` : ''}`,
        relatedIncomeId: newIncome.idIncome,
        notes,
        createdByStaffId: staffId,
        transaction
      });
    } catch (bankError) {
      console.error('❌ Error creando transacción bancaria:', bankError.message);
      // No hacer rollback si es solo warning de cuenta no encontrada
      if (bankError.message.includes('Fondos insuficientes') || 
          bankError.message.includes('no encontrada')) {
        // Es un error crítico, hacer rollback
        throw bankError;
      }
    }
    
    // Commit de la transacción
    await transaction.commit();
    
    // Enviar notificaciones al equipo de finanzas
    try {
      // Obtener información adicional para la notificación
      const incomeWithDetails = await Income.findByPk(newIncome.idIncome, {
        include: [
          { model: Staff, as: 'Staff', attributes: ['id', 'name', 'email'] },
          { model: Work, as: 'work', attributes: ['idWork', 'propertyAddress'] }
        ]
      });

      // Preparar datos para la notificación
      const notificationData = {
        ...incomeWithDetails.toJSON(),
        propertyAddress: incomeWithDetails.work?.propertyAddress || null
      };

      // Enviar notificación
      await sendNotifications('incomeRegistered', notificationData);
      console.log(`✅ Notificación de ingreso enviada: $${amount} - ${typeIncome}`);
    } catch (notificationError) {
      console.error('❌ Error enviando notificación de ingreso:', notificationError.message);
    }
    
    res.status(201).json(newIncome);
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error al crear el ingreso', error: error.message });
  }
};

// Obtener todos los ingresos CON relaciones
const getAllIncomes = async (req, res) => {
  try {
    // Obtener ingresos con Staff
    const incomes = await Income.findAll({
      include: [
        {
          model: Staff,
          as: 'Staff',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['date', 'DESC']]
    });

    // Obtener receipts por separado
    const incomeIds = incomes.map(income => income.idIncome);
    const receipts = await Receipt.findAll({
      where: {
        relatedModel: 'Income',
        relatedId: {
          [Op.in]: incomeIds.map(id => id.toString())
        }
      },
      attributes: ['idReceipt', 'relatedId', 'fileUrl', 'mimeType', 'originalName', 'notes']
    });

    // Asociar receipts manualmente
    const incomesWithReceipts = incomes.map(income => {
      const incomeReceipts = receipts.filter(receipt => 
        receipt.relatedId === income.idIncome.toString()
      );
      return {
        ...income.toJSON(),
        Receipts: incomeReceipts
      };
    });

    res.status(200).json(incomesWithReceipts);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los ingresos', error: error.message });
  }
};

// Obtener un ingreso por ID CON relaciones
const getIncomeById = async (req, res) => {
  const { id } = req.params;
  try {
    const income = await Income.findByPk(id, {
      include: [
        {
          model: Staff,
          as: 'Staff',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: Receipt,
          as: 'Receipts',
          required: false,
          on: {
            [Op.and]: [
              literal(`"Receipts"."relatedModel" = 'Income'`),
              literal(`"Income"."idIncome" = CAST("Receipts"."relatedId" AS UUID)`)
            ]
          },
          attributes: ['idReceipt', 'fileUrl', 'mimeType', 'originalName', 'notes'],
        }
      ]
    });
    if (!income) return res.status(404).json({ message: 'Ingreso no encontrado' });
    res.status(200).json(income);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el ingreso', error: error.message });
  }
};

// Actualizar un ingreso
const updateIncome = async (req, res) => {
  const { id } = req.params;
  let { date, amount, typeIncome, notes, workId, staffId, paymentMethod, paymentDetails, verified } = req.body; // Agregar paymentDetails
  
  // ✅ Normalizar fecha si se proporciona
  if (date) {
    date = normalizeDateToLocal(date);
  }
  
  const dbTransaction = await sequelize.transaction();

  try {
    const income = await Income.findByPk(id, { transaction: dbTransaction });
    if (!income) {
      await dbTransaction.rollback();
      return res.status(404).json({ message: 'Ingreso no encontrado' });
    }

    const prev = {
      amount: parseFloat(income.amount || 0),
      date: income.date,
      paymentMethod: income.paymentMethod,
      typeIncome: income.typeIncome,
      workId: income.workId,
      notes: income.notes,
      staffId: income.staffId,
    };

    const normalizeUuid = (value) => {
      if (value === '' || value === null || value === undefined) {
        return null;
      }

      return value;
    };

    const hasWorkIdInPayload = Object.prototype.hasOwnProperty.call(req.body, 'workId');
    const nextWorkId = hasWorkIdInPayload ? normalizeUuid(workId) : prev.workId;

    const next = {
      date: date ?? prev.date,
      amount: amount ?? prev.amount,
      typeIncome: typeIncome ?? prev.typeIncome,
      notes: notes ?? prev.notes,
      workId: nextWorkId,
      staffId: staffId ?? prev.staffId,
      paymentMethod: paymentMethod ?? prev.paymentMethod,
      paymentDetails: paymentDetails ?? income.paymentDetails,
      verified: verified ?? income.verified,
    };

    // Actualizar el ingreso
    await income.update(next, { transaction: dbTransaction });

    // ─────────────────────────────────────────────────────────────
    // Sincronizar BankTransaction + balances al editar
    // ─────────────────────────────────────────────────────────────
    const { BankAccount, BankTransaction } = require('../data');
    const existingBankTransaction = await BankTransaction.findOne({
      where: {
        relatedIncomeId: income.idIncome,
        transactionType: 'deposit'
      },
      transaction: dbTransaction
    });

    const oldIsBank = isBankAccount(prev.paymentMethod);
    const newIsBank = isBankAccount(next.paymentMethod);
    const nextAmount = parseFloat(next.amount || 0);

    // Revertir efecto anterior si estaba en cuenta bancaria
    if (oldIsBank && existingBankTransaction) {
      const oldAccount = await BankAccount.findByPk(existingBankTransaction.bankAccountId, { transaction: dbTransaction });
      if (oldAccount) {
        const revertedBalance = parseFloat(oldAccount.currentBalance || 0) - parseFloat(existingBankTransaction.amount || 0);
        await oldAccount.update({ currentBalance: revertedBalance }, { transaction: dbTransaction });
      }
    }

    if (newIsBank) {
      const accountName = getAccountName(next.paymentMethod);
      const newAccount = await BankAccount.findOne({
        where: { accountName, isActive: true },
        transaction: dbTransaction
      });

      if (!newAccount) {
        throw new Error(`Cuenta bancaria no encontrada para método de pago: ${next.paymentMethod}`);
      }

      const newBalance = parseFloat(newAccount.currentBalance || 0) + nextAmount;
      await newAccount.update({ currentBalance: newBalance }, { transaction: dbTransaction });

      const txPayload = {
        bankAccountId: newAccount.idBankAccount,
        amount: nextAmount,
        date: next.date,
        description: `Ingreso editado: ${next.typeIncome}${next.workId ? ` (Work #${String(next.workId).slice(0, 8)})` : ''}`,
        category: 'income',
        balanceAfter: newBalance,
        notes: next.notes || null,
        createdByStaffId: next.staffId || null,
      };

      if (existingBankTransaction) {
        await existingBankTransaction.update(txPayload, { transaction: dbTransaction });
      } else {
        await BankTransaction.create({
          ...txPayload,
          transactionType: 'deposit',
          relatedIncomeId: income.idIncome,
        }, { transaction: dbTransaction });
      }
    } else if (existingBankTransaction) {
      await existingBankTransaction.destroy({ transaction: dbTransaction });
    }

    // ─────────────────────────────────────────────────────────────
    // Recalcular Budget asociado cuando aplica pago inicial/final
    // ─────────────────────────────────────────────────────────────
    const budgetTypes = ['Factura Pago Inicial Budget', 'Factura Pago Final Budget'];
    const shouldRecalculateBudget =
      budgetTypes.includes(prev.typeIncome) ||
      budgetTypes.includes(next.typeIncome) ||
      prev.workId !== next.workId;

    if (shouldRecalculateBudget) {
      const { Work, Budget, FinalInvoice } = require('../data');

      const recalcBudgetForWork = async (targetWorkId) => {
        if (!targetWorkId) return;

        const work = await Work.findByPk(targetWorkId, {
          include: [{ model: Budget, as: 'budget' }],
          transaction: dbTransaction
        });

        if (!work || !work.budget) return;

        const budget = work.budget;
        const totalPaymentProof = parseFloat(await Income.sum('amount', {
          where: {
            workId: targetWorkId,
            typeIncome: { [Op.in]: budgetTypes }
          },
          transaction: dbTransaction
        }) || 0);

        const hasFirmaCompleta = budget.manualSignedPdfPath ||
          budget.signatureStatus === 'signed' ||
          budget.signatureStatus === 'completed';

        const fueEnviadoAFirmar = budget.signatureStatus === 'sent' ||
          budget.signatureStatus === 'pending' ||
          budget.signNowDocumentId ||
          budget.docusignEnvelopeId;

        let newStatus = budget.status;

        if (budget.status === 'approved' && totalPaymentProof === 0) {
          if (hasFirmaCompleta) {
            newStatus = 'signed';
          } else if (fueEnviadoAFirmar) {
            newStatus = 'sent_for_signature';
          } else {
            newStatus = 'send';
          }
        } else if (totalPaymentProof > 0 && ['send', 'sent_for_signature', 'signed'].includes(budget.status)) {
          newStatus = 'approved';
        }

        await budget.update({
          paymentProofAmount: totalPaymentProof === 0 ? null : totalPaymentProof,
          status: newStatus
        }, { transaction: dbTransaction });

        // Si ya existe FinalInvoice, recalcular tomando el nuevo pago inicial real.
        // finalAmountDue = originalBudgetTotal + subtotalExtras - discount - initialPaymentMade
        const finalInvoice = await FinalInvoice.findOne({
          where: { workId: targetWorkId },
          transaction: dbTransaction
        });

        if (finalInvoice && finalInvoice.status !== 'cancelled') {
          const totalInitialPayment = parseFloat(await Income.sum('amount', {
            where: {
              workId: targetWorkId,
              typeIncome: 'Factura Pago Inicial Budget'
            },
            transaction: dbTransaction
          }) || 0);

          const originalBudgetTotal = parseFloat(finalInvoice.originalBudgetTotal || 0);
          const subtotalExtras = parseFloat(finalInvoice.subtotalExtras || 0);
          const discount = parseFloat(finalInvoice.discount || 0);
          const currentPaid = parseFloat(finalInvoice.totalAmountPaid || 0);
          const newFinalAmountDue = Math.max(0, originalBudgetTotal + subtotalExtras - discount - totalInitialPayment);

          let newInvoiceStatus = finalInvoice.status;
          if (currentPaid <= 0) {
            newInvoiceStatus = 'pending';
          } else if (currentPaid >= newFinalAmountDue) {
            newInvoiceStatus = 'paid';
          } else {
            newInvoiceStatus = 'partially_paid';
          }

          await finalInvoice.update({
            initialPaymentMade: totalInitialPayment,
            finalAmountDue: newFinalAmountDue,
            status: newInvoiceStatus,
            paymentDate: newInvoiceStatus === 'pending' ? null : finalInvoice.paymentDate,
          }, { transaction: dbTransaction });

          // Si deja de estar paid, mover Work de paymentReceived a invoiceFinal para reabrir saldo.
          if (work.status === 'paymentReceived' && newInvoiceStatus !== 'paid') {
            await work.update({ status: 'invoiceFinal' }, { transaction: dbTransaction });
          }
        }
      };

      if (prev.workId && prev.workId !== next.workId) {
        await recalcBudgetForWork(prev.workId);
      }
      await recalcBudgetForWork(next.workId);
    }

    await dbTransaction.commit();
    
    // Enviar notificación de actualización (opcional - solo para cambios importantes)
    try {
      // Solo notificar si es un cambio significativo en el monto
      const originalAmount = parseFloat(income._previousDataValues?.amount || 0);
      const newAmount = parseFloat(amount || 0);
      const amountChanged = Math.abs(originalAmount - newAmount) > 0.01; // Cambio mayor a 1 centavo
      
      if (amountChanged) {
        // Obtener información actualizada para la notificación
        const incomeWithDetails = await Income.findByPk(id, {
          include: [
            { model: Staff, as: 'Staff', attributes: ['id', 'name', 'email'] },
            { model: Work, as: 'work', attributes: ['idWork', 'propertyAddress'] } // ✅ Cambio de 'Work' a 'work'
          ]
        });

        // Preparar datos para la notificación
        const notificationData = {
          ...incomeWithDetails.toJSON(),
          propertyAddress: incomeWithDetails.work?.propertyAddress || 'Obra no especificada', // ✅ Cambio de Work a work
          // Agregar información del cambio
          previousAmount: originalAmount,
          newAmount: newAmount
        };

        // Usar el mismo tipo de notificación que para registros nuevos
        await sendNotifications('incomeRegistered', notificationData);
        console.log(`✅ Notificación de actualización de ingreso enviada: $${originalAmount} → $${newAmount}`);
      }
    } catch (notificationError) {
      console.error('❌ Error enviando notificación de actualización de ingreso:', notificationError.message);
    }
    
    res.status(200).json(income);
  } catch (error) {
    if (dbTransaction && !dbTransaction.finished) {
      await dbTransaction.rollback();
    }
    res.status(500).json({ message: 'Error al actualizar el ingreso', error: error.message });
  }
};

// Eliminar un ingreso
const deleteIncome = async (req, res) => {
  const { id } = req.params;
  const transaction = await sequelize.transaction();
  
  try {
    const income = await Income.findByPk(id, { transaction });
    if (!income) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Ingreso no encontrado' });
    }

    // 🏦 REVERTIR TRANSACCIÓN BANCARIA si existe
    let revertedBankTransaction = null;
    const { isBankAccount } = require('../utils/bankTransactionHelper');
    
    if (isBankAccount(income.paymentMethod)) {
      try {
        const { BankAccount, BankTransaction } = require('../data');
        
        // Buscar la transacción bancaria relacionada (deposit)
        const bankTransaction = await BankTransaction.findOne({
          where: {
            relatedIncomeId: income.idIncome,
            transactionType: 'deposit'
          },
          transaction
        });

        if (bankTransaction) {
          // Buscar la cuenta bancaria
          const bankAccount = await BankAccount.findByPk(bankTransaction.bankAccountId, { transaction });

          if (bankAccount) {
            // Restar el monto del balance (revertir el depósito)
            const transactionAmount = parseFloat(bankTransaction.amount);
            const newBalance = parseFloat(bankAccount.currentBalance) - transactionAmount;
            
            // Advertir si queda negativo - PERMITIR para correcciones de datos
            if (newBalance < 0) {
              console.warn('⚠️ ADVERTENCIA: Balance de cuenta quedará negativo al eliminar ingreso');
              console.warn(`   Cuenta: ${bankAccount.accountName}`);
              console.warn(`   Balance actual: $${parseFloat(bankAccount.currentBalance)}`);
              console.warn(`   Ingreso a eliminar: $${transactionAmount}`);
              console.warn(`   Balance resultante: $${newBalance}`);
              console.warn('   Se permite eliminación para corrección de datos - REQUIERE AJUSTE MANUAL');
              
              // Marcar para notificación en respuesta
              req.negativeBalanceWarning = {
                accountName: bankAccount.accountName,
                currentBalance: parseFloat(bankAccount.currentBalance),
                incomeAmount: transactionAmount,
                newBalance: newBalance
              };
            }
            
            await bankAccount.update({ currentBalance: newBalance }, { transaction });

            // Eliminar la transacción bancaria
            await bankTransaction.destroy({ transaction });

            revertedBankTransaction = {
              accountName: bankAccount.accountName,
              amount: transactionAmount,
              newBalance: newBalance
            };

            console.log(`✅ [BANK] Transacción revertida al eliminar income: ${bankAccount.accountName} -$${transactionAmount} → Balance: $${newBalance.toFixed(2)}`);
          }
        }
      } catch (bankError) {
        console.error('❌ [BANK] Error revirtiendo transacción bancaria:', bankError.message);
        await transaction.rollback();
        return res.status(500).json({
          message: 'Error al revertir transacción bancaria',
          error: bankError.message
        });
      }
    }

    // 🧾 ELIMINAR RECEIPTS ASOCIADOS AL INCOME
    try {
      const { Receipt } = require('../data');
      const { cloudinary } = require('../utils/cloudinaryConfig');
      
      const receipts = await Receipt.findAll({
        where: {
          relatedModel: 'Income',
          relatedId: income.idIncome
        },
        transaction
      });

      if (receipts.length > 0) {
        console.log(` Eliminando ${receipts.length} receipt(s) asociado(s) al Income ${income.idIncome}`);
        
        for (const receipt of receipts) {
          // Eliminar archivo de Cloudinary
          if (receipt.publicId) {
            try {
              await cloudinary.uploader.destroy(receipt.publicId, {
                resource_type: receipt.mimeType === 'application/pdf' ? 'raw' : 'image'
              });
              console.log(`☁️ Archivo Cloudinary eliminado: ${receipt.publicId}`);
            } catch (cloudError) {
              console.error(`⚠️ Error eliminando archivo de Cloudinary ${receipt.publicId}:`, cloudError.message);
            }
          }
          
          // Eliminar el receipt de la BD
          await receipt.destroy({ transaction });
        }
        
        console.log(`✅ ${receipts.length} receipt(s) eliminado(s) correctamente`);
      }
    } catch (receiptError) {
      console.error('❌ Error eliminando receipts asociados:', receiptError.message);
      await transaction.rollback();
      return res.status(500).json({
        message: 'Error al eliminar comprobantes asociados',
        error: receiptError.message
      });
    }

    // 🧾 REVERTIR FINAL INVOICE SI ES PAGO FINAL
    if (income.typeIncome === 'Factura Pago Final Budget' && income.workId) {
      try {
        const { FinalInvoice } = require('../data');
        
        const finalInvoice = await FinalInvoice.findOne({
          where: { workId: income.workId },
          transaction
        });

        if (finalInvoice) {
          const incomeAmount = parseFloat(income.amount || 0);
          const currentTotalPaid = parseFloat(finalInvoice.totalAmountPaid || 0);
          const newTotalPaid = Math.max(0, currentTotalPaid - incomeAmount);
          
          // Determinar nuevo status
          let newStatus = finalInvoice.status;
          if (newTotalPaid === 0) {
            newStatus = 'pending';
          } else if (newTotalPaid < parseFloat(finalInvoice.finalAmountDue)) {
            newStatus = 'partially_paid';
          }
          
          // Actualizar FinalInvoice
          await finalInvoice.update({
            totalAmountPaid: newTotalPaid,
            status: newStatus,
            paymentDate: newTotalPaid === 0 ? null : finalInvoice.paymentDate,
            paymentNotes: finalInvoice.paymentNotes 
              ? `${finalInvoice.paymentNotes}\n🔄 Pago revertido: -$${incomeAmount.toFixed(2)} el ${new Date().toLocaleDateString()}`
              : `🔄 Pago revertido: -$${incomeAmount.toFixed(2)} el ${new Date().toLocaleDateString()}`
          }, { transaction });

          console.log(`🔄 [FINAL INVOICE] Pago revertido en FinalInvoice #${finalInvoice.id}: -$${incomeAmount.toFixed(2)} → Total Paid: $${newTotalPaid.toFixed(2)} | Status: ${finalInvoice.status} → ${newStatus}`);
          
          // 🔄 REVERTIR WORK.STATUS SI EL FINAL INVOICE VOLVIÓ A PENDING
          if (newStatus === 'pending') {
            const { Work } = require('../data');
            const work = await Work.findByPk(income.workId, { transaction });
            
            if (work && work.status === 'paymentReceived') {
              await work.update({ status: 'invoiceFinal' }, { transaction });
              console.log(`🔄 [WORK] Status revertido: paymentReceived → invoiceFinal (FinalInvoice volvió a pending)`);
            }
          }
        } else {
          console.warn(`⚠️ [FINAL INVOICE] No se encontró FinalInvoice para Work ${income.workId}`);
        }
      } catch (finalInvoiceError) {
        console.error('❌ [FINAL INVOICE] Error revirtiendo pago:', finalInvoiceError.message);
        await transaction.rollback();
        return res.status(500).json({
          message: 'Error al revertir pago en FinalInvoice',
          error: finalInvoiceError.message
        });
      }
    }

    // Eliminar el income
    await income.destroy({ transaction });
    
    // 🆕 REVERTIR PAGO DE BUDGET SI ES PAGO INICIAL O FINAL
    if (income.typeIncome === 'Factura Pago Inicial Budget' || income.typeIncome === 'Factura Pago Final Budget') {
      try {
        const { Work, Budget } = require('../data');
        
        // Buscar el Work asociado al income
        if (income.workId) {
          const work = await Work.findByPk(income.workId, {
            include: [{ model: Budget, as: 'budget' }],
            transaction
          });
          
          if (work && work.budget) {
            const budget = work.budget;
            const incomeAmount = parseFloat(income.amount || 0);
            const currentPaymentProof = parseFloat(budget.paymentProofAmount || 0);
            
            // Restar el monto del income del paymentProofAmount
            const newPaymentProof = Math.max(0, currentPaymentProof - incomeAmount);
            
            // 🔍 VERIFICAR ESTADO DE FIRMA
            const hasFirmaCompleta = budget.manualSignedPdfPath || 
                                     budget.signatureStatus === 'signed' || 
                                     budget.signatureStatus === 'completed';
            
            const fueEnviadoAFirmar = budget.signatureStatus === 'sent' || 
                                      budget.signatureStatus === 'pending' ||
                                      budget.signNowDocumentId ||
                                      budget.docusignEnvelopeId;
            
            // Determinar el nuevo estado
            let newStatus = budget.status; // Por defecto mantener el estado actual
            
            if (budget.status === 'approved' && newPaymentProof === 0) {
              // Si estaba approved y ahora no tiene pago
              if (hasFirmaCompleta) {
                // Si tiene firma completa → volver a 'signed'
                newStatus = 'signed';
                console.log(`🔄 [BUDGET] Budget con firma completa → estado: approved → signed`);
              } else if (fueEnviadoAFirmar) {
                // Si fue enviado para firma pero no está firmado → volver a 'sent_for_signature'
                newStatus = 'sent_for_signature';
                console.log(`🔄 [BUDGET] Budget enviado a firma (pendiente) → estado: approved → sent_for_signature`);
              } else {
                // Si no tiene firma ni fue enviado → volver a 'send'
                newStatus = 'send';
                console.log(`🔄 [BUDGET] Budget sin firma ni envío electrónico → estado: approved → send`);
              }
            }
            
            await budget.update({
              paymentProofAmount: newPaymentProof === 0 ? null : newPaymentProof,
              status: newStatus
            }, { transaction });
            
            console.log(`🔄 [BUDGET] Pago revertido en Budget #${budget.idBudget}: -$${incomeAmount.toFixed(2)} → PaymentProof: $${newPaymentProof.toFixed(2)} | Estado: ${budget.status} → ${newStatus}`);
          } else {
            console.warn(`⚠️ [BUDGET] No se encontró Budget asociado al Work ${income.workId} para revertir pago`);
          }
        } else {
          console.warn(`⚠️ [BUDGET] Income ${income.idIncome} no tiene workId asociado, no se puede revertir pago en Budget`);
        }
      } catch (budgetError) {
        console.error('❌ [BUDGET] Error revirtiendo pago en Budget:', budgetError.message);
        // No hacer rollback aquí, solo loggear el error (el Income ya se eliminó correctamente)
      }
    }
    
    // 🆕 REVERTIR PAGO DE SIMPLEWORK SI EXISTE
    if (income.typeIncome === 'Factura SimpleWork') {
      try {
        const { SimpleWork, SimpleWorkPayment } = require('../data');
        
        // Buscar el SimpleWorkPayment correspondiente
        const simpleWorkPayment = await SimpleWorkPayment.findOne({
          where: {
            amount: income.amount,
            paymentDate: income.date,
            paymentMethod: income.paymentMethod
          },
          transaction
        });

        if (simpleWorkPayment) {
          const simpleWork = await SimpleWork.findByPk(simpleWorkPayment.simpleWorkId, { transaction });
          
          if (simpleWork) {
            // Eliminar el SimpleWorkPayment
            await simpleWorkPayment.destroy({ transaction });

            // Recalcular totalPaid
            const newTotalPaid = await SimpleWorkPayment.sum('amount', {
              where: { simpleWorkId: simpleWork.id },
              transaction
            }) || 0;

            await simpleWork.update({ 
              totalPaid: newTotalPaid 
            }, { transaction });

            console.log(`🔄 [SIMPLEWORK] Pago eliminado: ${simpleWork.workNumber} -$${income.amount} → Total: $${newTotalPaid.toFixed(2)}`);
          }
        }
      } catch (simpleWorkError) {
        console.error('⚠️ [SIMPLEWORK] Error revirtiendo pago (no crítico):', simpleWorkError.message);
      }
    }

    // Legacy: Revertir usando simpleWorkId directo (para compatibilidad con datos viejos)
    if (income.simpleWorkId) {
      try {
        const { SimpleWork } = require('../data');
        const simpleWork = await SimpleWork.findByPk(income.simpleWorkId, { transaction });
        
        if (simpleWork) {
          const currentTotalPaid = parseFloat(simpleWork.totalPaid || 0);
          const incomeAmount = parseFloat(income.amount || 0);
          const newTotalPaid = Math.max(0, currentTotalPaid - incomeAmount);
          
          await simpleWork.update({ 
            totalPaid: newTotalPaid,
            // También actualizar el status si es necesario
            status: newTotalPaid === 0 ? 'sent' : 'invoiced'
          }, { transaction });
          
          console.log(`🔄 [SIMPLEWORK] Pago legacy revertido: ${simpleWork.workNumber} -$${incomeAmount.toFixed(2)} → Total: $${newTotalPaid.toFixed(2)}`);
        }
      } catch (simpleWorkError) {
        console.error('⚠️ [SIMPLEWORK] Error revirtiendo pago legacy (no crítico):', simpleWorkError.message);
      }
    }
    
    await transaction.commit();

    const response = {
      message: 'Ingreso eliminado correctamente',
      revertedBankTransaction: revertedBankTransaction
    };

    // Incluir advertencia si el balance quedó negativo
    if (req.negativeBalanceWarning) {
      response.warning = 'ATENCIÓN: El balance de la cuenta quedó negativo';
      response.negativeBalanceDetails = req.negativeBalanceWarning;
    }

    res.status(200).json(response);
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ message: 'Error al eliminar el ingreso', error: error.message });
  }
};

// Obtener tipos de ingreso disponibles (desde el modelo ENUM)
const getIncomeTypes = async (req, res) => {
  try {
    // Los tipos vienen del ENUM definido en el modelo Income
    const types = [
      'Factura Pago Inicial Budget',
      'Factura Pago Final Budget',
      'DiseñoDif',
      'Comprobante Ingreso'
    ];
    
    res.status(200).json({ types });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tipos de ingreso', error: error.message });
  }
};

module.exports = {
  createIncome,
  getAllIncomes,
  getIncomeById,
  updateIncome,
  deleteIncome,
  getIncomeTypes,
};