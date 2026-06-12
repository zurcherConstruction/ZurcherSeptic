const { Expense, Staff, Receipt, Work, SupplierInvoiceExpense, WorkNote, FleetAsset, sequelize } = require('../data');
const { Op } = require('sequelize');
const { uploadBufferToCloudinary } = require('../utils/cloudinaryUploader');
const { sendNotifications } = require('../utils/notifications/notificationManager');
const { createWithdrawalTransaction, isBankAccount, getAccountName } = require('../utils/bankTransactionHelper');
const { autoGenerateTokenForWork, getPortalInfoForWork } = require('../services/ClientPortalService');
const { sendEmail } = require('../utils/notifications/emailService');

const ORLANDO_TIMEZONE = 'America/New_York';
const formatOrlandoDateTime = () => new Date().toLocaleString('es-US', { timeZone: ORLANDO_TIMEZONE });

const buildFleetAssetNote = (fleetAsset) => {
  if (!fleetAsset) return '';

  const parts = [fleetAsset.name];

  if (fleetAsset.licensePlate) {
    parts.push(`Placa: ${fleetAsset.licensePlate}`);
  } else if (fleetAsset.serialNumber) {
    parts.push(`Serie: ${fleetAsset.serialNumber}`);
  }

  const assetTypeLabel =
    fleetAsset.assetType === 'vehicle' ? 'Vehículo' :
    fleetAsset.assetType === 'machine' ? 'Maquinaria' :
    fleetAsset.assetType === 'equipment' ? 'Equipo' :
    fleetAsset.assetType === 'trailer' ? 'Remolque' :
    fleetAsset.assetType;

  parts.push(`Tipo: ${assetTypeLabel}`);

  return `Activo de flota: ${parts.join(' · ')}`;
};

const composeFleetNotes = (notes, fleetAsset) => {
  const autoNote = buildFleetAssetNote(fleetAsset);
  if (!autoNote) return notes || null;

  const trimmedNotes = (notes || '').trim();
  if (!trimmedNotes) return autoNote;

  const notesWithoutAutoPrefix = trimmedNotes.replace(/^Activo de flota: .*?(\r?\n)?/, '').trimStart();
  return notesWithoutAutoPrefix ? `${autoNote}\n${notesWithoutAutoPrefix}` : autoNote;
};

