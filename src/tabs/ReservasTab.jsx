import { useMemo, useState } from 'react';
import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import StatusBadge from '../components/badges/StatusBadge';
import FadeIn from '../components/FadeIn';
import SectionTitle from '../components/SectionTitle';
import { useReservas } from '../hooks/useReservas';
import NuevaReservaForm from '../forms/NuevaReservaForm';
import { formatMoney, formatDateShort } from '../lib/format';

const ESTADOS_PROXIMAS = ['cotizada', 'pendiente_pago', 'confirmada', 'en_curso'];

export default function ReservasTab() {
  const [showForm, setShowForm] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: reservas, loading, error, refetch } = useReservas({
    desde: today,
    estado: ESTADOS_PROXIMAS,
  });

  const fullName = (h) =>
    [h?.nombre, h?.apellidos].filter(Boolean).join(' ').trim() || 'Sin nombre';

  return (
    <>
      <FadeIn>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            margin: '32px 0 14px',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <h2
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: T.muted,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Próximas reservas
          </h2>
          <button type="button" onClick={() => setShowForm(true)} style={btnNueva}>
            + Nueva reserva
          </button>
        </div>

        {loading && (
          <div style={{ color: T.muted, fontSize: 12, padding: '8px 0' }}>Cargando reservas…</div>
        )}
        {error && (
          <div style={{ color: T.red, fontSize: 12, padding: '8px 0' }}>
            Error: {error.message}
          </div>
        )}
        {!loading && !error && reservas.length === 0 && (
          <Card>
            <div style={{ color: T.muted, fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
              No hay reservas próximas. Crea una con el botón superior.
            </div>
          </Card>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reservas.map((r, i) => (
            <FadeIn key={r.id} delay={i * 40}>
              <Card
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{fullName(r.huesped)}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                    {r.chalet?.nombre ?? '—'}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: T.muted, minWidth: 130 }}>
                  {formatDateShort(r.fecha_entrada)} → {formatDateShort(r.fecha_salida)}
                </div>
                <StatusBadge status={r.estado} />
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: T.goldLight,
                    minWidth: 90,
                    textAlign: 'right',
                  }}
                >
                  {formatMoney(r.monto_total)}
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      </FadeIn>

      <NuevaReservaForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={refetch}
      />
    </>
  );
}

const btnNueva = {
  background: T.gold,
  color: T.dark,
  border: 'none',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};
