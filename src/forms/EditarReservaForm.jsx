import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import { formatMoney } from '../lib/format';
import Modal from '../components/Modal';
import { useRol } from '../hooks/useRol';

const ESTADOS_EDIT = [
  { value: 'cotizada', label: 'Cotizada' },
  { value: 'pendiente_pago', label: 'Pendiente de pago' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'en_curso', label: 'En curso' },
  { value: 'completada', label: 'Completada' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'no_show', label: 'No-show' },
];

export default function EditarReservaForm({ open, reserva, onClose, onUpdated }) {
  const { isAdmin, isSuperAdmin } = useRol();

  const [fechaEntrada, setFechaEntrada] = useState('');
  const [fechaSalida, setFechaSalida] = useState('');
  const [numHuespedes, setNumHuespedes] = useState(2);
  const [notas, setNotas] = useState('');
  const [estado, setEstado] = useState('pendiente_pago');

  const [calculo, setCalculo] = useState(null);
  const [calculoError, setCalculoError] = useState(null);
  const [solapeBlocking, setSolapeBlocking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !reserva) return;
    setFechaEntrada(reserva.fecha_entrada ?? '');
    setFechaSalida(reserva.fecha_salida ?? '');
    setNumHuespedes(reserva.num_huespedes ?? 2);
    setNotas(reserva.notas ?? '');
    setEstado(reserva.estado ?? 'pendiente_pago');
    setCalculo(null);
    setCalculoError(null);
    setSolapeBlocking(false);
    setSubmitError(null);
    setConfirmDelete(false);
  }, [open, reserva]);

  const fechasCambiadas =
    !!reserva && (fechaEntrada !== reserva.fecha_entrada || fechaSalida !== reserva.fecha_salida);

  // Recalcular si cambian fechas
  useEffect(() => {
    if (!open || !reserva) return;
    if (!fechasCambiadas) {
      setCalculo(null);
      setCalculoError(null);
      return;
    }
    if (!fechaEntrada || !fechaSalida) return;
    if (new Date(fechaSalida) <= new Date(fechaEntrada)) {
      setCalculo(null);
      setCalculoError('La salida debe ser posterior a la entrada.');
      return;
    }
    setCalculoError(null);
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('calcular_estadia', {
        p_chalet_id: reserva.chalet_id,
        p_fecha_entrada: fechaEntrada,
        p_fecha_salida: fechaSalida,
      });
      if (cancelled) return;
      if (error) {
        setCalculoError(error.message);
        setCalculo(null);
      } else {
        setCalculo(data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reserva, fechaEntrada, fechaSalida, fechasCambiadas]);

  // Disponibilidad excluyendo la reserva actual
  useEffect(() => {
    if (!open || !reserva) return;
    if (!fechasCambiadas) {
      setSolapeBlocking(false);
      return;
    }
    if (!fechaEntrada || !fechaSalida) return;
    if (new Date(fechaSalida) <= new Date(fechaEntrada)) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('reservas')
        .select('id, estado')
        .eq('chalet_id', reserva.chalet_id)
        .neq('id', reserva.id)
        .lt('fecha_entrada', fechaSalida)
        .gt('fecha_salida', fechaEntrada);
      if (cancelled || error) return;
      const ACTIVE = ['cotizada', 'pendiente_pago', 'confirmada', 'en_curso'];
      setSolapeBlocking((data ?? []).some((r) => ACTIVE.includes(r.estado)));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reserva, fechaEntrada, fechaSalida, fechasCambiadas]);

  if (!reserva) return null;

  const fullName =
    [reserva.huesped?.nombre, reserva.huesped?.apellidos].filter(Boolean).join(' ').trim() ||
    'Sin nombre';

  const valid =
    !!fechaEntrada &&
    !!fechaSalida &&
    !calculoError &&
    !solapeBlocking &&
    (!fechasCambiadas || !!calculo);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await supabase.from('reservas').delete().eq('id', reserva.id);
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    onUpdated?.();
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const update = {
        fecha_entrada: fechaEntrada,
        fecha_salida: fechaSalida,
        num_huespedes: Number(numHuespedes) || 2,
        notas: notas.trim() || null,
        estado,
      };
      if (fechasCambiadas && calculo) {
        update.subtotal_neto = calculo.subtotal_neto;
        update.iva = calculo.iva;
        update.impuesto_hospedaje = calculo.impuesto_hospedaje;
        update.monto_total = calculo.total;
      }
      const { error } = await supabase.from('reservas').update(update).eq('id', reserva.id);
      if (error) throw error;
      onUpdated?.();
      onClose?.();
    } catch (err) {
      setSubmitError(err.message ?? 'Error al actualizar la reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar reserva" maxWidth={560}>
      <form onSubmit={handleSubmit}>
        <div style={summaryStyle}>
          <Row label="Huésped" value={fullName} />
          <Row label="Chalet" value={reserva.chalet?.nombre ?? '—'} />
        </div>

        <div style={rowStyle}>
          <div style={{ ...fieldStyle, flex: 1, minWidth: 140 }}>
            <label style={labelStyle}>Entrada</label>
            <input
              style={inputStyle}
              type="date"
              value={fechaEntrada}
              onChange={(e) => setFechaEntrada(e.target.value)}
              required
            />
          </div>
          <div style={{ ...fieldStyle, flex: 1, minWidth: 140 }}>
            <label style={labelStyle}>Salida</label>
            <input
              style={inputStyle}
              type="date"
              value={fechaSalida}
              onChange={(e) => setFechaSalida(e.target.value)}
              required
            />
          </div>
          <div style={{ ...fieldStyle, width: 100 }}>
            <label style={labelStyle}># Huéspedes</label>
            <input
              style={inputStyle}
              type="number"
              min={1}
              max={10}
              value={numHuespedes}
              onChange={(e) => setNumHuespedes(e.target.value)}
            />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Notas</label>
          <textarea
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        {isAdmin && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Estado</label>
            <select
              style={inputStyle}
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              {ESTADOS_EDIT.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {fechasCambiadas && calculo && (
          <Breakdown calculo={calculo} />
        )}
        {calculoError && (
          <div style={{ color: T.red, fontSize: 12, margin: '8px 0' }}>{calculoError}</div>
        )}
        {solapeBlocking && (
          <div style={{ color: T.red, fontSize: 12, margin: '8px 0' }}>
            Fechas no disponibles: ya hay otra reserva activa en este chalet en el rango.
          </div>
        )}
        {submitError && (
          <div style={{ color: T.red, fontSize: 12, margin: '8px 0' }}>{submitError}</div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 18,
            flexWrap: 'wrap',
          }}
        >
          {isSuperAdmin ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              style={{
                ...btnDanger,
                opacity: submitting ? 0.5 : 1,
                cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              {confirmDelete ? '¿Confirmar borrado?' : 'Eliminar reserva'}
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={btnSecondary}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!valid || submitting}
              style={{
                ...btnPrimary,
                opacity: !valid || submitting ? 0.5 : 1,
                cursor: !valid || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ color: T.muted, fontSize: 12 }}>{label}</span>
      <span style={{ color: T.text, fontSize: 13, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function Breakdown({ calculo }) {
  return (
    <div
      style={{
        background: T.dark,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: '12px 14px',
        margin: '14px 0',
        fontSize: 13,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{ color: T.muted, fontSize: 11, marginBottom: 8 }}>
        Nuevo desglose ({calculo.noches} noche{calculo.noches !== 1 ? 's' : ''})
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span>Subtotal</span>
        <span>{formatMoney(calculo.subtotal_neto)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: T.muted }}>
        <span>IVA ({calculo.iva_pct}%)</span>
        <span>{formatMoney(calculo.iva)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: T.muted }}>
        <span>Hospedaje ({calculo.impuesto_hospedaje_pct}%)</span>
        <span>{formatMoney(calculo.impuesto_hospedaje)}</span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: `1px solid ${T.border}`,
          paddingTop: 8,
          color: T.goldLight,
          fontWeight: 600,
        }}
      >
        <span>Total</span>
        <span>{formatMoney(calculo.total)}</span>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: T.dark,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '10px 12px',
  color: T.text,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'DM Sans', sans-serif",
};

const labelStyle = {
  fontSize: 11,
  color: T.muted,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 6,
  fontFamily: "'DM Sans', sans-serif",
};

const fieldStyle = { marginBottom: 14 };
const rowStyle = { display: 'flex', gap: 10, flexWrap: 'wrap' };

const summaryStyle = {
  background: T.dark,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '6px 14px',
  marginBottom: 14,
  fontFamily: "'DM Sans', sans-serif",
};

const btnPrimary = {
  background: T.gold,
  color: T.dark,
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  fontFamily: "'DM Sans', sans-serif",
};

const btnSecondary = {
  background: 'transparent',
  color: T.muted,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: 1,
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};

const btnDanger = {
  background: 'rgba(199,80,80,0.12)',
  color: T.red,
  border: `1px solid rgba(199,80,80,0.3)`,
  borderRadius: 8,
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  fontFamily: "'DM Sans', sans-serif",
};
