const { NotificationRouting, Staff } = require('../data');

/**
 * Devuelve el staff asignado a un tipo de evento automático.
 * Si no hay routing configurado, cae en los owners activos (backward compatibility).
 */
async function getRoutedStaff(eventType) {
  try {
    const routing = await NotificationRouting.findOne({ where: { eventType } });
    if (routing?.staffId) {
      const staff = await Staff.findOne({
        where: { id: routing.staffId, isActive: true },
        attributes: ['id', 'name', 'email'],
      });
      if (staff) return [staff];
    }
  } catch (e) {
    console.warn(`[getRoutedStaff] Error buscando routing para ${eventType}:`, e.message);
  }

  return [];
}

module.exports = { getRoutedStaff };
