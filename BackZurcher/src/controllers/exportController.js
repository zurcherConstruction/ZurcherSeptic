const ExcelJS = require('exceljs');
const { Work, Permit, Budget, Inspection, Income, WorkChecklist, FixedExpense, FixedExpensePayment } = require('../data/index');
const { Op } = require('sequelize');

/**
 * Exportar works a Excel con filtros
 * GET /api/export/works
 * Query params:
 * - status: 'all', 'maintenance', 'active' (sin maintenance)
 * - applicantEmail: filtrar por email/contacto de aplicante
 * - exportType: 'standard' (default) | 'complete'
 */
const exportWorksToExcel = async (req, res) => {
  try {
    const { status = 'all', applicantEmail, exportType = 'standard', county, city, systemType, isPBTS, applicantName } = req.query;
    const isComplete = exportType === 'complete';

    console.log(`📊 [Export Works] Generando Excel (tipo: ${exportType})...`);

    // Filtros sobre Work
    const whereConditions = {};
    if (status === 'maintenance') {
      whereConditions.status = 'maintenance';
    } else if (status === 'active') {
      whereConditions.status = { [Op.notIn]: ['maintenance', 'cancelled'] };
    } else if (status && status !== 'all') {
      whereConditions.status = status;
    }

    // Filtros sobre Permit
    const permitWhere = {};
    if (applicantEmail) permitWhere.applicantEmail = { [Op.iLike]: `%${applicantEmail}%` };
    if (applicantName) permitWhere.applicantName = { [Op.iLike]: `%${applicantName}%` };
    if (county && county !== 'all') permitWhere.county = { [Op.iLike]: `%${county}%` };
    if (city) permitWhere.city = { [Op.iLike]: `%${city}%` };
    if (systemType && systemType !== 'all') permitWhere.systemType = { [Op.iLike]: `%${systemType}%` };
    if (isPBTS !== undefined && isPBTS !== '' && isPBTS !== 'all') permitWhere.isPBTS = isPBTS === 'true';
    const hasPermitFilters = Object.keys(permitWhere).length > 0;

    // Includes base
    const permitAttrs = ['applicantName', 'applicantEmail', 'permitNumber', 'systemType', 'isPBTS', 'county', 'city'];
    const includes = [
      {
        model: Permit,
        attributes: permitAttrs,
        ...(hasPermitFilters ? { where: permitWhere, required: true } : { required: false }),
      },
      {
        model: Inspection,
        as: 'inspections',
        attributes: ['dateInspectionPerformed', 'finalStatus', 'type', 'processStatus'],
        required: false,
        separate: true,
        order: [['dateInspectionPerformed', 'DESC']]
      },
      {
        model: Income,
        as: 'incomes',
        attributes: ['date', 'typeIncome'],
        required: false,
        separate: true,
        order: [['date', 'DESC']]
      }
    ];

    if (isComplete) {
      includes.push({
        model: WorkChecklist,
        as: 'checklist',
        attributes: ['feeInspectionPaid', 'initialInspectionPaid', 'finalInspectionPaid'],
        required: false
      });
    }

    const works = await Work.findAll({
      where: whereConditions,
      include: includes,
      order: [['createdAt', 'DESC']]
    });

    console.log(`✅ Se encontraron ${works.length} works para exportar`);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Works');

    if (isComplete) {
      worksheet.columns = [
        { header: 'Property Address',       key: 'address',              width: 40 },
        { header: 'Applicant Name',          key: 'applicantName',        width: 25 },
        { header: 'County',                  key: 'county',               width: 18 },
        { header: 'City',                    key: 'city',                 width: 18 },
        { header: 'Permit Number',           key: 'permitNumber',         width: 18 },
        { header: 'Applicant Email',         key: 'applicantEmail',       width: 30 },
        { header: 'System Type',             key: 'systemType',           width: 18 },
        { header: 'PBTS',                    key: 'isPBTS',               width: 8  },
        { header: 'Status',                  key: 'status',               width: 22 },
        { header: 'Start Date',              key: 'startDate',            width: 15 },
        { header: 'Initial Insp. Date',      key: 'initialInspDate',      width: 17 },
        { header: 'Initial Insp. Result',    key: 'initialInspResult',    width: 20 },
        { header: 'Final Insp. Date',        key: 'finalInspDate',        width: 17 },
        { header: 'Final Insp. Result',      key: 'finalInspResult',      width: 20 },
        { header: 'Fee Paid',                key: 'feePaid',              width: 10 },
        { header: 'Final Invoice Date',      key: 'finalInvoiceDate',     width: 17 },
      ];
    } else {
      worksheet.columns = [
        { header: 'Property Address',  key: 'address',          width: 40 },
        { header: 'Applicant Name',    key: 'applicantName',    width: 25 },
        { header: 'County',            key: 'county',           width: 18 },
        { header: 'City',              key: 'city',             width: 18 },
        { header: 'System Type',       key: 'systemType',       width: 15 },
        { header: 'PBTS',              key: 'isPBTS',           width: 8  },
        { header: 'Applicant Email',   key: 'applicantEmail',   width: 30 },
        { header: 'Status',            key: 'status',           width: 20 },
        { header: 'Start Date',        key: 'startDate',        width: 15 },
        { header: 'Installation Date', key: 'installationDate', width: 15 },
        { header: 'Final Invoice Date',key: 'finalInvoiceDate', width: 15 }
      ];
    }

    // Header styles
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isComplete ? 'FF1F5C2E' : 'FF4472C4' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    works.forEach(work => {
      const firstInspection = work.inspections?.find(i => i.type === 'initial');
      const finalInspection = work.inspections?.find(i => i.type === 'final');
      const finalIncome = work.incomes?.find(i => i.typeIncome === 'Factura Pago Final Budget');

      let row;

      if (isComplete) {
        row = worksheet.addRow({
          address:           work.propertyAddress || 'N/A',
          applicantName:     work.Permit?.applicantName || 'N/A',
          county:            work.Permit?.county || '',
          city:              work.Permit?.city || '',
          permitNumber:      work.Permit?.permitNumber || 'N/A',
          applicantEmail:    work.Permit?.applicantEmail || 'N/A',
          systemType:        work.Permit?.systemType || 'N/A',
          isPBTS:            work.Permit?.isPBTS ? 'Yes' : 'No',
          status:            work.status || 'N/A',
          startDate:         work.installationStartDate ? formatDate(work.installationStartDate) : 'N/A',
          initialInspDate:   firstInspection?.dateInspectionPerformed
                               ? formatDate(firstInspection.dateInspectionPerformed) : 'N/A',
          initialInspResult: resolveInspectionResult(firstInspection),
          finalInspDate:     finalInspection?.dateInspectionPerformed
                               ? formatDate(finalInspection.dateInspectionPerformed) : 'N/A',
          finalInspResult:   resolveInspectionResult(finalInspection),
          feePaid:           work.checklist?.feeInspectionPaid ? 'Yes' : 'No',
          finalInvoiceDate:  finalIncome?.date ? formatDate(finalIncome.date) : 'N/A',
        });

        // Color-code initial inspection result cell
        applyResultColor(row.getCell('initialInspResult'), firstInspection);
        applyResultColor(row.getCell('finalInspResult'), finalInspection);
        applyBoolColor(row.getCell('feePaid'), work.checklist?.feeInspectionPaid);
        applyBoolColor(row.getCell('isPBTS'), work.Permit?.isPBTS);
      } else {
        row = worksheet.addRow({
          address:          work.propertyAddress || 'N/A',
          applicantName:    work.Permit?.applicantName || 'N/A',
          county:           work.Permit?.county || '',
          city:             work.Permit?.city || '',
          systemType:       work.Permit?.systemType || '',
          isPBTS:           work.Permit?.isPBTS ? 'Yes' : 'No',
          applicantEmail:   work.Permit?.applicantEmail || 'N/A',
          status:           work.status || 'N/A',
          startDate:        work.installationStartDate ? formatDate(work.installationStartDate) : 'N/A',
          installationDate: firstInspection?.dateInspectionPerformed
                              ? formatDate(firstInspection.dateInspectionPerformed) : 'N/A',
          finalInvoiceDate: finalIncome?.date ? formatDate(finalIncome.date) : 'N/A'
        });
      }

      // Alternating row bg (only for non-highlighted cells in complete mode)
      if (!isComplete && row.number % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' }
        };
      }
    });

    worksheet.eachRow(row => { row.height = 20; });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const filename = `works-${isComplete ? 'complete' : 'export'}-${Date.now()}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ [Export Works] Excel (${exportType}) generado y enviado`);
  } catch (error) {
    console.error('❌ [Export Works] Error:', error);
    res.status(500).json({
      error: 'Error al exportar works',
      details: error.message
    });
  }
};

