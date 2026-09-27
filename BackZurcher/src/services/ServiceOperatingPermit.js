/**
 * ServiceOperatingPermit
 * Genera el formulario DEP 4081 usando el template oficial como fondo
 * y superponiendo los datos del cliente con coordenadas calibradas.
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs   = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '../assets/operating_permit_template.pdf');
const FIRMA_EMPRESA_PATH = path.join(__dirname, '../assets/firma_empresa.png');

// Datos fijos de la empresa (actúa como agente del propietario y entidad de mantenimiento)
const COMPANY = {
  name:       'ZURCHER CONSTRUCTION LLC',
  address:    '450 Rathburn Ave',
  city:       'Lehigh Acres',
  state:      'FL',
  zip:        '33972',
  phone:      '689 276 3356',
  email:      'admin@zurcherseptic.com',
  signerName: 'Damian Zurcher',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function addMonths(dateStr, n) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().split('T')[0];
}

class ServiceOperatingPermit {

  async generate(workData) {
    const {
      propertyAddress    = '',
      propertyCity       = '',
      propertyZip        = '',
      ownerName          = '',
      ownerPhone         = '',
      ownerEmail         = '',
      ownerAddress       = '',
      ownerCity          = '',
      ownerZip           = '',
      section            = '',
      township           = '',
      range              = '',
      parcelNo           = '',
      lot                = '',
      block              = '',
      subdivision        = '',
      applicationNumber  = '',
      systemManufacturer = 'Gorman (Delta)',
      systemModel        = '',
      septicTankGallons  = '',
      drainfieldSqFt     = '',
      installationDate   = '',
      drainfieldType     = 'standard_subsurface',
      drainfieldConfig   = 'trenches',
      onsiteWell         = 'no',
      monitoringRequired = 'no',
      additionalComments = '',
      permitRequest      = 'new',
      permitType         = 'aerobic',
    } = workData;

    // Normaliza valores yes/no (soporta strings con mayúsculas/espacios o booleanos)
    const isYes = (v) => String(v).trim().toLowerCase() === 'yes' || v === true;

    const bytes  = fs.readFileSync(TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page   = pdfDoc.getPages()[0];
    const form   = pdfDoc.getForm();

    const BLACK = rgb(0, 0, 0);
    const sz    = 8.5;

    const draw = (text, x, y) => {
      if (text === null || text === undefined || text === '') return;
      page.drawText(String(text), { x, y, size: sz, font, color: BLACK });
    };

    // El template es un AcroForm real: los checkboxes son widgets con su propia
    // apariencia (caja vacía) que se dibuja ENCIMA del contenido de la página,
    // por lo que dibujar una "X" manual queda tapada. Hay que marcar/desmarcar
    // el checkbox real del formulario para que se vea correctamente.
    const check = (name, on) => {
      try {
        const cb = form.getCheckBox(name);
        if (on) cb.check(); else cb.uncheck();
      } catch (e) {
        console.warn(`⚠️ Checkbox "${name}" no encontrado en el template de Operating Permit:`, e.message);
      }
    };

    // ── HEADER ─────────────────────────────────────────────────────────
    draw(applicationNumber,             520, 707);

    // ── OPERATING PERMIT REQUEST (New / Renew / Amend) ─────────────────
    check('Check Box1', permitRequest === 'new');
    check('Check Box2', permitRequest === 'renew');
    check('Check Box3', permitRequest === 'amend');

    // ── OPERATING PERMIT TYPE ───────────────────────────────────────────
    check('Check Box4', permitType === 'aerobic');
    check('Check Box5', permitType === 'commercial');
    check('Check Box6', permitType === 'industrial');

    // ── GENERAL INFORMATION ────────────────────────────────────────────
    // Fila 1: Property Address / City / Zip
    draw(propertyAddress,               100, 616);
    draw(propertyCity,                  315, 613);
    draw(propertyZip,                   556, 616);

    // Fila 2: Section / Township / Range / Parcel / Lot / Block / Subdivision / Unit
    draw(section,                        53, 601);
    draw(township,                      125, 601);
    draw(range,                         186, 601);
    draw(parcelNo,                      240, 601);
    draw(lot,                           365, 601);
    draw(block,                         406, 601);
    draw(subdivision,                   487, 601);

    // Fila 3: Property Owner / Phone / Email
    draw(ownerName,                      95, 586);
    draw(ownerPhone,                    320, 586);
    draw(ownerEmail,                    445, 586);

    // Fila 4: Address of Owner / City / Zip (editable, fallback a propertyAddress)
    draw(ownerAddress || propertyAddress, 102, 574);
    draw(ownerCity    || propertyCity,    350, 574);
    draw(ownerZip     || propertyZip,     556, 574);

    // Filas 5-6: Owner's Agent + Agent's Address (Zurcher actúa como agente del propietario)
    draw(COMPANY.name,                  100, 559);
    draw(COMPANY.phone,                 320, 559);
    draw(COMPANY.email,                 445, 559);
    draw(COMPANY.address,               115, 546);
    draw(COMPANY.city,                  350, 546);
    draw(COMPANY.state,                 467, 546);
    draw(COMPANY.zip,                   556, 546);

    // ── SYSTEM INFORMATION ─────────────────────────────────────────────
    // Fila 1: OSTDS Permit Number / Date of installation approval
    draw(applicationNumber,             265, 497);
    draw(formatDate(installationDate),  515, 497);

    // Fila 2: ATU model / gallons
    draw(systemManufacturer,            190, 485);
    draw(septicTankGallons,             533, 485);

    // Fila 3: Drainfield sq ft + checkbox tipo drainfield
    draw(drainfieldSqFt,                105, 471);
    check('Check Box10', drainfieldType === 'standard_subsurface');
    check('Check Box11', drainfieldType === 'filled');
    check('Check Box12', drainfieldType === 'mound');

    // Fila 4: Drainfield config
    check('Check Box7', drainfieldConfig === 'trenches');
    check('Check Box8', drainfieldConfig === 'bed');
    check('Check Box9', drainfieldConfig === 'other');

    // Fila 5: Onsite Well (siempre marca una de las dos opciones)
    check('Check Box13', isYes(onsiteWell));
    check('Check Box14', !isYes(onsiteWell));

    // Fila 6: Estimated sewage — vacío (no hay dato en el modelo)

    // Fila 7: Number of — residential (siempre 1 unidad, no hay dato de "businesses")
    check('Check Box23', false);   // businesses
    check('Check Box24', true);    // residential
    draw('1',                           445, 405);

    // Fila 8: Additional Comments
    if (additionalComments) draw(additionalComments, 115, 392);

    // ── ATU / PBTS ─────────────────────────────────────────────────────
    // Fila 1: Manufacturer / Model
    draw(systemManufacturer,            190, 348);
    draw(systemModel,                   460, 348);

    // Fila 2: Monitoring required (izquierda) — seleccionable
    check('Check Box15', isYes(monitoringRequired));
    check('Check Box16', !isYes(monitoringRequired));

    // Fila 2: Multiple ATU — siempre No
    check('Check Box17', false);
    check('Check Box18', true);

    // Fila 3: Service Agreement — siempre Yes (Zurcher mantiene contrato activo)
    check('Check Box20', true);
    check('Check Box19', false);

    // Fila 4: Service Agreement Expiration Date (installationDate + 24 meses)
    draw(formatDate(addMonths(installationDate, 24)), 205, 306);

    // Filas 5-6: Maintenance Entity + Address (Zurcher es la entidad de mantenimiento)
    draw(COMPANY.name,                  137, 293);
    draw(COMPANY.phone,                 320, 293);
    draw(COMPANY.email,                 450, 293);
    draw(COMPANY.address,               150, 280);
    draw(COMPANY.city,                  310, 280);
    draw(COMPANY.state,                 475, 280);
    draw(COMPANY.zip,                   540, 280);

    // ── FIRMA ──────────────────────────────────────────────────────────
    // Nombre y firma de Damian Zurcher
    const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    draw(COMPANY.signerName, 150, 152);
    draw(today, 541, 152);

    if (fs.existsSync(FIRMA_EMPRESA_PATH)) {
      try {
        const firmaBytes = fs.readFileSync(FIRMA_EMPRESA_PATH);
        const firmaImg   = await pdfDoc.embedPng(firmaBytes);
        const firmaH     = 20;
        const firmaW     = firmaImg.width * (firmaH / firmaImg.height);
        page.drawImage(firmaImg, { x: 378, y: 146, width: firmaW, height: firmaH });
      } catch (e) {
        console.warn('⚠️ No se pudo embeber firma_empresa.png en Operating Permit:', e.message);
      }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}

module.exports = new ServiceOperatingPermit();
