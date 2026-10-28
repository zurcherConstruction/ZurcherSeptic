/**
 * 📊 ZurcherAI — exportación a Excel
 *
 * La IA llama a export_to_excel con una consulta (entidad + filtros + campos). No se guarda ningún
 * archivo: la consulta queda en el historial de la conversación (bloque tool_use) y el Excel se
 * genera al descargarlo, con los datos de ese momento y re-validando el permiso del rol.
 */
const ExcelJS = require('exceljs');
const { FILTER_SCHEMA, buildFindOptions, listEntities } = require('./aiEntityCatalog');

const MAX_EXPORT_ROWS = 5000;

function buildExportToolDefinition(role) {
  return {
    name: 'export_to_excel',
    description: `Create a downloadable Excel file with records of one entity (up to ${MAX_EXPORT_ROWS} rows), using the same filters/fields/orderBy as query_records. Use it when the user asks for a report, list or data "in Excel", or when a list is too long to show in chat. Choose only the useful columns. The result contains a "link": include it in your answer exactly as a markdown link, e.g. [📥 Descargar Excel](link).`,
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title of the report; also used as file name (e.g. "Obras Lee County octubre 2026").' },
        entity: { type: 'string', enum: listEntities(role) },
        filters: FILTER_SCHEMA,
        fields: { type: 'array', items: { type: 'string' }, description: 'Columns to include, in order. Recommended.' },
        orderBy: {
          type: 'object',
          properties: { field: { type: 'string' }, direction: { type: 'string', enum: ['asc', 'desc'] } },
        },
      },
      required: ['title', 'entity'],
    },
  };
}

// Se ejecuta cuando la IA llama la herramienta: valida la consulta y cuenta las filas
async function prepareExport(role, input, toolUseId) {
  const { model, where, attributes } = buildFindOptions(role, input);
  const total = await model.count({ where });
  return {
    title: input.title,
    entity: input.entity,
    columns: attributes,
    rows: Math.min(total, MAX_EXPORT_ROWS),
    totalMatching: total,
    truncated: total > MAX_EXPORT_ROWS,
    link: `#ai-export/${toolUseId}`,
  };
}

function formatCell(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 32000);
  if (typeof value === 'string') return value.slice(0, 32000);
  return value;
}

// Genera el .xlsx a partir de la consulta guardada en el historial
async function buildExportWorkbook(role, input) {
  const { model, where, attributes, order, fieldDefs } = buildFindOptions(role, input);
  const rows = await model.findAll({ where, attributes, order, limit: MAX_EXPORT_ROWS, raw: true });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ZurcherAI';
  const sheet = workbook.addWorksheet(String(input.title || input.entity).replace(/[\\/*?:[\]]/g, ' ').slice(0, 31));

  sheet.columns = attributes.map(name => ({
    header: name,
    key: name,
    width: Math.min(Math.max(name.length + 2, ...rows.slice(0, 200).map(r => String(r[name] ?? '').length + 2)), 50),
    style: fieldDefs[name]?.type === 'DATE' ? { numFmt: 'yyyy-mm-dd hh:mm' } : undefined,
  }));
  rows.forEach(r => sheet.addRow(Object.fromEntries(attributes.map(a => [a, formatCell(r[a])]))));

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: attributes.length } };

  const fileName = `${String(input.title || input.entity).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '_') || 'reporte'}.xlsx`;
  return { buffer: await workbook.xlsx.writeBuffer(), fileName };
}

module.exports = { buildExportToolDefinition, prepareExport, buildExportWorkbook };
