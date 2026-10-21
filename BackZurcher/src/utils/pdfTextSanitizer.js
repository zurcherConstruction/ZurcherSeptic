/**
 * Sanitiza texto para que sea seguro dibujarlo con pdf-lib usando fuentes
 * estándar (Helvetica, etc.), que solo soportan codificación WinAnsi.
 *
 * Datos legacy importados (copiados desde Word, otros sistemas, WhatsApp, etc.)
 * a veces traen caracteres Unicode "tipográficos" o invisibles (guion especial
 * non-breaking U+2011, comillas curvas, marcas de dirección de texto RTL/LTR,
 * emojis, etc.) que WinAnsi NO puede codificar — eso hace que pdf-lib tire
 * `WinAnsi cannot encode "X"` y la generación del PDF falle con 500.
 *
 * Esta función reemplaza las variantes tipográficas más comunes por su
 * equivalente ASCII y, como última red de seguridad, descarta cualquier
 * carácter que quede fuera del rango seguro para WinAnsi.
 */
function sanitizePdfText(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);

  text = text
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-') // guiones especiales (incluye non-breaking hyphen)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")                   // comillas simples curvas
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')                   // comillas dobles curvas
    .replace(/[\u2026]/g, '...')                                   // puntos suspensivos
    .replace(/[\u00A0]/g, ' ');                                    // espacio no separable

  // Eliminar caracteres invisibles / marcas de dirección de texto (zero-width, RTL/LTR, BOM)
  text = text.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '');

  // Última red de seguridad: cualquier carácter restante fuera del rango
  // seguro para WinAnsi (ASCII imprimible + Latin-1 suplementario) se descarta.
  text = text.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');

  return text;
}

module.exports = { sanitizePdfText };
