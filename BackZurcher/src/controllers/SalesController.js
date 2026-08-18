const { Budget, Work, Permit, Staff, SalesLead } = require('../data');
const { Op } = require('sequelize');
const { sendEmail } = require('../utils/notifications/emailService');
const { sendSalesEmail } = require('../utils/notifications/salesEmailService');

class SalesController {
  /**
   * Dashboard para empleados de ventas (sales_rep)
   * Muestra sus presupuestos y works concretados
   */
  async getMySalesDashboard(req, res) {
    try {
      const userId = req.user.id; // ID del vendedor logueado
      const { month, year, status, workStatus } = req.query;

      console.log(`📊 Sales Dashboard - User ID: ${userId}`);

      // Verificar que el usuario exista y obtener su rol
      const user = await Staff.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: true,
          message: 'Usuario no encontrado'
        });
      }

      // === 📋 FILTROS ===
      const isSalesRepOrRecept = user.role === 'sales_rep' || user.role === 'recept';

      // sales_rep/recept ven sus propios budgets + todos los sales_lead
      // admin/owner ven TODOS los budgets de ventas (sales_rep + sales_lead)
      const budgetFilters = isSalesRepOrRecept
        ? {
            [Op.or]: [
              { leadSource: 'sales_rep', createdByStaffId: userId },
              { leadSource: 'sales_lead' }
            ]
          }
        : { leadSource: { [Op.in]: ['sales_rep', 'sales_lead'] } };

      // Filtro por mes/año
      if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        budgetFilters.createdAt = {
          [Op.between]: [startDate, endDate]
        };
      } else if (year) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);
        budgetFilters.createdAt = {
          [Op.between]: [startDate, endDate]
        };
      }

      // Filtro por status del presupuesto
      if (status) {
        budgetFilters.status = status;
      }

      // === 📊 OBTENER PRESUPUESTOS ===
      const budgets = await Budget.findAll({
        where: budgetFilters,
        include: [
          {
            model: Permit,
            attributes: ['permitNumber', 'applicantName', 'applicantEmail', 'applicantPhone', 'propertyAddress', 'systemType']
          },
          {
            model: Work,
            required: false,
            attributes: ['idWork', 'status', 'startDate', 'endDate', 'createdAt']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // === 🔨 OBTENER WORKS CONCRETADOS ===
      const workFilters = {};
      if (workStatus) {
        workFilters.status = workStatus;
      }

      // Filtro condicional para budgets en works
      const workBudgetWhere = isSalesRepOrRecept
        ? {
            [Op.or]: [
              { leadSource: 'sales_rep', createdByStaffId: userId },
              { leadSource: 'sales_lead' }
            ]
          }
        : { leadSource: { [Op.in]: ['sales_rep', 'sales_lead'] } };

      // Works que vienen de budgets del vendedor (o todos si es admin/owner)
      const works = await Work.findAll({
        where: workFilters,
        include: [
          {
            model: Budget,
            as: 'budget', // ✅ Usar alias correcto
            required: true,
            where: workBudgetWhere,
            include: [
              {
                model: Permit,
                attributes: ['permitNumber', 'applicantName', 'applicantEmail', 'applicantPhone', 'propertyAddress', 'systemType']
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // === 📈 CALCULAR TOTALES MENSUALES ===
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      const monthStartDate = new Date(currentYear, currentMonth - 1, 1);
      const monthEndDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

      const monthlyBudgetWhere = isSalesRepOrRecept
        ? {
            [Op.or]: [
              { leadSource: 'sales_rep', createdByStaffId: userId },
              { leadSource: 'sales_lead' }
            ],
            createdAt: { [Op.between]: [monthStartDate, monthEndDate] }
          }
        : {
            leadSource: { [Op.in]: ['sales_rep', 'sales_lead'] },
            createdAt: { [Op.between]: [monthStartDate, monthEndDate] }
          };

      const monthlyBudgets = await Budget.findAll({
        where: monthlyBudgetWhere,
        attributes: ['status', 'totalPrice']
      });

      // Contar works concretados del mes
      const monthlyWorkBudgetWhere = isSalesRepOrRecept
        ? {
            [Op.or]: [
              { leadSource: 'sales_rep', createdByStaffId: userId },
              { leadSource: 'sales_lead' }
            ]
          }
        : { leadSource: { [Op.in]: ['sales_rep', 'sales_lead'] } };

      const monthlyWorks = await Work.count({
        where: {
          createdAt: {
            [Op.between]: [monthStartDate, monthEndDate]
          }
        },
        include: [
          {
            model: Budget,
            as: 'budget',
            required: true,
            where: monthlyWorkBudgetWhere,
            attributes: []
          }
        ]
      });

      const monthlyStats = {
        totalCreated: monthlyBudgets.length,
        totalWorks: monthlyWorks
      };

      // === 📦 FORMATEAR RESPUESTA ===
      res.status(200).json({
        success: true,
        salesRep: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        monthlyStats: {
          month: currentMonth,
          year: currentYear,
          ...monthlyStats
        },
        budgets: budgets.map(b => ({
          idBudget: b.idBudget,
          status: b.status,
          leadSource: b.leadSource,
          propertyAddress: b.propertyAddress,
          totalPrice: parseFloat(b.totalPrice || 0),
          date: b.date,
          createdAt: b.createdAt,
          // Datos del cliente
          client: {
            name: b.Permit?.applicantName || b.applicantName,
            email: b.Permit?.applicantEmail || b.applicantEmail,
            phone: b.Permit?.applicantPhone,
            address: b.Permit?.propertyAddress || b.propertyAddress
          },
          permit: {
            permitNumber: b.Permit?.permitNumber,
            systemType: b.Permit?.systemType
          },
          // Work asociado (si existe)
          work: b.Work ? {
            idWork: b.Work.idWork,
            status: b.Work.status,
            startDate: b.Work.startDate,
            endDate: b.Work.endDate,
            createdAt: b.Work.createdAt
          } : null
        })),
        works: works.map(w => ({
          idWork: w.idWork,
          status: w.status,
          startDate: w.startDate,
          endDate: w.endDate,
          createdAt: w.createdAt,
          // Info del budget asociado
          budget: {
            idBudget: w.budget?.idBudget,
            status: w.budget?.status,
            totalPrice: parseFloat(w.budget?.totalPrice || 0),
            date: w.budget?.date,
            // Incluir permit completo en budget
            permit: {
              permitNumber: w.budget?.Permit?.permitNumber,
              applicantName: w.budget?.Permit?.applicantName,
              applicantEmail: w.budget?.Permit?.applicantEmail,
              applicantPhone: w.budget?.Permit?.applicantPhone,
              propertyAddress: w.budget?.Permit?.propertyAddress,
              systemType: w.budget?.Permit?.systemType
            }
          }
        }))
      });

    } catch (error) {
      console.error('❌ Error en getMySalesDashboard:', error);
      res.status(500).json({
        error: true,
        message: 'Error al obtener el dashboard de ventas',
        details: error.message
      });
    }
  }

  /**
   * Enviar propuesta comercial por email al cliente
   * POST /sales/send-proposal  (multipart/form-data)
   */
  async sendProposal(req, res) {
    try {
      const { to, clientName, subject, personalMessage, leadId } = req.body;
      const senderStaff = await Staff.findByPk(req.user.id, { attributes: ['name', 'email'] });

      if (!to || !to.includes('@')) {
        return res.status(400).json({ error: 'Email del destinatario inválido' });
      }

      const senderName = senderStaff?.name || 'Zurcher Septic Sales';
      const emailSubject = subject?.trim() || `Septic System Proposal — Zurcher Septic`;
      const greeting = clientName ? `Hi ${clientName},` : 'Hi there,';
      const customMessage = personalMessage?.trim() || '';
      const uploadedFiles = (req.files || []).slice(0, 2);
      const hasAttachments = uploadedFiles.length > 0;
      const attachmentFileNames = uploadedFiles.map(f => f.originalname);

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- HEADER BRAND -->
          <tr>
            <td bgcolor="#1a3a5c" style="background:linear-gradient(135deg,#1a3a5c 0%,#2563a8 100%) !important;background-color:#1a3a5c !important;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff !important;-webkit-text-fill-color:#ffffff !important;margin:0;font-size:28px;font-weight:700;letter-spacing:1px;">
                Zurcher Septic
              </h1>
              <p style="color:#a8c8f0 !important;-webkit-text-fill-color:#a8c8f0 !important;margin:6px 0 0;font-size:14px;letter-spacing:2px;text-transform:uppercase;">
                Professional Septic Solutions
              </p>
            </td>
          </tr>

          <!-- GREETING -->
          <tr>
            <td style="padding:36px 40px 20px;">
              <p style="font-size:18px;color:#1a3a5c !important;-webkit-text-fill-color:#1a3a5c !important;font-weight:600;margin:0 0 14px;">${greeting}</p>
              <p style="font-size:15px;color:#4a5568 !important;-webkit-text-fill-color:#4a5568 !important;line-height:1.7;margin:0 0 12px;">
                Thank you for your interest in Zurcher Septic. We specialize in 
                septic system installation, repair, and maintenance across Central & Southwest Florida — 
                delivering fast, reliable service with no hidden costs.
              </p>
              ${customMessage ? `
              <div style="background:#f0f7ff !important;background-color:#f0f7ff !important;border-left:4px solid #2563a8;border-radius:4px;padding:16px 20px;margin:20px 0;">
                <p style="font-size:14px;color:#2d3748 !important;-webkit-text-fill-color:#2d3748 !important;line-height:1.7;margin:0;white-space:pre-line;">${customMessage}</p>
              </div>` : ''}
            </td>
          </tr>

          <!-- FLYER IMAGE -->
          <tr>
            <td style="padding:0 40px 28px;">
              <a href="https://www.zurcherseptic.com/installation" target="_blank">
                <img
                  src="https://res.cloudinary.com/dt4ah1jmy/image/upload/v1774963095/flayer1_c1hnl4.jpg"
                  alt="Zurcher Septic Services"
                  width="540"
                  style="width:100%;max-width:540px;border-radius:10px;display:block;border:1px solid #e2e8f0;"
                />
              </a>
            </td>
          </tr>

          <!-- WHY CHOOSE US -->
          <tr>
            <td style="padding:0 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 16px;">
                    <h2 style="font-size:18px;color:#1a3a5c !important;-webkit-text-fill-color:#1a3a5c !important;margin:0 0 16px;font-weight:700;">
                      ✅ Why Choose Zurcher Septic?
                    </h2>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="8">
                      <tr>
                        <td width="48%" bgcolor="#f8fafc" style="background:#f8fafc !important;background-color:#f8fafc !important;border-radius:8px;padding:14px 16px;vertical-align:top;">
                          <p style="margin:0;font-size:14px;color:#2d3748 !important;-webkit-text-fill-color:#2d3748 !important;font-weight:600;">🏆 Licensed &amp; Insured</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#718096 !important;-webkit-text-fill-color:#718096 !important;">Fully certified for all septic work in Florida.</p>
                        </td>
                        <td width="4%"></td>
                        <td width="48%" bgcolor="#f8fafc" style="background:#f8fafc !important;background-color:#f8fafc !important;border-radius:8px;padding:14px 16px;vertical-align:top;">
                          <p style="margin:0;font-size:14px;color:#2d3748 !important;-webkit-text-fill-color:#2d3748 !important;font-weight:600;">⚡ Fast Installation</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#718096 !important;-webkit-text-fill-color:#718096 !important;">Efficient crews, on-time and on-budget.</p>
                        </td>
                      </tr>
                      <tr><td colspan="3" height="8"></td></tr>
                      <tr>
                        <td width="48%" bgcolor="#f8fafc" style="background:#f8fafc !important;background-color:#f8fafc !important;border-radius:8px;padding:14px 16px;vertical-align:top;">
                          <p style="margin:0;font-size:14px;color:#2d3748 !important;-webkit-text-fill-color:#2d3748 !important;font-weight:600;">💰 Competitive Pricing</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#718096 !important;-webkit-text-fill-color:#718096 !important;">Transparent quotes — no hidden fees.</p>
                        </td>
                        <td width="4%"></td>
                        <td width="48%" bgcolor="#f8fafc" style="background:#f8fafc !important;background-color:#f8fafc !important;border-radius:8px;padding:14px 16px;vertical-align:top;">
                          <p style="margin:0;font-size:14px;color:#2d3748 !important;-webkit-text-fill-color:#2d3748 !important;font-weight:600;">📋 Permit Handling</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#718096 !important;-webkit-text-fill-color:#718096 !important;">We manage all permits and inspections.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA BUTTON -->
          <tr>
            <td style="padding:0 40px 36px;text-align:center;">
              <a href="https://www.zurcherseptic.com/installation" target="_blank"
                 style="display:inline-block;background:linear-gradient(135deg,#1a3a5c 0%,#2563a8 100%) !important;background-color:#1a3a5c !important;color:#ffffff !important;-webkit-text-fill-color:#ffffff !important;text-decoration:none;padding:16px 44px;border-radius:30px;font-size:16px;font-weight:700;letter-spacing:0.5px;box-shadow:0 8px 24px rgba(26,58,92,0.35), 0 4px 12px rgba(37,99,168,0.40);">
                <span style="text-shadow:0 0 12px rgba(246,208,44,1), 0 3px 6px rgba(246,208,44,1), 0 0 20px rgba(246,208,44,0.8);">🌐</span> View Our Services &amp; Get a Free Quote
              </a>
              <p style="margin:14px 0 0;font-size:13px;color:#718096 !important;-webkit-text-fill-color:#718096 !important;">
                Or call us directly: <a href="tel:+19546368200" style="color:#2563a8 !important;-webkit-text-fill-color:#2563a8 !important;font-weight:600;text-decoration:none;">+1(954) 636-8200</a>
              </p>
            </td>
          </tr>

          <!-- DIVIDER -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" />
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="font-size:13px;color:#a0aec0 !important;-webkit-text-fill-color:#a0aec0 !important;margin:0 0 4px;">
                This proposal was sent by <strong style="color:#4a5568 !important;-webkit-text-fill-color:#4a5568 !important;">${senderName}</strong> from Zurcher Septic
              </p>
              <p style="font-size:12px;color:#cbd5e0 !important;-webkit-text-fill-color:#cbd5e0 !important;margin:0;">
                Zurcher Septic · Central Florida ·
                <a href="https://www.zurcherseptic.com" style="color:#2563a8 !important;-webkit-text-fill-color:#2563a8 !important;text-decoration:none;">zurcherseptic.com</a>
              </p>
            </td>
          </tr>

          ${hasAttachments ? `
          <!-- ATTACHMENTS NOTICE -->
          <tr>
            <td style="padding:0 40px 28px;">
              <div style="background:#f0fff4 !important;background-color:#f0fff4 !important;border:1px solid #9ae6b4;border-radius:8px;padding:16px 20px;text-align:center;">
                <p style="font-size:14px;color:#276749 !important;-webkit-text-fill-color:#276749 !important;font-weight:600;margin:0 0 6px;">📎 Budgets attached to this email</p>
                <p style="font-size:13px;color:#276749 !important;-webkit-text-fill-color:#276749 !important;margin:0;">
                  For any questions, please contact us at
                  <a href="mailto:sales@zurcherseptic.com" style="color:#2563a8 !important;-webkit-text-fill-color:#2563a8 !important;font-weight:600;text-decoration:none;">sales@zurcherseptic.com</a>
                </p>
              </div>
            </td>
          </tr>` : ''}

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

      // Preparar adjuntos desde archivos subidos (max 2)
      const attachments = uploadedFiles.map(file => ({
        filename: file.originalname,
        content: file.buffer,
        contentType: file.mimetype
      }));

      await sendSalesEmail({
        from: `"${senderName} — Zurcher Septic" <${process.env.SALES_SMTP_USER}>`,
        replyTo: process.env.SALES_SMTP_USER,
        to,
        subject: emailSubject,
        html: htmlContent,
        attachments
      });

      // Marcar el lead como propuesta enviada y cambiar status a 'quoted'
      if (leadId) {
        await SalesLead.update(
          { proposalSentAt: new Date(), status: 'quoted' },
          { where: { id: leadId } }
        );
      }

      res.json({ success: true, message: `Propuesta enviada a ${to}`, proposalSentAt: new Date() });

    } catch (error) {
      console.error('❌ Error en sendProposal:', error);
      res.status(500).json({ error: 'Error al enviar la propuesta', details: error.message });
    }
  }
}

module.exports = new SalesController();
