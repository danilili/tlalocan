import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import MetricCard from '../components/MetricCard';
import FadeIn from '../components/FadeIn';
import SectionTitle from '../components/SectionTitle';

// TODO(commit 15): reemplazar por useHuespedes con totales reales.
const topGuests = [
  { name: 'Ana García', visits: 5, totalSpent: 24600, lastVisit: 'Abr 2026' },
  { name: 'Carlos Mendoza', visits: 3, totalSpent: 12800, lastVisit: 'Abr 2026' },
  { name: 'Patricia Vega', visits: 3, totalSpent: 11400, lastVisit: 'Mar 2026' },
  { name: 'Fernando López', visits: 2, totalSpent: 8200, lastVisit: 'Feb 2026' },
];

export default function HuespedesTab() {
  return (
    <>
      <FadeIn>
        <SectionTitle>Huéspedes frecuentes</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {topGuests.map((g, i) => (
            <FadeIn key={i} delay={i * 60}>
              <Card style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', background: 'rgba(181,134,11,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 500, color: T.goldLight, flexShrink: 0,
                }}>
                  {g.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{g.visits} estancias · Última: {g.lastVisit}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.goldLight }}>${g.totalSpent.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: T.muted }}>total gastado</div>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={300}>
        <SectionTitle>Resumen CRM</SectionTitle>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <MetricCard label="Total huéspedes" value="34" sub="este año" />
          <MetricCard label="Repetidores" value="12" sub="35% del total" trend="up" />
          <MetricCard label="Ticket promedio" value="$2,840" sub="por estancia" />
        </div>
      </FadeIn>
    </>
  );
}
