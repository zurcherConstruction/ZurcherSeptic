const ExcelJS = require('exceljs');
const { Work, Permit, Budget, Inspection, Income, WorkChecklist } = require('../data/index');
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
    const { status = 'all', applicantEmail, exportType = 'standard' } = req.query;
    const isComplete = exportType === 'complete';

    console.log(`📊 [Export Works] Generando Excel (tipo: ${exportType})...`);
    console.log(`   Filtro estado: ${status}`);
    console.log(`   Filtro email: ${applicantEmail || 'ninguno'}`);

    // Construir filtros
    const whereConditions = {};

    if (status === 'maintenance') {
      whereConditions.status = 'maintenance';
    } else if (status === 'active') {
      whereConditions.status = {
        [Op.notIn]: ['maintenance', 'cancelled']
      };
    }

    if (applicantEmail) {
      whereConditions['$Permit.applicantEmail$'] = {
        [Op.iLike]: `%${applicantEmail}%`
      };
    }

    // Includes base
    const includes = [
      {
        model: Permit,
        attributes: isComplete
          ? ['applicantEmail', 'permitNumber', 'systemType', 'isPBTS']
          : ['applicantEmail'],
        required: false
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
        { header: 'Property Address', key: 'address',          width: 40 },
        { header: 'Applicant Email',  key: 'applicantEmail',   width: 30 },
        { header: 'Status',           key: 'status',           width: 20 },
        { header: 'Start Date',       key: 'startDate',        width: 15 },
        { header: 'Installation Date',key: 'installationDate', width: 15 },
        { header: 'Final Invoice Date',key: 'finalInvoiceDate',width: 15 }
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

module.exports = {
  exportWorksToExcel
};
