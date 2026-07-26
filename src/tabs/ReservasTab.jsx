import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import StatusBadge from '../components/badges/StatusBadge';
import SourceBadge from '../components/badges/SourceBadge';
import WhatsAppBadge from '../components/badges/WhatsAppBadge';
import FadeIn from '../components/FadeIn';
import { supabase } from '../lib/supabase';
import { useReservas } from '../hooks/useReservas';
import { useRol } from '../hooks/useRol';
import NuevaReservaForm from '../forms/NuevaReservaForm';
import BloquearFechasForm from '../forms/BloquearFechasForm';
import ValidarPagoForm from '../forms/ValidarPagoForm';
import EditarReservaForm from '../forms/EditarReservaForm';
import { formatMoney, formatDateShort, formatDate } from '../lib/format';
import { creadorLabel } from '../lib/creador';

const ESTADOS_PROXIMAS = ['cotizada', 'pendiente_pago', 'confirmada', 'en_curso'];

export default function ReservasTab() {
  const [showForm, setShowForm] = useState(false);
  const [showBloqueo, setShowBloqueo] = useState(false);
  const [validating, setValidating] = useState(null); // reserva | null
  const [editing, setEditing] = useState(null); // reserva | null
  const [extending, setExtending] = useState(null); // reserva en curso a extender | null
  const [liberando, setLiberando] = useState(null); // id del bloqueo en proceso
  const { isAdmin, isVentas } = useRol();
  const puedeEditar = isAdmin || isVentas;

  // Fecha local (toISOString es UTC: después de las 6pm ya "era mañana" y
  // ocultaba las reservas de hoy).
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const { data: reservas, loading, error, refetch } = useReservas({
    desde: today,
    estado: ESTADOS_PROXIMAS,
  });

  const fullName = (h) =>
    [h?.nombre, h?.apellidos].filter(Boolean).join(' ').trim() || 'Sin nombre';

  const requiresValidation = (r) =>
    r.estado === 'pendiente_pago' && !!r.comprobante_url;

  // Liberar bloqueo = pasar a cancelada (con confirmación). RLS permite a
  // ventas esta actualización solo sobre origen='bloqueo'.
  const liberarBloqueo = async (r) => {
    const ok = window.confirm(
      `¿Liberar el bloqueo de ${r.chalet?.nombre ?? 'chalet'} (${formatDateShort(r.fecha_entrada)} → ${formatDateShort(r.fecha_salida)})? Las fechas quedarán disponibles de nuevo.`,
    );
    if (!ok) return;
    setLiberando(r.id);
    const { error: updError } = await supabase
      .from('reservas')
      .update({ estado: 'cancelada' })
      .eq('id', r.id)
      .eq('origen', 'bloqueo');
    setLiberando(null);
    if (updError) window.alert(`No se pudo liberar el bloqueo: ${updError.message}`);
    else refetch();
  };

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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowBloqueo(true)} style={btnBloquear}>
              ⛔ Bloquear fechas
            </button>
            <button type="button" onClick={() => setShowForm(true)} style={btnNueva}>
              + Nueva reserva
            </button>
          </div>
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
          {reservas.map((r, i) => {
            const esBloqueo = r.origen === 'bloqueo';
            const needsValidation = !esBloqueo && requiresValidation(r);
            const clickable = needsValidation && isAdmin;
            // Diferencia entre el total y los pagos registrados (ledger sync).
            const adeudo = esBloqueo
              ? 0
              : Math.max(0, (Number(r.monto_total) || 0) - (Number(r.monto_pagado) || 0));
            return (
              <FadeIn key={r.id} delay={i * 40}>
                <Card
                  onClick={clickable ? () => setValidating(r) : undefined}
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 140, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap',
                        color: esBloqueo ? T.muted : T.text,
                      }}
                    >
                      {esBloqueo ? (r.notas || 'Bloqueo operativo') : fullName(r.huesped)}
                      {!esBloqueo && <WhatsAppBadge valido={r.huesped?.whatsapp_valido} />}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                      {esBloqueo ? 'Motivo del bloqueo' : 'Huésped'}
                    </div>
                  </div>
                  <div style={{ minWidth: 130, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.goldLight }}>
                      {r.chalet?.nombre ?? '—'}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Chalet</div>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, minWidth: 130 }}>
                    {formatDateShort(r.fecha_entrada)} → {formatDateShort(r.fecha_salida)}
                  </div>
                  {r.origen === 'airbnb' && (
                    <div style={{ minWidth: 110 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          color: r.codigo_airbnb ? T.text : T.muted,
                        }}
                      >
                        {r.codigo_airbnb || 'Sin código'}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Cód. Airbnb</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {needsValidation && <PagoPendienteBadge />}
                    {esBloqueo && <SourceBadge source="bloqueo" />}
                    <StatusBadge status={r.estado} />
                  </div>
                  {!esBloqueo && (
                    <div style={{ minWidth: 90, textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.goldLight }}>
                        {formatMoney(r.monto_total)}
                      </div>
                      {adeudo > 0.009 && (
                        <div style={{ fontSize: 11, fontWeight: 600, color: T.red, marginTop: 2 }}>
                          Adeudo {formatMoney(adeudo)}
                        </div>
                      )}
                    </div>
                  )}
                  {esBloqueo ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        liberarBloqueo(r);
                      }}
                      disabled={liberando === r.id}
                      title="Liberar bloqueo"
                      aria-label="Liberar bloqueo"
                      style={{ ...btnEdit, opacity: liberando === r.id ? 0.5 : 1 }}
                    >
                      🔓
                    </button>
                  ) : (
                    puedeEditar && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            r.origen === 'airbnb' &&
                            !window.confirm(
                              'No es recomendable editar reservaciones procedentes de Airbnb. ¿Estás seguro?',
                            )
                          ) return;
                          setEditing(r);
                        }}
                        title="Editar reserva"
                        aria-label="Editar reserva"
                        style={btnEdit}
                      >
                        ✎
                      </button>
                    )
                  )}
                  <div
                    style={{
                      flexBasis: '100%',
                      fontSize: 10.5,
                      color: T.muted,
                      borderTop: `1px solid ${T.border}`,
                      paddingTop: 6,
                      marginTop: 2,
                    }}
                  >
                    Creada por {creadorLabel(r)}
                    {r.created_at ? ` · ${formatDate(r.created_at)}` : ''}
                  </div>
                </Card>
              </FadeIn>
            );
          })}
        </div>
      </FadeIn>

      <NuevaReservaForm
        open={showForm || !!extending}
        reservaAExtender={extending}
        onClose={() => { setShowForm(false); setExtending(null); }}
        onCreated={refetch}
      />

      <BloquearFechasForm
        open={showBloqueo}
        onClose={() => setShowBloqueo(false)}
        onCreated={refetch}
      />

      <ValidarPagoForm
        open={!!validating}
        reserva={validating}
        onClose={() => setValidating(null)}
        onUpdated={refetch}
      />

      <EditarReservaForm
        open={!!editing}
        reserva={editing}
        onClose={() => setEditing(null)}
        onUpdated={refetch}
        onExtender={(r) => { setEditing(null); setExtending(r); }}
      />
    </>
  );
}

function PagoPendienteBadge() {
  return (
    <span
      style={{
        background: 'rgba(181,134,11,0.20)',
        color: T.gold,
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        whiteSpace: 'nowrap',
      }}
    >
      ⏱ Pago a validar
    </span>
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

const btnBloquear = {
  ...btnNueva,
  background: 'transparent',
  color: T.muted,
  border: `1px solid ${T.border}`,
};

const btnEdit = {
  background: 'transparent',
  color: T.muted,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  width: 30,
  height: 30,
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'DM Sans', sans-serif",
};
