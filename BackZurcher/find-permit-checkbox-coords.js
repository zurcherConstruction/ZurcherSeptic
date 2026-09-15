/**
 * Script para mapear coordenadas de los checkboxes del header del Operating Permit.
 * Genera un PDF con puntos y etiquetas cada 5px en el área del header (y=640–720).
 * Ejecutar: node find-permit-checkbox-coords.js
 */
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs   = require('fs');
const path = require('path');

const TEMPLATE = path.join(__dirname, 'src/assets/operating_permit_template.pdf');
const OUTPUT   = path.join(__dirname, 'src/assets/permit_header_map.pdf');

async function run() {
  const bytes  = fs.readFileSync(TEMPLATE);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page   = pdfDoc.getPages()[0];
  const RED    = rgb(1, 0, 0);
  const BLUE   = rgb(0, 0, 1);

  // Dibujar puntos cada 10px en el rango y=630..720, x=50..560
  for (let y = 630; y <= 720; y += 5) {
    // Etiqueta de fila al margen izquierdo
    page.drawText(`y=${y}`, { x: 5, y, size: 4, font, color: BLUE });
    // Línea horizontal sutil
    page.drawLine({ start: { x: 45, y }, end: { x: 580, y }, thickness: 0.2, color: rgb(0.8, 0.8, 1) });
  }

  // Marcar columnas de interés para checkboxes
  const xMarks = [
    { x: 220, label: 'New?' },
    { x: 310, label: 'Ren?' },
    { x: 395, label: 'Amd?' },
    { x: 220, label: 'Aero?' },
    { x: 220, label: 'Comm?' },
    { x: 220, label: 'Ind?' },
  ];
  // Marcar cada 20px en x entre 50 y 560
  for (let x = 50; x <= 560; x += 20) {
    page.drawText(`${x}`, { x, y: 628, size: 3.5, font, color: RED });
  }

  const out = await pdfDoc.save();
  fs.writeFileSync(OUTPUT, out);
  console.log('✅ Mapa generado en:', OUTPUT);
  console.log('   Abrí el PDF y fijate en qué coordenadas (x,y) caen los checkboxes del header.');
}

run().catch(console.error);