// --- Helpers ---

const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  const year  = d.getFullYear();
  return `${month}-${day}-${year}`;
};

const resolveInspectionResult = (inspection) => {
  if (!inspection) return 'No inspection';
  if (inspection.finalStatus === 'approved') return 'Approved';
  if (inspection.finalStatus === 'rejected') return 'Rejected';
  if (inspection.processStatus === 'inspection_completed_pending_result') return 'Pending Result';
  if (inspection.processStatus && inspection.processStatus !== 'pending_request') return 'In Progress';
  return 'Pending';
};

const applyResultColor = (cell, inspection) => {
  if (!inspection) return;
  const status = inspection.finalStatus;
  if (status === 'approved') {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
    cell.font = { color: { argb: 'FF276221' }, bold: true };
  } else if (status === 'rejected') {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
    cell.font = { color: { argb: 'FF9C0006' }, bold: true };
  } else if (inspection.processStatus === 'inspection_completed_pending_result') {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
    cell.font = { color: { argb: 'FF9C6500' }, bold: true };
  }
};

const applyBoolColor = (cell, value) => {
  if (value) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
    cell.font = { color: { argb: 'FF276221' } };
  }
};

const FREQ_LABELS = {
  monthly: 'Mensual', biweekly: 'Quincenal', weekly: 'Semanal',
  quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual', one_time: 'Único'
};

