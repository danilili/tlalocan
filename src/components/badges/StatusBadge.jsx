import { T } from '../../lib/design-tokens';

const CONFIG = {
  occupied: { label: 'Ocupado', bg: 'rgba(181,134,11,0.15)', color: T.goldLight },
  available: { label: 'Disponible', bg: 'rgba(91,140,90,0.15)', color: T.green },
  cleaning: { label: 'Limpieza', bg: 'rgba(160,152,130,0.15)', color: T.muted },
};

export default function StatusBadge({ status }) {
  const c = CONFIG[status];
  if (!c) return null;
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0.3,
        whiteSpace: 'nowrap',
      }}
    >
      {c.label}
    </span>
  );
}
