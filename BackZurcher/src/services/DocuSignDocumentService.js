const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const DocuSignTokenService = require('./DocuSignTokenService');

/**
 * Servicio para envío de documentos con DocuSign
 * Maneja upload, envío y descarga de documentos firmados
 */
class DocuSignDocumentService {
  constructor() {
    this.basePath = process.env.DOCUSIGN_BASE_PATH || 'https://na4.docusign.net/restapi';
    this.accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  }

  /**
   * Sube un documento y envía para firma
   */
  async uploadAndSendDocument(filePath, fileName, signerEmail, signerName, subject) {
    try {
      console.log('\ud83d\udce7 [DocuSign] Iniciando envío de documento...');

      // Obtener access token válido
      const accessToken = await DocuSignTokenService.getValidAccessToken();
      
      if (!accessToken) {
        throw new Error('No hay token de DocuSign válido. Ejecuta primero la autorización OAuth.');
      }

      // Leer el archivo PDF
      let pdfContent;
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        // Descargar desde URL
        const response = await axios.get(filePath, { responseType: 'arraybuffer' });
        pdfContent = Buffer.from(response.data).toString('base64');
      } else {
        // Leer desde archivo local
        pdfContent = fs.readFileSync(filePath, { encoding: 'base64' });
      }

      // Crear el envelope
      const envelopeDefinition = {
        emailSubject: subject || 'Por favor firma este documento',
        documents: [
          {
            documentBase64: pdfContent,
            name: fileName,
            fileExtension: 'pdf',
            documentId: '1'
          }
        ],
        recipients: {
          signers: [
            {
              email: signerEmail,
              name: signerName,
              recipientId: '1',
              routingOrder: '1',
              tabs: {
                signHereTabs: [
                  {
                    anchorString: '/sn1/',
                    anchorXOffset: '20',
                    anchorYOffset: '10',
                    documentId: '1',
                    pageNumber: '1'
                  }
                ]
              }
            }
          ]
        },
        status: 'sent' // Enviar inmediatamente
      };

      const response = await axios.post(
        `${this.basePath}/v2.1/accounts/${this.accountId}/envelopes`,
        envelopeDefinition,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('\u2705 [DocuSign] Documento enviado exitosamente');
      console.log(`   Envelope ID: ${response.data.envelopeId}`);

      return {
        success: true,
        envelopeId: response.data.envelopeId,
        status: response.data.status,
        provider: 'docusign'
      };
    } catch (error) {
      console.error('\u274c [DocuSign] Error enviando documento:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Verifica si un documento está firmado
   */
  async isDocumentSigned(envelopeId) {
    try {
      const accessToken = await DocuSignTokenService.getValidAccessToken();
      
      const response = await axios.get(
        `${this.basePath}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      const status = response.data.status;
      const isSigned = status === 'completed';

      return {
        isSigned,
        status,
        completedDateTime: response.data.completedDateTime,
        sentDateTime: response.data.sentDateTime
      };
    } catch (error) {
      console.error('\u274c [DocuSign] Error verificando estado:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Descarga el documento firmado
   */
  async downloadSignedDocument(envelopeId) {
    try {
      console.log(`\ud83d\udcdd [DocuSign] Descargando documento firmado (Envelope: ${envelopeId})...`);

      const accessToken = await DocuSignTokenService.getValidAccessToken();

      const response = await axios.get(
        `${this.basePath}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/documents/combined`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          responseType: 'arraybuffer'
        }
      );

      console.log('\u2705 [DocuSign] Documento firmado descargado');

      return Buffer.from(response.data);
    } catch (error) {
      console.error('\u274c [DocuSign] Error descargando documento:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Cancela un envelope pendiente
   */
  async cancelEnvelope(envelopeId) {
    try {
      const accessToken = await DocuSignTokenService.getValidAccessToken();

      await axios.put(
        `${this.basePath}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        { status: 'voided', voidedReason: 'Cancelado por el usuario' },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`\u2705 [DocuSign] Envelope ${envelopeId} cancelado`);
      return { success: true };
    } catch (error) {
      console.error('\u274c [DocuSign] Error cancelando envelope:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = DocuSignDocumentService;
