const { Budget, Permit } = require('../data');
const SignNowService = require('../services/ServiceSignNow');
const DocuSignService = require('../services/ServiceDocuSign');
const path = require('path');
const fs = require('fs');
const { cloudinary } = require('../utils/cloudinaryConfig');
const { Op } = require('sequelize');

/**
 * Verificar manualmente las firmas pendientes de SignNow y DocuSign
 * Similar al cron job pero se ejecuta bajo demanda
 */
const verifyPendingSignatures = async (req, res) => {
  try {
    const signNowService = new SignNowService();
    const docuSignService = new DocuSignService();

    // 🆕 OPTIMIZADO: Solo buscar presupuestos enviados en los últimos 30 días
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSignatureActivityWhere = {
      [Op.or]: [
        { sentForSignatureAt: { [Op.gte]: thirtyDaysAgo } },
        { sentForReviewAt: { [Op.gte]: thirtyDaysAgo } },
        { updatedAt: { [Op.gte]: thirtyDaysAgo } }
      ]
    };

    // Buscar presupuestos pendientes de SignNow
    const pendingSignNow = await Budget.findAll({
      where: {
        signNowDocumentId: { [Op.ne]: null },
        status: 'sent_for_signature',
        ...recentSignatureActivityWhere,
        [Op.or]: [
          { signatureMethod: 'signnow' },
          { signatureMethod: null },
          { signatureMethod: '' },
          { signatureMethod: 'none' }
        ]
      },
      include: [{ model: Permit, attributes: ['applicantName', 'propertyAddress'] }],
      limit: 25,
      order: [['updatedAt', 'DESC']]
    });

    // Buscar presupuestos pendientes de DocuSign
    const pendingDocuSign = await Budget.findAll({
      where: {
        docusignEnvelopeId: { [Op.ne]: null },
        status: 'sent_for_signature',
        ...recentSignatureActivityWhere,
        [Op.or]: [
          { signatureMethod: 'docusign' },
          { signatureMethod: null },
          { signatureMethod: '' },
          { signatureMethod: 'none' }
        ]
      },
      include: [{ model: Permit, attributes: ['applicantName', 'propertyAddress'] }],
      limit: 25,
      order: [['updatedAt', 'DESC']]
    });

    const totalPending = pendingSignNow.length + pendingDocuSign.length;

    if (totalPending === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay presupuestos pendientes de verificación',
        checked: 0,
        signed: 0
      });
    }

    let signedCount = 0;
    const results = [];

    // ===== VERIFICAR SIGNNOW =====
    for (const budget of pendingSignNow) {
      try {
        const signatureStatus = await signNowService.isDocumentSigned(budget.signNowDocumentId);

        if (signatureStatus.isSigned) {
          signedCount++;

          try {
            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }

            const tempFilePath = path.join(tempDir, `budget_${budget.idBudget}_signed_${Date.now()}.pdf`);
            
            await signNowService.downloadSignedDocument(budget.signNowDocumentId, tempFilePath);

            const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
              folder: 'signed_budgets',
              resource_type: 'raw',
              public_id: `budget_${budget.idBudget}_signed_${Date.now()}`,
              tags: [
                `invoice-${budget.idBudget}`,
                `property-${(budget.Permit?.propertyAddress || '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
                'budget',
                'signed',
                'signnow'
              ],
              context: {
                invoice: budget.idBudget.toString(),
                property: budget.Permit?.propertyAddress || budget.propertyAddress,
                signed_at: new Date().toISOString(),
                signature_method: 'signnow'
              }
            });

            await budget.update({
              status: 'signed',
              signatureMethod: 'signnow',
              signedAt: new Date(),
              signedPdfPath: uploadResult.secure_url,
              signedPdfPublicId: uploadResult.public_id
            });

            fs.unlinkSync(tempFilePath);

            results.push({
              idBudget: budget.idBudget,
              propertyAddress: budget.Permit?.propertyAddress || budget.propertyAddress,
              status: 'signed',
              method: 'SignNow',
              pdfUrl: uploadResult.secure_url
            });

          } catch (downloadError) {
            console.error(`❌ [SignNow] Error descargando PDF para Budget #${budget.idBudget}:`, downloadError.message);
            
            await budget.update({
              status: 'signed',
              signatureMethod: 'signnow',
              signedAt: new Date()
            });

            results.push({
              idBudget: budget.idBudget,
              propertyAddress: budget.Permit?.propertyAddress || budget.propertyAddress,
              status: 'signed',
              method: 'SignNow',
              error: 'PDF no descargado'
            });
          }
        } else {
          results.push({
            idBudget: budget.idBudget,
            propertyAddress: budget.Permit?.propertyAddress || budget.propertyAddress,
            status: 'pending',
            method: 'SignNow'
          });
        }
      } catch (error) {
        console.error(`❌ [SignNow] Error verificando Budget #${budget.idBudget}:`, error.message);
        results.push({
          idBudget: budget.idBudget,
          method: 'SignNow',
          error: error.message
        });
      }
    }

    // ===== VERIFICAR DOCUSIGN =====
    for (const budget of pendingDocuSign) {
      try {
        const signatureStatus = await docuSignService.isDocumentSigned(budget.docusignEnvelopeId);

        if (signatureStatus.signed) {
          signedCount++;

          try {
            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }

            const tempFilePath = path.join(tempDir, `budget_${budget.idBudget}_signed_${Date.now()}.pdf`);
            
            await docuSignService.downloadSignedDocument(budget.docusignEnvelopeId, tempFilePath);

            const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
              folder: 'signed_budgets',
              resource_type: 'raw',
              public_id: `budget_${budget.idBudget}_signed_${Date.now()}`,
              tags: [
                `invoice-${budget.idBudget}`,
                `property-${(budget.Permit?.propertyAddress || '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
                'budget',
                'signed',
                'docusign'
              ],
              context: {
                invoice: budget.idBudget.toString(),
                property: budget.Permit?.propertyAddress || budget.propertyAddress,
                signed_at: envelopeStatus.completedDateTime || new Date().toISOString(),
                signature_method: 'docusign'
              }
            });

            await budget.update({
              status: 'signed',
              signatureMethod: 'docusign',
              signedAt: signatureStatus.completedDateTime || new Date(),
              signedPdfPath: uploadResult.secure_url,
              signedPdfPublicId: uploadResult.public_id
            });

            fs.unlinkSync(tempFilePath);

            results.push({
              idBudget: budget.idBudget,
              propertyAddress: budget.Permit?.propertyAddress || budget.propertyAddress,
              status: 'signed',
              method: 'DocuSign',
              pdfUrl: uploadResult.secure_url
            });

          } catch (downloadError) {
            console.error(`❌ [DocuSign] Error descargando PDF para Budget #${budget.idBudget}:`, downloadError.message);
            
            await budget.update({
              status: 'signed',
              signatureMethod: 'docusign',
              signedAt: signatureStatus.completedDateTime || new Date()
            });

            results.push({
              idBudget: budget.idBudget,
              propertyAddress: budget.Permit?.propertyAddress || budget.propertyAddress,
              status: 'signed',
              method: 'DocuSign',
              error: 'PDF no descargado'
            });
          }
        } else {
          results.push({
            idBudget: budget.idBudget,
            propertyAddress: budget.Permit?.propertyAddress || budget.propertyAddress,
            status: envelopeStatus.status,
            completedDateTime: signatureStatus.completedDateTime,
            method: 'DocuSign'
          });
        }
      } catch (error) {
        console.error(`❌ [DocuSign] Error verificando Budget #${budget.idBudget}:`, error.message);
        results.push({
          idBudget: budget.idBudget,
          method: 'DocuSign',
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Verificación completada: ${signedCount} presupuestos firmados de ${totalPending} revisados`,
      checked: totalPending,
      signed: signedCount,
      signNowChecked: pendingSignNow.length,
      docuSignChecked: pendingDocuSign.length,
      results
    });

  } catch (error) {
    console.error('Error en verificación manual de firmas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar firmas',
      details: error.message
    });
  }
};

module.exports = {
  verifyPendingSignatures
};
