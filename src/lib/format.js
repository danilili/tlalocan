// Formateadores comunes con locale es-MX.

const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateShortFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
});

export function formatMoney(amount) {
  return moneyFormatter.format(Number(amount ?? 0));
}

// Sin centavos — para tarjetas de métricas donde el espacio manda.
const moneyRoundedFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

export function formatMoneyRounded(amount) {
  return moneyRoundedFormatter.format(Number(amount ?? 0));
}

// Acepta 'YYYY-MM-DD' (le fija medianoche local) o timestamps ISO completos
// (created_at de Postgres trae 'T...+00:00'; pegarle T00:00:00 daba Invalid
// Date y el RangeError de Intl tumbaba toda la app).
function toDate(input) {
  const d =
    typeof input === 'string'
      ? new Date(input.includes('T') ? input : `${input}T00:00:00`)
      : input;
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
}

export function formatDate(input) {
  if (!input) return '';
  const d = toDate(input);
  return d ? dateFormatter.format(d) : '';
}

export function formatDateShort(input) {
  if (!input) return '';
  const d = toDate(input);
  return d ? dateShortFormatter.format(d) : '';
}

// Quita todo lo que no sea digito; el schema guarda ej. "5213335702682".
export function normalizePhone(phone) {
  return (phone ?? '').replace(/\D/g, '');
}

// Para mostrar: agrega un + adelante si parece codigo pais.
export function formatPhone(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return '';
  return `+${digits}`;
}
