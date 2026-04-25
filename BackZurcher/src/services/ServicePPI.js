/**
 * ServicePPI - Servicio para gestionar documentos PPI (Pre-Permit Inspection)
 * 
 * Funcionalidades:
 * - Llenar campos de PDFs con formularios
 * - Generar PPIs personalizados por cliente
 * - Soporta dos tipos de inspectores (Type A y Type B)
 */

const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

class ServicePPI {
  constructor() {
    // Rutas a los templates
    this.templatesDir = path.join(__dirname, '../templates/ppi');
    this.outputDir = path.join(__dirname, '../uploads/ppi');
    
    this.templates = {
      'type-a': path.join(this.templatesDir, 'ppi-type-a.pdf'),
      'type-b': path.join(this.templatesDir, 'ppi-type-b.pdf')
    };
  }

  /**
   * Genera un PPI personalizado llenando los campos del PDF
   * @param {Object} permitData - Datos del permit
   * @param {Object} clientData - Datos del cliente
   * @param {string} inspectorType - 'type-a' o 'type-b'
   * @returns {Promise<string>} - Ruta al PDF generado
   */
  async generatePPI(permitData, clientData, inspectorType = 'type-a') {
    try {
      console.log(`📄 Generando PPI ${inspectorType.toUpperCase()}:`, permitData.permitNumber);
      
      // Validar tipo de inspector
      if (!['type-a', 'type-b'].includes(inspectorType)) {
        throw new Error(`Tipo de inspector inválido: ${inspectorType}`);
      }

      // Leer el template
      const templatePath = this.templates[inspectorType];
      console.log(`📂 Leyendo template: ${templatePath}`);
      
      const templateBytes = await fs.readFile(templatePath);
      const pdfDoc = await PDFDocument.load(templateBytes);
      const form = pdfDoc.getForm();

      // Llenar campos comunes
      this._fillCommonFields(form, permitData, clientData);

      // Llenar campos específicos según tipo
      if (inspectorType === 'type-a') {
        this._fillTypeASpecificFields(form, permitData);
      } else {
        this._fillTypeBSpecificFields(form, permitData);
      }

      // Generar nombre de archivo único
      const timestamp = Date.now();
      const fileName = `PPI_${inspectorType}_Permit_${permitData.idPermit || permitData.id}_${timestamp}.pdf`;
      
      // Asegurar que existe el directorio de salida
      await fs.mkdir(this.outputDir, { recursive: true });
      
      const outputPath = path.join(this.outputDir, fileName);

      // Guardar el PDF
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);

      console.log(`✅ PPI generado exitosamente: ${outputPath}`);
      
      return outputPath;

    } catch (error) {
      console.error('❌ Error generando PPI:', error);
      throw new Error(`Error al generar PPI: ${error.message}`);
    }
  }

  /**
   * 🆕 FUNCIÓN AUXILIAR: Separar dirección completa en componentes
   * Convierte "2607 49th St Lehigh Acres, FL 33971" en partes separadas
   * @static - Puede ser llamada sin instancia
   */
  static _parseAddress(fullAddress) {
    if (!fullAddress) {
      return {
        streetAddress: '',
        city: '',
        state: '',
        zipCode: ''
      };
    }

    try {
      // Dividir por coma
      const parts = fullAddress.split(',');

      // CASO 1: "Street, City, State ZIP" (2+ comas)
      // Ejemplo: "123 Main St, Sebring, FL 33870"
      if (parts.length >= 3) {
        const streetAddress = parts[0].trim();
        const city = parts[1].trim();
        const stateZipPart = parts[parts.length - 1].trim();
        const stateZipMatch = stateZipPart.match(/([A-Z]{2})\s*(\d{5}(-\d{4})?)/);
        const state = stateZipMatch ? stateZipMatch[1] : '';
        const zipCode = stateZipMatch ? stateZipMatch[2] : '';
        return { streetAddress, city, state, zipCode };
      }

      // CASO 2: "Street City, State ZIP" (1 coma)
      // Ejemplo: "2607 49th St Lehigh Acres, FL 33971"
      if (parts.length === 2) {
        const beforeComma = parts[0].trim();
        const afterComma = parts[1].trim();

        const stateZipMatch = afterComma.match(/([A-Z]{2})\s*(\d{5}(-\d{4})?)/);
        const state = stateZipMatch ? stateZipMatch[1] : '';
        const zipCode = stateZipMatch ? stateZipMatch[2] : '';

        const words = beforeComma.split(' ');

        let streetAddress = beforeComma;
        let city = '';

        if (words.length >= 4) {
          // Las últimas 2 palabras son la ciudad (ej: "Lehigh Acres", "Cape Coral")
          city = words.slice(-2).join(' ');
          streetAddress = words.slice(0, -2).join(' ');
        } else if (words.length === 3) {
          // 3 palabras: la última es la ciudad (ej: "123 Main Sebring")
          city = words[words.length - 1];
          streetAddress = words.slice(0, -1).join(' ');
        }

        return { streetAddress, city, state, zipCode };
      }

      // CASO 3: Sin comas — no se puede parsear
      return {
        streetAddress: fullAddress,
        city: '',
        state: '',
        zipCode: ''
      };

    } catch (error) {
      console.error('❌ Error parseando dirección:', error);
      return {
        streetAddress: fullAddress,
        city: '',
        state: '',
        zipCode: ''
      };
    }
  }

  /**
   * Llena campos comunes a ambos tipos de PPI
   * @private
   */
  _fillCommonFields(form, permitData, clientData) {
    // Llenando campos comunes del PPI (log removido para producción)
    
    // 🔍 DEBUG: Ver qué datos llegan
    // Datos recibidos en _fillCommonFields (logs removidos para producción)
    console.log('permitData.propertyAddress:', permitData.propertyAddress);
    console.log('permitData.city:', permitData.city);
    console.log('permitData.state:', permitData.state);
    console.log('permitData.zipCode:', permitData.zipCode);
    console.log('permitData.unit:', permitData.unit);
    console.log('permitData.section:', permitData.section);
    console.log('permitData.township:', permitData.township);
    console.log('permitData.range:', permitData.range);
    console.log('permitData.parcelNo:', permitData.parcelNo);
    console.log('permitData.applicationNo:', permitData.applicationNo);
    console.log('permitData.ppiAuthorizationType:', permitData.ppiAuthorizationType);
    // Fin datos recibidos (log removido para producción)
    
    // 🆕 PRIORIDAD: Usar campos editados manualmente (ppiStreetAddress) si existen
    let addressParts = {
      streetAddress: permitData.ppiStreetAddress || permitData.propertyAddress || '',
      city: permitData.city || '',
      state: permitData.state || 'FL',
      zipCode: permitData.zipCode || ''
    };
    
    // Si NO hay ppiStreetAddress Y faltan city/zipCode, parsear desde propertyAddress
    if (!permitData.ppiStreetAddress && (!permitData.city || !permitData.zipCode)) {
      console.log('⚠️  City o ZipCode faltantes y sin edición manual, parseando desde propertyAddress...');
      const parsed = ServicePPI._parseAddress(permitData.propertyAddress);
      
      // Solo usar los datos parseados si no existen en permitData
      addressParts = {
        streetAddress: parsed.streetAddress || permitData.propertyAddress || '',
        city: permitData.city || parsed.city,
        state: permitData.state || parsed.state || 'FL',
        zipCode: permitData.zipCode || parsed.zipCode
      };
    } else if (permitData.ppiStreetAddress) {
      // Usando dirección editada manualmente para PPI (log removido)
    }
    
    // 🔍 DEBUG: Ver qué valores se usarán en el PPI
    // Datos de dirección para PPI (logs removidos para producción)
    console.log('  🏠 Property Address (completa):', permitData.propertyAddress);
    console.log('  📍 ppiStreetAddress (campo editable):', permitData.ppiStreetAddress);
    console.log('  🏙️ City:', permitData.city);
    // Datos de dirección y campos PDF (logs removidos para producción)

    const fieldMappings = {
      // Part 1 - Applicant Information
      'Property Owner Name': clientData.name || permitData.applicantName || '',
      'Property Owner Email': permitData.ppiPropertyOwnerEmail || 'admin@zurcherseptic.com',
      'Property Owner Phone': permitData.ppiPropertyOwnerPhone || '+1 (407) 419-4495', // 🆕 Teléfono por defecto
      
      // Authorized Contractor N/A (cliente firma, no hay contratista autorizado)
      'Authorized Contractor if applicable': 'N/A',
      'Authorized Contractor': 'N/A',
      'Authorized Contractor Email': 'N/A',
      'Authorized Contractor Phone': 'N/A',
      
      // Part 2 - Property Information (🆕 USAR DATOS PARSEADOS)
      'Property Address': addressParts.streetAddress, // ✅ Solo calle y número
      'City': addressParts.city, // ✅ Ciudad separada
      'State': addressParts.state, // ✅ Estado separado
      'Zip Code': addressParts.zipCode, // ✅ Código postal separado
      
      // Datos del lote/parcela
      'Lot': permitData.lot || '',
      'Block': permitData.block || '',
      'Subdivision': permitData.subdivision || 'N/A',
      'Unit': permitData.unit || '',
      'Section': permitData.section || '',
      'Township': permitData.township || '',
      'Range': permitData.range || '',
      'Parcel No': permitData.parcelNo || '',
      'Parcel No.': permitData.parcelNo || '',
      
      // Application Number (editable desde Part 2)
      'Application No if known': permitData.applicationNo || '',
      'Application No': permitData.applicationNo || '',
      'Application No.': permitData.applicationNo || '',
      
      // Nombre impreso (duplicado para Part 5)
      'Printed Property Owner Name': clientData.name || permitData.applicantName || '',
      'Printed Property Owner Name_2': clientData.name || permitData.applicantName || ''
    };

    // Llenar cada campo que exista en el formulario
    Object.entries(fieldMappings).forEach(([fieldName, value]) => {
      try {
        const field = form.getTextField(fieldName);
        if (field) {
          field.setText(String(value || ''));
          if (value) {
            console.log(`  ✓ ${fieldName}: ${value}`);
          }
        }
      } catch (error) {
        // El campo no existe en este template, continuar sin mensaje
      }
    });
  }

  /**
   * Llena campos específicos del PPI Type A
   * @private
   */
  _fillTypeASpecificFields(form, permitData) {
    // Llenando campos Type A (log removido para producción)
    
    try {
      // Part 3 - Marcar checkbox según ppiAuthorizationType
      const authType = permitData.ppiAuthorizationType || 'initial';
      
      // Desmarcar TODOS los checkboxes primero
      try { form.getCheckBox('Check Box 1').uncheck(); } catch (e) {}
      try { form.getCheckBox('Check Box 2').uncheck(); } catch (e) {}
      try { form.getCheckBox('Check Box 3').uncheck(); } catch (e) {}
      
      // Marcar solo el correcto
      if (authType === 'initial') {
        const checkbox1 = form.getCheckBox('Check Box 1');
        checkbox1.check();
        console.log('  ✓ Check Box 1 marcado (Initial authorization)');
      } else if (authType === 'rescind') {
        const checkbox2 = form.getCheckBox('Check Box 2');
        checkbox2.check();
        console.log('  ✓ Check Box 2 marcado (Rescind authorization)');
      } else if (authType === 'amend') {
        const checkbox3 = form.getCheckBox('Check Box 3');
        checkbox3.check();
        console.log('  ✓ Check Box 3 marcado (Amend authorization)');
      }
    } catch (error) {
      console.log('  ⚠ Error marcando checkbox Part 3:', error.message);
    }
  }

  /**
   * Llena campos específicos del PPI Type B
   * @private
   */
  _fillTypeBSpecificFields(form, permitData) {
    // Llenando campos Type B (log removido para producción)
    
    try {
      // Part 3 - Marcar checkbox según ppiAuthorizationType  
      const authType = permitData.ppiAuthorizationType || 'initial';
      
      // Desmarcar TODOS los checkboxes primero
      try { form.getCheckBox('Check Box 1').uncheck(); } catch (e) {}
      try { form.getCheckBox('Check Box 2').uncheck(); } catch (e) {}
      try { form.getCheckBox('Check Box 3').uncheck(); } catch (e) {}
      
      // Marcar solo el correcto
      if (authType === 'initial') {
        const checkbox1 = form.getCheckBox('Check Box 1');
        checkbox1.check();
        console.log('  ✓ Check Box 1 marcado (Initial authorization)');
      } else if (authType === 'rescind') {
        const checkbox2 = form.getCheckBox('Check Box 2');
        checkbox2.check();
        console.log('  ✓ Check Box 2 marcado (Rescind authorization)');
      } else if (authType === 'amend') {
        const checkbox3 = form.getCheckBox('Check Box 3');
        checkbox3.check();
        console.log('  ✓ Check Box 3 marcado (Amend authorization)');
      }
      
      // Part 4 - Checkboxes de cualificación (Check Box 4 y 8 siempre se marcan)
      try {
        const checkbox4 = form.getCheckBox('Check Box 4');
        checkbox4.check();
        console.log('  ✓ Check Box 4 marcado (Qualification type)');
      } catch (err) {
        console.log('  ⚠ Check Box 4 no encontrado');
      }
      
      try {
        const checkbox8 = form.getCheckBox('Check Box 8');
        checkbox8.check();
        console.log('  ✓ Check Box 8 marcado (Qualification type)');
      } catch (err) {
        console.log('  ⚠ Check Box 8 no encontrado');
      }
      
    } catch (error) {
      console.log('  ⚠ Error marcando checkboxes Type B:', error.message);
    }
  }

  /**
   * Obtiene la ruta del template según el tipo de inspector
   * @param {string} inspectorType - 'type-a' o 'type-b'
   * @returns {string} - Ruta al template
   */
  getTemplatePath(inspectorType) {
    return this.templates[inspectorType] || null;
  }

  /**
   * Valida si un tipo de inspector es válido
   * @param {string} inspectorType
   * @returns {boolean}
   */
  isValidInspectorType(inspectorType) {
    return ['type-a', 'type-b'].includes(inspectorType);
  }

  /**
   * Obtiene el nombre descriptivo del tipo de inspector
   * @param {string} inspectorType
   * @returns {string}
   */
  getInspectorTypeName(inspectorType) {
    const names = {
      'type-a': 'Health Department',
      'type-b': 'County Inspector (ACK Environmental)'
    };
    return names[inspectorType] || 'Unknown';
  }
}

// Exportar tanto la instancia (default) como la clase (para métodos estáticos)
const servicePPIInstance = new ServicePPI();
servicePPIInstance.ServicePPI = ServicePPI; // Adjuntar la clase
module.exports = servicePPIInstance;
