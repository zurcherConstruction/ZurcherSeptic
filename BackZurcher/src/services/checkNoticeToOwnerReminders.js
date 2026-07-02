const cron = require('node-cron');
const { Work, Permit, FinalInvoice } = require('../data');
const { Op } = require('sequelize');
const { createRoutedReminder } = require('../utils/createRoutedReminder');

const NTO_ALERT_DAY = 35;

// Obras donde el NTO ya no aplica: invoice pagada o en estados post-pago
const EXCLUDED_STATUSES = [
  'paymentReceived',
  'finalInspectionPending',
  'finalRejected',
  'finalApproved',
  'maintenance',
];

const checkNoticeToOwnerReminders = async () => {
  try {
    console.log(`\n🔍 [CRON - NTO] Verificando obras en día ${NTO_ALERT_DAY} de Notice to Owner...`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // installationStartDate que corresponde exactamente al día 35 de hoy
    const targetDateStart = new Date(today);
    targetDateStart.setDate(targetDateStart.getDate() - NTO_ALERT_DAY);
    targetDateStart.setHours(0, 0, 0, 0);

    const targetDateEnd = new Date(targetDateStart);
    targetDateEnd.setHours(23, 59, 59, 999);

    const works = await Work.findAll({
      where: {
        installationStartDate: { [Op.gte]: targetDateStart, [Op.lte]: targetDateEnd },
        status: { [Op.notIn]: EXCLUDED_STATUSES },
        noticeToOwnerFiled: { [Op.or]: [false, null] }, // excluir los que ya tienen NTO cargado
      },
      include: [
        { model: Permit },
        { model: FinalInvoice, as: 'finalInvoice', required: false },
      ],
    });

    if (!works.length) {
      console.log(`✅ [CRON - NTO] No hay obras que hoy alcancen el día ${NTO_ALERT_DAY}`);
      return;
    }

    // Filtrar también obras con final invoice ya pagada
    const pendingWorks = works.filter(w => w.finalInvoice?.status !== 'paid');

    if (!pendingWorks.length) {
      console.log(`✅ [CRON - NTO] Obras encontradas pero todas tienen invoice pagada`);
      return;
    }

    console.log(`📋 [CRON - NTO] ${pendingWorks.length} obra(s) en día ${NTO_ALERT_DAY} hoy`);

    for (const work of pendingWorks) {
      await createRoutedReminder('notice_to_owner_35', work);
    }
  } catch (err) {
    console.error('[CRON - NTO] Error:', err.message);
  }
};

const startNoticeToOwnerCron = () => {
  cron.schedule('0 7 * * *', async () => {
    await checkNoticeToOwnerReminders();
  }, { timezone: 'America/New_York' });

  console.log(`✅ Cron NTO (Notice to Owner día ${NTO_ALERT_DAY}) activo: 07:00 AM`);
};

module.exports = { startNoticeToOwnerCron, checkNoticeToOwnerReminders };
