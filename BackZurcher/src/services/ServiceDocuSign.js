const docusign = require('docusign-esign');
const fs = require('fs');
const path = require('path');
const DocuSignTokenService = require('./DocuSignTokenService');
const { docuSignOperation, withAutoRefreshToken } = require('../middleware/docuSignMiddleware');

class DocuSignService {
  constructor() {
    this.integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
    this.userId = process.env.DOCUSIGN_USER_ID;
    this.accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    this.environment = process.env.DOCUSIGN_ENVIRONMENT || 'demo';
    
    // 🔧 FIX: Quitar /v2.1 de DOCUSIGN_BASE_PATH si está presente, porque el SDK lo agrega automáticamente
    let basePath = process.env.DOCUSIGN_BASE_PATH || 
      (this.environment === 'demo' 
        ? 'https://demo.docusign.net/restapi'
        : 'https://na4.docusign.net/restapi');
    
    // Quitar /v2.1 del final si está presente
    this.basePath = basePath.replace(/\/v2\.1$/, '');

    // Validar configuración
    if (!this.integrationKey || !this.userId || !this.accountId) {
      console.error('❌ Faltan credenciales de DocuSign en variables de entorno');
      console.error('Requeridas: DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID');
    }

    // Cliente API de DocuSign
    this.apiClient = new docusign.ApiClient();
    this.apiClient.setBasePath(this.basePath);
  }

