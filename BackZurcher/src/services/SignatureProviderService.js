const SignNowService = require('./ServiceSignNow');
const DocuSignDocumentService = require('./DocuSignDocumentService');

/**
 * Servicio abstracto para firmas electrónicas
 * Decide automáticamente entre SignNow (desarrollo) y DocuSign (producción)
 * basándose en variables de entorno
 */
class SignatureProviderService {
  constructor() {
    this.provider = this.determineProvider();
    this.service = this.initializeService();
  }

  /**
   * Determina qué proveedor usar basándose en env
   */
  determineProvider() {
    // Si USE_DOCUSIGN está explícitamente en true, usar DocuSign
    if (process.env.USE_DOCUSIGN === 'true') {
      return 'docusign';
    }
    
    // Por defecto, usar SignNow (más económico para desarrollo)
    return 'signnow';
  }

  /**
   * Inicializa el servicio correcto según el proveedor
   */
  initializeService() {
    if (this.provider === 'docusign') {
      console.log('\ud83d\udcdd [Signature Provider] Usando DocuSign');
      return new DocuSignDocumentService();
    } else {
      console.log('\ud83d\udcdd [Signature Provider] Usando SignNow');
      return new SignNowService();
    }
  }

  /**
   * Obtiene el nombre del proveedor activo
   */
  getProviderName() {
    return this.provider;
  }

  /**
   * Sube y envía un documento para firma
   * @param {string} filePath - Ruta del archivo PDF (local o URL)
   * @param {string} fileName - Nombre del archivo
   * @param {string} signerEmail - Email del firmante
   * @param {string} signerName - Nombre del firmante
   * @param {string} subject - Asunto del email (opcional)
   * @returns {Promise<{success: boolean, documentId: string, envelopeId: string, provider: string}>}
   */
  async uploadAndSendDocument(filePath, fileName, signerEmail, signerName, subject = 'Por favor firma este documento') {
    try {
      if (this.provider === 'docusign') {
        // DocuSign
        const result = await this.service.uploadAndSendDocument(
          filePath,
          fileName,
          signerEmail,
          signerName,
          subject
        );
        
        return {
          success: result.success,
          documentId: result.envelopeId, // DocuSign usa envelopeId
          envelopeId: result.envelopeId,
          provider: 'docusign'
        };
      } else {
        // SignNow - usar el método sendBudgetForSignature que ya funciona
        console.log('📧 Enviando documento a SignNow...');
        const result = await this.service.sendBudgetForSignature(
          filePath,
          fileName,
          signerEmail,
          signerName
        );

        console.log('✅ [SignNow] Documento enviado exitosamente');

        return {
          success: true,
          documentId: result.documentId,
          envelopeId: result.inviteId || result.documentId,
          provider: 'signnow'
        };
      }
    } catch (error) {
      console.error(`\u274c [${this.provider}] Error en uploadAndSendDocument:`, error.message);
      throw error;
    }
  }

  /**
   * Verifica si un documento está firmado
   * @param {string} documentId - ID del documento (document_id o envelopeId)
   * @returns {Promise<{isSigned: boolean, status: string, signedAt: string}>}
   */
  async isDocumentSigned(documentId) {
    try {
      if (this.provider === 'docusign') {
        return await this.service.isDocumentSigned(documentId);
      } else {
        return await this.service.isDocumentSigned(documentId);
      }
    } catch (error) {
      console.error(`\u274c [${this.provider}] Error verificando estado:`, error.message);
      throw error;
    }
  }

  /**
   * Descarga el documento firmado
   * @param {string} documentId - ID del documento
   * @returns {Promise<Buffer>} Buffer del PDF firmado
   */
  async downloadSignedDocument(documentId) {
    try {
      if (this.provider === 'docusign') {
        return await this.service.downloadSignedDocument(documentId);
      } else {
        // SignNow - descargar directamente como buffer
        const axios = require('axios');
        const apiKey = process.env.SIGNNOW_API_KEY;
        
        const response = await axios.get(
          `https://api.signnow.com/document/${documentId}/download?type=collapsed`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            },
            responseType: 'arraybuffer'
          }
        );

        return Buffer.from(response.data);
      }
    } catch (error) {
      console.error(`\u274c [${this.provider}] Error descargando documento:`, error.message);
      throw error;
    }
  }

  /**
   * Cancela un documento/envelope pendiente
   * @param {string} documentId - ID del documento
   * @returns {Promise<{success: boolean}>}
   */
  async cancelDocument(documentId) {
    try {
      if (this.provider === 'docusign') {
        return await this.service.cancelEnvelope(documentId);
      } else {
        // SignNow no tiene cancelación directa, retornar éxito
        console.log(`\u26a0\ufe0f [SignNow] No soporta cancelación directa`);
        return { success: true };
      }
    } catch (error) {
      console.error(`\u274c [${this.provider}] Error cancelando documento:`, error.message);
      throw error;
    }
  }

  /**
   * Test de conexión con el proveedor activo
   */
  async testConnection() {
    try {
      if (this.provider === 'docusign') {
        const DocuSignController = require('../controllers/DocuSignController');
        return await DocuSignController.testConnection();
      } else {
        return await this.service.testConnection();
      }
    } catch (error) {
      return {
        success: false,
        provider: this.provider,
        error: error.message
      };
    }
  }
}

module.exports = SignatureProviderService;
