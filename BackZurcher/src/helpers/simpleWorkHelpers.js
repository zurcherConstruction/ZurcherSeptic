const { generateAndSaveSimpleWorkPDF } = require('../utils/pdfGenerators/simpleWorkPdfGenerator.js');
const { sendEmail } = require('../utils/notifications/emailService.js');
const { sendNotifications } = require('../utils/notifications/notificationManager.js');
const { v4: uuidv4 } = require('uuid');

/**
 * Helper para manejar lógica de envío de SimpleWork por email
 * Similar al budgetHelpers.js pero adaptado para SimpleWork
 */
async function handleSimpleWorkSendLogic(simpleWorkInstance, transaction, reqIO, isUpdate = false) {
  console.log(`🚀 Iniciando handleSimpleWorkSendLogic para SimpleWork ID: ${simpleWorkInstance.id}, isUpdate: ${isUpdate}`);
  let pdfPathForEmail = null;

  try {
    console.log("📄 Intentando generar PDF en backend...");
    
    // Preparar datos para PDF
    const simpleWorkDataForPdf = {
      ...simpleWorkInstance.toJSON(),
      items: simpleWorkInstance.items || [] // Incluir items si existen
    };

    const generatedPath = await generateAndSaveSimpleWorkPDF(simpleWorkDataForPdf);
    
    // Actualizar la instancia con la ruta del PDF
    simpleWorkInstance.pdfPath = generatedPath;
    await simpleWorkInstance.save({ transaction });
    
    pdfPathForEmail = generatedPath;
    console.log(`✅ PDF generado y ruta actualizada en BD para SimpleWork ID ${simpleWorkInstance.id}: ${pdfPathForEmail}`);

  } catch (pdfError) {
    console.error(`❌ Error CRÍTICO al generar/guardar PDF para SimpleWork ID ${simpleWorkInstance.id}:`, pdfError);
    throw new Error(`Error al generar PDF: ${pdfError.message}`);
  }

  if (!pdfPathForEmail) {
    throw new Error('❌ Error interno: No se pudo obtener la ruta del PDF generado.');
  }

  console.log(`📧 Usando PDF en ${pdfPathForEmail} para enviar correo...`);
  
  // Extraer datos del cliente (soporta clientData.{firstName,lastName} o clientData.name)
  const clientData = simpleWorkInstance.clientData || {};
  const clientEmail = clientData.email;
  const clientName = (clientData.firstName || clientData.lastName)
    ? `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim()
    : (clientData.name || 'Cliente');
  const propertyAddress = simpleWorkInstance.propertyAddress || 'Dirección pendiente de confirmar';
  const workNumber = simpleWorkInstance.workNumber;

  if (!clientEmail || !clientEmail.includes('@')) {
    console.warn(`⚠️ Advertencia: El cliente para SimpleWork ID ${simpleWorkInstance.id} no tiene un correo válido. No se enviará email.`);
  } else {
    // Generar token de aprobación
    const approvalToken = uuidv4();
    simpleWorkInstance.approvalToken = approvalToken;
    await simpleWorkInstance.save({ transaction });

    // Determinar URL del frontend
    let frontendBaseUrl = process.env.FRONTEND_URL;
    if (!frontendBaseUrl) {
      frontendBaseUrl = process.env.NODE_ENV === 'production'
        ? 'https://www.zurcherseptic.com'
        : 'http://localhost:5173';
    }
    const approvalLink = `${frontendBaseUrl}/simple-work-approve/${approvalToken}`;

    const emailSubject = isUpdate
      ? `Updated Quote #${workNumber} - ${propertyAddress}`
      : `New Quote #${workNumber} - ${propertyAddress}`;
      
    const emailText = isUpdate
      ? `Dear ${clientName},

Please find attached your updated quote for the work at:
${propertyAddress}

Quote Number: #${workNumber}
Type of Work: ${simpleWorkInstance.getWorkTypeDisplay ? simpleWorkInstance.getWorkTypeDisplay() : simpleWorkInstance.workType}

Please review the details carefully and do not hesitate to contact us if you have any questions.

To approve the quote, please visit: ${approvalLink}

Best regards,
ZURCHER CONSTRUCTION`
      : `Dear ${clientName},

Please find attached the requested quote for the work at:
${propertyAddress}

Quote Number: #${workNumber}
Type of Work: ${simpleWorkInstance.getWorkTypeDisplay ? simpleWorkInstance.getWorkTypeDisplay() : simpleWorkInstance.workType}

Please review the details carefully and do not hesitate to contact us if you have any questions.

To approve the quote, please visit: ${approvalLink}

Best regards,
ZURCHER CONSTRUCTION`;

    const clientMailOptions = {
      to: clientEmail,
      subject: emailSubject,
      text: emailText,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c3e50; margin-bottom: 10px;">ZURCHER CONSTRUCTION</h1>
              <div style="height: 2px; background-color: #e74c3c; margin: 0 auto; width: 100px;"></div>
            </div>
            
            <h2 style="color: #34495e; margin-bottom: 20px;">
              ${isUpdate ? '📋 Updated Quote' : '🆕 New Quote'}
            </h2>
            
            <p style="margin-bottom: 15px; color: #555;">Dear <strong>${clientName}</strong>,</p>
            
            <p style="margin-bottom: 20px; color: #555;">
              Please find attached ${isUpdate ? 'your updated quote' : 'the requested quote'} for the work at:
            </p>
            
            <div style="background-color: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <p style="margin: 5px 0; color: #2c3e50;"><strong>🏠 Address:</strong> ${propertyAddress}</p>
              <p style="margin: 5px 0; color: #2c3e50;"><strong>📋 Quote #:</strong> ${workNumber}</p>
              <p style="margin: 5px 0; color: #2c3e50;"><strong>🔧 Type of Work:</strong> ${simpleWorkInstance.getWorkTypeDisplay ? simpleWorkInstance.getWorkTypeDisplay() : simpleWorkInstance.workType}</p>
            </div>
            
            <p style="margin-bottom: 20px; color: #555;">
              Please review the details carefully and do not hesitate to contact us if you have any questions.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${approvalLink}" target="_blank" style="background-color: #27ae60; color: white; padding: 16px 40px; text-align: center; text-decoration: none; display: inline-block; border-radius: 6px; font-weight: bold; font-size: 18px; letter-spacing: 1px;">
                ✅ APPROVE QUOTE
              </a>
            </div>
            
            <p style="margin-bottom: 10px; color: #888; font-size: 13px; text-align: center;">
              Click the button above to approve this quote, or reply to this email if you have any questions.
            </p>
            
            <p style="margin-bottom: 30px; color: #555;">
              Best regards,<br>
              <strong>ZURCHER CONSTRUCTION</strong>
            </p>
            
            <div style="text-align: center; border-top: 1px solid #ecf0f1; padding-top: 20px;">
              <p style="margin: 0; color: #999; font-size: 12px;">
                This email was sent automatically. For general inquiries, please contact us directly.
              </p>
            </div>
          </div>
        </div>
      `,
      attachments: [{ 
        filename: `cotizacion_${workNumber}.pdf`, 
        path: pdfPathForEmail, 
        contentType: 'application/pdf' 
      }],
    };

    try {
      console.log(`📧 Intentando enviar correo (${isUpdate ? 'actualizado' : 'nuevo'}) al cliente: ${clientEmail}`);
      await sendEmail(clientMailOptions);
      console.log(`✅ Correo (${isUpdate ? 'actualizado' : 'nuevo'}) enviado exitosamente al cliente.`);
    } catch (clientEmailError) {
      console.error(`❌ Error al enviar correo (${isUpdate ? 'actualizado' : 'nuevo'}) al cliente ${clientEmail}:`, clientEmailError);
    }
  }

  // Enviar notificaciones internas
  await sendNotifications('simpleWorkSent', {
    propertyAddress: propertyAddress,
    clientEmail: clientEmail,
    clientName: clientName,
    workNumber: workNumber,
  }, null, reqIO);
  console.log(`📱 Notificaciones internas 'simpleWorkSent' enviadas.`);

  console.log(`🎉 handleSimpleWorkSendLogic completado exitosamente para SimpleWork ID: ${simpleWorkInstance.id}`);
}

module.exports = {
  handleSimpleWorkSendLogic
};