  /**
   * Obtener token de acceso usando el sistema robusto de tokens OAuth
   * Reemplaza el sistema JWT por OAuth con persistencia en base de datos
   */
  async getAccessToken() {
    try {
      console.log('🔐 Obteniendo access token de DocuSign con sistema robusto OAuth...');

      // Usar el sistema robusto de tokens con auto-refresh
      const accessToken = await DocuSignTokenService.getValidAccessToken();
      
      // Configurar el token en el API client
      this.apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);
      
      console.log('✅ Access token robusto OAuth obtenido exitosamente');
      return accessToken;
    } catch (error) {
      console.error('❌ Error obteniendo access token robusto OAuth:', error.message);
      
      // Error específico para OAuth
      if (error.message.includes('No hay tokens disponibles')) {
        console.error('\n⚠️  ACCIÓN REQUERIDA: Se necesita autorización OAuth');
        console.error('👉 Ve a: ' + process.env.API_URL + '/docusign/auth');
        console.error('👉 Completa el proceso de autorización OAuth');
        console.error('👉 Una vez autorizado, los tokens se guardarán automáticamente en la base de datos');
      }
      throw error;
    }
  }

  /**
   * Enviar documento para firma (equivalente a sendBudgetForSignature de SignNow)
   * @param {string} pdfPath - Ruta local o URL del PDF
   * @param {string} clientEmail - Email del cliente que firmará
   * @param {string} clientName - Nombre del cliente
   * @param {string} fileName - Nombre del archivo
   * @param {string} subject - Asunto del email
   * @param {string} message - Mensaje del email
   * @param {boolean} getSigningUrl - Si true, genera URL inmediatamente. Si false, crea envelope con clientUserId pero sin generar URL (on-demand)
   */
  async sendBudgetForSignature(pdfPath, clientEmail, clientName, fileName, subject, message, getSigningUrl = false) {
    // Usar el sistema robusto de operaciones DocuSign con auto-refresh
    return await withAutoRefreshToken(async (accessToken) => {
      // 🔧 Normalizar email a minúsculas para evitar problemas de entrega
      const normalizedEmail = clientEmail.toLowerCase();
      
      console.log('\n🚀 === ENVIANDO DOCUMENTO A DOCUSIGN (SISTEMA ROBUSTO) ===');
      console.log('📧 Cliente:', normalizedEmail, '-', clientName);
      console.log('📄 Archivo:', fileName);
      console.log('🔗 Tipo de firma:', getSigningUrl ? 'Embedded (expira en 5-15 min)' : '✅ Remote (válido por 365 días)');
      console.log('🔐 Usando token robusto con auto-refresh');

      // Token ya fue obtenido y validado por withAutoRefreshToken
      this.apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);

      // Leer el archivo PDF
      let pdfBytes;
      if (pdfPath.startsWith('http://') || pdfPath.startsWith('https://')) {
        // Si es URL, descargar
        const axios = require('axios');
        const response = await axios.get(pdfPath, { responseType: 'arraybuffer' });
        pdfBytes = Buffer.from(response.data);
      } else {
        // Si es local, leer
        pdfBytes = fs.readFileSync(pdfPath);
      }

      const pdfBase64 = pdfBytes.toString('base64');

      // Crear el envelope (sobre)
      // ✅ IMPORTANTE: getSigningUrl = false para Remote Signing (enlace válido 365 días)
      //                getSigningUrl = true para Embedded Signing (enlace expira en 5-15 min)
      const envelopeDefinition = this.createEnvelopeDefinition(
        pdfBase64,
        fileName,
        normalizedEmail, // Usar email normalizado
        clientName,
        subject,
        message,
        getSigningUrl // false = Remote Signing (recomendado)
      );

      // Enviar el envelope
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      const results = await envelopesApi.createEnvelope(this.accountId, {
        envelopeDefinition: envelopeDefinition
      });

      console.log('✅ Documento enviado exitosamente a DocuSign (sistema robusto)');
      console.log('📋 Envelope ID:', results.envelopeId);
      console.log('📊 Status:', results.status);

      const response = {
        success: true,
        envelopeId: results.envelopeId,
        status: results.status,
        uri: results.uri,
        statusDateTime: results.statusDateTime
      };

      // Si se solicitó URL de firma embebida (getSigningUrl = true)
      if (getSigningUrl) {
        console.log('🔗 Generando URL de firma embebida (expira en 5-15 min)...');
        const signingUrl = await this.getRecipientViewUrl(
          results.envelopeId,
          normalizedEmail,
          clientName
        );
        response.signingUrl = signingUrl;
        console.log('✅ URL de firma embebida generada');
        console.log('⚠️  ADVERTENCIA: Este enlace expirará en 5-15 minutos de inactividad');
      } else {
        console.log('✅ Envelope creado con clientUserId (permite generación on-demand)');
        console.log('📧 Tu sistema enviará correo con botón de firma');
        console.log('🔗 URL se generará cuando cliente haga clic (válida 5-15 min cada vez)');
        console.log('✨ Cliente puede hacer clic múltiples veces, siempre genera URL fresca');
        console.log('🚫 Correos automáticos de DocuSign SUPRIMIDOS');
      }

      return response;
    });
  }

  /**
   * Enviar PPI (Pre-Permit Inspection) para firma con 2 firmas
   * @param {string} pdfPath - Ruta o URL del PDF del PPI
   * @param {string} clientEmail - Email del cliente
   * @param {string} clientName - Nombre del cliente
   * @param {string} fileName - Nombre del archivo PDF
   * @param {string} subject - Asunto del email
   * @param {string} message - Mensaje del email
   * @param {boolean} getSigningUrl - Si generar URL inmediatamente (default false = Remote Signing)
   */
  async sendPPIForSignature(pdfPath, clientEmail, clientName, applicant, fileName, subject, message, getSigningUrl = false) {
    return await withAutoRefreshToken(async (accessToken) => {
      const normalizedEmail = clientEmail.toLowerCase();
      
      console.log('\n🚀 === ENVIANDO PPI A DOCUSIGN (2 FIRMAS) ===');
      console.log('📧 Cliente:', normalizedEmail, '-', clientName);
      console.log('👤 Applicant (para autocompletar):', applicant);
      console.log('📄 Archivo:', fileName);
      console.log('🔗 Tipo de firma:', getSigningUrl ? 'Embedded' : '✅ Remote (válido 365 días)');
      console.log('✍️  Firmas requeridas: 2 (Property Owner + Applicant)');

      this.apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);

      // Leer el PDF (local o remoto)
      let pdfBytes;
      if (pdfPath.startsWith('http://') || pdfPath.startsWith('https://')) {
        const axios = require('axios');
        const response = await axios.get(pdfPath, { responseType: 'arraybuffer' });
        pdfBytes = Buffer.from(response.data);
      } else {
        pdfBytes = fs.readFileSync(pdfPath);
      }

      const pdfBase64 = pdfBytes.toString('base64');

      // Crear el envelope con 2 firmas usando el nuevo método
      const envelopeDefinition = this.createPPIEnvelopeDefinition(
        pdfBase64,
        fileName,
        normalizedEmail,
        clientName,
        applicant, // 🆕 Pasar applicant para autocompletar
        subject,
        message
      );

      // Enviar el envelope
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      const results = await envelopesApi.createEnvelope(this.accountId, {
        envelopeDefinition: envelopeDefinition
      });

      console.log('✅ PPI enviado exitosamente a DocuSign');
      console.log('📋 Envelope ID:', results.envelopeId);
      console.log('📊 Status:', results.status);
      console.log('✍️  Cliente debe firmar en 2 lugares del documento');

      const response = {
        success: true,
        envelopeId: results.envelopeId,
        status: results.status,
        uri: results.uri,
        statusDateTime: results.statusDateTime
      };

      if (getSigningUrl) {
        console.log('🔗 Generando URL de firma embebida...');
        const signingUrl = await this.getRecipientViewUrl(
          results.envelopeId,
          normalizedEmail,
          clientName
        );
        response.signingUrl = signingUrl;
        console.log('✅ URL de firma embebida generada');
      } else {
        console.log('✅ Envelope PPI creado con clientUserId (generación on-demand)');
        console.log('📧 Tu sistema enviará correo personalizado con botón de firma');
        console.log('🔗 URL se generará cuando cliente haga clic');
        console.log('🚫 Correos automáticos de DocuSign SUPRIMIDOS');
      }

      return response;
    });
  }

  /**
   * Enviar múltiples documentos para firma (Invoice + PPI)
   * @param {Array} documents - Array de objetos {pdfPath, fileName}
   * @param {string} clientEmail - Email del cliente
   * @param {string} clientName - Nombre del cliente
   * @param {string} subject - Asunto del email
   * @param {string} message - Mensaje del email
   * @param {boolean} getSigningUrl - Si generar URL inmediatamente
   */
  async sendMultipleDocuments(documents, clientEmail, clientName, subject, message, getSigningUrl = false) {
    return await withAutoRefreshToken(async (accessToken) => {
      const normalizedEmail = clientEmail.toLowerCase();
      
      console.log('\n🚀 === ENVIANDO MÚLTIPLES DOCUMENTOS A DOCUSIGN ===');
      console.log('📧 Cliente:', normalizedEmail, '-', clientName);
      console.log(`📄 Total documentos: ${documents.length}`);
      documents.forEach((doc, idx) => console.log(`   ${idx + 1}. ${doc.fileName}`));
      console.log('🔗 Tipo de firma:', getSigningUrl ? 'Embedded' : '✅ Remote (válido 365 días)');

      this.apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);

      // Leer y convertir todos los PDFs a base64
      const docusignDocuments = [];
      for (let i = 0; i < documents.length; i++) {
        const { pdfPath, fileName } = documents[i];
        
        let pdfBytes;
        if (pdfPath.startsWith('http://') || pdfPath.startsWith('https://')) {
          const axios = require('axios');
          const response = await axios.get(pdfPath, { responseType: 'arraybuffer' });
          pdfBytes = Buffer.from(response.data);
        } else {
          pdfBytes = fs.readFileSync(pdfPath);
        }

        const pdfBase64 = pdfBytes.toString('base64');
        
        docusignDocuments.push(docusign.Document.constructFromObject({
          documentBase64: pdfBase64,
          name: fileName,
          fileExtension: 'pdf',
          documentId: String(i + 1)
        }));
        
        console.log(`✅ Documento ${i + 1} cargado: ${fileName}`);
      }

      // Crear envelope con múltiples documentos
      const envelopeDefinition = this.createMultiDocumentEnvelopeDefinition(
        docusignDocuments,
        normalizedEmail,
        clientName,
        subject,
        message,
        getSigningUrl
      );

      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      const results = await envelopesApi.createEnvelope(this.accountId, {
        envelopeDefinition: envelopeDefinition
      });

      console.log('✅ Documentos enviados exitosamente a DocuSign');
      console.log('📋 Envelope ID:', results.envelopeId);
      console.log('📊 Status:', results.status);

      const response = {
        success: true,
        envelopeId: results.envelopeId,
        status: results.status,
        uri: results.uri,
        statusDateTime: results.statusDateTime
      };

      if (getSigningUrl) {
        const signingUrl = await this.getRecipientViewUrl(
          results.envelopeId,
          normalizedEmail,
          clientName
        );
        response.signingUrl = signingUrl;
      } else {
        console.log('✅ Envelope con múltiples documentos creado con clientUserId');
        console.log('🚫 Correos automáticos de DocuSign SUPRIMIDOS');
      }

      return response;
    });
  }

  /**
   * Crear definición del envelope para múltiples documentos
   */
  createMultiDocumentEnvelopeDefinition(documents, clientEmail, clientName, subject, message, useEmbeddedSigning) {
    // Firmante
    const signer = docusign.Signer.constructFromObject({
      email: clientEmail,
      name: clientName,
      recipientId: '1',
      routingOrder: '1',
      clientUserId: clientEmail
    });

    // Crear tabs de firma para cada documento
    const signHereTabs = [];
    const dateSignedTabs = [];

    documents.forEach((doc, idx) => {
      const docId = doc.documentId;
      
      signHereTabs.push(docusign.SignHere.constructFromObject({
        documentId: docId,
        anchorString: 'Client Signature:',
        anchorUnits: 'pixels',
        anchorXOffset: '90',
        anchorYOffset: '-5',
        name: `SignHere_Doc${docId}`,
        optional: 'false',
        scaleValue: '1'
      }));

      dateSignedTabs.push(docusign.DateSigned.constructFromObject({
        documentId: docId,
        anchorString: 'Date:',
        anchorUnits: 'pixels',
        anchorXOffset: '35',
        anchorYOffset: '-5',
        name: `DateSigned_Doc${docId}`,
        optional: 'false',
        fontSize: 'size9'
      }));
    });

    signer.tabs = docusign.Tabs.constructFromObject({
      signHereTabs: signHereTabs,
      dateSignedTabs: dateSignedTabs
    });

    // Envelope definition
    const envelopeDefinition = docusign.EnvelopeDefinition.constructFromObject({
      emailSubject: subject || 'Please sign these documents',
      emailBlurb: message || 'Please review and sign the attached documents.',
      documents: documents,
      recipients: docusign.Recipients.constructFromObject({
        signers: [signer],
        carbonCopies: []
      }),
      notification: undefined,
      status: 'sent',
      enableWetSign: 'false',
      allowMarkup: 'false',
      allowReassign: 'false',
      emailSettings: {
        replyEmailAddressOverride: process.env.SMTP_FROM || 'noreply@zurcherseptic.com',
        replyEmailNameOverride: 'Zurcher Construction'
      },
      eventNotification: undefined
    });

    return envelopeDefinition;
  }

  /**
   * Crear definición del envelope para firma
   */
  createEnvelopeDefinition(pdfBase64, fileName, clientEmail, clientName, subject, message, useEmbeddedSigning) {
    useEmbeddedSigning = useEmbeddedSigning !== undefined ? useEmbeddedSigning : true;
    // Documento
    const document = docusign.Document.constructFromObject({
      documentBase64: pdfBase64,
      name: fileName,
      fileExtension: 'pdf',
      documentId: '1'
    });

    // Firmante
    // ✅ SIEMPRE usar clientUserId para poder generar URLs on-demand
    // Suprimir el correo de DocuSign, nuestro sistema envía el correo con botón
    const signer = docusign.Signer.constructFromObject({
      email: clientEmail,
      name: clientName,
      recipientId: '1',
      routingOrder: '1',
      clientUserId: clientEmail // ✅ Siempre usar para permitir generación on-demand
    });

    // Tab de firma (dónde firmar) - Usar Anchor Text para ubicación automática
    const signHereTab = docusign.SignHere.constructFromObject({
      documentId: '1',
      anchorString: 'Client Signature:', // Buscar este texto en el PDF
      anchorUnits: 'pixels',
      anchorXOffset: '90',     // ✅ Mover 90px a la derecha (después del texto y sobre la línea)
      anchorYOffset: '-5',     // ✅ Mantener arriba para alineación
      name: 'SignHere',
      optional: 'false',
      scaleValue: '1'
    });

    // Tab de fecha - Usar Anchor Text para ubicación automática
    const dateSignedTab = docusign.DateSigned.constructFromObject({
      documentId: '1',
      anchorString: 'Date:',  // Buscar "Date:" que está después de Client Signature
      anchorUnits: 'pixels',
      anchorXOffset: '35',     // ✅ Mover 35px a la derecha del texto "Date:"
      anchorYOffset: '-5',     // ✅ Mantener arriba para alineación
      name: 'DateSigned',
      optional: 'false',
      fontSize: 'size9'
    });

    // Asignar tabs al firmante
    signer.tabs = docusign.Tabs.constructFromObject({
      signHereTabs: [signHereTab],
      dateSignedTabs: [dateSignedTab]
    });

    // Configurar notificaciones de email
    // ✅ SOLUCIÓN: Aumentar expiración a 365 días (1 año) para que el cliente pueda firmar cuando quiera
    const notification = docusign.Notification.constructFromObject({
      useAccountDefaults: 'false',
      reminders: docusign.Reminders.constructFromObject({
        reminderEnabled: 'true',
        reminderDelay: '2',      // Recordatorio después de 2 días
        reminderFrequency: '3'    // Cada 3 días
      }),
      expirations: docusign.Expirations.constructFromObject({
        expireEnabled: 'true',
        expireAfter: '365',       // ✅ 365 días (1 año completo)
        expireWarn: '7'           // Advertir 7 días antes de expirar
      })
    });

    // Definición del envelope
    // ✅ SIEMPRE suprimir correos de DocuSign (enviamos nuestro propio correo con botón)
    const envelopeDefinition = docusign.EnvelopeDefinition.constructFromObject({
      emailSubject: subject || 'Please sign this document',
      emailBlurb: message || 'Please review and sign the attached document.',
      documents: [document],
      recipients: docusign.Recipients.constructFromObject({
        signers: [signer],
        // ✅ Configurar Carbon Copies vacío para evitar correos automáticos
        carbonCopies: []
      }),
      notification: undefined, // ✅ Suprimir todas las notificaciones
      status: 'sent',
      enableWetSign: 'false',
      allowMarkup: 'false',
      allowReassign: 'false',
      // ✅ Configuración para suprimir correos
      emailSettings: {
        replyEmailAddressOverride: process.env.SMTP_FROM || 'noreply@zurcherseptic.com',
        replyEmailNameOverride: 'Zurcher Construction'
      },
      // ✅ Configurar para NO enviar correos a los firmantes
      eventNotification: undefined
    });

    return envelopeDefinition;
  }

  /**
   * Crear definición del envelope para PPI (Pre-Permit Inspection) con 2 firmas
   */
  createPPIEnvelopeDefinition(pdfBase64, fileName, clientEmail, clientName, applicant, subject, message) {
    // Documento
    const document = docusign.Document.constructFromObject({
      documentBase64: pdfBase64,
      name: fileName,
      fileExtension: 'pdf',
      documentId: '1'
    });

    // Firmante - SIEMPRE usar clientUserId para generación on-demand
    const signer = docusign.Signer.constructFromObject({
      email: clientEmail,
      name: clientName,
      recipientId: '1',
      routingOrder: '1',
      clientUserId: clientEmail // Permite regenerar URL on-demand
    });

    // 🆕 FIRMA #1 - Primera ocurrencia (Página 1)
    const signHereTab1 = docusign.SignHere.constructFromObject({
      documentId: '1',
      anchorString: '(Property Owner Signature)', // Texto exacto del PDF
      anchorUnits: 'pixels',
      anchorXOffset: '0',    // Centrar en el campo
      anchorYOffset: '-25',  // Subir más arriba de la línea
      name: 'SignHere_Page1',
      optional: 'false',
      scaleValue: '0.8',
      tabLabel: 'Property Owner Signature - Page 1',
      anchorIgnoreIfNotPresent: 'false'
    });

    // 🆕 NOMBRE #1 - Primera ocurrencia (Página 1) - Autocompletar con applicant
    const textTab1 = docusign.Text.constructFromObject({
      documentId: '1',
      anchorString: '(Printed Property Owner Name)', // Texto exacto del PDF
      anchorUnits: 'pixels',
      anchorXOffset: '0',
      anchorYOffset: '-25',  // Subir más arriba de la línea
      name: 'PropertyOwnerName_Page1',
      value: applicant || clientName || '', // 🆕 Valor predefinido del applicant
      locked: 'true', // Bloqueado para que no se pueda editar
      required: 'true',
      fontSize: 'size9',
      tabLabel: 'Property Owner Name - Page 1',
      anchorIgnoreIfNotPresent: 'false'
    });

    // 🆕 FECHA #1 - Primera ocurrencia (Página 1)
    const dateSignedTab1 = docusign.DateSigned.constructFromObject({
      documentId: '1',
      anchorString: '(Property Owner Signature)', // Buscar desde la firma
      anchorUnits: 'pixels',
      anchorXOffset: '220',  // Mover a la derecha hacia el campo Date
      anchorYOffset: '-25',  // Misma altura que la firma
      name: 'DateSigned_Page1',
      optional: 'false',
      fontSize: 'size9',
      tabLabel: 'Date - Page 1',
      anchorIgnoreIfNotPresent: 'false'
    });

    // 🆕 FIRMA #2 - Segunda ocurrencia (Página 2)
    const signHereTab2 = docusign.SignHere.constructFromObject({
      documentId: '1',
      anchorString: '(Property Owner Signature)', // Mismo texto, segunda ocurrencia
      anchorUnits: 'pixels',
      anchorXOffset: '0',
      anchorYOffset: '-25',  // Subir más arriba de la línea
      name: 'SignHere_Page2',
      optional: 'false',
      scaleValue: '0.8',
      tabLabel: 'Property Owner Signature - Page 2',
      anchorIgnoreIfNotPresent: 'false'
    });

    // 🆕 NOMBRE #2 - Segunda ocurrencia (Página 2) - Autocompletar con applicant
    const textTab2 = docusign.Text.constructFromObject({
      documentId: '1',
      anchorString: '(Printed Property Owner Name)', // Mismo texto, segunda ocurrencia
      anchorUnits: 'pixels',
      anchorXOffset: '0',
      anchorYOffset: '-25',  // Subir más arriba de la línea
      name: 'PropertyOwnerName_Page2',
      value: applicant || clientName || '', // 🆕 Valor predefinido del applicant
      locked: 'true', // Bloqueado para que no se pueda editar
      required: 'true',
      fontSize: 'size9',
      tabLabel: 'Property Owner Name - Page 2',
      anchorIgnoreIfNotPresent: 'false'
    });

    // 🆕 FECHA #2 - Segunda ocurrencia (Página 2)
    const dateSignedTab2 = docusign.DateSigned.constructFromObject({
      documentId: '1',
      anchorString: '(Property Owner Signature)', // Buscar desde la firma
      anchorUnits: 'pixels',
      anchorXOffset: '220',  // Mover a la derecha hacia el campo Date
      anchorYOffset: '-25',  // Misma altura que la firma
      name: 'DateSigned_Page2',
      optional: 'false',
      fontSize: 'size9',
      tabLabel: 'Date - Page 2',
      anchorIgnoreIfNotPresent: 'false'
    });

    // Asignar todos los tabs al firmante (2 firmas + 2 nombres + 2 fechas)
    // DocuSign automáticamente encontrará ambas ocurrencias de cada anchor string
    signer.tabs = docusign.Tabs.constructFromObject({
      signHereTabs: [signHereTab1, signHereTab2],
      textTabs: [textTab1, textTab2],  // 🆕 Cambio de fullNameTabs a textTabs con valores predefinidos
      dateSignedTabs: [dateSignedTab1, dateSignedTab2]
    });

    // Definición del envelope
    const envelopeDefinition = docusign.EnvelopeDefinition.constructFromObject({
      emailSubject: subject || 'Please sign the Pre-Permit Inspection (PPI)',
      emailBlurb: message || 'Please review and sign the Pre-Permit Inspection document in two places.',
      documents: [document],
      recipients: docusign.Recipients.constructFromObject({
        signers: [signer],
        carbonCopies: []
      }),
      notification: undefined,
      status: 'sent',
      enableWetSign: 'false',
      allowMarkup: 'false',
      allowReassign: 'false',
      emailSettings: {
        replyEmailAddressOverride: process.env.SMTP_FROM || 'noreply@zurcherseptic.com',
        replyEmailNameOverride: 'Zurcher Construction'
      },
      eventNotification: undefined
    });

    return envelopeDefinition;
  }

  /**
   * Obtener URL de firma embebida para el cliente
   * @param {string} envelopeId - ID del envelope
   * @param {string} email - Email del firmante
   * @param {string} name - Nombre del firmante
   * @param {string} returnUrl - URL de retorno después de firmar
   */
  async getRecipientViewUrl(envelopeId, email, name, returnUrl = null) {
    try {
      console.log(`🔗 Generando URL de firma para envelope: ${envelopeId}`);
      
      await this.getAccessToken();

      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      
      // URL de retorno por defecto - redirige a la landing principal
      const defaultReturnUrl = process.env.FRONTEND_URL || 'https://zurcher-construction.vercel.app';
      
      const recipientViewRequest = docusign.RecipientViewRequest.constructFromObject({
        returnUrl: returnUrl || defaultReturnUrl, // Redirige a la landing (/) directamente
        authenticationMethod: 'email',
        email: email.toLowerCase(),
        userName: name,
        clientUserId: email.toLowerCase() // Debe coincidir con el usado en createEnvelopeDefinition
      });

      const results = await envelopesApi.createRecipientView(
        this.accountId,
        envelopeId,
        { recipientViewRequest }
      );

      console.log(`✅ URL de firma generada exitosamente`);
      
      return results.url;

    } catch (error) {
      console.error('❌ Error generando URL de firma:', error.message);
      if (error.response) {
        console.error('Response:', JSON.stringify(error.response.body, null, 2));
      }
      throw error;
    }
  }

  /**
   * Obtener estado de un envelope (usado por SignatureVerificationController)
   * @param {string} envelopeId - ID del envelope de DocuSign
   */
  async getEnvelopeStatus(envelopeId) {
    try {
      console.log(`🔍 [DocuSign] Verificando estado del envelope: ${envelopeId}`);
      
      await this.getAccessToken();

      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      const envelope = await envelopesApi.getEnvelope(this.accountId, envelopeId);

      console.log(`📊 [DocuSign] Estado del envelope: ${envelope.status}`);

      return {
        status: envelope.status, // 'sent', 'delivered', 'completed', 'declined', 'voided'
        statusDateTime: envelope.statusDateTime,
        completedDateTime: envelope.completedDateTime,
        sentDateTime: envelope.sentDateTime,
        deliveredDateTime: envelope.deliveredDateTime
      };

    } catch (error) {
      console.error('❌ [DocuSign] Error obteniendo estado del envelope:', error.message);
      throw error;
    }
  }

  /**
   * Verificar si un documento está firmado (método legacy - usa getEnvelopeStatus)
   * @param {string} envelopeId - ID del envelope de DocuSign
   */
  async isDocumentSigned(envelopeId) {
    const status = await this.getEnvelopeStatus(envelopeId);
    
    const isSigned = status.status === 'completed';

    return {
      signed: isSigned,
      status: status.status,
      statusDateTime: status.statusDateTime,
      completedDateTime: status.completedDateTime
    };
  }

  /**
   * Descargar documento firmado
   * @param {string} envelopeId - ID del envelope
   * @param {string} savePath - Ruta donde guardar el PDF firmado
   */
  async downloadSignedDocument(envelopeId, savePath) {
    try {
      console.log(`📥 Descargando documento firmado: ${envelopeId}`);
      
      await this.getAccessToken();

      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      
      // Descargar el documento combinado (todos los documentos en un PDF)
      const results = await envelopesApi.getDocument(
        this.accountId, 
        envelopeId, 
        'combined' // 'combined' o el documentId específico
      );

      // results es un Buffer
      fs.writeFileSync(savePath, results);

      console.log(`✅ Documento firmado guardado en: ${savePath}`);
      return savePath;

    } catch (error) {
      console.error('❌ Error descargando documento firmado:', error.message);
      throw error;
    }
  }

  /**
   * Obtener información detallada de un envelope
   */
  async getEnvelopeDetails(envelopeId) {
    try {
      await this.getAccessToken();

      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      const envelope = await envelopesApi.getEnvelope(this.accountId, envelopeId);

      // Obtener información de los recipients
      const recipients = await envelopesApi.listRecipients(this.accountId, envelopeId);

      return {
        envelopeId: envelope.envelopeId,
        status: envelope.status,
        emailSubject: envelope.emailSubject,
        sentDateTime: envelope.sentDateTime,
        deliveredDateTime: envelope.deliveredDateTime,
        completedDateTime: envelope.completedDateTime,
        recipients: recipients
      };

    } catch (error) {
      console.error('❌ Error obteniendo detalles del envelope:', error.message);
      throw error;
    }
  }

  /**
   * Cancelar/void un envelope (antes de que se complete)
   */
  async voidEnvelope(envelopeId, reason = 'Cancelled by sender') {
    try {
      console.log(`🚫 Cancelando envelope: ${envelopeId}`);
      
      await this.getAccessToken();

      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      
      const voidedEnvelope = await envelopesApi.update(this.accountId, envelopeId, {
        envelope: {
          status: 'voided',
          voidedReason: reason
        }
      });

      console.log(`✅ Envelope cancelado exitosamente`);
      return voidedEnvelope;

    } catch (error) {
      console.error('❌ Error cancelando envelope:', error.message);
      throw error;
    }
  }

  /**
   * Reenviar notificación de firma
   */
  async resendEnvelope(envelopeId) {
    try {
      console.log(`📧 Reenviando notificación para envelope: ${envelopeId}`);
      
      await this.getAccessToken();

      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      
      await envelopesApi.update(this.accountId, envelopeId, {
        resendEnvelope: 'true'
      });

      console.log(`✅ Notificación reenviada exitosamente`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error reenviando notificación:', error.message);
      throw error;
    }
  }

  /**
   * ✅ NUEVA FUNCIONALIDAD: Regenerar enlace de firma cuando expire el token de sesión
   * Este método genera un nuevo enlace de firma para el cliente sin necesidad de reenviar el envelope
   * @param {string} envelopeId - ID del envelope
   * @param {string} clientEmail - Email del cliente que firmará
   * @param {string} clientName - Nombre del cliente
   * @param {string} returnUrl - URL de retorno opcional
   */
  async regenerateSigningLink(envelopeId, clientEmail, clientName, returnUrl = null) {
    return await withAutoRefreshToken(async (accessToken) => {
      try {
        console.log('\n🔄 === REGENERANDO ENLACE DE FIRMA ===');
        console.log('📋 Envelope ID:', envelopeId);
        console.log('📧 Cliente:', clientEmail, '-', clientName);
        
        this.apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);

        // Primero verificar el estado del envelope
        const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
        const envelope = await envelopesApi.getEnvelope(this.accountId, envelopeId);

        console.log('📊 Estado del envelope:', envelope.status);

        // Solo permitir regenerar si está en estado 'sent' o 'delivered'
        if (!['sent', 'delivered'].includes(envelope.status)) {
          throw new Error(`No se puede regenerar enlace. Estado actual: ${envelope.status}`);
        }

        // ✅ VERIFICAR SI EL ENVELOPE TIENE clientUserId (firma embebida)
        console.log('🔍 Verificando si el envelope usa firma embebida...');
        const recipients = await envelopesApi.listRecipients(this.accountId, envelopeId);
        
        const signer = recipients.signers?.find(s => 
          s.email.toLowerCase() === clientEmail.toLowerCase()
        );

        if (!signer) {
          throw new Error(`No se encontró el firmante ${clientEmail} en el envelope`);
        }

        console.log(`👤 Firmante encontrado: ${signer.name} (${signer.email})`);
        console.log(`🔑 ClientUserId: ${signer.clientUserId || 'NO CONFIGURADO'}`);

        // Si no tiene clientUserId, fue enviado por email tradicional
        if (!signer.clientUserId) {
          console.log('⚠️ Este envelope fue enviado por EMAIL TRADICIONAL (sin firma embebida)');
          console.log('📧 El enlace en el correo original de DocuSign NO EXPIRA');
          
          throw new Error(
            'Este documento fue enviado por email tradicional de DocuSign. ' +
            'El enlace en el correo original es permanente y no expira. ' +
            'Por favor, use el enlace del email enviado por DocuSign (revise la bandeja de entrada o spam). ' +
            'Los documentos enviados recientemente ya usan enlaces que sí se pueden regenerar.'
          );
        }

        console.log('✅ Envelope usa firma embebida - generando nuevo enlace...');

        // Generar nuevo enlace de firma
        const signingUrl = await this.getRecipientViewUrl(
          envelopeId,
          clientEmail.toLowerCase(),
          clientName,
          returnUrl
        );

        console.log('✅ Enlace de firma regenerado exitosamente');
        console.log('🔗 Nuevo enlace válido por 5-15 minutos desde que se accede');
        
        return {
          success: true,
          envelopeId: envelopeId,
          status: envelope.status,
          signingUrl: signingUrl,
          expiresIn: '5-15 minutes from first access',
          regeneratedAt: new Date().toISOString()
        };

      } catch (error) {
        console.error('❌ Error regenerando enlace de firma:', error.message);
        if (error.response) {
          console.error('Response:', JSON.stringify(error.response.body, null, 2));
        }
        throw error;
      }
    });
  }

  /**
   * Validar webhook signature (si se configuró DOCUSIGN_WEBHOOK_SECRET)
   */
  validateWebhookSignature(payload, signature) {
    const crypto = require('crypto');
    const secret = process.env.DOCUSIGN_WEBHOOK_SECRET;
    
    if (!secret) {
      console.warn('⚠️ DOCUSIGN_WEBHOOK_SECRET no configurado, no se puede validar signature');
      return true; // Permitir si no está configurado
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const calculatedSignature = hmac.digest('base64');

    return calculatedSignature === signature;
  }
}

module.exports = DocuSignService;
