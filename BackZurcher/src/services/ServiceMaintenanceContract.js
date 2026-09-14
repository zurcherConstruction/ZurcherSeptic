/**
 * ServiceMaintenanceContract
 * Genera el contrato de servicio de 2 años (Norweco/Delta) usando pdf-lib.
 * Produce un PDF profesional con todos los datos del cliente y las 4 fechas de visita.
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const COMPANY = {
  name: 'ZURCHER CONSTRUCTION LLC',
  address: '450 RATHBURN ST',
  city: 'LEHIGH ACRES, FL 33974',
  phone: '6892763356',
  email: 'admin@zurcherseptic.com',
  signerName: 'DAMIAN ZURCHER',
};

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  const year  = d.getFullYear();
  return `${month}/${day}/${year}`;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

class ServiceMaintenanceContract {

  async generate(workData) {
    const {
      propertyAddress,
      customerName,
      customerPhone,
      customerEmail,
      customerCity,
      customerState,
      customerZip,
      systemModel,
      serialNumber,
      startDate,       // Date object or ISO string — base for the 4 visit dates
      contractDate,    // Date for the "Date:" field on the contract
      lot,
      block,
      subdivision,
    } = workData;

    const baseDate = startDate ? new Date(startDate) : new Date();
    const visit1 = addMonths(baseDate, 6);
    const visit2 = addMonths(baseDate, 12);
    const visit3 = addMonths(baseDate, 18);
    const visit4 = addMonths(baseDate, 24);
    const expirationDate = visit4;

    const pdfDoc = await PDFDocument.create();
    const helvetica     = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    const margin = 50;
    const col = width / 2;

    let y = height - 40;

    const drawText = (text, x, yPos, opts = {}) => {
      const font = opts.bold ? helveticaBold : helvetica;
      const size = opts.size || 9;
      const color = opts.color || rgb(0, 0, 0);
      page.drawText(String(text || ''), { x, y: yPos, size, font, color });
    };

    const drawLine = (x1, yPos, x2) => {
      page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness: 0.5, color: rgb(0, 0, 0) });
    };

    const drawRect = (x, yPos, w, h, opts = {}) => {
      page.drawRectangle({
        x, y: yPos, width: w, height: h,
        borderColor: rgb(0, 0, 0),
        borderWidth: opts.borderWidth ?? 0.5,
        color: opts.fill ? rgb(0.92, 0.92, 0.92) : undefined,
      });
    };

    // ─── Title ───────────────────────────────────────────────────────────────
    drawText('2-Year Service Contract', width / 2 - 80, y, { bold: true, size: 13 });
    y -= 22;
    drawLine(margin, y, width - margin);
    y -= 16;

    // ─── Parties header ──────────────────────────────────────────────────────
    drawText('Parties:', margin, y, { bold: true, size: 10 });
    y -= 16;
    drawText('(Authorized Delta Service Provider)', margin, y, { bold: true, size: 9 });
    drawText('And:', col - 10, y, { bold: true, size: 9 });
    drawText('(Customer)', col + 20, y, { bold: true, size: 9 });
    y -= 14;

    // ─── Left: Service Provider | Right: Customer ─────────────────────────
    const leftX  = margin;
    const rightX = col + 10;

    const providerLines = [
      `Name: ${COMPANY.name}`,
      `Address: ${COMPANY.address}`,
      `City, State, Zip: ${COMPANY.city}`,
      `Telephone: ${COMPANY.phone}`,
      `E-Mail: ${COMPANY.email}`,
    ];
    const customerCityLine = [customerCity, customerState, customerZip].filter(Boolean).join(', ');
    const customerLines = [
      `Name: ${customerName || ''}`,
      `Address: ${propertyAddress || ''}`,
      `City, State, Zip: ${customerCityLine}`,
      `Telephone: ${customerPhone || ''}`,
      `E-Mail: ${customerEmail || ''}`,
    ];

    for (let i = 0; i < providerLines.length; i++) {
      drawText(providerLines[i], leftX, y, { size: 8.5 });
      drawText(customerLines[i], rightX, y, { size: 8.5 });
      y -= 13;
    }

    y -= 8;
    drawLine(margin, y, width - margin);
    y -= 14;

    // ─── Agency Contact | System Location ────────────────────────────────
    drawText('Agency Contact Information:', leftX, y, { bold: true, size: 9 });
    drawText('System Location:', rightX, y, { bold: true, size: 9 });
    y -= 14;

    const legalDesc = [lot && `Lot ${lot}`, block && `Block ${block}`, subdivision].filter(Boolean).join(', ') || '';
    const agencyLines = [
      `Agency: ${COMPANY.name}`,
      `Address: ${COMPANY.address}`,
      `City, State, Zip: ${COMPANY.city}`,
      `Telephone: ${COMPANY.phone}`,
      `E-Mail: ${COMPANY.email}`,
    ];
    const systemCityLine = [customerCity, customerState, customerZip].filter(Boolean).join(', ');
    const systemLines = [
      `Address: ${propertyAddress || ''}`,
      `City, State, Zip: ${systemCityLine}`,
      `Legal Description: ${legalDesc}`,
      `Model: ${systemModel || ''}`,
      `Serial Number: ${serialNumber || ''}`,
    ];

    for (let i = 0; i < agencyLines.length; i++) {
      drawText(agencyLines[i], leftX, y, { size: 8.5 });
      drawText(systemLines[i] || '', rightX, y, { size: 8.5 });
      y -= 13;
    }

    y -= 8;
    drawText(`Date:`, leftX, y, { bold: true, size: 9 });
    drawText(formatDate(contractDate || new Date()), leftX + 35, y, { size: 9 });
    y -= 8;
    drawLine(margin, y, margin + 130);
    y -= 18;

    drawLine(margin, y, width - margin);
    y -= 16;

    // ─── Preamble ────────────────────────────────────────────────────────
    const preamble = 'NOW, THEREFORE, in consideration of the terms, provision, covenants and conditions herein, the Parties hereto agree as follows:';
    const preambleLines = wrapText(preamble, 510, helvetica, 8.5);
    for (const line of preambleLines) {
      drawText(line, leftX, y, { size: 8.5 });
      y -= 13;
    }
    y -= 10;

    // ─── 1.0 Performance of Basic Services ───────────────────────────────
    drawText('1.0 Performance of Basic Services', leftX, y, { bold: true, size: 10 });
    y -= 18;

    drawText('1.1 Initial Service Policy', leftX + 10, y, { bold: true, size: 9 });
    y -= 14;

    const serviceText = 'The Authorized Delta Service Provider shall perform the System Inspection/Service Visits during the 24-month period after installation, as marked:';
    const wrapped = wrapText(serviceText, 500, helvetica, 8.5);
    for (const line of wrapped) {
      drawText(line, leftX + 10, y, { size: 8.5 });
      y -= 13;
    }
    y -= 8;

    // ─── Visit table ─────────────────────────────────────────────────────
    const tableX = leftX + 10;
    const tableW = 420;
    const rowH   = 20;
    const col1W  = 190;
    const col2W  = 120;
    const rows = [
      ['Inspection/Service Visits 1', '6th month',  formatDate(visit1)],
      ['',                            '12th month', formatDate(visit2)],
      ['',                            '18th month', formatDate(visit3)],
      ['',                            '24th month', formatDate(visit4)],
    ];

    // Outer border
    drawRect(tableX, y - rowH * rows.length, tableW, rowH * rows.length + rowH);
    // Header row
    drawRect(tableX, y, tableW, rowH, { fill: true });
    drawText('Visit',    tableX + 6,           y + 6, { bold: true, size: 8.5 });
    drawText('Interval', tableX + col1W + 6,   y + 6, { bold: true, size: 8.5 });
    drawText('Date',     tableX + col1W + col2W + 6, y + 6, { bold: true, size: 8.5 });
    y -= rowH;

    for (const row of rows) {
      drawLine(tableX, y, tableX + tableW);
      // Vertical separators
      drawLine(tableX + col1W, y, tableX + col1W, y + rowH);
      drawLine(tableX + col1W + col2W, y, tableX + col1W + col2W, y + rowH);
      drawText(row[0], tableX + 6,                     y + 6, { size: 8.5 });
      drawText(row[1], tableX + col1W + 6,             y + 6, { size: 8.5 });
      drawText(row[2], tableX + col1W + col2W + 6,     y + 6, { size: 8.5 });
      y -= rowH;
    }

    y -= 14;

    const nsf = 'As required by NSF, these services will be included as part of the initial purchase of the system.';
    drawText(nsf, leftX + 10, y, { size: 8.5 });
    y -= 24;

    // ─── 1.2 – 1.4 ──────────────────────────────────────────────────────
    const sections12_14 = [
      ['1.2 Extended Service Policy', 'The Delta authorized service provider shall make available, for purchase by the owner, an extended service policy with terms comparable to those in the initial service policy.'],
      ['1.3 Stand-By Parts', 'In the event that a mechanical or electrical component must undergo off-site repairs, the local authorized representative should maintain a stock of mechanical and electrical components that may be temporarily installed until repairs are completed.'],
      ['1.4 Availability of Service', 'The Service Provider shall provide emergency service within 48 hours of a service request.'],
    ];

    for (const [title, body] of sections12_14) {
      drawText(title, leftX + 10, y, { bold: true, size: 9 });
      y -= 14;
      const lines = wrapText(body, 500, helvetica, 8.5);
      for (const line of lines) {
        drawText(line, leftX + 10, y, { size: 8.5 });
        y -= 13;
      }
      y -= 8;
    }

    // ─── Page 2 ──────────────────────────────────────────────────────────
    const page2 = pdfDoc.addPage([612, 792]);
    let y2 = height - 40;

    const draw2 = (text, x, yPos, opts = {}) => {
      const font = opts.bold ? helveticaBold : helvetica;
      const size = opts.size || 9;
      page2.drawText(String(text || ''), { x, y: yPos, size, font, color: rgb(0, 0, 0) });
    };
    const line2 = (x1, yPos, x2) => {
      page2.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness: 0.5, color: rgb(0, 0, 0) });
    };

    // ─── 2.0 Term ────────────────────────────────────────────────────────
    const mainSections = [
      ['2.0 Term of Agreement', 'This Agreement shall be for the period 24 months from the date of System start-up, unless otherwise terminated or canceled by either party as provided herein.'],
      ['3.0 Definitions', null],
      [null, '3.1 "System" shall mean a Delta NSF/ANSI 40 and/or 245 certified wastewater treatment system.'],
      [null, '3.2 "System Start-Up Date" shall mean the date the System begins operating for its intended purpose.'],
      ['4.0 Charges', 'The basic services, including service, inspection, effluent quality evaluation, and service, shall be included with the purchase of the System. Optional, additional services shall be provided at the agreed upon contract price and terms. The annual report and annual evaluation fee, if required by the permitting agency, is not optional, and may or may not be included in the cost of basic services. Refer to Service Provider\'s fee schedule for an outline of the cost of basic services and optional services to be provided under this contract.\n\nThese services shall be performed during normal business hours Monday through Friday (excluding national holidays) on a pre-scheduled basis and as the Authorized Delta Service Provider deems necessary or advisable.\n\nAt each service visit the System shall be inspected and serviced in accordance with the instructions in the Systems O & M Manual. Additionally, an effluent quality inspection consisting of a visual assessment of color, turbidity, and scum overflow and an olfactory assessment for odor shall be performed.\n\nThe Service Provider will affix a "For Service, Call ' + COMPANY.phone + '" label near the control panel\'s alarm signal.\n\nPerformance of the 2-year Inspection/Service visits shall include notification of needed repair, replacement or addition of parts used in the system.\n\nThe Service Provider shall be responsible for submitting the annual report and annual evaluation fee to the appropriate regulatory agency as required in Florida Regulations.\n\nThe Service Provider shall notify the owner in writing if any improper system operation cannot be remedied at the time of servicing. The written notification shall include an estimated date of correction.'],
      ['5.0 Warranty', 'The Delta Service Provider warrants that all Services shall be performed in a good and workmanlike manner and that Service Provider will correct any System errors, malfunctions, or defects directly caused by Service Provider\'s failure to perform the Services and Additional Services in such manner.'],
      ['6.0 Limitation of Liability', 'The sole liability of the Delta Service Provider under this agreement shall be to correct any errors, malfunctions or defects in the system directly caused by the Delta Service Provider\'s failure to perform any services in a good and workmanlike manner pursuant to Section 4 above. In no event shall the Service Provider\'s liability to the Customer hereunder exceed the total of the amounts paid to the Service Provider hereunder by the Customer. In no event shall the Delta Service Provider be liable to the Customer or any third-party claimant for any indirect, special, punitive, consequential or incidental damages or lost profits arising out of or related to this Agreement.'],
      ['7.0 Termination/Cancellation', 'This Agreement may be terminated or canceled only upon:\n• Written notice by one Party effective as of the effective date thereof if the other Party is in default of any provision of this Agreement and such default is not cured by the defaulting Party within fifteen (15) days after the effective date of said notice from the non-defaulting party, or by the mutual written agreement of both Parties.\n• Copy of such written notice shall be forwarded to the regulatory agency.'],
      ['8.0 Miscellaneous Provisions', 'This Agreement is personal in nature and may not be delegated, assigned or transferred by either Party without the prior written consent of the other Party.\n\nThe laws of the State of Florida shall govern this Agreement.\n\nThe homeowner shall be responsible for complying with the applicable Delta Treatment Unit Installation, Operation & Maintenance Manual provided to them with the purchase of the system.'],
    ];

    for (const [title, body] of mainSections) {
      if (title) {
        draw2(title, margin, y2, { bold: true, size: title.startsWith('  ') ? 9 : 10 });
        y2 -= 15;
      }
      if (body) {
        const paragraphs = body.split('\n');
        for (const para of paragraphs) {
          if (!para.trim()) { y2 -= 6; continue; }
          const lines = wrapText(para, 500, helvetica, 8.5);
          for (const line of lines) {
            if (y2 < 120) break;
            draw2(line, margin + 10, y2, { size: 8.5 });
            y2 -= 13;
          }
        }
      }
      y2 -= 8;
      if (y2 < 120) break;
    }

    // ─── Signature block ─────────────────────────────────────────────────
    y2 -= 10;
    line2(margin, y2, width - margin);
    y2 -= 16;

    draw2('Delta Service Provider', margin, y2, { bold: true, size: 9 });
    draw2('Customer(s)', col + 10, y2, { bold: true, size: 9 });
    y2 -= 14;

    draw2(`Name:  ${COMPANY.name}`, margin, y2, { size: 8.5 });
    draw2(`Name:  ${customerName || ''}`, col + 10, y2, { size: 8.5 });
    y2 -= 22;

    draw2('Signature: ____________________________', margin, y2, { size: 8.5 });
    draw2('Client Signature: ____________________________', col + 10, y2, { size: 8.5 });
    y2 -= 16;

    draw2(`Title:  ${COMPANY.signerName}`, margin, y2, { size: 8.5 });
    draw2('Title:  OWNER', col + 10, y2, { size: 8.5 });
    y2 -= 14;

    draw2('Sign Date: ____________________________', col + 10, y2, { size: 8.5 });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}

// ─── Helper: simple word-wrap ────────────────────────────────────────────────
function wrapText(text, maxWidth, font, size) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const w = font.widthOfTextAtSize(test, size);
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

module.exports = new ServiceMaintenanceContract();
