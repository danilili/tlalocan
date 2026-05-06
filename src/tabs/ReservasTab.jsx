import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import SourceBadge from '../components/badges/SourceBadge';
import FadeIn from '../components/FadeIn';
import SectionTitle from '../components/SectionTitle';

// TODO(commit 11): reemplazar por useReservas + boton "+ Nueva reserva".
const upcomingBookings = [
  { guest: 'Laura Jiménez', chalet: 'De La Cima', checkin: '12 Abr', checkout: '14 Abr', source: 'direct', amount: 1380 },
  { guest: 'Roberto Sánchez', chalet: 'De La Entrada', checkin: '12 Abr', checkout: '15 Abr', source: 'airbnb', amount: 9000 },
  { guest: 'María Torres', chalet: 'Del Fondo', checkin: '14 Abr', checkout: '16 Abr', source: 'airbnb', amount: 3180 },
  { guest: 'Diego Ramírez', chalet: 'De La Cañada', checkin: '15 Abr', checkout: '17 Abr', source: 'direct', amount: 2380 },
];

export default function ReservasTab() {
  return (
    <>
      <FadeIn>
        <SectionTitle>Próximas reservas</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {upcomingBookings.map((b, i) => (
            <FadeIn key={i} delay={i * 60}>
              <Card style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{b.guest}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{b.chalet}</div>
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>{b.checkin} → {b.checkout}</div>
                <SourceBadge source={b.source} />
                <div style={{ fontSize: 14, fontWeight: 600, color: T.goldLight, minWidth: 70, textAlign: 'right' }}>${b.amount.toLocaleString()}</div>
              </Card>
            </FadeIn>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={300}>
        <SectionTitle>Calendario de abril</SectionTitle>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map(d => (
              <div key={d} style={{ fontSize: 10, color: T.muted, padding: 6, letterSpacing: 0.5 }}>{d}</div>
            ))}
            {[null, null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((day, i) => {
              if (!day) return <div key={i} />;
              const isToday = day === 10;
              const isBooked = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].includes(day);
              return (
                <div key={i} style={{
                  padding: '8px 4px', borderRadius: 6, fontSize: 12,
                  background: isToday ? T.gold : isBooked ? 'rgba(181,134,11,0.08)' : 'transparent',
                  color: isToday ? T.dark : isBooked ? T.goldLight : T.muted,
                  fontWeight: isToday ? 600 : 400,
                  border: isBooked && !isToday ? '1px solid rgba(181,134,11,0.15)' : '1px solid transparent',
                  transition: 'all 0.2s',
                }}>
                  {day}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: T.gold, display: 'inline-block' }} /> Hoy
            </span>
            <span style={{ fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, border: '1px solid rgba(181,134,11,0.3)', display: 'inline-block' }} /> Con reserva
            </span>
          </div>
        </Card>
      </FadeIn>
    </>
  );
}
