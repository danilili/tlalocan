import { T } from '../../lib/design-tokens';

const CONFIG = {
  pendiente: { label: 'Pendiente', color: T.muted },
  en_curso: { label: 'En curso', color: T.goldLight },
  completada: { label: 'Listo', color: T.green },
  cancelada: { label: 'Cancelada', color: T.muted },
  rechazada: { label: 'Rechazada', color: T.red },
};

export default function TaskBadge({ status }) {
  const c = CONFIG[status];
  if (!c) return null;
  return (
    <span style={{ color: c.color, fontSize: 11, fontWeight: 500 }}>{c.label}</span>
  );
}
