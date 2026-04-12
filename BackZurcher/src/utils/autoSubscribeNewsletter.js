/**
 * 📧 Auto-suscripción al Newsletter
 * 
 * Helper para suscribir automáticamente a usuarios cuando se crean
 * nuevos registros con email en Budget, Work, SalesLead, Permit.
 */

/**
 * Suscribe automáticamente un email al newsletter
 * @param {string} email - Email del usuario
 * @param {string} name - Nombre completo del usuario (opcional)
 * @param {string} source - Fuente de origen (budget, work, sales_lead, permit)
 * @param {object} metadata - Datos adicionales (opcional)
 * @returns {Promise<object|null>} El suscriptor creado o null si falla
 */
async function autoSubscribeToNewsletter(email, name = null, source = 'system', metadata = {}) {
  try {
    // Validar email
    if (!email || !email.includes('@')) {
      return null;
    }

    // 🔧 Lazy load para evitar dependencia circular
    const { NewsletterSubscriber } = require('../data');

    const normalizedEmail = email.trim().toLowerCase();

    // Separar nombre completo en firstName y lastName
    const nameParts = name ? name.trim().split(' ') : [];
    const firstName = nameParts.length > 0 ? nameParts[0] : null;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

    // ⚠️ IMPORTANTE: Verificar si el usuario está desuscrito (incluir soft deleted)
    const existingSubscriber = await NewsletterSubscriber.findOne({
      where: { email: normalizedEmail },
      paranoid: false // Incluir registros eliminados
    });

    // Si el usuario se desuscribió manualmente, RESPETAR su decisión
    if (existingSubscriber && existingSubscriber.status === 'unsubscribed') {
      console.log(`📧 [Newsletter] Email ${normalizedEmail} está desuscrito - No se volverá a suscribir`);
      return null;
    }

    // Si existe pero está soft deleted, restaurarlo primero
    if (existingSubscriber && existingSubscriber.deletedAt) {
      await existingSubscriber.restore();
      await existingSubscriber.update({
        firstName: firstName || existingSubscriber.firstName,
        lastName: lastName || existingSubscriber.lastName,
        status: 'active',
        source: source,
        tags: [...new Set([...(existingSubscriber.tags || []), source])],
        metadata: {
          ...(existingSubscriber.metadata || {}),
          ...metadata,
          restoredAt: new Date().toISOString()
        }
      });
      console.log(`📧 [Newsletter] Suscriptor ${normalizedEmail} restaurado desde ${source}`);
      return existingSubscriber;
    }

    // Intentar crear o actualizar el suscriptor (solo si NO está unsubscribed)
    const [subscriber, created] = await NewsletterSubscriber.findOrCreate({
      where: { email: normalizedEmail },
      defaults: {
        email: normalizedEmail,
        firstName: firstName,
        lastName: lastName,
        status: 'active',
        source: source,
        tags: [source],
        metadata: {
          ...metadata,
          autoSubscribedAt: new Date().toISOString()
        }
      }
    });

    // Si ya existía, actualizar tags para incluir la nueva fuente
    if (!created) {
      const currentTags = subscriber.tags || [];
      if (!currentTags.includes(source)) {
        await subscriber.update({
          tags: [...currentTags, source],
          metadata: {
            ...(subscriber.metadata || {}),
            ...metadata,
            lastUpdatedFrom: source,
            lastUpdatedAt: new Date().toISOString()
          }
        });
      }
    }

    return subscriber;
  } catch (error) {
    console.error('Error en autoSubscribeToNewsletter:', error);
    // No lanzar error para no interrumpir el flujo principal
    return null;
  }
}

module.exports = {
  autoSubscribeToNewsletter
};
