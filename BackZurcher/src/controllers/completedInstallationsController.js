const { Op } = require('sequelize');
const {
  WorkStateHistory, Work, WorkChecklist, Budget, FinalInvoice,
  Income, Expense, Staff, sequelize
} = require('../data');

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

/**
 * GET /completed-installations?year=2026&month=7
 *
 * Works that first reached "installed" status in the given month, enriched with:
 *   - totalIncome, totalExpenses, profit
 *   - finalReviewCompleted (OK Final check)
 *   - FinalInvoice status
 */
const getCompletedInstallations = async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : null;

    // Build date range (same approach as MonthlyInstallations)
    let startDate, endDate;
    if (targetMonth) {
      const pad = String(targetMonth).padStart(2, '0');
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();
      startDate = `${targetYear}-${pad}-01T00:00:00.000Z`;
      endDate   = `${targetYear}-${pad}-${String(lastDay).padStart(2,'0')}T23:59:59.999Z`;
    } else {
      startDate = `${targetYear}-01-01T00:00:00.000Z`;
      endDate   = `${targetYear}-12-31T23:59:59.999Z`;
    }

    // 1. Get all "installed" transitions in the range
    const histories = await WorkStateHistory.findAll({
      where: {
        toStatus: 'installed',
        changedAt: { [Op.between]: [startDate, endDate] }
      },
      include: [{
        model: Work,
        as: 'work',
        attributes: ['idWork', 'status', 'idBudget'],
        include: [
          {
            model: Budget,
            as: 'budget',
            attributes: ['propertyAddress', 'applicantName', 'totalPrice'],
            required: false
          },
          {
            model: FinalInvoice,
            as: 'finalInvoice',
            attributes: ['originalBudgetTotal', 'subtotalExtras', 'discount', 'finalAmountDue', 'totalAmountPaid', 'status'],
            required: false
          },
          {
            model: WorkChecklist,
            as: 'checklist',
            attributes: ['finalReviewCompleted', 'reviewedAt'],
            required: false
          },
          {
            model: Staff,
            attributes: ['id', 'name'],
            required: false
          }
        ]
      }],
      order: [['changedAt', 'ASC']]
    });

    // 2. De-duplicate: keep earliest "installed" transition per work
    const workMap = new Map();
    for (const h of histories) {
      if (!h.work) continue;
      const wid = h.work.idWork;
      if (!workMap.has(wid)) {
        workMap.set(wid, { history: h, installedDate: h.changedAt });
      } else {
        if (h.changedAt < workMap.get(wid).installedDate) {
          workMap.set(wid, { history: h, installedDate: h.changedAt });
        }
      }
    }

    const workIds = [...workMap.keys()];

    // 3. Aggregate income and expenses per work
    let incomeMap = {};
    let expenseMap = {};

    if (workIds.length > 0) {
      const incomeTotals = await Income.findAll({
        where: { workId: { [Op.in]: workIds } },
        attributes: ['workId', [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
        group: ['workId'],
        raw: true
      });
      const expenseTotals = await Expense.findAll({
        where: { workId: { [Op.in]: workIds } },
        attributes: ['workId', [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
        group: ['workId'],
        raw: true
      });
      incomeTotals.forEach(r => { incomeMap[r.workId] = parseFloat(r.total || 0); });
      expenseTotals.forEach(r => { expenseMap[r.workId] = parseFloat(r.total || 0); });
    }

    // 4. Build enriched work list
    const works = [...workMap.values()].map(({ history, installedDate }) => {
      const work        = history.work;
      const budget      = work.budget;
      const finalInvoice = work.finalInvoice;
      const checklist   = work.checklist;
      const wid         = work.idWork;
      const totalIncome    = incomeMap[wid] || 0;
      const totalExpenses  = expenseMap[wid] || 0;

      return {
        workId: wid,
        propertyAddress: budget?.propertyAddress || work.propertyAddress || 'Sin dirección',
        applicantName:   budget?.applicantName || null,
        installedDate:   new Date(installedDate).toISOString().split('T')[0],
        currentStatus:   work.status,
        staff: work.Staff ? { id: work.Staff.id, name: work.Staff.name } : null,
        contractTotal:   parseFloat(budget?.totalPrice || 0),
        pendingToCollect: (() => {
          const ct = parseFloat(budget?.totalPrice || 0);
          if (finalInvoice) {
            return Math.max(0, parseFloat(finalInvoice.finalAmountDue || 0) - parseFloat(finalInvoice.totalAmountPaid || 0));
          }
          return Math.max(0, ct - totalIncome);
        })(),
        totalIncome,
        totalExpenses,
        profit:          totalIncome - totalExpenses,
        finalReviewCompleted: checklist?.finalReviewCompleted || false,
        reviewedAt:      checklist?.reviewedAt || null,
        finalInvoiceStatus:  finalInvoice?.status || null,
        finalAmountDue:  parseFloat(finalInvoice?.finalAmountDue || 0),
        totalAmountPaid: parseFloat(finalInvoice?.totalAmountPaid || 0)
      };
    }).sort((a, b) => new Date(b.installedDate) - new Date(a.installedDate));

    // 5. Year totals
    const yearTotals = {
      count:          works.length,
      contractTotal:  works.reduce((s, w) => s + w.contractTotal, 0),
      totalIncome:    works.reduce((s, w) => s + w.totalIncome, 0),
      totalExpenses:  works.reduce((s, w) => s + w.totalExpenses, 0),
      profit:         works.reduce((s, w) => s + w.profit, 0),
      withFinalOk:    works.filter(w => w.finalReviewCompleted).length
    };

    return res.json({ year: targetYear, month: targetMonth, works, yearTotals });

  } catch (err) {
    console.error('❌ Error en getCompletedInstallations:', err);
    return res.status(500).json({ message: 'Error obteniendo instalaciones completadas', error: err.message });
  }
};

/**
 * GET /completed-installations/available-years
 */
const getAvailableYears = async (req, res) => {
  try {
    const rows = await WorkStateHistory.findAll({
      where: { toStatus: 'installed', changedAt: { [Op.ne]: null } },
      attributes: [[sequelize.fn('DISTINCT', sequelize.fn('date_trunc', 'year', sequelize.col('changedAt'))), 'yr']],
      raw: true
    });

    const years = rows
      .map(r => r.yr ? new Date(r.yr).getFullYear() : null)
      .filter(Boolean)
      .sort((a, b) => b - a);

    const current = new Date().getFullYear();
    if (!years.includes(current)) years.unshift(current);

    return res.json({ availableYears: [...new Set(years)] });
  } catch (err) {
    console.error('❌ Error en getAvailableYears:', err);
    return res.status(500).json({ message: 'Error obteniendo años disponibles', error: err.message });
  }
};

module.exports = { getCompletedInstallations, getAvailableYears };
