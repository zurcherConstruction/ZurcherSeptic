const { 
  NewsletterSubscriber, 
  NewsletterTemplate, 
  Newsletter, 
  NewsletterRecipient,
  Staff 
} = require('../data');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUploader');
const { cloudinary } = require('../utils/cloudinaryConfig');

// ==================== SUBSCRIBERS ====================

// Obtener todos los suscriptores
const getAllSubscribers = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { rows: subscribers, count } = await NewsletterSubscriber.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      data: subscribers,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error en getAllSubscribers:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener suscriptores',
      error: error.message
    });
  }
};

// Crear nuevo suscriptor
const createSubscriber = async (req, res) => {
  try {
    const { email, firstName, lastName, phone, source, tags } = req.body;

    // Verificar si ya existe (incluyendo soft deleted)
    const existing = await NewsletterSubscriber.findOne({ 
      where: { email },
      paranoid: false // Incluir registros eliminados
    });

    if (existing) {
      // Si existe pero está eliminado, restaurarlo
      if (existing.deletedAt) {
        await existing.restore();
        await existing.update({
          firstName,
          lastName,
          phone,
          source,
          tags,
          status: 'active',
          confirmedAt: new Date(),
          unsubscribedAt: null,
          unsubscribeReason: null
        });

        return res.status(200).json({
          success: true,
          data: existing,
          message: 'Suscriptor restaurado exitosamente'
        });
      }

      // Si existe y está activo
      return res.status(400).json({
        success: false,
        message: 'Este email ya está suscrito'
      });
    }

    // No existe, crear nuevo
    const subscriber = await NewsletterSubscriber.create({
      email,
      firstName,
      lastName,
      phone,
      source,
      tags,
      status: 'active',
      confirmedAt: new Date()
    });

    res.status(201).json({
      success: true,
      data: subscriber,
      message: 'Suscriptor creado exitosamente'
    });
  } catch (error) {
    console.error('Error en createSubscriber:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear suscriptor',
      error: error.message
    });
  }
};

// Suscripción pública desde el sitio web
const publicSubscribe = async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'El email es obligatorio'
      });
    }

    // Verificar si ya existe (incluyendo soft deleted)
    const existing = await NewsletterSubscriber.findOne({ 
      where: { email },
      paranoid: false // Incluir registros eliminados
    });

    if (existing) {
      // Si está eliminado, restaurarlo primero
      if (existing.deletedAt) {
        await existing.restore();
      }

      if (existing.status === 'active' && !existing.deletedAt) {
        return res.status(200).json({
          success: true,
          message: 'Ya estás suscrito a nuestro newsletter'
        });
      } else {
        // Reactivar suscripción
        await existing.update({
          status: 'active',
          firstName: firstName || existing.firstName,
          lastName: lastName || existing.lastName,
          confirmedAt: new Date(),
          unsubscribedAt: null,
          unsubscribeReason: null
        });
        return res.status(200).json({
          success: true,
          message: 'Tu suscripción ha sido reactivada'
        });
      }
    }

    const subscriber = await NewsletterSubscriber.create({
      email,
      firstName,
      lastName,
      source: 'website',
      status: 'active',
      confirmedAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: '¡Gracias por suscribirte! Recibirás nuestro newsletter pronto.',
      data: subscriber
    });
  } catch (error) {
    console.error('Error en publicSubscribe:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la suscripción',
      error: error.message
    });
  }
};

// Desuscribir (POST desde API)
const unsubscribe = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const subscriber = await NewsletterSubscriber.findByPk(id);
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Suscriptor no encontrado'
      });
    }

    await subscriber.update({
      status: 'unsubscribed',
      unsubscribedAt: new Date(),
      unsubscribeReason: reason
    });

    res.status(200).json({
      success: true,
      message: 'Suscripción cancelada exitosamente'
    });
  } catch (error) {
    console.error('Error en unsubscribe:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar suscripción',
      error: error.message
    });
  }
};

