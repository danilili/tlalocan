import { T } from '../../lib/design-tokens';

const CONFIG = {
  airbnb: { label: 'Airbnb', bg: 'rgba(255,90,95,0.12)', color: '#FF5A5F' },
  booking: { label: 'Booking', bg: 'rgba(74,159,224,0.12)', color: '#4A9FE0' },
  // Bloqueo operativo: gris con patrón rayado para distinguirlo de reservas reales.
  bloqueo: {
    label: 'Bloqueo',
    bg: 'repeating-linear-gradient(45deg, rgba(160,152,130,0.22) 0 5px, rgba(160,152,130,0.08) 5px 10px)',
    color: T.muted,
  },
  cortesia: { label: 'Cortesía', bg: 'rgba(160,152,130,0.15)', color: T.muted },
  extension: { label: 'Extensión', bg: 'rgba(181,134,11,0.12)', color: T.goldLight },
  referido: { label: 'Referido', bg: 'rgba(181,134,11,0.12)', color: T.goldLight },
  website: { label: 'Sitio web', bg: 'rgba(181,134,11,0.12)', color: T.goldLight },
  app_manual: { label: 'Manual', bg: 'rgba(181,134,11,0.12)', color: T.goldLight },
  agente_whatsapp: { label: 'Tlali', bg: 'rgba(91,140,90,0.15)', color: T.green },
  directa: { label: 'Directa', bg: 'rgba(181,134,11,0.12)', color: T.goldLight },
};

export default function SourceBadge({ source }) {
  if (!source) return null;
  const c = CONFIG[source] ?? { label: 'Directo', bg: 'rgba(181,134,11,0.12)', color: T.goldLight };
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {c.label}
    </span>
  );
}
