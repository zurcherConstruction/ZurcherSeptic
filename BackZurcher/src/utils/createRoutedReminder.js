const { NotificationRouting, Reminder, ReminderAssignment, Staff } = require('../data');

// Título corto para el recordatorio según el tipo de evento
const TITLES = {
  pending:                               (e) => `Nuevo trabajo - asignar fecha: ${e.propertyAddress}`,
  assigned:                              (e) => `Comprar materiales: ${e.propertyAddress}`,
  inProgress:                            (e) => `Instalación programada: ${e.propertyAddress}`,
  installed:                             (e) => `Pedir 1a inspección: ${e.propertyAddress}`,
  installed_fee:                         (e) => `Pagar fee inspección: ${e.propertyAddress}`,
  firstInspectionPending:                (e) => `1a inspección pendiente: ${e.propertyAddress}`,
  approvedInspection:                    (e) => `Inspección aprobada: ${e.propertyAddress}`,
  rejectedInspection:                    (e) => `Correcciones requeridas: ${e.propertyAddress}`,
  initial_correction_ready:              (e) => `Solicitar reinspección: ${e.propertyAddress}`,
  reinspection_initial_requested:        (e) => `Reinspección solicitada: ${e.propertyAddress}`,
  initial_inspection_approved:           (e) => {
    const sysType = (e?.Permit?.systemType || e?.systemType || '').toLowerCase();
    if (sysType !== 'atu') return null; // solo ATU necesita cargar documentos finales
    return `Cargar documentos finales: ${e.propertyAddress}`;
  },
  initial_inspection_rejected:           (e) => `Insp. inicial rechazada: ${e.propertyAddress}`,
  coverPending:                          (e) => `Lista para tapar: ${e.propertyAddress}`,
  covered:                               (e) => `Enviar invoice final: ${e.propertyAddress}`,
  finalInspectionPending:                (e) => `Insp. final pendiente: ${e.propertyAddress}`,
  final_inspection_requested:            (e) => `Insp. final solicitada: ${e.propertyAddress}`,
  finalApproved:                         (e) => `Insp. final aprobada: ${e.propertyAddress}`,
  finalRejected:                         (e) => `Insp. final rechazada: ${e.propertyAddress}`,
  final_correction_ready:                (e) => `Correcciones finales listas: ${e.propertyAddress}`,
  reinspection_final_requested:          (e) => `Reinspección final solicitada: ${e.propertyAddress}`,
  final_inspection_approved_maintenance: (e) => `Insp. final aprobada: ${e.propertyAddress}`,
  final_inspection_rejected:             (e) => `Insp. final rechazada: ${e.propertyAddress}`,
  completed:                             (e) => `Obra completada: ${e.propertyAddress}`,
  maintenance:                           (e) => `En mantenimiento: ${e.propertyAddress}`,
  budgetCreated:                         (e) => `Enviar presupuesto: ${e.propertyAddress}`,
  budgetSent:                            (e) => `Presupuesto enviado: ${e.propertyAddress}`,
  budgetSentForReview:                   (e) => `Presupuesto en revisión: ${e.propertyAddress}`,
  budgetSentToSignNow:                   (e) => `Presupuesto para firma: ${e.propertyAddress}`,
  budgetApprovedByClient:                (e) => `Budget aprobado: ${e.propertyAddress}`,
  budgetRejectedByClient:                (e) => `Budget rechazado: ${e.propertyAddress}`,
  budgetSigned:                          (e) => `Budget firmado: ${e.propertyAddress}`,
  budgetPdfError:                        (e) => `Error PDF presupuesto: ${e.propertyAddress}`,
  invoiceFinal:                          (e) => `Invoice final enviada: ${e.propertyAddress}`,
  final_invoice_received:                (e) => `Invoice final recibida: ${e.propertyAddress}`,
  final_invoice_sent_to_client:          (e) => `Invoice enviada al cliente: ${e.propertyAddress}`,
  final_payment_confirmed_by_client:     (e) => `Pago final confirmado: ${e.propertyAddress}`,
  incomeCreated:                         (e) => `Pago inicial recibido: ${e.propertyAddress || ''}`,
  incomeRegistered:                      (e) => `Ingreso registrado: ${e.propertyAddress || ''}`,
  expenseCreated:                        (e) => `Gasto registrado: ${e.description || e.propertyAddress || ''}`,
  expenseUpdated:                        (e) => `Gasto actualizado: ${e.description || ''}`,
  simpleWorkSent:                        (e) => `Simple work enviado: ${e.propertyAddress || ''}`,
  notice_to_owner_35:                    (e) => `NTO día 35 - vence en 10d: ${e.propertyAddress}`,
};