// Desuscribir público (GET desde email) - Muestra HTML
const publicUnsubscribe = async (req, res) => {
  try {
    const { id } = req.params;

    const subscriber = await NewsletterSubscriber.findByPk(id);
    if (!subscriber) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Unsubscribe - Zurcher Septic</title>
          <style>
            body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 40px 20px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
            .container { background: white; border-radius: 12px; padding: 40px; max-width: 500px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center; }
            .logo { height: 60px; margin-bottom: 20px; }
            h1 { color: #dc2626; margin: 0 0 20px 0; font-size: 28px; }
            p { color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; }
            .home-btn { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: bold; transition: transform 0.2s; }
            .home-btn:hover { transform: translateY(-2px); }
          </style>
        </head>
        <body>
          <div class="container">
            <img src="https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751206826/logo_zlxdhw.png" alt="Zurcher Septic Logo" class="logo" />
            <h1>⚠️ Subscriber Not Found</h1>
            <p>The subscription link appears to be invalid or the subscriber has already been removed from our system.</p>
            <a href="https://zurcherseptic.com" class="home-btn">Go to Homepage</a>
          </div>
        </body>
        </html>
      `);
    }

    if (subscriber.status === 'unsubscribed') {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Already Unsubscribed - Zurcher Septic</title>
          <style>
            body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 40px 20px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
            .container { background: white; border-radius: 12px; padding: 40px; max-width: 500px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center; }
            .logo { height: 60px; margin-bottom: 20px; }
            h1 { color: #16a34a; margin: 0 0 20px 0; font-size: 28px; }
            p { color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; }
            .home-btn { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: bold; transition: transform 0.2s; }
            .home-btn:hover { transform: translateY(-2px); }
          </style>
        </head>
        <body>
          <div class="container">
            <img src="https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751206826/logo_zlxdhw.png" alt="Zurcher Septic Logo" class="logo" />
            <h1>✓ Already Unsubscribed</h1>
            <p>You are already unsubscribed from our newsletter. You will not receive any more emails from us.</p>
            <p>If you change your mind, you can always resubscribe on our website.</p>
            <a href="https://zurcherseptic.com" class="home-btn">Go to Homepage</a>
          </div>
        </body>
        </html>
      `);
    }

    await subscriber.update({
      status: 'unsubscribed',
      unsubscribedAt: new Date()
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Successfully Unsubscribed - Zurcher Septic</title>
        <style>
          body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 40px 20px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .container { background: white; border-radius: 12px; padding: 40px; max-width: 500px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center; }
          .logo { height: 60px; margin-bottom: 20px; }
          .checkmark { width: 80px; height: 80px; border-radius: 50%; background: #16a34a; color: white; font-size: 50px; line-height: 80px; margin: 0 auto 20px auto; }
          h1 { color: #16a34a; margin: 0 0 20px 0; font-size: 28px; }
          p { color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; }
          .home-btn { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: bold; transition: transform 0.2s; }
          .home-btn:hover { transform: translateY(-2px); }
        </style>
      </head>
      <body>
        <div class="container">
          <img src="https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751206826/logo_zlxdhw.png" alt="Zurcher Septic Logo" class="logo" />
          <div class="checkmark">✓</div>
          <h1>Successfully Unsubscribed</h1>
          <p>You have been successfully unsubscribed from our newsletter.</p>
          <p>We're sorry to see you go! You will no longer receive emails from Zurcher Septic.</p>
          <p>If you change your mind in the future, you can always resubscribe through our website.</p>
          <a href="https://zurcherseptic.com" class="home-btn">Go to Homepage</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error en publicUnsubscribe:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error - Zurcher Septic</title>
        <style>
          body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 40px 20px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .container { background: white; border-radius: 12px; padding: 40px; max-width: 500px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center; }
          .logo { height: 60px; margin-bottom: 20px; }
          h1 { color: #dc2626; margin: 0 0 20px 0; font-size: 28px; }
          p { color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; }
          .home-btn { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: bold; transition: transform 0.2s; }
          .home-btn:hover { transform: translateY(-2px); }
        </style>
      </head>
      <body>
        <div class="container">
          <img src="https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751206826/logo_zlxdhw.png" alt="Zurcher Septic Logo" class="logo" />
          <h1>⚠️ Something Went Wrong</h1>
          <p>We encountered an error while processing your unsubscribe request. Please try again later.</p>
          <a href="https://zurcherseptic.com" class="home-btn">Go to Homepage</a>
        </div>
      </body>
      </html>
    `);
  }
};

// Actualizar suscriptor
const updateSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, firstName, lastName, phone, tags, status } = req.body;

    const subscriber = await NewsletterSubscriber.findByPk(id);
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Suscriptor no encontrado'
      });
    }

    await subscriber.update({
      email,
      firstName,
      lastName,
      phone,
      tags,
      status
    });

    res.status(200).json({
      success: true,
      data: subscriber,
      message: 'Suscriptor actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error en updateSubscriber:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar suscriptor',
      error: error.message
    });
  }
};

// Desuscribir (cambiar status a unsubscribed sin eliminar)
const unsubscribeSubscriber = async (req, res) => {
  try {
    const { id } = req.params;

    const subscriber = await NewsletterSubscriber.findByPk(id);
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Suscriptor no encontrado'
      });
    }

    await subscriber.update({ 
      status: 'unsubscribed',
      unsubscribedAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Suscriptor desuscrito exitosamente',
      data: subscriber
    });
  } catch (error) {
    console.error('Error en unsubscribeSubscriber:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desuscribir',
      error: error.message
    });
  }
};

// Eliminar suscriptor
const deleteSubscriber = async (req, res) => {
  try {
    const { id } = req.params;

    const subscriber = await NewsletterSubscriber.findByPk(id);
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Suscriptor no encontrado'
      });
    }

    await subscriber.destroy();

    res.status(200).json({
      success: true,
      message: 'Suscriptor eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteSubscriber:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar suscriptor',
      error: error.message
    });
  }
};

// ==================== TEMPLATES ====================

// Obtener todas las plantillas
const getAllTemplates = async (req, res) => {
  try {
    const { category, isActive } = req.query;
    
    const where = {};
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const templates = await NewsletterTemplate.findAll({
      where,
      include: [
        {
          model: Staff,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error en getAllTemplates:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener plantillas',
      error: error.message
    });
  }
};

// Crear plantilla
const createTemplate = async (req, res) => {
  try {
    const { name, description, subject, htmlContent, textContent, category, previewImageUrl } = req.body;
    const staffId = req.user?.id;

    const template = await NewsletterTemplate.create({
      name,
      description,
      subject,
      htmlContent,
      textContent,
      category,
      previewImageUrl,
      createdByStaffId: staffId,
      isActive: true
    });

    res.status(201).json({
      success: true,
      data: template,
      message: 'Plantilla creada exitosamente'
    });
  } catch (error) {
    console.error('Error en createTemplate:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear plantilla',
      error: error.message
    });
  }
};

// Actualizar plantilla
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, subject, htmlContent, textContent, category, isActive, previewImageUrl } = req.body;

    const template = await NewsletterTemplate.findByPk(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Plantilla no encontrada'
      });
    }

    await template.update({
      name,
      description,
      subject,
      htmlContent,
      textContent,
      category,
      isActive,
      previewImageUrl
    });

    res.status(200).json({
      success: true,
      data: template,
      message: 'Plantilla actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error en updateTemplate:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar plantilla',
      error: error.message
    });
  }
};

// Eliminar plantilla
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await NewsletterTemplate.findByPk(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Plantilla no encontrada'
      });
    }

    await template.destroy();

    res.status(200).json({
      success: true,
      message: 'Plantilla eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteTemplate:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar plantilla',
      error: error.message
    });
  }
};

// ==================== NEWSLETTERS ====================

// Obtener todos los newsletters
const getAllNewsletters = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const where = {};
    if (status) where.status = status;

    const offset = (page - 1) * limit;

    const { rows: newsletters, count } = await Newsletter.findAndCountAll({
      where,
      include: [
        {
          model: Staff,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: NewsletterTemplate,
          as: 'template',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      data: newsletters,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error en getAllNewsletters:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener newsletters',
      error: error.message
    });
  }
};

// Obtener newsletter por ID
const getNewsletterById = async (req, res) => {
  try {
    const { id } = req.params;

    const newsletter = await Newsletter.findByPk(id, {
      include: [
        {
          model: Staff,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: NewsletterTemplate,
          as: 'template'
        }
      ]
    });

    if (!newsletter) {
      return res.status(404).json({
        success: false,
        message: 'Newsletter no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: newsletter
    });
  } catch (error) {
    console.error('Error en getNewsletterById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener newsletter',
      error: error.message
    });
  }
};

// Crear newsletter
const createNewsletter = async (req, res) => {
  try {
    const { name, subject, htmlContent, textContent, templateId, scheduledAt, recipientFilters, metadata, sendNow } = req.body;
    const staffId = req.user?.id;

    // Combinar metadata existente con recipientFilters
    const finalMetadata = {
      ...(metadata || {}),
      recipientFilters: recipientFilters || metadata?.recipientFilters || {}
    };

    // Determinar el status inicial
    let initialStatus = 'draft';
    if (scheduledAt) {
      initialStatus = 'scheduled';
    } else if (sendNow) {
      initialStatus = 'sending'; // Se enviará inmediatamente
    }

    const newsletter = await Newsletter.create({
      name,
      subject,
      htmlContent,
      textContent,
      templateId,
      scheduledAt,
      status: initialStatus,
      createdByStaffId: staffId,
      metadata: finalMetadata
    });

    // Si sendNow es true, enviar inmediatamente (sin esperar al cron job)
    if (sendNow) {
      console.log(`📧 [Newsletter] Enviando newsletter "${newsletter.name}" inmediatamente...`);
      
      // Ejecutar el envío en background para no bloquear la respuesta
      setImmediate(async () => {
        try {
          // Primero crear los recipients
          const subscribers = await NewsletterSubscriber.findAll({
            where: { status: 'active' }
          });

          if (subscribers.length === 0) {
            console.error('❌ [Newsletter] No hay suscriptores activos');
            await newsletter.update({ status: 'failed', metadata: { ...newsletter.metadata, error: 'No hay suscriptores activos' } });
            return;
          }

          // Crear registros de destinatarios
          const recipientRecords = subscribers.map(sub => ({
            newsletterId: newsletter.id,
            subscriberId: sub.id,
            status: 'pending'
          }));

          await NewsletterRecipient.bulkCreate(recipientRecords, {
            ignoreDuplicates: true
          });

          // Actualizar el newsletter con el número de destinatarios
          await newsletter.update({ recipientCount: subscribers.length });

          console.log(`📨 [Newsletter] ${subscribers.length} destinatarios preparados`);

          // Ahora sí, procesar el envío
          await processNewsletterSending(newsletter.id);
          console.log(`✅ [Newsletter] Newsletter "${newsletter.name}" enviado exitosamente`);
        } catch (error) {
          console.error(`❌ [Newsletter] Error enviando newsletter ${newsletter.id}:`, error.message);
          console.error(error);
          // Actualizar status a failed
          await newsletter.update({ status: 'failed', metadata: { ...newsletter.metadata, error: error.message } });
        }
      });

      res.status(201).json({
        success: true,
        data: newsletter,
        message: 'Newsletter creado y enviándose ahora'
      });
    } else {
      res.status(201).json({
        success: true,
        data: newsletter,
        message: 'Newsletter creado exitosamente'
      });
    }
  } catch (error) {
    console.error('Error en createNewsletter:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear newsletter',
      error: error.message
    });
  }
};

// Actualizar newsletter
const updateNewsletter = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject, htmlContent, textContent, scheduledAt, status, metadata } = req.body;

    const newsletter = await Newsletter.findByPk(id);
    if (!newsletter) {
      return res.status(404).json({
        success: false,
        message: 'Newsletter no encontrado'
      });
    }

    // Permitir edición en cualquier estado (removida restricción)
    await newsletter.update({
      name,
      subject,
      htmlContent,
      textContent,
      scheduledAt,
      status,
      metadata: metadata || newsletter.metadata
    });

    res.status(200).json({
      success: true,
      data: newsletter,
      message: 'Newsletter actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error en updateNewsletter:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar newsletter',
      error: error.message
    });
  }
};

// Enviar newsletter
const sendNewsletter = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscriberIds } = req.body; // Array de IDs o null para todos los activos

    const newsletter = await Newsletter.findByPk(id);
    if (!newsletter) {
      return res.status(404).json({
        success: false,
        message: 'Newsletter no encontrado'
      });
    }

    if (newsletter.status === 'sent') {
      return res.status(400).json({
        success: false,
        message: 'Este newsletter ya fue enviado'
      });
    }

    // Obtener suscriptores
    let subscribers;
    if (subscriberIds && subscriberIds.length > 0) {
      subscribers = await NewsletterSubscriber.findAll({
        where: {
          id: { [Op.in]: subscriberIds },
          status: 'active'
        }
      });
    } else {
      subscribers = await NewsletterSubscriber.findAll({
        where: { status: 'active' }
      });
    }

    if (subscribers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay suscriptores activos para enviar'
      });
    }

    // Crear registros de destinatarios
    const recipientRecords = subscribers.map(sub => ({
      newsletterId: newsletter.id,
      subscriberId: sub.id,
      status: 'pending'
    }));

    await NewsletterRecipient.bulkCreate(recipientRecords, {
      ignoreDuplicates: true
    });

    // Actualizar el newsletter
    await newsletter.update({
      status: 'sending',
      recipientCount: subscribers.length
    });

    // Proceso de envío en background (aquí simplificaremos)
    // En producción, esto debería ser un job queue (Bull, BeeQueue, etc.)
    setTimeout(async () => {
      try {
        await processNewsletterSending(newsletter.id);
      } catch (error) {
        console.error('Error en proceso de envío:', error);
      }
    }, 100);

    res.status(200).json({
      success: true,
      message: `Newsletter programado para envío a ${subscribers.length} suscriptores`,
      data: {
        newsletterId: newsletter.id,
        recipientCount: subscribers.length
      }
    });
  } catch (error) {
    console.error('Error en sendNewsletter:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar newsletter',
      error: error.message
    });
  }
};

// 🆕 Enviar newsletter de prueba a un email específico
const sendTestNewsletter = async (req, res) => {
  try {
    const { id } = req.params;
    const { testEmail } = req.body;

    // Validar email
    if (!testEmail || !testEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({
        success: false,
        message: 'Email de prueba inválido'
      });
    }

    const newsletter = await Newsletter.findByPk(id);
    if (!newsletter) {
      return res.status(404).json({
        success: false,
        message: 'Newsletter no encontrado'
      });
    }

    console.log(`📧 [Newsletter TEST] Enviando newsletter de prueba "${newsletter.name}" a ${testEmail}...`);

    // Configurar transporter SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });

    // Personalizar HTML (sin tracking pixel para pruebas)
    let testHtml = newsletter.htmlContent;
    
    // Reemplazar placeholder de unsubscribe con mensaje de prueba
    testHtml = testHtml.replace(/\{\{subscriberId\}\}/g, 'TEST-ID');

    // Enviar email de prueba
    await transporter.sendMail({
      from: `"Zurcher Septic [TEST]" <${process.env.SMTP_USER}>`,
      to: testEmail,
      subject: `[TEST] ${newsletter.subject}`,
      html: testHtml,
      text: `[TEST EMAIL]\n\n${newsletter.textContent || 'Este es un email de prueba del newsletter.'}`
    });

    console.log(`✅ [Newsletter TEST] Email de prueba enviado exitosamente a ${testEmail}`);

    res.status(200).json({
      success: true,
      message: `Email de prueba enviado exitosamente a ${testEmail}`,
      data: {
        newsletterId: newsletter.id,
        testEmail: testEmail,
        sentAt: new Date()
      }
    });
  } catch (error) {
    console.error('❌ Error en sendTestNewsletter:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar email de prueba',
      error: error.message
    });
  }
};

// Reenviar newsletter (crear nuevos recipients y enviar inmediatamente)
const resendNewsletter = async (req, res) => {
  try {
    const { id } = req.params;

    const newsletter = await Newsletter.findByPk(id);
    if (!newsletter) {
      return res.status(404).json({
        success: false,
        message: 'Newsletter no encontrado'
      });
    }

    console.log(`📧 [Newsletter] Reenviando newsletter "${newsletter.name}"...`);

    // IMPORTANTE: Eliminar recipients viejos para poder crear nuevos
    await NewsletterRecipient.destroy({
      where: { newsletterId: newsletter.id }
    });
    console.log(`🗑️ [Newsletter] Recipients anteriores eliminados`);

    // Obtener todos los suscriptores activos
    const subscribers = await NewsletterSubscriber.findAll({
      where: { status: 'active' }
    });

    if (subscribers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay suscriptores activos para reenviar'
      });
    }

    // Actualizar el newsletter a estado "sending"
    await newsletter.update({
      status: 'sending',
      recipientCount: subscribers.length
    });

    // Crear nuevos registros de destinatarios
    const recipientRecords = subscribers.map(sub => ({
      newsletterId: newsletter.id,
      subscriberId: sub.id,
      status: 'pending'
    }));

    await NewsletterRecipient.bulkCreate(recipientRecords);

    console.log(`📨 [Newsletter] ${subscribers.length} destinatarios preparados para reenvío`);

    // Proceso de envío en background
    setImmediate(async () => {
      try {
        await processNewsletterSending(newsletter.id);
        console.log(`✅ [Newsletter] Newsletter "${newsletter.name}" reenviado exitosamente`);
      } catch (error) {
        console.error(`❌ [Newsletter] Error reenviando newsletter ${newsletter.id}:`, error.message);
        await newsletter.update({ status: 'failed' });
      }
    });

    res.status(200).json({
      success: true,
      message: `Newsletter reenviándose a ${subscribers.length} suscriptores`,
      data: {
        newsletterId: newsletter.id,
        recipientCount: subscribers.length
      }
    });
  } catch (error) {
    console.error('Error en resendNewsletter:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reenviar newsletter',
      error: error.message
    });
  }
};

// Función auxiliar para procesar el envío
async function processNewsletterSending(newsletterId) {
  try {
    const newsletter = await Newsletter.findByPk(newsletterId);
    if (!newsletter) return;

    // 🔧 FIX: Buscar TODOS los recipients pendientes (sin limit)
    const recipients = await NewsletterRecipient.findAll({
      where: {
        newsletterId,
        status: 'pending'
      },
      include: [
        {
          model: NewsletterSubscriber,
          as: 'subscriber'
        }
      ]
      // SIN LIMIT - procesar todos los suscriptores
    });

    // 🔧 Configurar transporter SMTP con POOL para reutilizar conexión
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      pool: true, // ✅ REUTILIZAR conexión en lugar de crear nueva cada vez
      maxConnections: 1, // ✅ Una sola conexión para evitar múltiples logins
      maxMessages: Infinity, // ✅ Sin límite de mensajes por conexión
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });

    let sentCount = 0;
    let failedCount = 0;

    // 🚀 OPTIMIZACIÓN: Procesar en lotes con concurrencia controlada
    const BATCH_SIZE = 3; // ✅ Reducido de 10 a 3 para evitar rate limit
    const DELAY_BETWEEN_BATCHES = 2000; // ✅ Aumentado a 2 segundos
    
    console.log(`📧 [Newsletter] Procesando ${recipients.length} destinatarios en lotes de ${BATCH_SIZE}`);

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(recipients.length / BATCH_SIZE);
      
      console.log(`📦 [Newsletter] Procesando lote ${batchNumber}/${totalBatches} (${batch.length} emails)`);

      // Procesar este lote en paralelo
      const batchPromises = batch.map(async (recipient) => {
        try {
          // Personalizar HTML con el ID del suscriptor para el botón de unsubscribe
          let personalizedHtml = newsletter.htmlContent.replace(/\{\{subscriberId\}\}/g, recipient.subscriber.id);
          
          // 🆕 Agregar pixel de tracking invisible para registrar aperturas
          const backendUrl = process.env.API_URL || 'http://localhost:3001';
          const trackingPixel = `<img src="${backendUrl}/newsletter/track-open/${recipient.id}" width="1" height="1" style="display:none;border:0;" alt="" />`;
          
          // Insertar el pixel justo antes del cierre del body
          if (personalizedHtml.includes('</body>')) {
            personalizedHtml = personalizedHtml.replace('</body>', `${trackingPixel}</body>`);
          } else {
            personalizedHtml += trackingPixel;
          }
          
          await transporter.sendMail({
            from: `"Zurcher Septic" <${process.env.SMTP_USER}>`,
            to: recipient.subscriber.email,
            subject: newsletter.subject,
            html: personalizedHtml,
            text: newsletter.textContent
          });

          await recipient.update({
            status: 'sent',
            sentAt: new Date()
          });

          return { success: true, email: recipient.subscriber.email };
        } catch (error) {
          console.error(`❌ Error enviando a ${recipient.subscriber.email}:`, error.message);
          await recipient.update({
            status: 'failed',
            metadata: { error: error.message }
          });
          return { success: false, email: recipient.subscriber.email };
        }
      });

      // Esperar a que termine todo el lote
      const results = await Promise.allSettled(batchPromises);
      
      // Contar resultados
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      });

      console.log(`✅ Lote ${batchNumber}/${totalBatches} completado - Enviados: ${sentCount}, Fallidos: ${failedCount}`);

      // Pausa entre lotes para no saturar el servidor SMTP
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    // Actualizar estadísticas del newsletter
    const allRecipients = await NewsletterRecipient.findAll({
      where: { newsletterId },
      attributes: ['status']
    });

    const totalSent = allRecipients.filter(r => r.status === 'sent').length;
    const totalFailed = allRecipients.filter(r => r.status === 'failed').length;
    const totalPending = allRecipients.filter(r => r.status === 'pending').length;

    if (totalPending === 0) {
      // Todos procesados
      await newsletter.update({
        status: totalFailed === allRecipients.length ? 'failed' : 'sent',
        sentAt: new Date()
      });
    }

    console.log(`Newsletter ${newsletterId}: Enviados ${sentCount}, Fallidos ${failedCount}`);
    
    // 🔒 Cerrar el pool de conexiones SMTP
    transporter.close();
  } catch (error) {
    console.error('Error en processNewsletterSending:', error);
  }
}

// Eliminar newsletter
const deleteNewsletter = async (req, res) => {
  try {
    const { id } = req.params;

    const newsletter = await Newsletter.findByPk(id);
    if (!newsletter) {
      return res.status(404).json({
        success: false,
        message: 'Newsletter no encontrado'
      });
    }

    await newsletter.destroy();

    res.status(200).json({
      success: true,
      message: 'Newsletter eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteNewsletter:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar newsletter',
      error: error.message
    });
  }
};

// Obtener estadísticas de un newsletter
const getNewsletterStats = async (req, res) => {
  try {
    const { id } = req.params;

    const newsletter = await Newsletter.findByPk(id);
    if (!newsletter) {
      return res.status(404).json({
        success: false,
        message: 'Newsletter no encontrado'
      });
    }

    const recipients = await NewsletterRecipient.findAll({
      where: { newsletterId: id }
    });

    const stats = {
      total: recipients.length,
      sent: recipients.filter(r => r.status === 'sent').length,
      pending: recipients.filter(r => r.status === 'pending').length,
      failed: recipients.filter(r => r.status === 'failed').length,
      opened: recipients.filter(r => r.openedAt !== null).length,
      clicked: recipients.filter(r => r.clickedAt !== null).length,
      openRate: 0,
      clickRate: 0
    };

    if (stats.sent > 0) {
      stats.openRate = ((stats.opened / stats.sent) * 100).toFixed(2);
      stats.clickRate = ((stats.clicked / stats.sent) * 100).toFixed(2);
    }

    res.status(200).json({
      success: true,
      data: {
        newsletter,
        stats
      }
    });
  } catch (error) {
    console.error('Error en getNewsletterStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};

// ==================== NEWSLETTER IMAGES ====================

// Subir imagen a Cloudinary para newsletters
const uploadNewsletterImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó ninguna imagen'
      });
    }

    // Subir a Cloudinary en carpeta específica
    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: 'newsletter_images',
      resource_type: 'image',
      quality: 'auto:good',
      fetch_format: 'auto'
    });

    res.status(200).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height
      },
      message: 'Imagen subida exitosamente'
    });
  } catch (error) {
    console.error('Error en uploadNewsletterImage:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir imagen',
      error: error.message
    });
  }
};

// Obtener todas las imágenes de la galería de newsletters
const getNewsletterImages = async (req, res) => {
  try {
    // Listar recursos de la carpeta newsletter_images en Cloudinary
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'newsletter_images/',
      max_results: 500,
      resource_type: 'image'
    });

    const images = result.resources.map(resource => ({
      url: resource.secure_url,
      publicId: resource.public_id,
      width: resource.width,
      height: resource.height,
      format: resource.format,
      createdAt: resource.created_at
    }));

    res.status(200).json({
      success: true,
      data: images,
      total: images.length
    });
  } catch (error) {
    console.error('Error en getNewsletterImages:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener imágenes',
      error: error.message
    });
  }
};

// Eliminar imagen de Cloudinary
const deleteNewsletterImage = async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere publicId'
      });
    }

    await deleteFromCloudinary(publicId);

    res.status(200).json({
      success: true,
      message: 'Imagen eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteNewsletterImage:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar imagen',
      error: error.message
    });
  }
};

// 📧 Registrar apertura de email (tracking pixel)
const trackOpen = async (req, res) => {
  try {
    const { recipientId } = req.params;

    // Buscar el destinatario
    const recipient = await NewsletterRecipient.findByPk(recipientId);
    
    if (recipient && !recipient.openedAt) {
      // Registrar la primera apertura
      await recipient.update({
        openedAt: new Date(),
        status: 'opened'
      });
      
      console.log(`📧 [Newsletter] Email abierto - Recipient: ${recipientId}`);
    }

    // Retornar un pixel transparente de 1x1
    // GIF transparente base64 (43 bytes)
    const transparentGif = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );

    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': transparentGif.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache'
    });
    res.end(transparentGif);
  } catch (error) {
    console.error('Error en trackOpen:', error);
    // Aún así retornar el pixel para no romper el email
    const transparentGif = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': transparentGif.length
    });
    res.end(transparentGif);
  }
};

// 🔄 Reintentar solo los envíos fallidos (no duplica exitosos)
const retryFailedRecipients = async (req, res) => {
  try {
    const { id } = req.params;

    const newsletter = await Newsletter.findByPk(id);
    if (!newsletter) {
      return res.status(404).json({
        success: false,
        message: 'Newsletter no encontrado'
      });
    }

    // Contar cuántos fallidos hay
    const failedCount = await NewsletterRecipient.count({
      where: {
        newsletterId: newsletter.id,
        status: 'failed'
      }
    });

    if (failedCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay destinatarios fallidos para reintentar'
      });
    }

    console.log(`🔄 [Newsletter] Reintentando ${failedCount} envíos fallidos de "${newsletter.name}"...`);

    // Cambiar los fallidos a 'pending' para que se reintenten
    await NewsletterRecipient.update(
      { status: 'pending' },
      {
        where: {
          newsletterId: newsletter.id,
          status: 'failed'
        }
      }
    );

    // Actualizar newsletter a "sending"
    await newsletter.update({ status: 'sending' });

    // Proceso de envío en background
    setImmediate(async () => {
      try {
        await processNewsletterSending(newsletter.id);
        console.log(`✅ [Newsletter] Reintento completado para "${newsletter.name}"`);
      } catch (error) {
        console.error(`❌ [Newsletter] Error en reintento ${newsletter.id}:`, error.message);
        await newsletter.update({ status: 'failed' });
      }
    });

    res.status(200).json({
      success: true,
      message: `Reintentando envío a ${failedCount} destinatarios fallidos`,
      data: {
        newsletterId: newsletter.id,
        failedCount
      }
    });
  } catch (error) {
    console.error('Error en retryFailedRecipients:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reintentar envíos fallidos',
      error: error.message
    });
  }
};

module.exports = {
  // Subscribers
  getAllSubscribers,
  createSubscriber,
  publicSubscribe,
  unsubscribe,
  publicUnsubscribe,
  updateSubscriber,
  unsubscribeSubscriber,
  deleteSubscriber,
  
  // Templates
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  
  // Newsletters
  getAllNewsletters,
  getNewsletterById,
  createNewsletter,
  updateNewsletter,
  sendNewsletter,
  sendTestNewsletter, // 🆕 Envío de prueba
  resendNewsletter,
  retryFailedRecipients, // 🔄 Reintentar solo fallidos
  deleteNewsletter,
  getNewsletterStats,
  
  // Images
  uploadNewsletterImage,
  getNewsletterImages,
  deleteNewsletterImage,
  
  // Tracking
  trackOpen
};
