const { Work, Budget, FinalInvoice, ChangeOrder, WorkExtraItem, Staff, Expense, Receipt, WorkNote } = require('../data');
const { Sequelize, Op } = require('sequelize');
const { uploadBufferToCloudinary } = require('../utils/cloudinaryUploader');
const { sendNotifications } = require('../utils/notifications/notificationManager');
const { createWithdrawalTransaction } = require('../utils/bankTransactionHelper'); // 🏦 Para pagos de comisiones

/**
 * Helper para formatear fecha sin conversión UTC
 * Devuelve string en formato YYYY-MM-DD en hora local
 */
const formatDateLocal = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Controlador para Cuentas por Cobrar (Accounts Receivable)
 * Maneja el seguimiento de dinero pendiente por cobrar
 */
const AccountsReceivableController = {

  /**
   * Obtener resumen completo de cuentas por cobrar
   * ✅ ACTUALIZADO: Muestra TODOS los Works sin importar el status
   */
  async getAccountsReceivableSummary(req, res) {
    try {
      
      // 1. OBTENER TODOS LOS WORKS (sin filtro de status)
      const worksInProgress = await Work.findAll({
        // ✅ CAMBIO: Removido el filtro de status para mostrar TODOS los Works
        include: [
          {
            model: Budget,
            as: 'budget',
            include: [
              {
                model: Staff,
                as: 'createdByStaff',
                attributes: ['id', 'name', 'email']
              }
            ]
          },
          {
            model: FinalInvoice,
            as: 'finalInvoice',
            required: false,
            include: [
              {
                model: WorkExtraItem,
                as: 'extraItems'
              }
            ]
          },
          {
            model: ChangeOrder,
            as: 'changeOrders',
            where: { status: 'approved' },
            required: false
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Calcular total pendiente de obras en progreso
      let totalPendingFromWorks = 0;
      const worksPendingDetails = worksInProgress.map(work => {
        const budgetTotal = parseFloat(work.budget?.totalPrice || 0);
        const initialPayment = parseFloat(work.budget?.paymentProofAmount || 0);
        
        // Calcular extras de Change Orders aprobados
        const changeOrdersTotal = work.changeOrders?.reduce((sum, co) => {
          return sum + parseFloat(co.newTotalPrice || 0) - parseFloat(co.previousTotalPrice || 0);
        }, 0) || 0;

        // Calcular extras de Final Invoice
        const finalInvoiceExtras = work.finalInvoice?.subtotalExtras || 0;

        // Total a cobrar = Budget + Change Orders + Extras - Pago Inicial
        const totalDue = budgetTotal + changeOrdersTotal + parseFloat(finalInvoiceExtras) - initialPayment;

        // Calcular pagado de Final Invoice
        const finalInvoicePaid = work.finalInvoice?.status === 'paid' ? parseFloat(work.finalInvoice.finalAmountDue) : 0;
        
        const amountPending = totalDue - finalInvoicePaid;

        totalPendingFromWorks += amountPending;

        return {
          workId: work.idWork,
          propertyAddress: work.propertyAddress,
          status: work.status,
          clientName: work.budget?.applicantName || 'N/A',
          budgetTotal,
          initialPayment,
          changeOrdersTotal,
          finalInvoiceExtras,
          totalDue,
          finalInvoicePaid,
          amountPending,
          finalInvoiceStatus: work.finalInvoice?.status || 'not_created',
          hasChangeOrders: work.changeOrders?.length > 0,
          changeOrdersCount: work.changeOrders?.length || 0,
          // 🆕 Información de comisión
          commissionAmount: parseFloat(work.budget?.commissionAmount || 0),
          commissionPaid: work.budget?.commissionPaid || false,
          commissionPaidDate: work.budget?.commissionPaidDate || null,
          salesRepName: work.budget?.createdByStaff?.name || 'N/A',
          salesRepId: work.budget?.createdByStaffId || null
        };
      });

      // 3. FINAL INVOICES PENDIENTES
      const pendingFinalInvoices = await FinalInvoice.findAll({
        where: {
          status: {
            [Op.in]: ['pending', 'partially_paid']
          }
        },
        include: [
          {
            model: Work,
            as: 'Work',
            include: [
              {
                model: Budget,
                as: 'budget'
              }
            ]
          },
          {
            model: WorkExtraItem,
            as: 'extraItems'
          }
        ]
      });

      // Obtener información de envío para cada factura desde WorkNote
      const finalInvoicesWithSentInfo = await Promise.all(
        pendingFinalInvoices.map(async (invoice) => {
          // Buscar WorkNote que indique envío de esta factura
          const sentNote = await WorkNote.findOne({
            where: {
              workId: invoice.workId,
              [Op.and]: [
                {
                  message: {
                    [Op.like]: '%Factura Final%'
                  }
                },
                {
                  message: {
                    [Op.like]: '%ENVIADA%'
                  }
                }
              ],
              noteType: 'payment'
            },
            order: [['createdAt', 'DESC']],
            attributes: ['id', 'message', 'createdAt', 'workId']
          });

          const resultData = {
            ...invoice.toJSON(),
            sentAt: sentNote?.createdAt || null,
            wasSent: !!sentNote
          };

          return resultData;
        })
      );

      const totalPendingFromFinalInvoices = finalInvoicesWithSentInfo.reduce((sum, invoice) => {
        return sum + parseFloat(invoice.finalAmountDue || 0);
      }, 0);

      // 4. CHANGE ORDERS APROBADOS PERO NO INCLUIDOS EN FINAL INVOICE
      const approvedChangeOrders = await ChangeOrder.findAll({
        where: {
          status: 'approved'
        },
        include: [
          {
            model: Work,
            as: 'work',
            include: [
              {
                model: Budget,
                as: 'budget'
              },
              {
                model: FinalInvoice,
                as: 'finalInvoice',
                required: false
              }
            ]
          }
        ]
      });

      const changeOrdersPendingDetails = approvedChangeOrders.map(co => {
        const increase = parseFloat(co.newTotalPrice || 0) - parseFloat(co.previousTotalPrice || 0);
        return {
          changeOrderId: co.id,
          workId: co.workId,
          propertyAddress: co.work?.propertyAddress || 'N/A',
          clientName: co.work?.budget?.applicantName || 'N/A',
          description: co.changeDescription,
          previousTotal: parseFloat(co.previousTotalPrice || 0),
          newTotal: parseFloat(co.newTotalPrice || 0),
          increase,
          approvedDate: co.approvedDate,
          includedInFinalInvoice: !!co.work?.finalInvoice
        };
      });

      // ✅ RESUMEN GENERAL (sin budgets sin work)
      const totalAccountsReceivable = totalPendingFromWorks + totalPendingFromFinalInvoices;

      res.status(200).json({
        summary: {
          totalAccountsReceivable,
          totalPendingFromWorks,
          totalPendingFromFinalInvoices,
          worksInProgressCount: worksInProgress.length,
          pendingFinalInvoicesCount: pendingFinalInvoices.length,
          approvedChangeOrdersCount: approvedChangeOrders.length
        },
        details: {
          // ✅ ELIMINADO: budgetsWithoutWork (no son seguros, no deberían estar aquí)
          worksInProgress: worksPendingDetails,
          pendingFinalInvoices: finalInvoicesWithSentInfo.map(fi => ({
            finalInvoiceId: fi.id,
            invoiceNumber: fi.invoiceNumber,
            workId: fi.workId,
            propertyAddress: fi.Work?.propertyAddress || 'N/A',
            clientName: fi.Work?.budget?.applicantName || 'N/A',
            originalBudgetTotal: parseFloat(fi.originalBudgetTotal || 0),
            initialPaymentMade: parseFloat(fi.initialPaymentMade || 0),
            subtotalExtras: parseFloat(fi.subtotalExtras || 0),
            finalAmountDue: parseFloat(fi.finalAmountDue || 0),
            status: fi.status,
            invoiceDate: fi.invoiceDate,
            extraItemsCount: fi.extraItems?.length || 0,
            wasSent: fi.wasSent,
            sentAt: fi.sentAt
          })),
          approvedChangeOrders: changeOrdersPendingDetails
        }
      });

    } catch (error) {
      console.error('Error obteniendo cuentas por cobrar:', error);
      res.status(500).json({
        error: true,
        message: 'Error al obtener cuentas por cobrar',
        details: error.message
      });
    }
  },

  /**
   * Obtener detalle de una obra específica con toda la información de cobros
   */
  async getWorkReceivableDetail(req, res) {
    const { workId } = req.params;

    try {
      const work = await Work.findByPk(workId, {
        include: [
          {
            model: Budget,
            as: 'budget'
          },
          {
            model: FinalInvoice,
            as: 'finalInvoice',
            include: [
              {
                model: WorkExtraItem,
                as: 'extraItems'
              }
            ]
          },
          {
            model: ChangeOrder,
            as: 'changeOrders',
            where: { status: 'approved' },
            required: false
          }
        ]
      });

      if (!work) {
        return res.status(404).json({ error: true, message: 'Obra no encontrada' });
      }

      // Calcular breakdown detallado
      const budgetTotal = parseFloat(work.budget?.totalPrice || 0);
      const initialPayment = parseFloat(work.budget?.paymentProofAmount || 0);

      const changeOrders = work.changeOrders?.map(co => ({
        id: co.id,
        description: co.changeDescription,
        previousTotal: parseFloat(co.previousTotalPrice || 0),
        newTotal: parseFloat(co.newTotalPrice || 0),
        increase: parseFloat(co.newTotalPrice || 0) - parseFloat(co.previousTotalPrice || 0),
        approvedDate: co.approvedDate
      })) || [];

      const totalChangeOrdersIncrease = changeOrders.reduce((sum, co) => sum + co.increase, 0);

      const extraItems = work.finalInvoice?.extraItems?.map(item => ({
        id: item.id,
        description: item.description,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        lineTotal: parseFloat(item.lineTotal)
      })) || [];

      const totalExtraItems = extraItems.reduce((sum, item) => sum + item.lineTotal, 0);

      const totalDue = budgetTotal + totalChangeOrdersIncrease + totalExtraItems;
      const totalPaid = initialPayment + (work.finalInvoice?.status === 'paid' ? parseFloat(work.finalInvoice.finalAmountDue) : 0);
      const amountPending = totalDue - totalPaid;

      res.status(200).json({
        work: {
          id: work.idWork,
          propertyAddress: work.propertyAddress,
          status: work.status,
          clientName: work.budget?.applicantName || 'N/A'
        },
        financials: {
          budgetTotal,
          initialPayment,
          totalChangeOrdersIncrease,
          totalExtraItems,
          totalDue,
          totalPaid,
          amountPending
        },
        breakdown: {
          changeOrders,
          extraItems
        },
        finalInvoice: work.finalInvoice ? {
          id: work.finalInvoice.id,
          status: work.finalInvoice.status,
          finalAmountDue: parseFloat(work.finalInvoice.finalAmountDue),
          invoiceDate: work.finalInvoice.invoiceDate,
          paymentDate: work.finalInvoice.paymentDate
        } : null
      });

    } catch (error) {
      console.error('Error obteniendo detalle de cuenta por cobrar:', error);
      res.status(500).json({
        error: true,
        message: 'Error al obtener detalle',
        details: error.message
      });
    }
  },

  /**
   * Obtener comisiones pendientes de pago a vendedores
   * ✅ SOLO muestra comisiones de budgets que se convirtieron en Work (aprobados)
   */
  async getPendingCommissions(req, res) {
    try {
      // ✅ FILTRAR: Solo budgets que tienen Work asociado (fueron aprobados)
      const budgetsWithCommissions = await Budget.findAll({
        where: {
          [Op.or]: [
            {
              // Sales Reps (vendedores internos) - comisión fija $500
              leadSource: 'sales_rep',
              createdByStaffId: { [Op.ne]: null },
              commissionAmount: { [Op.gt]: 0 }
            },
            {
              // External Referrals (referidos externos) - comisión variable
              leadSource: 'external_referral',
              commissionAmount: { [Op.gt]: 0 }
            }
          ]
        },
        include: [
          {
            model: Staff,
            as: 'createdByStaff',
            attributes: ['id', 'name', 'email', 'role'],
            required: false
          },
          {
            model: Work,
            attributes: ['idWork', 'status'],
            required: true // ✅ CLAVE: Solo budgets que TIENEN Work asociado
          }
        ]
      });

      // ✅ Calcular totales de comisiones PAGADAS y PENDIENTES
      let totalPendingCommissions = 0;
      let totalPaidCommissions = 0;
      
      budgetsWithCommissions.forEach(budget => {
        // ✅ USAR commissionAmount universal para ambos tipos
        const amount = parseFloat(budget.commissionAmount || 0);
        
        if (budget.commissionPaid) {
          totalPaidCommissions += amount;
        } else {
          totalPendingCommissions += amount;
        }
      });

      // Agrupar por vendedor/referido
      const commissionsBySalesRep = {}; // Incluye sales reps
      const commissionsByExternalReferral = {}; // Incluye external referrals
      
      budgetsWithCommissions.forEach(budget => {
        // ✅ USAR commissionAmount universal
        const amount = parseFloat(budget.commissionAmount || 0);

        if (budget.leadSource === 'sales_rep') {
          // Agrupar por vendedor interno (Staff)
          const staffId = budget.createdByStaffId;
          const staffName = budget.createdByStaff?.name || 'Unknown';
          
          if (!commissionsBySalesRep[staffId]) {
            commissionsBySalesRep[staffId] = {
              type: 'sales_rep',
              staffId,
              staffName,
              staffEmail: budget.createdByStaff?.email,
              totalCommissions: 0,
              totalPaid: 0,
              totalPending: 0,
              budgetsCount: 0,
              budgets: []
            };
          }

          commissionsBySalesRep[staffId].totalCommissions += amount;
          
          if (budget.commissionPaid) {
            commissionsBySalesRep[staffId].totalPaid += amount;
          } else {
            commissionsBySalesRep[staffId].totalPending += amount;
          }
          
          commissionsBySalesRep[staffId].budgetsCount += 1;
          commissionsBySalesRep[staffId].budgets.push({
            budgetId: budget.idBudget,
            propertyAddress: budget.propertyAddress,
            clientName: budget.applicantName || 'N/A',
            commissionAmount: amount,
            commissionPaid: budget.commissionPaid || false,
            commissionPaidDate: budget.commissionPaidDate || null,
            budgetStatus: budget.status,
            workStatus: budget.Work?.status || 'no_work',
            workId: budget.Work?.idWork || null,
            date: budget.date,
            leadSource: 'sales_rep'
          });
        } else if (budget.leadSource === 'external_referral') {
          // Agrupar por referido externo (por nombre ya que no tienen ID único)
          const referralKey = budget.externalReferralName || `unknown_${budget.idBudget}`;
          
          if (!commissionsByExternalReferral[referralKey]) {
            commissionsByExternalReferral[referralKey] = {
              type: 'external_referral',
              referralName: budget.externalReferralName || 'Sin nombre especificado',
              referralEmail: budget.externalReferralEmail,
              referralPhone: budget.externalReferralPhone,
              referralCompany: budget.externalReferralCompany,
              totalCommissions: 0,
              totalPaid: 0,
              totalPending: 0,
              budgetsCount: 0,
              budgets: []
            };
          }

          commissionsByExternalReferral[referralKey].totalCommissions += amount;
          
          if (budget.commissionPaid) {
            commissionsByExternalReferral[referralKey].totalPaid += amount;
          } else {
            commissionsByExternalReferral[referralKey].totalPending += amount;
          }
          
          commissionsByExternalReferral[referralKey].budgetsCount += 1;
          commissionsByExternalReferral[referralKey].budgets.push({
            budgetId: budget.idBudget,
            propertyAddress: budget.propertyAddress,
            clientName: budget.applicantName || 'N/A',
            commissionAmount: amount,
            commissionPaid: budget.commissionPaid || false,
            commissionPaidDate: budget.commissionPaidDate || null,
            budgetStatus: budget.status,
            workStatus: budget.Work?.status || 'no_work',
            workId: budget.Work?.idWork || null,
            date: budget.date,
            leadSource: 'external_referral'
          });
        }
      });

      res.status(200).json({
        summary: {
          totalPendingCommissions,
          totalPaidCommissions,
          totalCommissions: totalPendingCommissions + totalPaidCommissions,
          totalBudgetsWithCommissions: budgetsWithCommissions.length,
          salesRepsCount: Object.keys(commissionsBySalesRep).length,
          externalReferralsCount: Object.keys(commissionsByExternalReferral).length
        },
        bySalesRep: Object.values(commissionsBySalesRep),
        byExternalReferral: Object.values(commissionsByExternalReferral),
        allBudgets: budgetsWithCommissions.map(b => {
          // ✅ USAR commissionAmount universal
          const amount = parseFloat(b.commissionAmount || 0);
            
          return {
            budgetId: b.idBudget,
            propertyAddress: b.propertyAddress,
            leadSource: b.leadSource,
            // Datos de sales rep (si aplica)
            salesRepName: b.createdByStaff?.name || null,
            salesRepId: b.createdByStaffId || null,
            // Datos de external referral (si aplica)
            externalReferralName: b.externalReferralName || 'Sin nombre especificado',
            externalReferralEmail: b.externalReferralEmail || null,
            externalReferralPhone: b.externalReferralPhone || null,
            externalReferralCompany: b.externalReferralCompany || null,
            // Datos comunes
            clientName: b.applicantName || 'N/A',
            commissionAmount: amount,
            commissionPaid: b.commissionPaid || false,
            commissionPaidDate: b.commissionPaidDate || null,
            budgetStatus: b.status,
            workStatus: b.Work?.status || 'no_work',
            workId: b.Work?.idWork || null,
            date: b.date
          };
        })
      });

    } catch (error) {
      console.error('Error obteniendo comisiones pendientes:', error);
      res.status(500).json({
        error: true,
        message: 'Error al obtener comisiones pendientes',
        details: error.message
      });
    }
  },

  /**
   * 🆕 Obtener budgets aprobados (invoices activos) con tracking de pagos
   * Muestra todos los budgets que ya están aprobados/signed y se convirtieron en invoices
   */
  /**
   * Obtener invoices activos con detalles de cobros
   * ✅ ACTUALIZADO: Muestra solo WORKS (no budgets sueltos)
   */
  async getActiveInvoices(req, res) {
    try {
      const { 
        status, // 'all', 'pending_payment', 'partial', 'completed'
        startDate, 
        endDate, 
        salesRepId,
        searchTerm 
      } = req.query;

      // ✅ CAMBIO: Buscar WORKS en lugar de BUDGETS
      // Condiciones para filtrar Works
      const workWhereConditions = {};

      // Filtro por búsqueda (dirección)
      if (searchTerm) {
        workWhereConditions.propertyAddress = { [Op.iLike]: `%${searchTerm}%` };
      }

      // Condiciones para Budget asociado
      const budgetWhereConditions = {};

      // Filtro de fechas
      if (startDate && endDate) {
        budgetWhereConditions.date = {
          [Op.between]: [startDate, endDate]
        };
      } else if (startDate) {
        budgetWhereConditions.date = {
          [Op.gte]: startDate
        };
      } else if (endDate) {
        budgetWhereConditions.date = {
          [Op.lte]: endDate
        };
      }

      // Filtro por vendedor
      if (salesRepId) {
        budgetWhereConditions.createdByStaffId = salesRepId;
      }

      // Filtro de búsqueda en cliente (dentro de budget)
      if (searchTerm) {
        budgetWhereConditions.applicantName = { [Op.iLike]: `%${searchTerm}%` };
      }

      // Buscar WORKS con sus budgets asociados
      const works = await Work.findAll({
        where: workWhereConditions,
        include: [
          {
            model: Budget,
            as: 'budget',
            where: budgetWhereConditions,
            required: true, // Solo Works que tengan Budget
            include: [
              {
                model: Staff,
                as: 'createdByStaff',
                attributes: ['id', 'name', 'email']
              }
            ]
          },
          {
            model: ChangeOrder,
            as: 'changeOrders',
            where: { status: 'approved' },
            required: false
          },
          {
            model: FinalInvoice,
            as: 'finalInvoice',
            required: false
          }
        ],
        order: [[{ model: Budget, as: 'budget' }, 'date', 'DESC']]
      });

      const invoicesData = works.map(work => {
        // ✅ CORREGIDO: Usar totalPrice (que ya tiene descuento aplicado)
        const budgetTotal = parseFloat(work.budget?.totalPrice || 0);
        const initialPayment = parseFloat(work.budget?.paymentProofAmount || 0);
        
        // Calcular change orders aprobados
        const changeOrders = work.changeOrders || [];
        const changeOrdersTotal = changeOrders.reduce((sum, co) => {
          return sum + (parseFloat(co.newTotalPrice || 0) - parseFloat(co.previousTotalPrice || 0));
        }, 0);

        // Calcular extras de Final Invoice (si existe y está aplicado el descuento)
        const finalInvoice = work.finalInvoice;
        let finalInvoiceExtras = 0;
        let finalInvoiceDiscount = 0;
        
        if (finalInvoice) {
          finalInvoiceExtras = parseFloat(finalInvoice.subtotalExtras || 0);
          finalInvoiceDiscount = parseFloat(finalInvoice.discount || 0);
        }

        // Total esperado = Budget + Change Orders + Extras - Descuento de Final Invoice
        const expectedTotal = budgetTotal + changeOrdersTotal + finalInvoiceExtras - finalInvoiceDiscount;
        
        // Total cobrado hasta ahora (INCLUYE el pago inicial)
        let totalCollected = initialPayment;
        
        // Si hay final invoice pagado, sumar lo adicional (sin contar el initial payment que ya está en totalCollected)
        if (work.finalInvoice?.status === 'paid') {
          // finalAmountDue es el monto de la final invoice (NO incluye initial payment)
          totalCollected += parseFloat(work.finalInvoice.finalAmountDue || 0);
        } else if (work.finalInvoice?.status === 'partially_paid') {
          totalCollected += parseFloat(work.finalInvoice.amountPaid || 0);
        }

        // Monto restante por cobrar
        const remainingAmount = expectedTotal - totalCollected;

        // Determinar estado de pago
        let paymentStatus;
        if (remainingAmount <= 0) {
          paymentStatus = 'completed';
        } else if (totalCollected > initialPayment) {
          paymentStatus = 'partial';
        } else if (initialPayment > 0) {
          paymentStatus = 'initial_only';
        } else {
          paymentStatus = 'pending_payment';
        }

        return {
          budgetId: work.budget?.idBudget,
          invoiceNumber: work.budget?.invoiceNumber,
          propertyAddress: work.propertyAddress,
          clientName: work.budget?.applicantName,
          budgetDate: work.budget?.date,
          budgetStatus: work.budget?.status,
          
          // Información del vendedor/referido
          leadSource: work.budget?.leadSource,
          salesRepName: work.budget?.createdByStaff?.name || null,
          salesRepId: work.budget?.createdByStaffId || null,
          externalReferralName: work.budget?.externalReferralName || null,
          externalReferralCompany: work.budget?.externalReferralCompany || null,
          
          // Desglose financiero
          budgetTotal,
          initialPayment,
          changeOrdersCount: changeOrders.length,
          changeOrdersTotal,
          finalInvoiceExtras,
          expectedTotal,
          totalCollected,
          remainingAmount,
          paymentStatus,
          
          // Estado del trabajo
          hasWork: true, // Siempre true porque estamos buscando Works
          workId: work.idWork,
          workStatus: work.status,
          
          // Final Invoice
          hasFinalInvoice: !!work.finalInvoice,
          finalInvoiceId: work.finalInvoice?.id || null,
          finalInvoiceStatus: work.finalInvoice?.status || 'not_created',
          finalInvoiceAmount: work.finalInvoice?.finalAmountDue || 0,
          
          // Comisión
          commissionAmount: parseFloat(work.budget?.commissionAmount || 0),
          commissionPaid: work.budget?.commissionPaid || false
        };
      });

      // Aplicar filtro de estado de pago si se especifica
      let filteredInvoices = invoicesData;
      if (status && status !== 'all') {
        filteredInvoices = invoicesData.filter(inv => inv.paymentStatus === status);
      }

      // Calcular resumen
      const summary = {
        totalInvoices: filteredInvoices.length,
        totalExpected: filteredInvoices.reduce((sum, inv) => sum + inv.expectedTotal, 0),
        totalCollected: filteredInvoices.reduce((sum, inv) => sum + inv.totalCollected, 0),
        totalRemaining: filteredInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0),
        
        byStatus: {
          completed: filteredInvoices.filter(inv => inv.paymentStatus === 'completed').length,
          partial: filteredInvoices.filter(inv => inv.paymentStatus === 'partial').length,
          initial_only: filteredInvoices.filter(inv => inv.paymentStatus === 'initial_only').length,
          pending_payment: filteredInvoices.filter(inv => inv.paymentStatus === 'pending_payment').length
        }
      };

      res.status(200).json({
        summary,
        invoices: filteredInvoices
      });

    } catch (error) {
      console.error('Error obteniendo invoices activos:', error);
      res.status(500).json({
        error: true,
        message: 'Error al obtener invoices activos',
        details: error.message
      });
    }
  },

  /**
   * 🆕 Marcar comisión como pagada Y crear Expense automáticamente
   * Sigue el mismo patrón que UploadVouchers para consistencia
   */
  async markCommissionAsPaid(req, res) {
    try {
      const { budgetId } = req.params;
      const { 
        paid, 
        paidDate, 
        paymentMethod, 
        paymentDetails, 
        notes 
      } = req.body;

      // ✅ Validaciones
      if (!paymentMethod && paid) {
        return res.status(400).json({
          error: true,
          message: '⚠️ El método de pago es obligatorio para marcar como pagada'
        });
      }

      const budget = await Budget.findByPk(budgetId, {
        include: [
          {
            model: Staff,
            as: 'createdByStaff',
            attributes: ['id', 'name', 'email']
          },
          {
            model: Work,
            attributes: ['idWork', 'propertyAddress', 'status']
          }
        ]
      });
      
      if (!budget) {
        return res.status(404).json({
          error: true,
          message: 'Budget no encontrado'
        });
      }

      // ✅ Verificar que tenga Work asociado
      if (!budget.Work) {
        return res.status(400).json({
          error: true,
          message: 'Este budget no tiene un Work asociado. Solo se pueden pagar comisiones de budgets aprobados.'
        });
      }

      const commissionAmount = parseFloat(budget.commissionAmount || 0);
      
      if (commissionAmount <= 0) {
        return res.status(400).json({
          error: true,
          message: 'Este budget no tiene un monto de comisión configurado'
        });
      }

      let createdExpense = null;
      let createdReceipt = null;

      // ✅ Si se marca como pagada, crear el Expense automáticamente
      if (paid) {

        // Determinar el vendor según el tipo de comisión
        let vendor = '';
        let expenseNotes = notes || '';

        if (budget.leadSource === 'sales_rep') {
          vendor = budget.createdByStaff?.name || 'Vendedor no especificado';
          expenseNotes = `Comisión Sales Rep - ${vendor} - Budget ${budget.propertyAddress}`;
        } else if (budget.leadSource === 'external_referral') {
          vendor = budget.externalReferralName || 'Referido externo';
          expenseNotes = `Comisión Referido Externo - ${vendor} - Budget ${budget.propertyAddress}`;
          if (budget.externalReferralCompany) {
            expenseNotes += ` (${budget.externalReferralCompany})`;
          }
        }

        // Crear el Expense con fecha como string YYYY-MM-DD
        const expenseDate = paidDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

        createdExpense = await Expense.create({
          date: expenseDate,
          amount: commissionAmount,
          typeExpense: 'Comisión Vendedor',
          notes: expenseNotes,
          workId: budget.Work.idWork,
          staffId: req.user?.id || null, // ✅ Usuario que paga la comisión (no el vendedor)
          paymentMethod,
          paymentDetails: paymentDetails || null,
          verified: false, // Requiere verificación de finanzas
          paymentStatus: 'paid', // Ya se pagó
          vendor: vendor
        });

        // 🏦 Crear BankTransaction si paymentMethod es cuenta bancaria
        const isBankPayment = ['Chase Bank', 'Proyecto Septic BOFA'].includes(paymentMethod);
        if (isBankPayment) {
          try {
            await createWithdrawalTransaction({
              paymentMethod,
              amount: commissionAmount,
              date: expenseDate,
              description: `Comisión: ${vendor}`,
              relatedExpenseId: createdExpense.idExpense,
              notes: expenseNotes,
              createdByStaffId: req.user?.id || null,
              skipBalanceCheck: true  // 🏦 Permitir sobregiros
            });
          } catch (bankError) {
            console.error('❌ Error creando transacción bancaria:', bankError.message);
            // No bloqueamos el pago si falla la transacción bancaria
          }
        }

        // ✅ Si hay archivo adjunto, crear Receipt
        if (req.file) {
          
          const result = await uploadBufferToCloudinary(req.file.buffer, {
            folder: 'zurcher_receipts',
            resource_type: req.file.mimetype === 'application/pdf' ? 'raw' : 'auto',
            format: req.file.mimetype === 'application/pdf' ? undefined : 'jpg',
            access_mode: 'public'
          });

          createdReceipt = await Receipt.create({
            relatedModel: 'Expense',
            relatedId: createdExpense.idExpense.toString(),
            type: 'Comisión Vendedor',
            notes: expenseNotes,
            fileUrl: result.secure_url,
            publicId: result.public_id,
            mimeType: req.file.mimetype,
            originalName: req.file.originalname
          });
        }

        // ❌ NOTIFICACIONES DE EXPENSES DESHABILITADAS - Generan demasiado ruido
        // try {
        //   await sendNotifications('expenseCreated', {
        //     ...createdExpense.toJSON(),
        //     propertyAddress: budget.Work.propertyAddress,
        //     Staff: budget.createdByStaff
        //   });
        // } catch (notificationError) {
        //   console.error('❌ Error enviando notificación:', notificationError.message);
        // }
      }

      // ✅ Actualizar estado de comisión en el Budget (guardar fecha como string)
      budget.commissionPaid = paid;
      
      if (paid) {
        // Guardar fecha directamente como string YYYY-MM-DD
        if (paidDate) {
          budget.commissionPaidDate = paidDate;
        } else {
          const today = new Date();
          budget.commissionPaidDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        }
      } else {
        budget.commissionPaidDate = null;
      }
      
      await budget.save();

      res.status(200).json({
        success: true,
        message: paid 
          ? `✅ Comisión marcada como pagada y Expense creado automáticamente` 
          : `Comisión marcada como no pagada`,
        budget: {
          idBudget: budget.idBudget,
          propertyAddress: budget.propertyAddress,
          commissionAmount: budget.commissionAmount,
          commissionPaid: budget.commissionPaid,
          commissionPaidDate: budget.commissionPaidDate, // Ya es string
          leadSource: budget.leadSource,
          salesRepName: budget.createdByStaff?.name || null,
          externalReferralName: budget.externalReferralName || null
        },
        expense: createdExpense ? {
          idExpense: createdExpense.idExpense,
          amount: createdExpense.amount,
          date: createdExpense.date,
          paymentMethod: createdExpense.paymentMethod,
          vendor: createdExpense.vendor,
          hasReceipt: !!createdReceipt
        } : null,
        receipt: createdReceipt ? {
          idReceipt: createdReceipt.idReceipt,
          fileUrl: createdReceipt.fileUrl,
          originalName: createdReceipt.originalName
        } : null
      });

    } catch (error) {
      console.error('Error actualizando estado de comisión:', error);
      res.status(500).json({
        error: true,
        message: 'Error al actualizar estado de comisión',
        details: error.message
      });
    }
  },

  /**
   * Obtener todos los ingresos recibidos (Income)
   * Muestra todos los pagos recibidos de clientes
   */
  async getIncome(req, res) {
    try {

      // 1. Obtener todos los Budgets con Initial Payment
      const budgetsWithInitialPayment = await Budget.findAll({
        where: {
          initialPayment: { [Op.gt]: 0 }
        },
        attributes: [
          'idBudget',
          'invoiceNumber',
          'propertyAddress',
          'totalPrice',
          'initialPayment',
          'paymentProofMethod',
          'createdAt'
        ],
        include: [
          {
            model: Work,
            attributes: ['idWork', 'status'],
            required: false
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // 2. Obtener todos los Final Invoices pagados (con monto > 0)
      const finalInvoicePayments = await FinalInvoice.findAll({
        where: {
          [Op.or]: [
            { status: 'paid' },
            { totalAmountPaid: { [Op.gt]: 0 } }
          ]
        },
        attributes: [
          'id',
          'finalAmountDue',
          'totalAmountPaid',
          'paymentDate',
          'paymentNotes',
          'createdAt'
        ],
        include: [
          {
            model: Work,
            attributes: ['idWork', 'status'],
            include: [
              {
                model: Budget,
                as: 'budget',
                attributes: ['idBudget', 'invoiceNumber', 'propertyAddress']
              }
            ]
          }
        ],
        order: [['paymentDate', 'DESC']]
      });

      // 3. Formatear datos de Initial Payments
      const initialPayments = budgetsWithInitialPayment.map(budget => ({
        id: `initial-${budget.idBudget}`,
        type: 'initial_payment',
        date: formatDateLocal(budget.createdAt),
        amount: parseFloat(budget.initialPayment || 0),
        paymentMethod: budget.paymentProofMethod || 'No especificado',
        budgetNumber: budget.invoiceNumber || budget.idBudget,
        propertyAddress: budget.propertyAddress,
        workId: budget.Work?.idWork || null,
        workStatus: budget.Work?.status || 'Sin Work',
        notes: 'Initial Payment'
      }));

      // 4. Formatear datos de Final Invoice Payments
      const finalPayments = finalInvoicePayments.map(invoice => ({
        id: `final-${invoice.id}`,
        type: 'final_payment',
        date: formatDateLocal(invoice.paymentDate || invoice.createdAt),
        amount: parseFloat(invoice.totalAmountPaid || 0),
        paymentMethod: invoice.paymentNotes || 'No especificado',
        budgetNumber: invoice.Work?.budget?.invoiceNumber || invoice.Work?.budget?.idBudget || 'N/A',
        propertyAddress: invoice.Work?.budget?.propertyAddress || 'N/A',
        workId: invoice.Work?.idWork || null,
        workStatus: invoice.Work?.status || 'N/A',
        notes: `Final Invoice #${invoice.id}`
      }));

      // 5. Combinar y ordenar por fecha (más reciente primero)
      const allIncome = [...initialPayments, ...finalPayments].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });

      // 6. Calcular totales
      const totalIncome = allIncome.reduce((sum, income) => sum + income.amount, 0);
      const totalInitialPayments = initialPayments.reduce((sum, p) => sum + p.amount, 0);
      const totalFinalPayments = finalPayments.reduce((sum, p) => sum + p.amount, 0);

      res.json({
        summary: {
          totalIncome,
          totalInitialPayments,
          totalFinalPayments,
          totalTransactions: allIncome.length,
          initialPaymentsCount: initialPayments.length,
          finalPaymentsCount: finalPayments.length
        },
        income: allIncome
      });

    } catch (error) {
      console.error('❌ [Income] Error:', error);
      res.status(500).json({
        error: true,
        message: 'Error al obtener ingresos',
        details: error.message
      });
    }
  }
};

module.exports = AccountsReceivableController;