const fmtDateShort = (date) => {
  if (!date) return '';
  const s = typeof date === 'string' ? date : date.toISOString();
  return s.slice(0, 10);
};

const exportFixedExpensesToExcel = async (req, res) => {
  try {
    const { from, to } = req.query;
    const monthRegex = /^\d{4}-\d{2}$/;

    if (!from || !monthRegex.test(from)) {
      return res.status(400).json({ error: 'Parámetro "from" requerido (formato YYYY-MM)' });
    }
    const toMonth = (to && monthRegex.test(to)) ? to : from;

    const [fy, fm] = from.split('-').map(Number);
    const [ty, tm] = toMonth.split('-').map(Number);
    const fromDate = new Date(fy, fm - 1, 1);
    const toDate   = new Date(ty, tm - 1, 1);

    if (toDate < fromDate) {
      return res.status(400).json({ error: '"to" debe ser mayor o igual a "from"' });
    }

    const months = [];
    let cur = new Date(fromDate);
    while (cur <= toDate && months.length < 24) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
      cur.setMonth(cur.getMonth() + 1);
    }

    const rangeStart = `${months[0]}-01`;
    const [lastY, lastMo] = months[months.length - 1].split('-').map(Number);
    const lastDay = new Date(Date.UTC(lastY, lastMo, 0)).getUTCDate();
    const rangeEnd = `${months[months.length - 1]}-${String(lastDay).padStart(2, '0')}`;

    console.log(`📊 [Export FixedExpenses] ${from} → ${toMonth} (${months.length} meses)`);

    // Incluir activos E inactivos (para capturar pagos únicos ya cerrados)
    const expenses = await FixedExpense.findAll({
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    // Incluir receiptUrl para mostrar comprobantes
    const payments = await FixedExpensePayment.findAll({
      where: {
        [Op.or]: [
          { periodStart: { [Op.between]: [rangeStart, rangeEnd] } },
          { paymentDate: { [Op.between]: [rangeStart, rangeEnd] } }
        ]
      },
      order: [['periodStart', 'ASC'], ['paymentDate', 'ASC']]
    });

    // Group payments by month → expenseId (usando periodStart o paymentDate)
    const pmtMap = {};
    const allPaymentRows = []; // para hoja de detalle individual

    payments.forEach(p => {
      const dateKey = p.periodStart
        ? p.periodStart.toString().slice(0, 7)
        : p.paymentDate.toString().slice(0, 7);
      if (!pmtMap[dateKey]) pmtMap[dateKey] = {};
      const eid = p.fixedExpenseId;
      if (!pmtMap[dateKey][eid]) pmtMap[dateKey][eid] = [];
      pmtMap[dateKey][eid].push(p);
      allPaymentRows.push({ month: dateKey, payment: p });
    });

    // Indexar expenses por id para la hoja de detalle
    const expenseById = {};
    expenses.forEach(e => { expenseById[e.idFixedExpense] = e; });

    const rows = [];
    const summaryByMonth = {};

    for (const month of months) {
      const [y, mo] = month.split('-').map(Number);
      const mLastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const monthEnd = `${month}-${String(mLastDay).padStart(2, '0')}`;
      const pmtsThisMonth = pmtMap[month] || {};
      let monthExpectedTotal = 0;
      let monthPaidTotal = 0;

      for (const expense of expenses) {
        const totalAmount = parseFloat(expense.totalAmount);
        const nextDue = expense.nextDueDate ? expense.nextDueDate.toString().slice(0, 10) : null;
        const alwaysMonthly = ['monthly', 'biweekly', 'weekly'].includes(expense.frequency);
        const isDueThisMonthOrBefore = alwaysMonthly || !nextDue || nextDue <= monthEnd;
        const expPmts = pmtsThisMonth[expense.idFixedExpense] || [];

        let monthPaidAmount = expPmts.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        let isPaidThisMonth = false;
        let paymentDates = '';
        let paymentMethodLabel = '';
        let receiptUrls = [];

        if (expPmts.length > 0) {
          isPaidThisMonth = expense.variableAmount
            ? monthPaidAmount > 0
            : monthPaidAmount >= totalAmount - 0.01;
          paymentDates = expPmts.map(p => fmtDateShort(p.paymentDate)).join(', ');
          const methods = [...new Set(expPmts.map(p => p.paymentMethod).filter(Boolean))];
          paymentMethodLabel = methods.join(', ');
          receiptUrls = expPmts.map(p => p.receiptUrl).filter(Boolean);
        } else if (
          isDueThisMonthOrBefore &&
          (expense.paymentStatus === 'paid' || expense.paymentStatus === 'paid_via_credit_card')
        ) {
          monthPaidAmount = parseFloat(expense.paidAmount || 0);
          isPaidThisMonth = true;
          paymentDates = expense.paidDate ? fmtDateShort(expense.paidDate) : '';
          paymentMethodLabel = expense.paymentMethod || '';
        } else {
          monthPaidAmount = 0;
        }

        const showInChecklist = monthPaidAmount > 0 || isDueThisMonthOrBefore;
        if (!showInChecklist) continue;

        const isPartiallyPaid = !isPaidThisMonth && monthPaidAmount > 0;
        let statusLabel;
        if (isPaidThisMonth) {
          statusLabel = expense.paymentStatus === 'paid_via_credit_card' ? 'Pagado (TC)' : 'Pagado';
        } else if (isPartiallyPaid) {
          statusLabel = 'Parcial';
        } else {
          statusLabel = 'Pendiente';
        }

        if (isDueThisMonthOrBefore) monthExpectedTotal += totalAmount;
        monthPaidTotal += monthPaidAmount;

        rows.push({
          month,
          category: expense.category || '',
          name: expense.name,
          frequency: FREQ_LABELS[expense.frequency] || expense.frequency || '',
          totalAmount,
          monthPaidAmount,
          diff: Math.max(0, totalAmount - monthPaidAmount),
          statusLabel,
          isPaidThisMonth,
          isPartiallyPaid,
          paymentMethod: paymentMethodLabel,
          paymentDates,
          account: expense.paymentAccount || '',
          notes: expense.notes || '',
          receiptUrls, // array de URLs de comprobantes
        });
      }

      summaryByMonth[month] = { totalAmount: monthExpectedTotal, paidAmount: monthPaidTotal };
    }

    // ── Build Workbook ──
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ZurcherSeptic';
    workbook.created = new Date();

    // Sheet 1: Detail (one row per expense per month)
    const ws = workbook.addWorksheet('Gastos Fijos');
    ws.columns = [
      { header: 'Período',          key: 'month',           width: 12 },
      { header: 'Categoría',        key: 'category',        width: 24 },
      { header: 'Nombre',           key: 'name',            width: 32 },
      { header: 'Frecuencia',       key: 'frequency',       width: 14 },
      { header: 'Monto Total',      key: 'totalAmount',     width: 14 },
      { header: 'Monto Pagado',     key: 'monthPaidAmount', width: 14 },
      { header: 'Diferencia',       key: 'diff',            width: 13 },
      { header: 'Estado',           key: 'statusLabel',     width: 14 },
      { header: 'Método de Pago',   key: 'paymentMethod',   width: 20 },
      { header: 'Fecha(s) de Pago', key: 'paymentDates',    width: 22 },
      { header: 'Cuenta/Banco',     key: 'account',         width: 18 },
      { header: 'Notas',            key: 'notes',           width: 32 },
      { header: 'Comprobante(s)',   key: 'receipts',         width: 40 },
    ];

    const hRow = ws.getRow(1);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
    hRow.alignment = { vertical: 'middle', horizontal: 'center' };
    hRow.height = 22;

    ['totalAmount', 'monthPaidAmount', 'diff'].forEach(key => {
      ws.getColumn(key).numFmt = '$#,##0.00';
    });

    rows.forEach(r => {
      const row = ws.addRow({
        ...r,
        receipts: r.receiptUrls.length > 0 ? r.receiptUrls.join(' | ') : '',
      });
      row.height = 18;
      row.alignment = { vertical: 'middle', wrapText: false };

      // Comprobante como hyperlink si hay uno solo
      if (r.receiptUrls.length === 1) {
        const cell = row.getCell('receipts');
        cell.value = { text: 'Ver comprobante', hyperlink: r.receiptUrls[0] };
        cell.font = { color: { argb: 'FF0563C1' }, underline: true };
      } else if (r.receiptUrls.length > 1) {
        const cell = row.getCell('receipts');
        cell.value = r.receiptUrls.join(' | ');
        cell.font = { color: { argb: 'FF0563C1' } };
      }

      const statusCell = row.getCell('statusLabel');
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (r.isPaidThisMonth) {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
        statusCell.font = { color: { argb: 'FF276221' }, bold: true };
      } else if (r.isPartiallyPaid) {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
        statusCell.font = { color: { argb: 'FF9C6500' }, bold: true };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
        statusCell.font = { color: { argb: 'FF9C3D0A' }, bold: true };
      }

      if (row.number % 2 === 0) {
        ['month','category','name','frequency','totalAmount','monthPaidAmount','diff','paymentMethod','paymentDates','account','notes'].forEach(k => {
          const cell = row.getCell(k);
          if (!cell.fill || cell.fill.fgColor?.argb === undefined) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
          }
        });
      }
    });

    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: 'A1', to: 'M1' };

    // Sheet 2: Detalle de Pagos (one row per individual payment with receipt)
    const wsPmts = workbook.addWorksheet('Detalle Pagos');
    wsPmts.columns = [
      { header: 'Mes Período',       key: 'month',          width: 12 },
      { header: 'Categoría',         key: 'category',       width: 24 },
      { header: 'Nombre Gasto',      key: 'name',           width: 32 },
      { header: 'Frecuencia',        key: 'frequency',      width: 14 },
      { header: 'Fecha de Pago',     key: 'paymentDate',    width: 14 },
      { header: 'Monto Pagado',      key: 'amount',         width: 14 },
      { header: 'Método',            key: 'paymentMethod',  width: 20 },
      { header: 'Período Cubierto',  key: 'period',         width: 24 },
      { header: 'Notas Pago',        key: 'notes',          width: 28 },
      { header: 'Comprobante',       key: 'receipt',        width: 40 },
    ];

    const ph = wsPmts.getRow(1);
    ph.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    ph.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF154360' } };
    ph.alignment = { vertical: 'middle', horizontal: 'center' };
    ph.height = 22;
    wsPmts.getColumn('amount').numFmt = '$#,##0.00';

    allPaymentRows
      .filter(({ month }) => months.includes(month))
      .sort((a, b) => a.month.localeCompare(b.month) || a.payment.paymentDate.toString().localeCompare(b.payment.paymentDate.toString()))
      .forEach(({ month, payment }) => {
        const exp = expenseById[payment.fixedExpenseId];
        if (!exp) return;
        const periodStr = payment.periodStart && payment.periodEnd
          ? `${fmtDateShort(payment.periodStart)} → ${fmtDateShort(payment.periodEnd)}`
          : '';
        const pRow = wsPmts.addRow({
          month,
          category: exp.category || '',
          name: exp.name,
          frequency: FREQ_LABELS[exp.frequency] || exp.frequency || '',
          paymentDate: fmtDateShort(payment.paymentDate),
          amount: parseFloat(payment.amount || 0),
          paymentMethod: payment.paymentMethod || '',
          period: periodStr,
          notes: payment.notes || '',
          receipt: payment.receiptUrl ? 'Ver comprobante' : '',
        });
        pRow.height = 18;
        pRow.alignment = { vertical: 'middle' };

        if (payment.receiptUrl) {
          const cell = pRow.getCell('receipt');
          cell.value = { text: 'Ver comprobante', hyperlink: payment.receiptUrl };
          cell.font = { color: { argb: 'FF0563C1' }, underline: true };
        }

        if (pRow.number % 2 === 0) {
          ['month','category','name','frequency','paymentDate','paymentMethod','period','notes'].forEach(k => {
            pRow.getCell(k).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
          });
        }
      });

    wsPmts.views = [{ state: 'frozen', ySplit: 1 }];
    wsPmts.autoFilter = { from: 'A1', to: 'J1' };

    // Sheet 3: Summary
    const wsSummary = workbook.addWorksheet('Resumen');
    wsSummary.columns = [
      { header: 'Período',          key: 'month',   width: 12 },
      { header: 'Total Esperado',   key: 'total',   width: 16 },
      { header: 'Total Pagado',     key: 'paid',    width: 16 },
      { header: 'Pendiente',        key: 'pending', width: 14 },
      { header: '% Pagado',         key: 'pct',     width: 12 },
    ];

    const sHeader = wsSummary.getRow(1);
    sHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    sHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
    sHeader.alignment = { vertical: 'middle', horizontal: 'center' };
    sHeader.height = 22;
    ['total','paid','pending'].forEach(k => { wsSummary.getColumn(k).numFmt = '$#,##0.00'; });
    wsSummary.getColumn('pct').numFmt = '0.0"%"';

    months.forEach(m => {
      const s = summaryByMonth[m] || { totalAmount: 0, paidAmount: 0 };
      const pending = Math.max(0, s.totalAmount - s.paidAmount);
      const pct = s.totalAmount > 0 ? (s.paidAmount / s.totalAmount) * 100 : 0;
      const sRow = wsSummary.addRow({ month: m, total: s.totalAmount, paid: s.paidAmount, pending, pct });
      sRow.height = 18;
      const pctCell = sRow.getCell('pct');
      if (pct >= 99.9) {
        pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
        pctCell.font = { color: { argb: 'FF276221' } };
      } else if (pct > 0) {
        pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
        pctCell.font = { color: { argb: 'FF9C6500' } };
      }
    });

    wsSummary.views = [{ state: 'frozen', ySplit: 1 }];

    const label = from === toMonth ? from : `${from}_a_${toMonth}`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=gastos-fijos-${label}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ [Export FixedExpenses] ${rows.length} filas resumen, ${allPaymentRows.length} pagos individuales, ${months.length} meses`);
  } catch (error) {
    console.error('❌ [Export FixedExpenses] Error:', error);
    res.status(500).json({ error: 'Error al exportar gastos fijos', details: error.message });
  }
};

module.exports = {
  exportWorksToExcel,
  exportFixedExpensesToExcel
};
