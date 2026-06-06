const DEFAULT_TIMEZONE = import.meta.env.VITE_DISPLAY_TIMEZONE || 'America/New_York';
const DEFAULT_LOCALE = import.meta.env.VITE_DISPLAY_LOCALE || 'es-US';

export const getDisplayTimeZone = () => {
  return DEFAULT_TIMEZONE;
};

export const getDisplayLocale = () => {
  return DEFAULT_LOCALE;
};

export const formatDateTimeInDisplayTz = (value, options = {}) => {
  if (!value) return 'N/A';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';

  return new Intl.DateTimeFormat(getDisplayLocale(), {
    timeZone: getDisplayTimeZone(),
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
};

export const formatDateInDisplayTz = (value, options = {}) => {
  if (!value) return 'N/A';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';

  return new Intl.DateTimeFormat(getDisplayLocale(), {
    timeZone: getDisplayTimeZone(),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(date);
};

export const formatDateOnlyInDisplayTz = (dateOnly, options = {}) => {
  if (!dateOnly) return 'N/A';
  const parts = String(dateOnly).split('-');
  if (parts.length !== 3) return 'N/A';

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return 'N/A';

  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return new Intl.DateTimeFormat(getDisplayLocale(), {
    timeZone: getDisplayTimeZone(),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(utcNoon);
};

const getTodayDateOnlyInDisplayTz = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: getDisplayTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

export const isDateOnlyOverdueInDisplayTz = (dateOnly) => {
  if (!dateOnly) return false;
  const today = getTodayDateOnlyInDisplayTz();
  return dateOnly < today;
};
