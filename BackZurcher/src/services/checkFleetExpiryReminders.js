const cron = require('node-cron');
const { Op } = require('sequelize');
const {
  FleetAsset,
  Staff,
  Reminder,
  ReminderAssignment,
} = require('../data');
const { sendEmail } = require('../utils/notifications/emailService');

const ALERT_DAYS = Number(process.env.FLEET_EXPIRY_ALERT_DAYS || 30);

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const toDateOnly = (date) => date.toISOString().split('T')[0];

const companyLabel = (asset) => {
  if (asset.companyType === 'zurcher') return 'ZURCHER';
  if (asset.companyType === 'invertech') return 'INVERTECH';
  if (asset.companyType === 'other') return asset.companyOtherName || 'OTRA';
  return 'ZURCHER';
};

const expiryKinds = [
  {
    key: 'registration',
    field: 'registrationExpiry',
    title: 'Vencimiento de Placa/Registracion',
  },
  {
    key: 'insurance',
    field: 'insuranceExpiry',
    title: 'Vencimiento de Seguro',
  },
];

async function createReminderAndNotifyOwners({ owners, asset, kind, expiryDate }) {
  const dueDate = toDateOnly(expiryDate);
  const linkedEntityType = 'fleet';
  const linkedEntityId = String(asset.id);
  const label = companyLabel(asset);
  const plateOrSerial = asset.licensePlate || asset.serialNumber || 'N/D';

  const reminderTitle = `${kind.title} - ${asset.name} (${dueDate})`;
  const description = [
    `Empresa: ${label}`,
    `Activo: ${asset.name}`,
    `Identificacion: ${plateOrSerial}`,
    `${kind.title}: ${dueDate}`,
    `Faltan ${Math.max(0, Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24)))} dias.`,
  ].join('\n');

  const existing = await Reminder.findOne({
    where: {
      linkedEntityType,
      linkedEntityId,
      dueDate,
      title: reminderTitle,
    },
  });

  if (existing) {
    return false;
  }

  const reminder = await Reminder.create({
    title: reminderTitle,
    description,
    type: 'tagged',
    priority: 'high',
    dueDate,
    linkedEntityType,
    linkedEntityId,
    linkedEntityLabel: asset.name,
    createdBy: owners[0].id,
  });

  await ReminderAssignment.bulkCreate(
    owners.map((owner) => ({ reminderId: reminder.id, staffId: owner.id })),
    { ignoreDuplicates: true }
  );

  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/fleet/${asset.id}`;

  for (const owner of owners) {
    if (!owner.email) continue;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <h2 style="color: #1d4ed8; margin-bottom: 8px;">Recordatorio de Flota</h2>
        <p style="margin-top: 0; color: #4b5563;">Se genero un recordatorio automatico en el sistema.</p>

        <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <p style="margin: 0 0 8px;"><strong>Empresa:</strong> ${label}</p>
          <p style="margin: 0 0 8px;"><strong>Activo:</strong> ${asset.name}</p>
          <p style="margin: 0 0 8px;"><strong>Identificacion:</strong> ${plateOrSerial}</p>
          <p style="margin: 0;"><strong>${kind.title}:</strong> ${dueDate}</p>
        </div>

        <a href="${dashboardUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;">
          Ver activo en Fleet
        </a>

        <p style="margin-top: 18px; font-size: 12px; color: #6b7280;">
          Este email se envia una sola vez por cada alerta generada.
        </p>
      </div>
    `;

    await sendEmail({
      to: owner.email,
      subject: `Fleet Alert: ${kind.title} - ${asset.name}`,
      html,
      text: `${kind.title} proximamente: ${asset.name} (${dueDate})`,
    });
  }

  return true;
}

const checkFleetExpiryReminders = async () => {
  try {
    console.log('\n🔍 [CRON - FLEET REMINDERS] Verificando vencimientos de flota...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = addDays(today, ALERT_DAYS);

    const owners = await Staff.findAll({
      where: { role: 'owner', isActive: true },
      attributes: ['id', 'name', 'email'],
    });

    if (!owners.length) {
      console.log('⚠️ [CRON - FLEET REMINDERS] No hay owners activos para notificar');
      return;
    }

    const assets = await FleetAsset.findAll({
      where: {
        status: { [Op.ne]: 'retired' },
        [Op.or]: [
          {
            registrationExpiry: {
              [Op.gte]: toDateOnly(today),
              [Op.lte]: toDateOnly(maxDate),
            },
          },
          {
            insuranceExpiry: {
              [Op.gte]: toDateOnly(today),
              [Op.lte]: toDateOnly(maxDate),
            },
          },
        ],
      },
      order: [['name', 'ASC']],
    });

    if (!assets.length) {
      console.log('✅ [CRON - FLEET REMINDERS] No hay vencimientos proximos');
      return;
    }

    let createdCount = 0;

    for (const asset of assets) {
      for (const kind of expiryKinds) {
        const dateValue = asset[kind.field];
        if (!dateValue) continue;

        const expiryDate = new Date(dateValue);
        expiryDate.setHours(0, 0, 0, 0);

        if (expiryDate < today || expiryDate > maxDate) continue;

        const created = await createReminderAndNotifyOwners({
          owners,
          asset,
          kind,
          expiryDate,
        });

        if (created) createdCount += 1;
      }
    }

    console.log(`✅ [CRON - FLEET REMINDERS] Alertas creadas: ${createdCount}`);
  } catch (error) {
    console.error('❌ [CRON - FLEET REMINDERS] Error:', error.message);
  }
};

const startFleetExpiryRemindersCron = () => {
  if (process.env.ENABLE_FLEET_EXPIRY_REMINDERS === 'false') {
    console.log('ℹ️ Fleet expiry reminders deshabilitado (ENABLE_FLEET_EXPIRY_REMINDERS=false)');
    return;
  }

  console.log(`✅ Cron Fleet reminders activo: 07:15 AM (alerta ${ALERT_DAYS} dias)`);

  cron.schedule('15 7 * * *', async () => {
    await checkFleetExpiryReminders();
  }, {
    scheduled: true,
    timezone: 'America/New_York',
  });
};

module.exports = {
  startFleetExpiryRemindersCron,
  checkFleetExpiryReminders,
};
