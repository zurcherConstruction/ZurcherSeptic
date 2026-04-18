const { SignatureDocument, KnowledgeContact, Staff } = require('../data');
const SignatureProviderService = require('../services/SignatureProviderService');
const { cloudinary } = require('../utils/cloudinaryConfig');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');

/**
 * Controlador para gestión de documentos para firma electrónica
 * Soporta SignNow (desarrollo) y DocuSign (producción)
 */
const SignatureDocumentController = {
  /**
   * Listar todos los documentos de firma
   */
  async getAllDocuments(req, res) {
    try {
      const { status, linkedContactId, page = 1, limit = 50 } = req.query;

      const where = {};
      if (status) where.status = status;
      if (linkedContactId) where.linkedContactId = linkedContactId;

      const offset = (page - 1) * limit;

      const { count, rows: documents } = await SignatureDocument.findAndCountAll({
        where,
        include: [
          { 
            model: KnowledgeContact, 
            as: 'linkedContact',
            attributes: ['id', 'companyName', 'contactPerson', 'email', 'phone']
          },
          {
            model: Staff,
            as: 'creator',
            attributes: ['id', 'name', 'email']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        documents,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('\u274c Error listando documentos:', error);
      res.status(500).json({
        success: false,
        message: 'Error listando documentos',
        error: error.message
      });
    }
  },

  /**
   * Obtener un documento específico
   */
  async getDocument(req, res) {
    try {
      const { id } = req.params;

      const document = await SignatureDocument.findByPk(id, {
        include: [
          { 
            model: KnowledgeContact, 
            as: 'linkedContact',
            attributes: ['id', 'companyName', 'contactPerson', 'email', 'phone']
          },
          {
            model: Staff,
            as: 'creator',
            attributes: ['id', 'name', 'email']
          }
        ]
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Documento no encontrado'
        });
      }

      res.json({
        success: true,
        document
      });
    } catch (error) {
      console.error('\u274c Error obteniendo documento:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo documento',
        error: error.message
      });
    }
  },

  /**
   * Crear y enviar documento para firma
   */
  async createAndSendDocument(req, res) {
    try {
      const {
        documentName,
        documentType,
        description,
        signerName,
        signerEmail,
        signerPhone,
        linkedContactId,
        linkedEntityType,
        linkedEntityId
      } = req.body;

      // Validaciones
      if (!documentName || !signerName || !signerEmail) {
        return res.status(400).json({
          success: false,
          message: 'Campos requeridos: documentName, signerName, signerEmail'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Archivo PDF requerido'
        });
      }

      const pdfFile = req.file;

      // Subir PDF original a Cloudinary
      console.log('\u2601\ufe0f Subiendo PDF a Cloudinary...');
      
      const cloudinaryResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'signature-documents',
            resource_type: 'raw',
            format: 'pdf'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        
        const bufferStream = Readable.from(pdfFile.buffer);
        bufferStream.pipe(uploadStream);
      });

      console.log('\u2705 PDF subido a Cloudinary:', cloudinaryResult.secure_url);

      // Inicializar servicio de firma
      const signatureService = new SignatureProviderService();
      const provider = signatureService.getProviderName();

      // Crear documento en estado draft
      const document = await SignatureDocument.create({
        documentName,
        documentType: documentType || null,
        description: description || null,
        signerName,
        signerEmail,
        signerPhone: signerPhone || null,
        linkedContactId: linkedContactId || null,
        linkedEntityType: linkedEntityType || null,
        linkedEntityId: linkedEntityId || null,
        signatureProvider: provider,
        originalPdfUrl: cloudinaryResult.secure_url,
        originalPdfPublicId: cloudinaryResult.public_id,
        status: 'draft',
        createdBy: req.user?.id || null
      });

      // Enviar a proveedor de firma
      console.log(`\ud83d\udce7 Enviando documento a ${provider}...`);

      const sendResult = await signatureService.uploadAndSendDocument(
        cloudinaryResult.secure_url,
        `${documentName}.pdf`,
        signerEmail,
        signerName,
        `Por favor firma: ${documentName}`
      );

      // Actualizar documento con IDs del proveedor
      await document.update({
        providerDocumentId: sendResult.documentId,
        providerEnvelopeId: sendResult.envelopeId,
        status: 'pending',
        sentAt: new Date()
      });

      console.log('\u2705 Documento enviado exitosamente');

      // Devolver documento completo
      const createdDocument = await SignatureDocument.findByPk(document.id, {
        include: [
          { model: KnowledgeContact, as: 'linkedContact' },
          { model: Staff, as: 'creator', attributes: ['id', 'name', 'email'] }
        ]
      });

      res.status(201).json({
        success: true,
        message: `Documento enviado a ${signerEmail} via ${provider}`,
        document: createdDocument
      });
    } catch (error) {
      console.error('\u274c Error creando/enviando documento:', error);
      res.status(500).json({
        success: false,
        message: 'Error creando/enviando documento',
        error: error.message
      });
    }
  },

  /**
   * Verificar estado de firma de un documento
   */
  async checkDocumentStatus(req, res) {
    try {
      const { id } = req.params;

      const document = await SignatureDocument.findByPk(id);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Documento no encontrado'
        });
      }

      if (!document.providerDocumentId) {
        return res.status(400).json({
          success: false,
          message: 'Este documento no ha sido enviado aún'
        });
      }

      // Verificar estado en el proveedor
      const signatureService = new SignatureProviderService();
      const statusResult = await signatureService.isDocumentSigned(document.providerDocumentId);

      // Actualizar documento si está firmado y aún no lo habíamos detectado
      if (statusResult.isSigned && document.status !== 'signed') {
        await document.update({
          status: 'signed',
          signedAt: statusResult.signedAt || statusResult.completedDateTime || new Date()
        });
      }

      res.json({
        success: true,
        documentId: id,
        ...statusResult,
        provider: document.signatureProvider
      });
    } catch (error) {
      console.error('\u274c Error verificando estado:', error);
      res.status(500).json({
        success: false,
        message: 'Error verificando estado',
        error: error.message
      });
    }
  },

  /**
   * Descargar documento firmado
   */
  async downloadSignedDocument(req, res) {
    try {
      const { id } = req.params;

      const document = await SignatureDocument.findByPk(id);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Documento no encontrado'
        });
      }

      if (document.status !== 'signed') {
        return res.status(400).json({
          success: false,
          message: 'El documento aún no está firmado'
        });
      }

      // Si ya está en Cloudinary, devolver URL
      if (document.signedPdfUrl) {
        return res.json({
          success: true,
          signedPdfUrl: document.signedPdfUrl,
          fromCache: true
        });
      }

      // Descargar del proveedor
      const signatureService = new SignatureProviderService();
      const pdfBuffer = await signatureService.downloadSignedDocument(document.providerDocumentId);

      // Subir a Cloudinary
      console.log('\u2601\ufe0f Subiendo PDF firmado a Cloudinary...');
      
      const cloudinaryResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'signature-documents/signed',
            resource_type: 'raw',
            format: 'pdf',
            public_id: `signed-${document.id}`
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        
        const bufferStream = Readable.from(pdfBuffer);
        bufferStream.pipe(uploadStream);
      });

      // Actualizar documento
      await document.update({
        signedPdfUrl: cloudinaryResult.secure_url,
        signedPdfPublicId: cloudinaryResult.public_id,
        downloadedAt: new Date()
      });

      console.log('\u2705 PDF firmado guardado en Cloudinary');

      res.json({
        success: true,
        signedPdfUrl: cloudinaryResult.secure_url,
        fromCache: false
      });
    } catch (error) {
      console.error('\u274c Error descargando documento firmado:', error);
      res.status(500).json({
        success: false,
        message: 'Error descargando documento firmado',
        error: error.message
      });
    }
  },

  /**
   * Cancelar documento pendiente
   */
  async cancelDocument(req, res) {
    try {
      const { id } = req.params;

      const document = await SignatureDocument.findByPk(id);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Documento no encontrado'
        });
      }

      if (document.status === 'signed') {
        return res.status(400).json({
          success: false,
          message: 'No se puede cancelar un documento ya firmado'
        });
      }

      // Cancelar en el proveedor si fue enviado
      if (document.providerDocumentId) {
        const signatureService = new SignatureProviderService();
        await signatureService.cancelDocument(document.providerDocumentId);
      }

      // Actualizar estado
      await document.update({
        status: 'cancelled'
      });

      res.json({
        success: true,
        message: 'Documento cancelado exitosamente'
      });
    } catch (error) {
      console.error('\u274c Error cancelando documento:', error);
      res.status(500).json({
        success: false,
        message: 'Error cancelando documento',
        error: error.message
      });
    }
  },

  /**
   * Eliminar documento
   */
  async deleteDocument(req, res) {
    try {
      const { id } = req.params;

      const document = await SignatureDocument.findByPk(id);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Documento no encontrado'
        });
      }

      // Eliminar PDFs de Cloudinary
      if (document.originalPdfPublicId) {
        try {
          await cloudinary.uploader.destroy(document.originalPdfPublicId, { resource_type: 'raw' });
        } catch (err) {
          console.warn('\u26a0\ufe0f Error eliminando PDF original de Cloudinary:', err.message);
        }
      }

      if (document.signedPdfPublicId) {
        try {
          await cloudinary.uploader.destroy(document.signedPdfPublicId, { resource_type: 'raw' });
        } catch (err) {
          console.warn('\u26a0\ufe0f Error eliminando PDF firmado de Cloudinary:', err.message);
        }
      }

      await document.destroy();

      res.json({
        success: true,
        message: 'Documento eliminado exitosamente'
      });
    } catch (error) {
      console.error('\u274c Error eliminando documento:', error);
      res.status(500).json({
        success: false,
        message: 'Error eliminando documento',
        error: error.message
      });
    }
  },

  /**
   * Test de conexión con el proveedor activo
   */
  async testConnection(req, res) {
    try {
      const signatureService = new SignatureProviderService();
      const provider = signatureService.getProviderName();
      const result = await signatureService.testConnection();

      res.json({
        success: result.success || false,
        provider,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

module.exports = SignatureDocumentController;
