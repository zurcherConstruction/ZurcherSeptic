const { Budget, Work, Permit, SalesLead, Staff, MarketingCampaign } = require('../data');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');

class CompanyEmailController {
  /**
   * 📧 GET /api/company-emails/unique-recipients
   * Obtiene lista de emails únicos de todas las fuentes (Budgets, Works, SalesLeads, Permits)
   */
  async getUniqueRecipients(req, res) {
    try {
      console.log('📧 Obteniendo emails únicos de todas las fuentes...');

      // Objeto para almacenar emails únicos con sus fuentes
      const emailMap = new Map();

      // 1️⃣ BUDGETS
      const budgets = await Budget.findAll({
        attributes: ['idBudget', 'applicantName', 'applicantEmail', 'propertyAddress'],
        where: {
          applicantEmail: { [Op.ne]: null },
        },
        raw: true
      });

      budgets.forEach(b => {
        const email = b.applicantEmail?.trim().toLowerCase();
        if (email && email.includes('@')) {
          if (!emailMap.has(email)) {
            emailMap.set(email, {
              email: email,
              name: b.applicantName,
              sources: [],
              address: b.propertyAddress
            });
          }
          emailMap.get(email).sources.push('budget');
        }
      });

      // 2️⃣ WORKS (via Budget)
      const works = await Work.findAll({
        include: [{
          model: Budget,
          as: 'budget',
          attributes: ['applicantEmail', 'applicantName', 'propertyAddress'],
          required: true,
          where: {
            applicantEmail: { [Op.ne]: null }
          }
        }],
        raw: true
      });

      works.forEach(w => {
        const email = w['budget.applicantEmail']?.trim().toLowerCase();
        if (email && email.includes('@')) {
          if (!emailMap.has(email)) {
            emailMap.set(email, {
              email: email,
              name: w['budget.applicantName'],
              sources: [],
              address: w['budget.propertyAddress']
            });
          }
          if (!emailMap.get(email).sources.includes('work')) {
            emailMap.get(email).sources.push('work');
          }
        }
      });

      // 3️⃣ SALES LEADS
      const salesLeads = await SalesLead.findAll({
        attributes: ['id', 'applicantName', 'applicantEmail', 'propertyAddress'],
        where: {
          applicantEmail: { [Op.ne]: null },
          status: { [Op.notIn]: ['lost', 'archived'] } // Excluir leads perdidos/archivados
        },
        raw: true
      });

      salesLeads.forEach(s => {
        const email = s.applicantEmail?.trim().toLowerCase();
        if (email && email.includes('@')) {
          if (!emailMap.has(email)) {
            emailMap.set(email, {
              email: email,
              name: s.applicantName,
              sources: [],
              address: s.propertyAddress
            });
          }
          if (!emailMap.get(email).sources.includes('sales_lead')) {
            emailMap.get(email).sources.push('sales_lead');
          }
        }
      });

      // 4️⃣ PERMITS (Legacy)
      const permits = await Permit.findAll({
        attributes: ['idPermit', 'applicantName', 'applicantEmail', 'propertyAddress'],
        where: {
          applicantEmail: { [Op.ne]: null }
        },
        raw: true
      });

      permits.forEach(p => {
        const email = p.applicantEmail?.trim().toLowerCase();
        if (email && email.includes('@')) {
          if (!emailMap.has(email)) {
            emailMap.set(email, {
              email: email,
              name: p.applicantName,
              sources: [],
              address: p.propertyAddress
            });
          }
          if (!emailMap.get(email).sources.includes('permit')) {
            emailMap.get(email).sources.push('permit');
          }
        }
      });

      // Convertir Map a Array
      const uniqueRecipients = Array.from(emailMap.values());

      console.log(`✅ ${uniqueRecipients.length} emails únicos encontrados`);

      res.json({
        success: true,
        count: uniqueRecipients.length,
        recipients: uniqueRecipients
      });

    } catch (error) {
      console.error('❌ Error al obtener emails únicos:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener lista de destinatarios',
        message: error.message
      });
    }
  }

  /**
   * 📤 POST /api/company-emails/send-campaign
   * Envía email masivo a lista de destinatarios
   */
  async sendCampaign(req, res) {
    try {
      const {
        subject,
        message,
        emailTitle,
        titleColor,
        titleFont,
        imageUrl,
        recipients, // Array de emails
        campaignType,
        campaignName,
        excludedEmails // Optional: emails a excluir
      } = req.body;

      const userId = req.user?.id;

      // Validaciones
      if (!subject || !message) {
        return res.status(400).json({
          success: false,
          error: 'Asunto y mensaje son requeridos'
        });
      }

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Debe incluir al menos un destinatario'
        });
      }

      console.log(`📧 Iniciando campaña de email: ${campaignName || subject}`);
      console.log(`👥 ${recipients.length} destinatarios totales`);

      // Filtrar emails excluidos
      const finalRecipients = excludedEmails && excludedEmails.length > 0
        ? recipients.filter(r => !excludedEmails.includes(r.email))
        : recipients;

      console.log(`✅ ${finalRecipients.length} destinatarios después de filtrar`);

      // Crear registro de campaña
      const campaign = await MarketingCampaign.create({
        subject,
        message,
        imageUrl,
        recipientCount: finalRecipients.length,
        uniqueEmails: finalRecipients.map(r => r.email),
        campaignType: campaignType || 'holiday',
        campaignName: campaignName || subject,
        sentByStaffId: userId,
        status: 'sending',
        startedAt: new Date()
      });

      // Enviar emails en segundo plano
      this._sendCampaignEmails(
        campaign.id, 
        finalRecipients, 
        subject, 
        message, 
        imageUrl,
        emailTitle || 'Special Message',
        titleColor || '#1a3a5c',
        titleFont || 'Playfair Display'
      );

      res.json({
        success: true,
        campaignId: campaign.id,
        message: `Campaña iniciada. Enviando a ${finalRecipients.length} destinatarios...`
      });

    } catch (error) {
      console.error('❌ Error al iniciar campaña:', error);
      res.status(500).json({
        success: false,
        error: 'Error al iniciar campaña de email',
        message: error.message
      });
    }
  }

  /**
   * 🔄 Envío de la campaña en segundo plano
   *  - UNA conexión SMTP reutilizada (pool): Gmail bloquea la cuenta si se inicia sesión por cada email
   *    ("454 4.7.0 Too many login attempts").
   *  - De a un email, con pausa entre envíos.
   *  - Si Gmail frena temporalmente (4xx), espera y reintenta. Si sigue frenando, se detiene y deja los
   *    pendientes como fallidos para reintentarlos después (POST /campaigns/:id/retry-failed).
   *
   * retry = true: reenvío de los fallidos de una campaña existente (suma a los enviados)
   */
  async _sendCampaignEmails(campaignId, recipients, subject, message, imageUrl, emailTitle, titleColor, titleFont, { retry = false } = {}) {
    const SEND_DELAY_MS = 1500;                       // ~40 emails por minuto
    const BACKOFF_MS = [60 * 1000, 3 * 60 * 1000, 10 * 60 * 1000];
    const isTemporary = (err) => {
      const code = Number(err?.responseCode);
      return (code >= 400 && code < 500)
        || /4\.7\.0|too many|try again later|rate limit/i.test(err?.message || '')
        || ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNRESET'].includes(err?.code);
    };
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      pool: true,
      maxConnections: 1,
      maxMessages: 100, // re-login cada 100 emails, no por cada uno
    });

    const campaign = await MarketingCampaign.findByPk(campaignId);
    let sentCount = retry ? (campaign?.sentCount || 0) : 0;
    const failedEmails = [];
    const htmlContent = this._buildEmailHTML(message, imageUrl, emailTitle, titleColor, titleFont);
    const saveProgress = (extra = {}) => MarketingCampaign.update(
      { sentCount, failedCount: failedEmails.length, failedEmails: failedEmails.length ? failedEmails : null, ...extra },
      { where: { id: campaignId } },
    ).catch(err => console.error('⚠️ No se pudo guardar el progreso de la campaña:', err.message));

    try {
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        let attempt = 0;
        while (true) {
          try {
            await transporter.sendMail({
              from: `"Zurcher Septic " <${process.env.SMTP_USER}>`,
              to: recipient.email,
              subject,
              html: htmlContent.replace(/\{\{NAME\}\}/g, recipient.name || 'Valued Customer'),
            });
            sentCount++;
            console.log(`✅ [Campaña] ${i + 1}/${recipients.length} enviado a: ${recipient.email}`);
            break;
          } catch (error) {
            if (isTemporary(error) && attempt < BACKOFF_MS.length) {
              console.warn(`⏸️ [Campaña] Gmail frenó el envío (${error.message.split('\n')[0]}). Reintento en ${BACKOFF_MS[attempt] / 60000} min...`);
              await wait(BACKOFF_MS[attempt]);
              attempt++;
              continue;
            }
            if (isTemporary(error)) {
              // Gmail sigue bloqueando: se detiene y los pendientes quedan para reintentar
              const reason = `Pendiente: Gmail bloqueó temporalmente el envío (${error.message.split('\n')[0]}). Usá "Reintentar fallidos" más tarde.`;
              for (const r of recipients.slice(i)) failedEmails.push({ email: r.email, name: r.name || null, error: reason });
              console.error(`🛑 [Campaña] Detenida: Gmail sigue bloqueando. ${recipients.length - i} pendientes para reintentar.`);
              i = recipients.length;
              break;
            }
            failedEmails.push({ email: recipient.email, name: recipient.name || null, error: error.message });
            console.error(`❌ [Campaña] Falló envío a ${recipient.email}:`, error.message);
            break;
          }
        }
        if ((i + 1) % 10 === 0) await saveProgress();
        if (i < recipients.length - 1) await wait(SEND_DELAY_MS);
      }

      const total = campaign?.recipientCount || recipients.length;
      await saveProgress({
        status: sentCount === 0 && failedEmails.length ? 'failed' : 'completed',
        completedAt: new Date(),
        ...(retry ? {} : { recipientCount: total }),
      });
      console.log(`📊 Campaña ${retry ? '(reintento) ' : ''}completada: ${sentCount} enviados, ${failedEmails.length} fallidos`);
    } catch (error) {
      console.error('❌ Error crítico en envío de campaña:', error);
      await saveProgress({ status: 'failed', completedAt: new Date() });
    } finally {
      transporter.close();
    }
  }

  /**
   * 🔁 POST /api/company-emails/campaigns/:id/retry-failed
   * Reenvía la campaña solo a los emails que fallaron
   */
  async retryFailed(req, res) {
    try {
      const campaign = await MarketingCampaign.findByPk(req.params.id);
      if (!campaign) return res.status(404).json({ success: false, error: 'Campaña no encontrada' });
      if (campaign.status === 'sending') return res.status(409).json({ success: false, error: 'La campaña todavía se está enviando' });
      const failed = Array.isArray(campaign.failedEmails) ? campaign.failedEmails : [];
      if (!failed.length) return res.status(400).json({ success: false, error: 'No hay emails fallidos para reintentar' });

      // Nombres: los guardados con el fallo, o los de la lista de destinatarios (campañas viejas)
      let names = new Map();
      if (failed.some(f => !f.name)) {
        await this.getUniqueRecipients({}, {
          json: data => { names = new Map((data.recipients || []).map(r => [r.email, r.name])); },
          status: () => ({ json: () => {} }),
        });
      }
      const recipients = failed.map(f => ({ email: f.email, name: f.name || names.get(String(f.email).toLowerCase()) || null }));

      const { emailTitle, titleColor, titleFont } = req.body || {};
      await campaign.update({ status: 'sending', failedCount: 0, failedEmails: null, completedAt: null });

      this._sendCampaignEmails(
        campaign.id, recipients, campaign.subject, campaign.message, campaign.imageUrl,
        emailTitle || 'Special Message', titleColor || '#1a3a5c', titleFont || 'Playfair Display',
        { retry: true },
      );

      res.json({ success: true, message: `Reintentando ${recipients.length} emails. Tarda ~${Math.ceil(recipients.length * 1.5 / 60)} min.` });
    } catch (error) {
      console.error('❌ Error al reintentar campaña:', error);
      res.status(500).json({ success: false, error: 'Error al reintentar la campaña', message: error.message });
    }
  }

  /**
   * 🎨 Construir HTML del email con imagen y mensaje
   */
  _buildEmailHTML(message, imageUrl, emailTitle = 'Special Message', titleColor = '#1a3a5c', titleFont = 'Playfair Display') {
    // Construir URL de Google Fonts dinámicamente para la fuente seleccionada
    const fontUrl = `https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@700&family=Open+Sans:wght@400;600&display=swap`;
    
    return `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="${fontUrl}" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Open Sans', Arial, sans-serif; background-color: #f4f4f4;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4;">
          <tr>
            <td align="center" style="padding: 20px 0;">
              <!-- Container principal -->
              <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; max-width: 600px;">
                
                <!-- Header -->
                <tr>
                  <td align="center" style="background-color: #1a3a5c; padding: 30px 20px;">
                    <a href="https://www.zurcherseptic.com" style="color: #ffffff; font-size: 28px; font-weight: bold; text-decoration: none; font-family: 'Playfair Display', Georgia, serif;">
                      Zurcher Septic
                    </a>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      
                      <!-- Email Title -->
                      <tr>
                        <td align="center" style="padding-bottom: 30px;">
                          <h1 style="margin: 0; font-family: '${titleFont}', Georgia, serif; font-size: 32px; font-weight: 700; color: ${titleColor}; line-height: 1.2;">
                            ${emailTitle}
                          </h1>
                        </td>
                      </tr>
                      
                      <!-- Divider -->
                      <tr>
                        <td style="padding-bottom: 30px;">
                          <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="border-bottom: 1px solid #e0e0e0;"></td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      
                      <!-- Message -->
                      <tr>
                        <td style="font-family: 'Open Sans', Arial, sans-serif; font-size: 16px; line-height: 1.8; color: #333333; padding-bottom: 30px; white-space: pre-wrap;">
                          ${message}
                        </td>
                      </tr>
                      
                      ${imageUrl ? `
                      <!-- Image -->
                      <tr>
                        <td align="center" style="padding: 30px 0;">
                          <img src="${imageUrl}" alt="Campaign Image" style="max-width: 100%; height: auto; border-radius: 12px; display: block;" />
                        </td>
                      </tr>
                      ` : ''}
                      
                      <!-- CTA Button -->
                      <tr>
                        <td align="center" style="padding: 30px 0;">
                          <table border="0" cellpadding="0" cellspacing="0">
                            <tr>
                              <td align="center" style="background-color: #1a3a5c; border-radius: 8px;">
                                <a href="https://www.zurcherseptic.com" target="_blank" style="font-family: 'Open Sans', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 14px 36px; display: inline-block;">
                                  Visit Our Website
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9f9f9; padding: 30px 20px; border-top: 1px solid #e0e0e0;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center">
                          <p style="margin: 0 0 10px 0; font-family: 'Open Sans', Arial, sans-serif; font-size: 16px; font-weight: bold; color: #333333;">
                            Zurcher Septic
                          </p>
                          <p style="margin: 5px 0; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; color: #666666;">
                            Septic System Installation & Maintenance
                          </p>
                          <p style="margin: 5px 0; font-family: 'Open Sans', Arial, sans-serif; font-size: 14px; color: #666666;">
                            📧 admin@zurcherseptic.com | 📞 Contact Us
                          </p>
                          <table border="0" cellpadding="0" cellspacing="0" width="200" style="margin: 20px auto;">
                            <tr>
                              <td style="border-bottom: 1px solid #e0e0e0;"></td>
                            </tr>
                          </table>
                          <p style="margin: 10px 0 0 0; font-family: 'Open Sans', Arial, sans-serif; font-size: 12px; color: #999999;">
                            You're receiving this email because you're a valued customer of Zurcher Septic.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * 📋 GET /api/company-emails/campaigns
   * Obtiene historial de campañas enviadas
   */
  async getCampaigns(req, res) {
    try {
      const { page = 1, pageSize = 20, status, campaignType } = req.query;
      const offset = (page - 1) * pageSize;

      const where = {};
      if (status) where.status = status;
      if (campaignType) where.campaignType = campaignType;

      const { rows, count } = await MarketingCampaign.findAndCountAll({
        where,
        include: [{
          model: Staff,
          as: 'sentBy',
          attributes: ['id', 'name', 'email']
        }],
        order: [['createdAt', 'DESC']],
        limit: parseInt(pageSize),
        offset
      });

      res.json({
        success: true,
        campaigns: rows,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(count / pageSize)
      });

    } catch (error) {
      console.error('❌ Error al obtener campañas:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener historial de campañas',
        message: error.message
      });
    }
  }

  /**
   * 📊 GET /api/company-emails/campaigns/:id
   * Obtiene detalles de una campaña específica
   */
  async getCampaignDetails(req, res) {
    try {
      const { id } = req.params;

      const campaign = await MarketingCampaign.findByPk(id, {
        include: [{
          model: Staff,
          as: 'sentBy',
          attributes: ['id', 'name', 'email']
        }]
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaña no encontrada'
        });
      }

      res.json({
        success: true,
        campaign
      });

    } catch (error) {
      console.error('❌ Error al obtener detalles de campaña:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener detalles de campaña',
        message: error.message
      });
    }
  }
}

module.exports = new CompanyEmailController();
