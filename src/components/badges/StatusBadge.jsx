import { T } from '../../lib/design-tokens';

const CONFIG = {
  // Estados de chalet (legacy / Resumen tab).
  occupied: { label: 'Ocupado', bg: 'rgba(181,134,11,0.15)', color: T.goldLight },
  available: { label: 'Disponible', bg: 'rgba(91,140,90,0.15)', color: T.green },
  cleaning: { label: 'Limpieza', bg: 'rgba(160,152,130,0.15)', color: T.muted },
  // Estados de reserva (esquema reservas.estado).
  cotizada: { label: 'Cotizada', bg: 'rgba(160,152,130,0.15)', color: T.muted },
  pendiente_pago: { label: 'Pendiente pago', bg: 'rgba(181,134,11,0.15)', color: T.goldLight },
  confirmada: { label: 'Confirmada', bg: 'rgba(91,140,90,0.15)', color: T.green },
  en_curso: { label: 'En curso', bg: 'rgba(181,134,11,0.20)', color: T.gold },
  completada: { label: 'Completada', bg: 'rgba(160,152,130,0.10)', color: T.muted },
  cancelada: { label: 'Cancelada', bg: 'rgba(199,80,80,0.12)', color: T.red },
  no_show: { label: 'No-show', bg: 'rgba(199,80,80,0.12)', color: T.red },
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
