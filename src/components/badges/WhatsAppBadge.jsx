import { T } from '../../lib/design-tokens';

// huespedes.whatsapp_valido: true = existe en WhatsApp, false = no recibe,
// null = aún sin verificar (el cron valida a diario) → no se muestra nada.
export default function WhatsAppBadge({ valido }) {
  if (valido !== true && valido !== false) return null;
  return (
    <span
      title={valido ? 'El número recibe WhatsApp' : 'El número no recibe WhatsApp'}
      style={{
        background: valido ? 'rgba(91,140,90,0.15)' : 'rgba(199,80,80,0.15)',
        color: valido ? T.green : T.red,
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.4,
        whiteSpace: 'nowrap',
      }}
    >
      {valido ? '✓ WhatsApp' : '✗ Sin WhatsApp'}
    </span>
  );
}
