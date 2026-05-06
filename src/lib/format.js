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

export function formatDate(input) {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(`${input}T00:00:00`) : input;
  return dateFormatter.format(d);
}

export function formatDateShort(input) {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(`${input}T00:00:00`) : input;
  return dateShortFormatter.format(d);
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
