import { T } from '../../lib/design-tokens';

const CONFIG = {
  in_progress: { label: 'En curso', color: T.goldLight },
  pending: { label: 'Pendiente', color: T.muted },
  completed: { label: 'Listo', color: T.green },
};

export default function TaskBadge({ status }) {
  const c = CONFIG[status];
  if (!c) return null;
  return (
    <span style={{ color: c.color, fontSize: 11, fontWeight: 500 }}>{c.label}</span>
  );
}