// Eventos que disparan recordatorios adicionales en paralelo
const COMPANION_EVENTS = {
  installed: ['installed_fee'],
};

async function createRoutedReminder(eventType, entity = {}, _isCompanion = false) {
  try {
    console.log(`[createRoutedReminder] → eventType="${eventType}" entity.id=${entity?.id || entity?.idWork || 'N/A'}`);

    // 1. Buscar responsable configurado
    const routing = await NotificationRouting.findOne({ where: { eventType } });
    console.log(`[createRoutedReminder] routing=${routing ? `staffId=${routing.staffId}` : 'null'}`);
    if (!routing?.staffId) { console.log(`[createRoutedReminder] sin routing para "${eventType}", saliendo.`); return; }

    const staff = await Staff.findOne({
      where: { id: routing.staffId, isActive: true },
      attributes: ['id'],
    });
    console.log(`[createRoutedReminder] staff=${staff ? staff.id : 'null/inactivo'}`);
    if (!staff) { console.log(`[createRoutedReminder] staff no encontrado o inactivo, saliendo.`); return; }

    // 2. Armar título (máx 60 chars para no romper la UI)
    const titleFn = TITLES[eventType];
    const rawTitle = titleFn ? titleFn(entity) : eventType;
    if (!rawTitle) return; // título null = este evento no aplica para esta entidad
    const title = rawTitle.slice(0, 60);

    // 3. Determinar entidad vinculada
    // pending → lleva al calendario de obras, no al perfil de la obra
    const CALENDAR_EVENTS = new Set(['pending']);
    const linkedEntityType  = entity?.idWork    ? (CALENDAR_EVENTS.has(eventType) ? 'workCalendar' : 'work')
                            : entity?.idBudget  ? 'budget'
                            : null;
    const linkedEntityId    = entity?.idWork    ? String(entity.idWork)   : entity?.idBudget ? String(entity.idBudget) : null;
    const linkedEntityLabel = entity?.propertyAddress || null;

    // 4. Deduplicar: no crear si ya existe uno igual para esta entidad+evento
    if (linkedEntityId) {
      const existing = await Reminder.findOne({
        where: { linkedEntityType, linkedEntityId, title },
      });
      if (existing) return;
    }

    // 5. Crear recordatorio
    const reminder = await Reminder.create({
      title,
      type:             'tagged',
      priority:         'medium',
      linkedEntityType,
      linkedEntityId,
      linkedEntityLabel,
      createdBy:        routing.staffId,
    });

    await ReminderAssignment.create({
      reminderId: reminder.id,
      staffId:    routing.staffId,
    });

    console.log(`📌 [Reminder] ${eventType} → ${routing.staffId}: "${title}"`);
  } catch (err) {
    // No romper el flujo principal si falla la creación del reminder
    console.error(`[createRoutedReminder] Error para "${eventType}":`, err.message);
  }

  // Disparar eventos compañeros siempre, incluso si el evento principal no tiene routing
  if (!_isCompanion) {
    const companions = COMPANION_EVENTS[eventType] || [];
    for (const companion of companions) {
      await createRoutedReminder(companion, entity, true);
    }
  }
}

module.exports = { createRoutedReminder };
