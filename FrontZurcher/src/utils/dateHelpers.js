/**
 * Utilidades para manejo correcto de fechas sin problemas de timezone
 * 
 * PROBLEMA: 
 * - Backend envía fechas DATEONLY (YYYY-MM-DD) desde PostgreSQL
 * - parseISO() de date-fns interpreta como UTC → se muestra un día anterior
 * 
 * SOLUCIÓN:
 * - Parsear fechas DATEONLY manualmente sin timezone
 * - Mantener fechas en zona horaria local
 */

/**
 * Parsea una fecha DATEONLY (YYYY-MM-DD) sin problemas de timezone
 * @param {string} dateString - Fecha en formato YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss
 * @returns {Date|null} - Objeto Date en zona horaria local o null si es inválido
 */
export const parseDateOnly = (dateString) => {
  if (!dateString) return null;
  
  // Si viene con 'T' (datetime), extraer solo la parte de la fecha
  const dateOnlyString = dateString.includes('T') 
    ? dateString.split('T')[0] 
    : dateString;
  
  // Parsear manualmente para evitar conversión UTC
  const [year, month, day] = dateOnlyString.split('-').map(Number);
  
  // Validar
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    console.warn('⚠️ Fecha inválida:', dateString);
    return null;
  }
  
  // Crear fecha en zona horaria local (mes es 0-indexed)
  return new Date(year, month - 1, day);
};

/**
 * Normaliza una fecha para inputs type="date" (YYYY-MM-DD)
 * @param {string|Date} date - Fecha a normalizar
 * @returns {string} - Fecha en formato YYYY-MM-DD o string vacío
 */
export const normalizeDateForInput = (date) => {
  if (!date) return '';
  
  // Si ya es string, verificar formato
  if (typeof date === 'string') {
    // Si viene con 'T', extraer solo la parte de la fecha
    if (date.includes('T')) {
      return date.split('T')[0];
    }
    return date;
  }
  
  // Si es objeto Date, convertir a YYYY-MM-DD
  if (date instanceof Date && !isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return '';
};

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD (zona horaria local)
 * @returns {string} - Fecha actual en formato YYYY-MM-DD
 */
export const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formatea una fecha DATEONLY para visualización
 * @param {string} dateString - Fecha en formato YYYY-MM-DD
 * @param {string} format - Formato deseado ('DD/MM/YYYY', 'MM/DD/YYYY', etc.)
 * @returns {string} - Fecha formateada o 'N/A'
 */
export const formatDateOnly = (dateString, format = 'DD/MM/YYYY') => {
  const date = parseDateOnly(dateString);
  if (!date) return 'N/A';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'MM-DD-YYYY':
      return `${month}-${day}-${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    default:
      return `${day}/${month}/${year}`;
  }
};

/**
 * Compara dos fechas DATEONLY (ignora horas)
 * @param {string} date1 - Primera fecha
 * @param {string} date2 - Segunda fecha
 * @returns {number} - -1 si date1 < date2, 0 si iguales, 1 si date1 > date2
 */
export const compareDatesOnly = (date1, date2) => {
  const d1 = parseDateOnly(date1);
  const d2 = parseDateOnly(date2);
  
  if (!d1 || !d2) return 0;
  
  const time1 = d1.getTime();
  const time2 = d2.getTime();
  
  if (time1 < time2) return -1;
  if (time1 > time2) return 1;
  return 0;
};

/**
 * Verifica si una fecha es válida
 * @param {string} dateString - Fecha a validar
 * @returns {boolean} - true si es válida
 */
export const isValidDateString = (dateString) => {
  const date = parseDateOnly(dateString);
  return date !== null && !isNaN(date.getTime());
};