const sendClientPortalLinkOnInProgress = async (workId, propertyAddress = 'tu proyecto') => {
  try {
    const existingPortalLinkNote = await WorkNote.findOne({
      where: {
        workId,
        noteType: 'client_contact',
        relatedStatus: 'inProgress',
        message: {
          [Op.iLike]: 'Enlace del Portal de Seguimiento enviado automáticamente%'
        }
      },
      attributes: ['id']
    });

    if (existingPortalLinkNote) {
      return;
    }

    let portalInfo = await getPortalInfoForWork(workId);

    if (!portalInfo?.hasPortal) {
      const workForToken = await Work.findByPk(workId, {
        attributes: ['idWork', 'idBudget']
      });

      if (workForToken?.idBudget) {
        await autoGenerateTokenForWork({
          idWork: workForToken.idWork,
          idBudget: workForToken.idBudget,
        });
      }

      portalInfo = await getPortalInfoForWork(workId);
    }

    if (!portalInfo?.hasPortal || !portalInfo?.portalUrl || !portalInfo?.clientEmail) {
      console.warn(`[ExpenseController] Portal link email skipped for work ${workId}: missing portal URL or client email`);
      return;
    }

    const subject = 'Your project is now in progress | Zurcher Septic';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
        <h2 style="margin-bottom: 8px; color: #0f4c81;">Your project is in progress</h2>
        <p style="margin-top: 0;">Hi ${portalInfo.clientName || 'there'},</p>
        <p>
          Your project at <strong>${propertyAddress || 'your address'}</strong> has moved to
          <strong>In Progress</strong>.
        </p>
        <p>You can track progress, documents, and photos in your portal:</p>
        <p style="margin: 18px 0;">
          <a href="${portalInfo.portalUrl}" style="background: #0f4c81; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Open Tracking Portal
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">
          If the button does not work, copy and paste this link in your browser:<br />
          <a href="${portalInfo.portalUrl}">${portalInfo.portalUrl}</a>
        </p>
      </div>
    `;

    await sendEmail({
      to: portalInfo.clientEmail,
      subject,
      html,
    });

    await WorkNote.create({
      workId,
      staffId: null,
      message: `Enlace del Portal de Seguimiento enviado automaticamente al cliente (${portalInfo.clientEmail}) al pasar a inProgress - ${formatOrlandoDateTime()}`,
      noteType: 'client_contact',
      priority: 'medium',
      relatedStatus: 'inProgress',
      isResolved: true,
      mentionedStaffIds: [],
    });

    console.log(`[ExpenseController] Client portal link email sent for work ${workId} to ${portalInfo.clientEmail}`);
  } catch (error) {
    console.error(`[ExpenseController] Error sending client portal link email for work ${workId}:`, error.message);
  }
};

// 🔧 Helper: Normalizar fecha de ISO a YYYY-MM-DD (acepta ambos formatos)
const normalizeDateToLocal = (dateInput) => {
  if (!dateInput) return null;
  
  // Si ya es formato YYYY-MM-DD (10 caracteres), devolverlo tal cual
  if (typeof dateInput === 'string' && dateInput.length === 10 && dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateInput;
  }
  
  // Si es formato ISO completo (ej: 2025-10-22T12:34:56.789Z), convertir usando zona horaria EST
  try {
    const date = new Date(dateInput);
    // Ajustar a zona horaria de Orlando (EST: UTC-5)
    const offsetHours = -5; // EST offset
    const localDate = new Date(date.getTime() + (offsetHours * 60 * 60 * 1000));
    
    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error('Error normalizando fecha:', dateInput, e);
    return dateInput; // Devolver el original si falla
  }
};

// Crear un nuevo gasto
const createExpense = async (req, res) => {
  let { date, amount, typeExpense, notes, workId, simpleWorkId, staffId, paymentMethod, paymentDetails, verified, fixedExpenseId, fleetAssetId } = req.body;
  let shouldSendPortalLinkEmail = false;
  let workPropertyAddressForPortal = null;

  const normalizeUuid = (value) => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    return value;
  };
  
  // ✅ Normalizar fecha (acepta ISO completo o YYYY-MM-DD)
  date = normalizeDateToLocal(date);
  workId = normalizeUuid(workId);
  simpleWorkId = normalizeUuid(simpleWorkId);
  fixedExpenseId = normalizeUuid(fixedExpenseId);
  fleetAssetId = normalizeUuid(fleetAssetId);
  staffId = normalizeUuid(staffId);
  
  // Iniciar transacción de base de datos
  const transaction = await sequelize.transaction();
  
  try {
    // ✅ VALIDACIÓN: paymentMethod es OBLIGATORIO
    if (!paymentMethod) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'El método de pago es obligatorio',
        message: 'Debe seleccionar un método de pago para registrar el gasto'
      });
    }

    // 🚗 VALIDACIÓN: Gasto Flota requiere un activo válido
    if (typeExpense === 'Gasto Flota') {
      if (!fleetAssetId) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'El activo de flota es obligatorio',
          message: 'Debe seleccionar el vehículo o maquinaria para registrar un Gasto Flota'
        });
      }

      const fleetAsset = await FleetAsset.findByPk(fleetAssetId, { transaction });
      if (!fleetAsset) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Activo de flota no encontrado',
          message: 'El vehículo o maquinaria seleccionado no existe o ya no está disponible'
        });
      }

      notes = composeFleetNotes(notes, fleetAsset);
    }

    // 1. Crear el Expense normalmente (con estado unpaid por defecto)
    const newExpense = await Expense.create({ 
      date, 
      amount, 
      typeExpense, 
      notes, 
      workId, 
      simpleWorkId,  // 🆕 Incluir simpleWorkId
      staffId, 
      paymentMethod, 
      paymentDetails,
      verified: verified || false,
      paymentStatus: 'unpaid',  // 🆕 Todos los gastos inician como no pagados
      relatedFixedExpenseId: fixedExpenseId || null,  // 💳 Vincular con FixedExpense para cascade al liquidar tarjeta
      fleetAssetId: fleetAssetId || null  // 🚗 Vincular con FleetAsset si es Gasto Flota
    }, { transaction });

    console.log('✅ [EXPENSE] Gasto creado:', {
      idExpense: newExpense.idExpense,
      amount,
      typeExpense,
      workId: workId || 'N/A',
      simpleWorkId: simpleWorkId || 'N/A',
      paymentMethod
    });

    // 🆕 NO crear SimpleWorkExpense - Los gastos vinculados se gestionan directamente con el campo simpleWorkId
    // La relación Expense -> SimpleWork es suficiente para mostrar gastos vinculados

    // 🏦 AUTO-CREAR BANK TRANSACTION SI EL PAGO ES DESDE CUENTA BANCARIA
    try {
      const bankTransaction = await createWithdrawalTransaction({
        paymentMethod,
        amount,
        date,
        description: `Gasto: ${typeExpense}${workId ? ` (Work #${workId.slice(0, 8)})` : ''}`,
        relatedExpenseId: newExpense.idExpense,
        notes,
        createdByStaffId: staffId,
        transaction,
        skipBalanceCheck: true  // 🏦 Permitir sobregiros
      });

      // 💰 Si se creó BankTransaction, marcar el gasto como PAGADO
      if (bankTransaction) {
        await newExpense.update({ paymentStatus: 'paid' }, { transaction });
        console.log(`✅ Gasto marcado como 'paid' (BankTransaction creado)`);
      }
    } catch (bankError) {
      console.error('❌ Error creando transacción bancaria:', bankError.message);
      // Si hay error de fondos, hacer rollback completo
      await transaction.rollback();
      return res.status(400).json({
        error: 'Error procesando transacción bancaria',
        message: bankError.message
      });
    }

    // 🆕 AUTO-CAMBIAR ESTADO DEL TRABAJO A inProgress CUANDO SE CARGA MATERIALES INICIALES
    if (typeExpense === 'Materiales Iniciales' && workId) {
      try {
        const work = await Work.findByPk(workId, { transaction });
        if (work && work.status === 'assigned') {
          await work.update({ status: 'inProgress' }, { transaction });
          shouldSendPortalLinkEmail = true;
          workPropertyAddressForPortal = work.propertyAddress;
          console.log(`✅ Trabajo ${workId.slice(0, 8)} cambiado de 'assigned' a 'inProgress' automáticamente`);
        } else if (work) {
          console.log(`ℹ️  Trabajo ${workId.slice(0, 8)} no cambió de estado. Status actual: ${work.status}`);
        }
      } catch (statusError) {
        console.error('❌ Error actualizando estado del trabajo:', statusError.message);
        await transaction.rollback();
        return res.status(500).json({
          error: 'Error actualizando estado del trabajo',
          message: statusError.message
        });
      }
    }

    // Commit de la transacción
    await transaction.commit();

    // 2. Si es Inspección Inicial o Inspección Final y hay archivo, crear Receipt asociado
    let createdReceipt = null;
    if ((typeExpense === 'Inspección Inicial' || typeExpense === 'Inspección Final') && req.file) {
      // Subir archivo a Cloudinary
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: 'zurcher_receipts',
        resource_type: req.file.mimetype === 'application/pdf' ? 'raw' : 'auto',
        format: req.file.mimetype === 'application/pdf' ? undefined : 'jpg',
        access_mode: 'public'
      });

      // Crear Receipt asociado al Expense
      createdReceipt = await Receipt.create({
        relatedModel: 'Expense',
        relatedId: newExpense.idExpense.toString(),
        type: typeExpense,
        notes,
        fileUrl: result.secure_url,
        publicId: result.public_id,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname
      });
    }

    // 3. Enviar notificaciones al equipo de finanzas
    try {
      // Obtener información adicional para la notificación
      const expenseWithDetails = await Expense.findByPk(newExpense.idExpense, {
        include: [
          { model: Staff, as: 'Staff', attributes: ['id', 'name', 'email'] },
          { model: Work, as: 'work', attributes: ['idWork', 'propertyAddress'] }
        ]
      });

      // Preparar datos para la notificación
      const notificationData = {
        ...expenseWithDetails.toJSON(),
        // Agregar propiedades adicionales si no están en las relaciones
        propertyAddress: expenseWithDetails.work?.propertyAddress || null
      };

      // ✅ SOLO ENVIAR NOTIFICACIÓN PARA MATERIALES INICIALES
      if (typeExpense === 'Materiales Iniciales') {
        await sendNotifications('expenseCreated', notificationData, null, null, { userId: req.user?.id });
        console.log(`✅ Notificación de Materiales Iniciales enviada: $${amount}`);
      }
    } catch (notificationError) {
      console.error('❌ Error enviando notificación de gasto:', notificationError.message);
      // No fallar la creación del gasto por error de notificación
    }

    if (shouldSendPortalLinkEmail && workId) {
      await sendClientPortalLinkOnInProgress(workId, workPropertyAddressForPortal);
    }

    // Devolver ambos si corresponde
    res.status(201).json({
      ...newExpense.toJSON(),
      Receipt: createdReceipt ? createdReceipt.toJSON() : null
    });
  } catch (error) {
    console.error('❌ [ExpenseController] Error creando gasto:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      body: req.body,
    });

    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('❌ [ExpenseController] Error haciendo rollback:', rollbackError.message);
    }

    res.status(500).json({ message: 'Error al crear el gasto', error: error.message });
  }
};

// Obtener todos los gastos CON relaciones
const getAllExpenses = async (req, res) => {
  try {
    const { paymentStatus, fleetAssetId, typeExpense, month, year } = req.query;
    
    // Construir filtro base
    const where = {};
    
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
      
      // 🆕 Si buscan "unpaid", excluir los que ya están vinculados a invoices
      if (paymentStatus === 'unpaid') {
        const linkedExpenseIds = await SupplierInvoiceExpense.findAll({
          attributes: ['expenseId'],
          raw: true
        });

        const linkedIds = linkedExpenseIds.map(item => item.expenseId);

        if (linkedIds.length > 0) {
          where.idExpense = {
            [Op.notIn]: linkedIds
          };
        }
      }
    }

    if (fleetAssetId) {
      where.fleetAssetId = fleetAssetId;
    }

    if (typeExpense) {
      where.typeExpense = typeExpense;
    }

    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      const lastDay = new Date(y, m, 0).getDate();
      where.date = {
        [Op.between]: [
          `${y}-${String(m).padStart(2, '0')}-01`,
          `${y}-${String(m).padStart(2, '0')}-${lastDay}`,
        ],
      };
    } else if (year) {
      where.date = { [Op.between]: [`${year}-01-01`, `${year}-12-31`] };
    }

    // Obtener gastos con Staff
    const expenses = await Expense.findAll({
      where,
      include: [
        {
          model: Staff,
          as: 'Staff',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        ...(fleetAssetId ? [{
          model: FleetAsset,
          as: 'fleetAsset',
          attributes: ['id', 'name', 'licensePlate', 'serialNumber', 'assetType'],
          required: false,
        }] : []),
      ],
      order: [['date', 'DESC']]
    });

    // Obtener receipts por separado
    const expenseIds = expenses.map(expense => expense.idExpense);
    const receipts = await Receipt.findAll({
      where: {
        relatedModel: 'Expense',
        relatedId: {
          [Op.in]: expenseIds.map(id => id.toString())
        }
      },
      attributes: ['idReceipt', 'relatedId', 'fileUrl', 'mimeType', 'originalName', 'notes']
    });

    // Asociar receipts manualmente
    const expensesWithReceipts = expenses.map(expense => {
      const expenseReceipts = receipts.filter(receipt => 
        receipt.relatedId === expense.idExpense.toString()
      );
      return {
        ...expense.toJSON(),
        Receipts: expenseReceipts
      };
    });

    res.status(200).json(expensesWithReceipts);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los gastos', error: error.message });
  }
};

// Obtener un gasto por ID CON relaciones
const getExpenseById = async (req, res) => {
  const { id } = req.params;
  try {
    const expense = await Expense.findByPk(id, {
      include: [
        {
          model: Staff,
          as: 'Staff',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });

    if (!expense) return res.status(404).json({ message: 'Gasto no encontrado' });

    // Obtener receipts por separado
    const receipts = await Receipt.findAll({
      where: {
        relatedModel: 'Expense',
        relatedId: id.toString()
      },
      attributes: ['idReceipt', 'fileUrl', 'mimeType', 'originalName', 'notes']
    });

    res.status(200).json({
      ...expense.toJSON(),
      Receipts: receipts
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el gasto', error: error.message });
  }
};


// Actualizar un gasto
const updateExpense = async (req, res) => {
  const { id } = req.params;
  let { date, amount, typeExpense, notes, workId, staffId, paymentMethod, paymentDetails, verified, fleetAssetId } = req.body; // Agregar paymentDetails
  
  // ✅ Normalizar fecha si se proporciona
  if (date) {
    date = normalizeDateToLocal(date);
  }
  
  const dbTransaction = await sequelize.transaction();

  try {
    const expense = await Expense.findByPk(id, { transaction: dbTransaction });
    if (!expense) {
      await dbTransaction.rollback();
      return res.status(404).json({ message: 'Gasto no encontrado' });
    }

    const prev = {
      amount: parseFloat(expense.amount || 0),
      date: expense.date,
      typeExpense: expense.typeExpense,
      notes: expense.notes,
      workId: expense.workId,
      staffId: expense.staffId,
      paymentMethod: expense.paymentMethod,
      relatedFixedExpenseId: expense.relatedFixedExpenseId,
      fleetAssetId: expense.fleetAssetId,
    };

    const normalizeUuid = (value) => {
      if (value === '' || value === null || value === undefined) {
        return null;
      }

      return value;
    };

    const hasFleetAssetIdInPayload = Object.prototype.hasOwnProperty.call(req.body, 'fleetAssetId');
    const hasWorkIdInPayload = Object.prototype.hasOwnProperty.call(req.body, 'workId');
    const nextTypeExpense = typeExpense ?? prev.typeExpense;
    const nextWorkId = hasWorkIdInPayload ? normalizeUuid(workId) : prev.workId;

    let nextFleetAssetId = prev.fleetAssetId;
    if (nextTypeExpense !== 'Gasto Flota') {
      nextFleetAssetId = null;
    } else if (hasFleetAssetIdInPayload) {
      nextFleetAssetId = normalizeUuid(fleetAssetId);
    }

    if (nextTypeExpense === 'Gasto Flota' && nextFleetAssetId) {
      const fleetAsset = await FleetAsset.findByPk(nextFleetAssetId, { transaction: dbTransaction });
      if (!fleetAsset) {
        await dbTransaction.rollback();
        return res.status(400).json({
          error: 'Activo de flota no encontrado',
          message: 'El vehículo o maquinaria seleccionado no existe o ya no está disponible'
        });
      }
    }

    const next = {
      date: date ?? prev.date,
      amount: amount ?? prev.amount,
      typeExpense: nextTypeExpense,
      notes: notes ?? prev.notes,
      workId: nextWorkId,
      staffId: staffId ?? prev.staffId,
      paymentMethod: paymentMethod ?? prev.paymentMethod,
      paymentDetails: paymentDetails ?? expense.paymentDetails,
      verified: verified ?? expense.verified,
      fleetAssetId: nextFleetAssetId,
    };

    // Actualizar el gasto
    await expense.update(next, { transaction: dbTransaction });

    // ─────────────────────────────────────────────────────────────
    // Sincronizar BankTransaction + balances al editar
    // ─────────────────────────────────────────────────────────────
    const { BankAccount, BankTransaction } = require('../data');
    const existingBankTransaction = await BankTransaction.findOne({
      where: {
        relatedExpenseId: expense.idExpense,
        transactionType: 'withdrawal'
      },
      transaction: dbTransaction
    });

    const oldIsBank = isBankAccount(prev.paymentMethod);
    const newIsBank = isBankAccount(next.paymentMethod);
    const nextAmount = parseFloat(next.amount || 0);

    // Revertir el efecto anterior si estaba en cuenta bancaria
    if (oldIsBank && existingBankTransaction) {
      const oldAccount = await BankAccount.findByPk(existingBankTransaction.bankAccountId, { transaction: dbTransaction });
      if (oldAccount) {
        const revertedBalance = parseFloat(oldAccount.currentBalance || 0) + parseFloat(existingBankTransaction.amount || 0);
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

      const newBalance = parseFloat(newAccount.currentBalance || 0) - nextAmount;
      await newAccount.update({ currentBalance: newBalance }, { transaction: dbTransaction });

      const txPayload = {
        bankAccountId: newAccount.idBankAccount,
        amount: nextAmount,
        date: next.date,
        description: `Gasto editado: ${next.typeExpense}${next.workId ? ` (Work #${String(next.workId).slice(0, 8)})` : ''}`,
        category: 'expense',
        balanceAfter: newBalance,
        notes: next.notes || null,
        createdByStaffId: next.staffId || null,
      };

      if (existingBankTransaction) {
        await existingBankTransaction.update(txPayload, { transaction: dbTransaction });
      } else {
        await BankTransaction.create({
          ...txPayload,
          transactionType: 'withdrawal',
          relatedExpenseId: expense.idExpense,
        }, { transaction: dbTransaction });
      }

      // Si sale por banco, asegurar estado paid
      if (expense.paymentStatus !== 'paid') {
        await expense.update({ paymentStatus: 'paid' }, { transaction: dbTransaction });
      }
    } else if (existingBankTransaction) {
      await existingBankTransaction.destroy({ transaction: dbTransaction });
    }

    // ─────────────────────────────────────────────────────────────
    // Recalcular gasto fijo vinculado cuando cambia monto
    // ─────────────────────────────────────────────────────────────
    if (prev.relatedFixedExpenseId) {
      const { FixedExpense, FixedExpensePayment } = require('../data');
      const fixedExpense = await FixedExpense.findByPk(prev.relatedFixedExpenseId, { transaction: dbTransaction });

      if (fixedExpense) {
        const oldAmount = parseFloat(prev.amount || 0);
        const newAmount = parseFloat(next.amount || 0);
        const delta = newAmount - oldAmount;

        if (Math.abs(delta) > 0.0001) {
          const currentPaid = parseFloat(fixedExpense.paidAmount || 0);
          const totalAmount = parseFloat(fixedExpense.totalAmount || 0);
          const newPaidAmount = Math.max(0, currentPaid + delta);

          const newStatus = newPaidAmount >= totalAmount
            ? 'paid'
            : newPaidAmount > 0
              ? 'partial'
              : 'unpaid';

          await fixedExpense.update({
            paidAmount: newPaidAmount,
            paymentStatus: newStatus,
            paidDate: newPaidAmount <= 0 ? null : fixedExpense.paidDate
          }, { transaction: dbTransaction });
        }

        const paymentRecord = await FixedExpensePayment.findOne({
          where: {
            fixedExpenseId: prev.relatedFixedExpenseId,
            expenseId: expense.idExpense,
          },
          transaction: dbTransaction
        });

        if (paymentRecord) {
          await paymentRecord.update({
            amount: parseFloat(next.amount || 0),
            paymentDate: next.date || paymentRecord.paymentDate,
            paymentMethod: next.paymentMethod || paymentRecord.paymentMethod,
            notes: next.notes || paymentRecord.notes,
          }, { transaction: dbTransaction });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Recalcular estado de Works afectados cuando cambia workId o typeExpense
    // Solo aplica a tipos que disparan transiciones de estado automáticas
    // ─────────────────────────────────────────────────────────────
    const STATUS_TRIGGERING_TYPES = ['Materiales Iniciales'];
    const wasStatusTriggering = STATUS_TRIGGERING_TYPES.includes(prev.typeExpense);
    const isStatusTriggering  = STATUS_TRIGGERING_TYPES.includes(next.typeExpense);
    const workIdChanged        = String(prev.workId || '') !== String(next.workId || '');
    const typeChanged          = prev.typeExpense !== next.typeExpense;

    if (wasStatusTriggering || isStatusTriggering) {
      // Works que debemos revisar:
      // - El work anterior si el workId cambió o si dejó de ser tipo disparador
      // - El work nuevo si pasó a ser tipo disparador
      const worksToRecheck = new Set();

      if (wasStatusTriggering && (workIdChanged || (typeChanged && !isStatusTriggering))) {
        if (prev.workId) worksToRecheck.add(String(prev.workId));
      }
      if (isStatusTriggering && (workIdChanged || (typeChanged && !wasStatusTriggering))) {
        if (next.workId) worksToRecheck.add(String(next.workId));
      }

      for (const targetWorkId of worksToRecheck) {
        const targetWork = await Work.findByPk(targetWorkId, { transaction: dbTransaction });
        if (!targetWork) continue;

        // Contar cuántos "Materiales Iniciales" siguen vinculados a este work
        const remainingMI = await Expense.count({
          where: {
            workId: targetWorkId,
            typeExpense: 'Materiales Iniciales',
            idExpense: { [require('sequelize').Op.ne]: expense.idExpense } // excluir el propio gasto editado
          },
          transaction: dbTransaction
        });

        // También contar el propio gasto actualizado si queda en este work con tipo MI
        const thisExpenseCountsForWork =
          String(next.workId || '') === targetWorkId &&
          next.typeExpense === 'Materiales Iniciales';

        const totalMIForWork = remainingMI + (thisExpenseCountsForWork ? 1 : 0);

        if (totalMIForWork === 0 && targetWork.status === 'inProgress') {
          // Ya no hay Materiales Iniciales → volver a assigned
          await targetWork.update({ status: 'assigned' }, { transaction: dbTransaction });
          console.log(`↩️  Work ${targetWorkId.slice(0, 8)} revertido a 'assigned' (sin Materiales Iniciales restantes)`);
        } else if (totalMIForWork > 0 && targetWork.status === 'assigned') {
          // Ahora tiene Materiales Iniciales → avanzar a inProgress
          await targetWork.update({ status: 'inProgress' }, { transaction: dbTransaction });
          console.log(`✅ Work ${targetWorkId.slice(0, 8)} avanzado a 'inProgress' (Materiales Iniciales vinculados)`);
        }
      }
    }

    await dbTransaction.commit();
    
    // Enviar notificación de actualización
    try {
      // Obtener información actualizada para la notificación
      const expenseWithDetails = await Expense.findByPk(id, {
        include: [
          { model: Staff, as: 'Staff', attributes: ['id', 'name', 'email'] },
          { model: Work, as: 'work', attributes: ['idWork', 'propertyAddress'] }
        ]
      });

      // Preparar datos para la notificación
      const notificationData = {
        ...expenseWithDetails.toJSON(),
        propertyAddress: expenseWithDetails.work?.propertyAddress || null
      };

      // ❌ NOTIFICACIONES DE EXPENSES DESHABILITADAS - Generan demasiado ruido
      // await sendNotifications('expenseUpdated', notificationData);
      // console.log(`✅ Notificación de actualización de gasto enviada: $${amount} - ${typeExpense}`);
    } catch (notificationError) {
      console.error('❌ Error enviando notificación de actualización de gasto:', notificationError.message);
    }
    
    res.status(200).json(expense);
  } catch (error) {
    if (dbTransaction && !dbTransaction.finished) {
      await dbTransaction.rollback();
    }
    res.status(500).json({ message: 'Error al actualizar el gasto', error: error.message });
  }
};

// Eliminar un gasto
const deleteExpense = async (req, res) => {
  const { id } = req.params;
  const transaction = await sequelize.transaction();
  
  try {
    const expense = await Expense.findByPk(id, { transaction });
    if (!expense) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Gasto no encontrado' });
    }

    // 🏦 REVERTIR TRANSACCIÓN BANCARIA si existe
    let revertedBankTransaction = null;
    const { isBankAccount } = require('../utils/bankTransactionHelper');
    
    if (isBankAccount(expense.paymentMethod)) {
      try {
        const { BankAccount, BankTransaction } = require('../data');
        
        // Buscar la transacción bancaria relacionada (withdrawal)
        const bankTransaction = await BankTransaction.findOne({
          where: {
            relatedExpenseId: expense.idExpense,
            transactionType: 'withdrawal'
          },
          transaction
        });

        if (bankTransaction) {
          // Buscar la cuenta bancaria
          const bankAccount = await BankAccount.findByPk(bankTransaction.bankAccountId, { transaction });

          if (bankAccount) {
            // Restaurar el balance (devolver el dinero)
            const transactionAmount = parseFloat(bankTransaction.amount);
            const newBalance = parseFloat(bankAccount.currentBalance) + transactionAmount;
            await bankAccount.update({ currentBalance: newBalance }, { transaction });

            // Eliminar la transacción bancaria
            await bankTransaction.destroy({ transaction });

            revertedBankTransaction = {
              accountName: bankAccount.accountName,
              amount: transactionAmount,
              newBalance: newBalance
            };

            console.log(`✅ [BANK] Transacción revertida al eliminar expense: ${bankAccount.accountName} +$${transactionAmount} → Balance: $${newBalance.toFixed(2)}`);
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

    // 💰 REVERTIR PAGO DE FIXED EXPENSE si está vinculado
    let revertedFixedExpense = null;
    if (expense.relatedFixedExpenseId) {
      try {
        const { FixedExpense, FixedExpensePayment } = require('../data');
        
        const fixedExpense = await FixedExpense.findByPk(expense.relatedFixedExpenseId, { transaction });
        
        if (fixedExpense) {
          // Buscar el payment relacionado con este expense
          const payment = await FixedExpensePayment.findOne({
            where: { 
              fixedExpenseId: expense.relatedFixedExpenseId,
              expenseId: expense.idExpense 
            },
            transaction
          });

          if (payment) {
            const expenseAmount = parseFloat(expense.amount);
            const currentPaid = parseFloat(fixedExpense.paidAmount) || 0;
            const newPaidAmount = Math.max(0, currentPaid - expenseAmount);
            const totalAmount = parseFloat(fixedExpense.totalAmount);
            
            // Determinar nuevo estado
            const newStatus = newPaidAmount >= totalAmount ? 'paid' : 
                             newPaidAmount > 0 ? 'partial' : 'unpaid';
            
            await fixedExpense.update({
              paidAmount: newPaidAmount,
              paymentStatus: newStatus,
              paidDate: newPaidAmount <= 0 ? null : fixedExpense.paidDate
            }, { transaction });

            // Eliminar el payment record
            await payment.destroy({ transaction });
            
            revertedFixedExpense = {
              fixedExpenseId: fixedExpense.idFixedExpense,
              name: fixedExpense.name,
              previousPaid: currentPaid,
              newPaid: newPaidAmount,
              newStatus: newStatus
            };
            
            console.log(`✅ [FIXED EXPENSE] Pago revertido: ${fixedExpense.name} - $${currentPaid} → $${newPaidAmount} (${newStatus})`);
          }
        }
      } catch (fixedExpenseError) {
        console.error('❌ [FIXED EXPENSE] Error revirtiendo pago:', fixedExpenseError.message);
        await transaction.rollback();
        return res.status(500).json({
          message: 'Error al revertir pago de gasto fijo',
          error: fixedExpenseError.message
        });
      }
    }

    // 📋 REVERTIR PAGO DE SUPPLIER INVOICE si está vinculado
    let revertedInvoicePayment = null;
    if (expense.supplierInvoiceItemId) {
      try {
        const { SupplierInvoice } = require('../data');
        
        // Buscar invoice usando la columna correcta idSupplierInvoice
        const invoice = await SupplierInvoice.findOne({
          where: { idSupplierInvoice: expense.supplierInvoiceItemId },
          transaction
        });
        
        if (invoice) {
          const expenseAmount = parseFloat(expense.amount);  // 🔧 Corregido: amount en vez de totalAmount
          const currentPaid = parseFloat(invoice.paidAmount) || 0;
          const newPaidAmount = Math.max(0, currentPaid - expenseAmount);
          const totalInvoice = parseFloat(invoice.totalAmount);
          
          // Determinar nuevo estado
          let newPaymentStatus;
          if (newPaidAmount === 0) {
            newPaymentStatus = 'pending';
          } else if (newPaidAmount >= totalInvoice) {
            newPaymentStatus = 'paid';
          } else {
            newPaymentStatus = 'partial';
          }
          
          await invoice.update({
            paidAmount: newPaidAmount,
            paymentStatus: newPaymentStatus
          }, { transaction });
          
          revertedInvoicePayment = {
            invoiceId: invoice.idSupplierInvoice,
            vendorName: invoice.vendor,  // 🔧 Corregido: vendor en vez de vendorName
            previousPaid: currentPaid,
            newPaid: newPaidAmount,
            newStatus: newPaymentStatus
          };
          
          console.log(`✅ [INVOICE] Pago revertido: ${invoice.vendor} - $${currentPaid} → $${newPaidAmount} (${newPaymentStatus})`);
        }
      } catch (invoiceError) {
        console.error('❌ [INVOICE] Error revirtiendo pago de invoice:', invoiceError.message);
        await transaction.rollback();
        return res.status(500).json({
          message: 'Error al revertir pago de invoice',
          error: invoiceError.message
        });
      }
    }

    // Eliminar el expense
    await expense.destroy({ transaction });
    
    await transaction.commit();

    res.status(200).json({
      message: 'Gasto eliminado correctamente',
      revertedBankTransaction: revertedBankTransaction,
      revertedFixedExpense: revertedFixedExpense,
      revertedInvoicePayment: revertedInvoicePayment
    });
  } catch (error) {
    // 🔧 Verificar estado de transacción antes de rollback (evitar crash por timeout)
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('⚠️ [DeleteExpense] Error en rollback:', rollbackError.message);
      }
    } else {
      console.warn('⚠️ [DeleteExpense] Transacción ya finalizada, no se puede hacer rollback');
    }
    
    console.error('❌ [DeleteExpense] Error:', error);
    res.status(500).json({ message: 'Error al eliminar el gasto', error: error.message });
  }
};

// Obtener tipos de gasto disponibles (desde el modelo ENUM)
const getExpenseTypes = async (req, res) => {
  try {
    // Los tipos vienen del ENUM definido en el modelo Expense
    const types = [
      'Materiales',
      'Diseño',
      'Workers',
      'Fee de Inspección',
      'Comprobante Gasto',
      'Gastos Generales',
      'Materiales Iniciales',
      'Inspección Inicial',
      'Inspección Final',
      'Comisión Vendedor',
      'Gasto Fijo',
      'Gasto Flota'
    ];
    
    res.status(200).json({ types });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tipos de gasto', error: error.message });
  }
};

// Obtener gastos no pagados (para vincular con invoices)
const getUnpaidExpenses = async (req, res) => {
  try {
    const { workId, vendor } = req.query;

    const where = {
      paymentStatus: 'unpaid'
    };

    if (workId) {
      where.workId = workId;
    }

    if (vendor) {
      where.vendor = { [Op.iLike]: `%${vendor}%` };
    }

    // 🆕 Obtener IDs de expenses que YA están vinculados a invoices
    const linkedExpenseIds = await SupplierInvoiceExpense.findAll({
      attributes: ['expenseId'],
      raw: true
    });

    const linkedIds = linkedExpenseIds.map(item => item.expenseId);

    // 🆕 Excluir expenses que ya están vinculados a un invoice
    if (linkedIds.length > 0) {
      where.idExpense = {
        [Op.notIn]: linkedIds
      };
    }

    const unpaidExpenses = await Expense.findAll({
      where,
      include: [
        {
          model: Work,
          as: 'work',
          attributes: ['idWork', 'propertyAddress'] // Work NO tiene campo 'name'
        },
        {
          model: Staff,
          as: 'Staff',
          attributes: ['id', 'name']
        }
      ],
      order: [['date', 'DESC']]
    });

    console.log(`🔍 Expenses sin pagar y SIN vincular a invoices: ${unpaidExpenses.length}`);
    if (linkedIds.length > 0) {
      console.log(`   ⛔ Excluidos ${linkedIds.length} expenses ya vinculados a invoices`);
    }

    // Devolver array directamente para compatibilidad con frontend
    res.json(unpaidExpenses);

  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener gastos no pagados',
      details: error.message
    });
  }
};

// Obtener gastos por estado de pago
const getExpensesByPaymentStatus = async (req, res) => {
  try {
    const { status } = req.params; // Obtener status desde params de URL
    const { workId } = req.query;

    const where = {};

    // Validar que el status sea válido
    const validStatuses = ['unpaid', 'paid', 'paid_via_invoice'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Estado de pago inválido',
        validStatuses
      });
    }

    if (status) {
      where.paymentStatus = status;
    }

    if (workId) {
      where.workId = workId;
    }

    // 🆕 Si se buscan expenses "unpaid", excluir los que ya están vinculados a invoices
    if (status === 'unpaid') {
      const linkedExpenseIds = await SupplierInvoiceExpense.findAll({
        attributes: ['expenseId'],
        raw: true
      });

      const linkedIds = linkedExpenseIds.map(item => item.expenseId);

      if (linkedIds.length > 0) {
        where.idExpense = {
          [Op.notIn]: linkedIds
        };
      }
    }

    const expenses = await Expense.findAll({
      where,
      include: [
        {
          model: Work,
          as: 'work',
          attributes: ['idWork', 'propertyAddress', 'name']
        },
        {
          model: Staff,
          as: 'Staff',
          attributes: ['id', 'name']
        }
      ],
      order: [['date', 'DESC']]
    });

    // Devolver array directamente para compatibilidad con frontend
    res.json(expenses);

  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener gastos por estado',
      details: error.message
    });
  }
};

// 🆕 Crear gasto general con recibo (para workers)
const createGeneralExpenseWithReceipt = async (req, res) => {
  const { amount, notes, staffId } = req.body;
  
  try {
    // Validaciones
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: true,
        message: 'El monto debe ser mayor a 0'
      });
    }

    if (!staffId) {
      return res.status(400).json({
        error: true,
        message: 'Se requiere el ID del staff'
      });
    }

    // Crear fecha actual en formato local
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Crear el gasto general
    const newExpense = await Expense.create({
      date: localDate,
      amount: parseFloat(amount),
      typeExpense: 'Gastos Generales',
      notes: notes || 'Gasto general registrado por worker',
      workId: null, // No está asociado a un trabajo específico
      staffId: staffId,
      paymentMethod: 'Chase Credit Card', // Método por defecto según especificación
      paymentStatus: 'unpaid',
      verified: false
    });

    // Si hay archivo (recibo), subirlo a Cloudinary y crear Receipt
    let createdReceipt = null;
    if (req.file) {
      try {
        const result = await uploadBufferToCloudinary(req.file.buffer, {
          folder: 'zurcher_receipts/general_expenses',
          resource_type: req.file.mimetype === 'application/pdf' ? 'raw' : 'auto',
          format: req.file.mimetype === 'application/pdf' ? undefined : 'jpg',
          access_mode: 'public'
        });

        createdReceipt = await Receipt.create({
          relatedModel: 'Expense',
          relatedId: newExpense.idExpense.toString(),
          type: 'Gastos Generales',
          notes: notes || 'Comprobante de gasto general',
          fileUrl: result.secure_url,
          publicId: result.public_id,
          mimeType: req.file.mimetype,
          originalName: req.file.originalname
        });
      } catch (uploadError) {
        console.error('Error al subir recibo:', uploadError);
        // No fallar la creación del gasto si falla la subida del recibo
      }
    }

    // Enviar notificaciones
    try {
      const expenseWithDetails = await Expense.findByPk(newExpense.idExpense, {
        include: [
          { model: Staff, as: 'Staff', attributes: ['id', 'name', 'email'] }
        ]
      });

      // ❌ NOTIFICACIONES DE EXPENSES DESHABILITADAS - Generan demasiado ruido
      // await sendNotifications('expenseCreated', expenseWithDetails.toJSON());
      // console.log(`✅ Notificación de gasto general enviada: $${amount}`);
    } catch (notificationError) {
      console.error('❌ Error enviando notificación:', notificationError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Gasto general creado correctamente',
      expense: {
        ...newExpense.toJSON(),
        Receipt: createdReceipt ? createdReceipt.toJSON() : null
      }
    });
  } catch (error) {
    console.error('Error al crear gasto general:', error);
    res.status(500).json({ 
      error: true,
      message: 'Error al crear el gasto general', 
      details: error.message 
    });
  }
};

// 📱 Obtener gastos del usuario logueado (para app móvil)
const getMyExpenses = async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query;
    const staffId = req.user.id; // Usuario logueado desde el token JWT

    console.log('📱 GET /expenses/my - Usuario:', staffId, 'Filtros:', { startDate, endDate, groupBy });

    // Construir filtro base (solo del usuario logueado)
    const where = { staffId };
    
    // Filtrar por rango de fechas si se proporciona
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date[Op.gte] = startDate;
      if (endDate) where.date[Op.lte] = endDate;
    }

    // Obtener gastos con receipts
    const expenses = await Expense.findAll({
      where,
      include: [
        {
          model: Staff,
          as: 'Staff',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']]
    });

    // Obtener receipts por separado
    const expenseIds = expenses.map(expense => expense.idExpense);
    const receipts = expenseIds.length > 0 ? await Receipt.findAll({
      where: {
        relatedModel: 'Expense',
        relatedId: {
          [Op.in]: expenseIds.map(id => id.toString())
        }
      },
      attributes: ['idReceipt', 'relatedId', 'fileUrl', 'mimeType', 'originalName', 'notes']
    }) : [];

    // Asociar receipts manualmente
    const expensesWithReceipts = expenses.map(expense => {
      const expenseReceipts = receipts.filter(receipt => 
        receipt.relatedId === expense.idExpense.toString()
      );
      return {
        ...expense.toJSON(),
        Receipts: expenseReceipts
      };
    });

    // Agrupar por día o mes si se solicita
    let result = expensesWithReceipts;
    if (groupBy === 'day') {
      const grouped = {};
      expensesWithReceipts.forEach(expense => {
        const date = expense.date;
        if (!grouped[date]) {
          grouped[date] = {
            date,
            expenses: [],
            total: 0
          };
        }
        grouped[date].expenses.push(expense);
        grouped[date].total += parseFloat(expense.amount || 0);
      });
      result = Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (groupBy === 'month') {
      const grouped = {};
      expensesWithReceipts.forEach(expense => {
        const month = expense.date.substring(0, 7); // YYYY-MM
        if (!grouped[month]) {
          grouped[month] = {
            month,
            expenses: [],
            total: 0
          };
        }
        grouped[month].expenses.push(expense);
        grouped[month].total += parseFloat(expense.amount || 0);
      });
      result = Object.values(grouped).sort((a, b) => b.month.localeCompare(a.month));
    }

    console.log(`✅ GET /expenses/my - ${expensesWithReceipts.length} gastos encontrados`);
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error al obtener mis gastos:', error);
    res.status(500).json({ message: 'Error al obtener tus gastos', error: error.message });
  }
};

module.exports = {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseTypes,
  getUnpaidExpenses,
  getExpensesByPaymentStatus,
  createGeneralExpenseWithReceipt,
  getMyExpenses
};