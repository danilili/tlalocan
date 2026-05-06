import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import MetricCard from '../components/MetricCard';
import TaskBadge from '../components/badges/TaskBadge';
import FadeIn from '../components/FadeIn';
import SectionTitle from '../components/SectionTitle';

// TODO(commit 16): reemplazar por useTareas + listado real de staff.
const staffTasks = [
  { staff: 'Lupita', task: 'Limpieza - Del Fondo', status: 'in_progress', time: 'Iniciada hace 45 min' },
  { staff: 'Don Pedro', task: 'Revisión gas - De La Cima', status: 'pending', time: 'Pendiente' },
  { staff: 'Lupita', task: 'Prep. llegada - De La Cima', status: 'pending', time: 'Para mañana 2pm' },
];

const team = [
  { name: 'Lupita Hernández', role: 'Limpieza', tasks: 2 },
  { name: 'Don Pedro', role: 'Mantenimiento', tasks: 1 },
];

export default function StaffTab() {
  return (
    <>
      <FadeIn>
        <SectionTitle>Tareas pendientes</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {staffTasks.map((t, i) => (
            <FadeIn key={i} delay={i * 60}>
              <Card style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{t.task}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Asignado: {t.staff}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <TaskBadge status={t.status} />
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{t.time}</div>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={200}>
        <SectionTitle>Equipo</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {team.map((s, i) => (
            <Card key={i} style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: 'rgba(91,140,90,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: T.green, fontWeight: 500,
                }}>
                  {s.name.split(' ')[0][0]}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{s.role}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: T.muted }}>
                {s.tasks} tarea{s.tasks > 1 ? 's' : ''} pendiente{s.tasks > 1 ? 's' : ''} · <span style={{ color: T.green }}>Activo</span>
              </div>
            </Card>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={300}>
        <SectionTitle>Gastos operativos (abril)</SectionTitle>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <MetricCard label="Limpieza" value="$2,400" />
          <MetricCard label="Insumos" value="$1,850" />
          <MetricCard label="Mantenimiento" value="$600" />
          <MetricCard label="Utilidad neta" value="$20,950" sub="81% margen" trend="up" />
        </div>
      </FadeIn>
    </>
  );
}
