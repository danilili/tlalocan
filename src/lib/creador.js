// Etiqueta de quién creó una reserva/bloqueo. Usa el nombre del usuario
// (join creador en useReservas); si no hay creada_por, la reserva vino de un
// flujo automático y la etiqueta sale del origen.
const CREADOR_AUTO = {
  airbnb: 'Airbnb (automática)',
  booking: 'Booking (automática)',
  website: 'Sitio web (automática)',
  agente_whatsapp: 'Tlali (WhatsApp)',
};

export function creadorLabel(r) {
  return r?.creador?.nombre || CREADOR_AUTO[r?.origen] || 'Sistema';
}
