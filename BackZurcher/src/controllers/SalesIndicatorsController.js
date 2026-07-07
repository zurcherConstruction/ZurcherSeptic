const { Op } = require('sequelize');
const { Work, WorkStateHistory, Budget } = require('../data');

// Works antes de esta fecha no están completos en el sistema
const MINIMUM_DATE = '2026-01-01T00:00:00.000Z';
const MINIMUM_YEAR = 2026;

const monthFormatter = new Intl.DateTimeFormat('es', { month: 'long' });
const getMonthName = (year, month) =>
  monthFormatter.format(new Date(year, month - 1, 1));

const LEAD_SOURCE_LABELS = {
  web: 'Web',
  direct_client: 'Cliente Directo',
  social_media: 'Redes Sociales',
  referral: 'Referido',
  sales_rep: 'Sales Rep',
  external_referral: 'Referido Externo',
  unknown: 'No especificado',
};

/**
 * GET /sales-indicators/monthly?year=2026
 *
 * Devuelve por cada mes del año:
 *   - ventas: works nuevos creados ese mes
 *   - instalados: works que alcanzaron estado 'installed' ese mes (de cualquier año)
 *   - backlog: works vendidos y no instalados al cierre del mes
 *   - sources: desglose de ventas por leadSource del budget asociado
 */
const getMonthlySalesIndicators = async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = Math.max(parseInt(year) || new Date().getFullYear(), MINIMUM_YEAR);

    const yearStart = `${targetYear}-01-01T00:00:00.000Z`;
    const yearEnd   = `${targetYear}-12-31T23:59:59.999Z`;

    // ── 1. Ventas del año: works creados en el año objetivo (no cancelados)
    const yearWorks = await Work.findAll({
      where: {
        createdAt: { [Op.between]: [yearStart, yearEnd] },
        status:    { [Op.ne]: 'cancelled' },
      },
      attributes: ['idWork', 'createdAt', 'idBudget'],
      include: [{
        model: Budget,
        as: 'budget',
        attributes: ['idBudget', 'leadSource'],
        required: false,
      }],
    });

    // ── 2. Para el backlog: works no cancelados creados desde MINIMUM_DATE hasta fin del año.
    //     El backlog arranca en cero en enero 2026 (no se arrastra de años anteriores).
    const allWorks = await Work.findAll({
      where: {
        createdAt: { [Op.gte]: MINIMUM_DATE, [Op.lte]: yearEnd },
        status:    { [Op.ne]: 'cancelled' },
      },
      attributes: ['idWork', 'createdAt'],
    });

    const allWorkIds = allWorks.map(w => w.idWork);

    const allInstallHistories = allWorkIds.length > 0
      ? await WorkStateHistory.findAll({
          where: {
            toStatus: 'installed',
            workId:   { [Op.in]: allWorkIds },
          },
          attributes: ['workId', 'changedAt'],
        })
      : [];

    // Primera fecha de installed por work (all time)
    const firstInstallEver = {};
    for (const h of allInstallHistories) {
      const wid = h.workId;
      if (!firstInstallEver[wid] || new Date(h.changedAt) < new Date(firstInstallEver[wid])) {
        firstInstallEver[wid] = h.changedAt;
      }
    }

    // ── 3. Calcular por mes
    const now          = new Date();
    // Para el año actual solo incluir meses hasta hoy; para años anteriores todos los 12
    const maxMonth = now.getFullYear() === targetYear ? now.getMonth() + 1 : 12;

    const monthlyData = [];

    for (let m = 1; m <= maxMonth; m++) {
      const lastDay   = new Date(targetYear, m, 0).getDate();
      const mPad      = m.toString().padStart(2, '0');
      const ldPad     = lastDay.toString().padStart(2, '0');
      const monthStart = new Date(`${targetYear}-${mPad}-01T00:00:00.000Z`);
      const monthEnd   = new Date(`${targetYear}-${mPad}-${ldPad}T23:59:59.999Z`);

      // Ventas este mes
      const ventasWorks = yearWorks.filter(w => {
        const d = new Date(w.createdAt);
        return d >= monthStart && d <= monthEnd;
      });

      // Desglose por fuente
      const sourcesMap = {};
      for (const w of ventasWorks) {
        const src = w.budget?.leadSource || 'unknown';
        sourcesMap[src] = (sourcesMap[src] || 0) + 1;
      }
      const sources = Object.entries(sourcesMap).map(([key, count]) => ({
        key,
        label: LEAD_SOURCE_LABELS[key] || key,
        count,
      }));

      // Instalados este mes: works >= MINIMUM_DATE que llegaron a 'installed' por primera vez en este mes
      let instalados = 0;
      for (const installedAt of Object.values(firstInstallEver)) {
        const d = new Date(installedAt);
        if (d >= monthStart && d <= monthEnd) instalados++;
      }

      // Backlog al cierre del mes:
      // works creados <= monthEnd, no instalados antes de o durante este mes
      const backlog = allWorks.filter(w => {
        if (new Date(w.createdAt) > monthEnd) return false;
        const installedAt = firstInstallEver[w.idWork];
        if (!installedAt) return true; // nunca instalado → en backlog
        return new Date(installedAt) > monthEnd;
      }).length;

      monthlyData.push({
        month:    m,
        monthName: getMonthName(targetYear, m),
        ventas:   ventasWorks.length,
        instalados,
        backlog,
        sources,
      });
    }

    const totals = {
      ventas:    monthlyData.reduce((s, d) => s + d.ventas,    0),
      instalados: monthlyData.reduce((s, d) => s + d.instalados, 0),
    };

    res.json({ year: targetYear, monthlyData, totals });

  } catch (err) {
    console.error('❌ Error en getMonthlySalesIndicators:', err);
    res.status(500).json({ error: 'Error al obtener indicadores de ventas', details: err.message });
  }
};

/**
 * GET /sales-indicators/available-years
 * Retorna los años con datos (works creados).
 */
const getAvailableYears = async (req, res) => {
  try {
    const works = await Work.findAll({
      where: { createdAt: { [Op.gte]: MINIMUM_DATE } },
      attributes: ['createdAt'],
    });

    const currentYear = new Date().getFullYear();
    const yearsSet    = new Set([Math.max(currentYear, MINIMUM_YEAR)]);
    for (const w of works) {
      const y = new Date(w.createdAt).getFullYear();
      if (y >= MINIMUM_YEAR) yearsSet.add(y);
    }

    res.json({ years: Array.from(yearsSet).sort((a, b) => b - a) });
  } catch (err) {
    console.error('❌ Error en getAvailableYears:', err);
    res.status(500).json({ error: 'Error al obtener años disponibles', details: err.message });
  }
};

module.exports = { getMonthlySalesIndicators, getAvailableYears };
