/**
 * ServiceOperatingPermit
 * Genera el formulario DEP 4081 usando el template oficial como fondo
 * y superponiendo los datos del cliente con coordenadas calibradas.
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs   = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '../assets/operating_permit_template.pdf');

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
      additionalComments = '',
      permitRequest      = 'new',
      permitType         = 'aerobic',
    } = workData;

    const bytes  = fs.readFileSync(TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page   = pdfDoc.getPages()[0];

    const BLACK = rgb(0, 0, 0);
    const WHITE = rgb(1, 1, 1);
    const sz    = 8.5;

    const draw = (text, x, y) => {
      if (text === null || text === undefined || text === '') return;
      page.drawText(String(text), { x, y, size: sz, font, color: BLACK });
    };

    const zapf = await pdfDoc.embedFont(StandardFonts.ZapfDingbats);
    const tick  = (x, y) => page.drawText('✓', { x, y, size: 9, font: zapf, color: BLACK });
    const cover = (x, y, w, h) => page.drawRectangle({ x, y, width: w, height: h, color: WHITE });

    // ── HEADER ─────────────────────────────────────────────────────────
    draw(applicationNumber,             520, 707);

    // ── OPERATING PERMIT REQUEST (New / Renew / Amend) ─────────────────
    // Tapar marca pre-impresa de "New" si no es la opción seleccionada
    if (permitRequest !== 'new') cover(148, 677, 8, 14);
    if (permitRequest === 'new')   tick(150, 679);
    if (permitRequest === 'renew') tick(220, 679);
    if (permitRequest === 'amend') tick(308, 679);

    // ── OPERATING PERMIT TYPE ───────────────────────────────────────────
    // Tapar marca pre-impresa de "ATU" si no es la opción seleccionada
    if (permitType !== 'aerobic') cover(146, 658, 8, 14);
    if (permitType === 'aerobic')     tick(148, 661);
    if (permitType === 'commercial')  tick(148, 649);
    if (permitType === 'industrial')  tick(148, 637);

    // ── GENERAL INFORMATION ────────────────────────────────────────────
    // Fila 1: Property Address / City / Zip
    draw(propertyAddress,               125, 616);
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
    draw(ownerName,                     150, 586);
    draw(ownerPhone,                    320, 586);
    draw(ownerEmail,                    445, 586);

    // Fila 4: Address of Owner / City / Zip (editable, fallback a propertyAddress)
    draw(ownerAddress || propertyAddress, 115, 574);
    draw(ownerCity    || propertyCity,    350, 574);
    draw(ownerZip     || propertyZip,     556, 574);

    // Filas 5-6: Owner's Agent + Agent's Address — PRE-IMPRESOS en el template

    // ── SYSTEM INFORMATION ─────────────────────────────────────────────
    // Fila 1: OSTDS Permit Number / Date of installation approval
    draw(applicationNumber,             265, 497);
    draw(formatDate(installationDate),  515, 497);

    // Fila 2: ATU model / gallons
    draw(systemManufacturer,            220, 485);
    draw(septicTankGallons,             533, 485);

    // Fila 3: Drainfield sq ft + checkbox tipo drainfield
    draw(drainfieldSqFt,                105, 471);
    if (drainfieldType === 'standard_subsurface') draw('X', 288, 470);
    if (drainfieldType === 'filled')              draw('X', 404, 470);
    if (drainfieldType === 'mound')               draw('X', 449, 470);

    // Fila 4: Drainfield config
    if (drainfieldConfig === 'trenches') draw('X', 170, 454);
    if (drainfieldConfig === 'bed')      draw('X', 232, 454);
    if (drainfieldConfig === 'other')    draw('X', 277, 454);

    // Fila 5: Onsite Well
    if (onsiteWell === 'yes') draw('X',  90, 429);
    if (onsiteWell === 'no')  draw('X', 130, 429);

    // Fila 6: Estimated sewage — vacío (no hay dato en el modelo)

    // Fila 7: Number of — [X] residential / 1 unidad
    draw('X',                           163, 405);   // [X] residential
    draw('1',                           445, 405);

    // Fila 8: Additional Comments
    if (additionalComments) draw(additionalComments, 115, 392);

    // ── ATU / PBTS ─────────────────────────────────────────────────────
    // Fila 1: Manufacturer / Model
    draw(systemManufacturer,            190, 348);
    draw(systemModel,                   460, 348);

    // Fila 2: Multiple ATU — [X] No
    draw('X',                           514, 333);   // [X] No

    // Fila 3: Service Agreement Yes — PRE-IMPRESO en el template

    // Fila 4: Service Agreement Expiration Date (installationDate + 24 meses)
    draw(formatDate(addMonths(installationDate, 24)), 205, 306);

    // Filas 5-6: Maintenance Entity + Address — PRE-IMPRESOS en el template

    // ── FIRMA ──────────────────────────────────────────────────────────
    // Nombre y firma de Damian Zurcher — PRE-IMPRESOS en el template
    const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    draw(today, 541, 152);

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}

module.exports = new ServiceOperatingPermit();
