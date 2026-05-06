import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import { formatMoney, normalizePhone } from '../lib/format';
import Modal from '../components/Modal';
import { useChalets } from '../hooks/useChalets';
import { useRol } from '../hooks/useRol';
import { useAuth } from '../hooks/useAuth';

const ORIGENES_HUESPED = [
  { value: 'website', label: 'Sitio web' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'booking', label: 'Booking' },
  { value: 'referido', label: 'Referido' },
  { value: 'whatsapp_directo', label: 'WhatsApp directo' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'otro', label: 'Otro' },
];

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

const INITIAL = {
  phone: '', nombre: '', apellidos: '', email: '', origenInicial: 'directa',
  chaletId: '', fechaEntrada: '', fechaSalida: '', numHuespedes: 2,
  notas: '', estado: 'pendiente_pago',
};

export default function NuevaReservaForm({ open, onClose, onCreated }) {
  const { data: chalets } = useChalets();
  const { isAdmin } = useRol();
  const { user } = useAuth();

  const [form, setForm] = useState(INITIAL);
  const [huespedFound, setHuespedFound] = useState(null);
  const [calculo, setCalculo] = useState(null);
  const [calculoError, setCalculoError] = useState(null);
  const [solape, setSolape] = useState({ blocking: false, warning: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Reset al abrir.
  useEffect(() => {
    if (open) {
      const defaultEstado = isAdmin ? 'pendiente_pago' : 'pendiente_pago';
      setForm({ ...INITIAL, estado: defaultEstado });
      setHuespedFound(null); setCalculo(null); setCalculoError(null);
      setSolape({ blocking: false, warning: false }); setSubmitError(null);
    }
  }, [open, isAdmin]);

  // Buscar huesped por telefono.
  useEffect(() => {
    const tel = normalizePhone(form.phone);
    if (tel.length < 10) { setHuespedFound(null); return; }
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from('huespedes').select('*').eq('telefono', tel).limit(1);
      if (cancelled) return;
      const found = rows?.[0] ?? null;
      setHuespedFound(found);
      if (found) set({
        nombre: found.nombre ?? '',
        apellidos: found.apellidos ?? '',
        email: found.email ?? '',
      });
    })();
    return () => { cancelled = true; };
  }, [form.phone]);

  // Calculo de estadia.
  useEffect(() => {
    const { chaletId, fechaEntrada, fechaSalida } = form;
    if (!chaletId || !fechaEntrada || !fechaSalida) { setCalculo(null); setCalculoError(null); return; }
    if (new Date(fechaSalida) <= new Date(fechaEntrada)) {
      setCalculo(null); setCalculoError('La salida debe ser posterior a la entrada.'); return;
    }
    setCalculoError(null);
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('calcular_estadia', {
        p_chalet_id: chaletId,
        p_fecha_entrada: fechaEntrada,
        p_fecha_salida: fechaSalida,
      });
      if (cancelled) return;
      if (error) { setCalculoError(error.message); setCalculo(null); }
      else setCalculo(data);
    })();
    return () => { cancelled = true; };
  }, [form.chaletId, form.fechaEntrada, form.fechaSalida]);

  // Disponibilidad.
  useEffect(() => {
    const { chaletId, fechaEntrada, fechaSalida } = form;
    if (!chaletId || !fechaEntrada || !fechaSalida) { setSolape({ blocking: false, warning: false }); return; }
    if (new Date(fechaSalida) <= new Date(fechaEntrada)) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('reservas').select('id, estado')
        .eq('chalet_id', chaletId)
        .lt('fecha_entrada', fechaSalida)
        .gt('fecha_salida', fechaEntrada);
      if (cancelled || error) return;
      const blocking = (data ?? []).some((r) => ['confirmada', 'en_curso'].includes(r.estado));
      const warning = !blocking && (data ?? []).some((r) => r.estado === 'pendiente_pago');
      setSolape({ blocking, warning });
    })();
    return () => { cancelled = true; };
  }, [form.chaletId, form.fechaEntrada, form.fechaSalida]);

  const valid =
    !!form.nombre.trim() && normalizePhone(form.phone).length >= 10 &&
    !!form.chaletId && !!form.fechaEntrada && !!form.fechaSalida &&
    !!calculo && !calculoError && !solape.blocking;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true); setSubmitError(null);
    try {
      const tel = normalizePhone(form.phone);
      let huespedId = huespedFound?.id;
      if (!huespedId) {
        const { data: newH, error: hErr } = await supabase.from('huespedes').insert({
          nombre: form.nombre.trim(),
          apellidos: form.apellidos.trim() || null,
          telefono: tel,
          email: form.email.trim() || null,
          origen_inicial: form.origenInicial,
        }).select('id').single();
        if (hErr) throw hErr;
        huespedId = newH.id;
      }
      const { error: rErr } = await supabase.from('reservas').insert({
        huesped_id: huespedId,
        chalet_id: form.chaletId,
        fecha_entrada: form.fechaEntrada,
        fecha_salida: form.fechaSalida,
        num_huespedes: Number(form.numHuespedes) || 2,
        subtotal_neto: calculo.subtotal_neto,
        iva: calculo.iva,
        impuesto_hospedaje: calculo.impuesto_hospedaje,
        monto_total: calculo.total,
        estado: form.estado,
        origen: 'app_manual',
        notas: form.notas.trim() || null,
        creada_por: user?.id ?? null,
      });
      if (rErr) throw rErr;
      onCreated?.();
      onClose?.();
    } catch (err) {
      setSubmitError(err.message ?? 'Error al crear la reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva reserva" maxWidth={580}>
      <form onSubmit={handleSubmit}>
        {/* Huesped */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Teléfono WhatsApp (con lada)</label>
          <input style={inputStyle} type="tel" placeholder="5213335702682"
                 value={form.phone} onChange={(e) => set({ phone: e.target.value })} required />
          {huespedFound && (
            <div style={{ fontSize: 11, color: T.green, marginTop: 4 }}>
              Huésped existente: {huespedFound.total_estancias} estancia(s) previa(s).
            </div>
          )}
        </div>

        <div style={rowStyle}>
          <div style={{ ...fieldStyle, flex: 1, minWidth: 180 }}>
            <label style={labelStyle}>Nombre</label>
            <input style={inputStyle} value={form.nombre}
                   onChange={(e) => set({ nombre: e.target.value })} required />
          </div>
          <div style={{ ...fieldStyle, flex: 1, minWidth: 180 }}>
            <label style={labelStyle}>Apellidos</label>
            <input style={inputStyle} value={form.apellidos}
                   onChange={(e) => set({ apellidos: e.target.value })} />
          </div>
        </div>

        <div style={rowStyle}>
          <div style={{ ...fieldStyle, flex: 1, minWidth: 180 }}>
            <label style={labelStyle}>Email (opcional)</label>
            <input style={inputStyle} type="email" value={form.email}
                   onChange={(e) => set({ email: e.target.value })} />
          </div>
          {!huespedFound && (
            <div style={{ ...fieldStyle, flex: 1, minWidth: 180 }}>
              <label style={labelStyle}>Origen del huésped</label>
              <select style={inputStyle} value={form.origenInicial}
                      onChange={(e) => set({ origenInicial: e.target.value })}>
                {ORIGENES_HUESPED.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Reserva */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Chalet</label>
          <select style={inputStyle} value={form.chaletId}
                  onChange={(e) => set({ chaletId: e.target.value })} required>
            <option value="">— Selecciona —</option>
            {chalets.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div style={rowStyle}>
          <div style={{ ...fieldStyle, flex: 1, minWidth: 140 }}>
            <label style={labelStyle}>Entrada</label>
            <input style={inputStyle} type="date" value={form.fechaEntrada}
                   onChange={(e) => set({ fechaEntrada: e.target.value })} required />
          </div>
          <div style={{ ...fieldStyle, flex: 1, minWidth: 140 }}>
            <label style={labelStyle}>Salida</label>
            <input style={inputStyle} type="date" value={form.fechaSalida}
                   onChange={(e) => set({ fechaSalida: e.target.value })} required />
          </div>
          <div style={{ ...fieldStyle, width: 100 }}>
            <label style={labelStyle}># Huéspedes</label>
            <input style={inputStyle} type="number" min={1} max={10} value={form.numHuespedes}
                   onChange={(e) => set({ numHuespedes: e.target.value })} />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Notas (opcional)</label>
          <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }}
                    value={form.notas} onChange={(e) => set({ notas: e.target.value })} />
        </div>

        {/* Estado al crear */}
        {isAdmin && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Estado al crear</label>
            <select style={inputStyle} value={form.estado}
                    onChange={(e) => set({ estado: e.target.value })}>
              <option value="pendiente_pago">Pendiente de pago</option>
              <option value="confirmada">Confirmada</option>
            </select>
          </div>
        )}

        {/* Cálculo */}
        <Breakdown calculo={calculo} error={calculoError} />

        {/* Disponibilidad */}
        {solape.blocking && (
          <div style={{ color: T.red, fontSize: 12, margin: '8px 0' }}>
            Fechas no disponibles: ya hay una reserva confirmada o en curso en este chalet.
          </div>
        )}
        {solape.warning && (
          <div style={{ color: T.goldLight, fontSize: 12, margin: '8px 0' }}>
            Hay otra reserva pendiente de pago en estas fechas. Confirma con el huésped antes de proceder.
          </div>
        )}

        {submitError && (
          <div style={{ color: T.red, fontSize: 12, margin: '8px 0' }}>{submitError}</div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" onClick={onClose}
                  style={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={!valid || submitting}
                  style={{ ...btnPrimary, opacity: !valid || submitting ? 0.5 : 1, cursor: !valid || submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Guardando…' : 'Guardar reserva'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Breakdown({ calculo, error }) {
  if (error) return <div style={{ color: T.red, fontSize: 12, margin: '8px 0' }}>{error}</div>;
  if (!calculo) return null;
  return (
    <div style={{
      background: T.dark, border: `1px solid ${T.border}`, borderRadius: 8,
      padding: '12px 14px', margin: '14px 0', fontSize: 13, fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: T.muted, marginBottom: 6 }}>
        <span>{calculo.noches} noche{calculo.noches !== 1 ? 's' : ''} · {calculo.tarifa_aplicada}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span>Subtotal</span><span>{formatMoney(calculo.subtotal_neto)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: T.muted }}>
        <span>IVA ({calculo.iva_pct}%)</span><span>{formatMoney(calculo.iva)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: T.muted }}>
        <span>Hospedaje ({calculo.impuesto_hospedaje_pct}%)</span><span>{formatMoney(calculo.impuesto_hospedaje)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${T.border}`, paddingTop: 8, color: T.goldLight, fontWeight: 600 }}>
        <span>Total</span><span>{formatMoney(calculo.total)}</span>
      </div>
    </div>
  );
}

const btnPrimary = {
  background: T.gold, color: T.dark, border: 'none', borderRadius: 8,
  padding: '10px 16px', fontSize: 13, fontWeight: 600, letterSpacing: 1,
  textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif",
};

const btnSecondary = {
  background: 'transparent', color: T.muted, border: `1px solid ${T.border}`,
  borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 500,
  letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};
