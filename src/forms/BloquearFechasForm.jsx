import { useEffect, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import Modal from '../components/Modal';
import RangeCalendar from '../components/RangeCalendar';
import { useChalets } from '../hooks/useChalets';
import { useAuth } from '../hooks/useAuth';

// Los bloqueos se guardan como reservas origen='bloqueo' a nombre del
// huésped de sistema (disponibilidad, iCal y calendario los respetan solos).
const TELEFONO_SISTEMA = '0000000000';
const ESTADOS_ACTIVOS = ['cotizada', 'pendiente_pago', 'confirmada', 'en_curso'];
const TODOS = 'todos';

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

const INITIAL = { chaletId: '', fechaEntrada: '', fechaSalida: '', motivo: '' };

export default function BloquearFechasForm({ open, onClose, onCreated }) {
  const { data: chalets } = useChalets();
  const { user } = useAuth();

  const [form, setForm] = useState(INITIAL);
  const [occupied, setOccupied] = useState(() => new Set());
  const [conflictos, setConflictos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setConflictos([]);
      setSubmitError(null);
    }
  }, [open]);

  // Noches ocupadas para el calendario: del chalet elegido, o la unión de
  // todos los chalets cuando el bloqueo es general.
  useEffect(() => {
    if (!form.chaletId) { setOccupied(new Set()); return; }
    let cancelled = false;
    (async () => {
      const hoy = format(new Date(), 'yyyy-MM-dd');
      let query = supabase
        .from('reservas')
        .select('fecha_entrada, fecha_salida')
        .in('estado', ESTADOS_ACTIVOS)
        .gt('fecha_salida', hoy);
      if (form.chaletId !== TODOS) query = query.eq('chalet_id', form.chaletId);
      const { data, error } = await query;
      if (cancelled) return;
      const nights = new Set();
      if (!error) {
        for (const r of data ?? []) {
          let d = parseISO(r.fecha_entrada);
          const fin = parseISO(r.fecha_salida);
          while (d < fin) {
            nights.add(format(d, 'yyyy-MM-dd'));
            d = addDays(d, 1);
          }
        }
      }
      setOccupied(nights);
    })();
    return () => { cancelled = true; };
  }, [form.chaletId, open]);

  // Traslapes con reservas activas en el rango elegido (mismo criterio que
  // usa disponibilidad). Con "todos", reporta cada chalet en conflicto.
  useEffect(() => {
    const { chaletId, fechaEntrada, fechaSalida } = form;
    if (!chaletId || !fechaEntrada || !fechaSalida) { setConflictos([]); return; }
    if (new Date(fechaSalida) <= new Date(fechaEntrada)) { setConflictos([]); return; }
    let cancelled = false;
    (async () => {
      let query = supabase
        .from('reservas')
        .select('id, estado, chalet_id')
        .lt('fecha_entrada', fechaSalida)
        .gt('fecha_salida', fechaEntrada)
        .in('estado', ESTADOS_ACTIVOS);
      if (chaletId !== TODOS) query = query.eq('chalet_id', chaletId);
      const { data, error } = await query;
      if (cancelled || error) return;
      const ids = [...new Set((data ?? []).map((r) => r.chalet_id))];
      setConflictos(ids);
    })();
    return () => { cancelled = true; };
  }, [form.chaletId, form.fechaEntrada, form.fechaSalida]);

  const nombresConflicto = conflictos
    .map((id) => chalets.find((c) => c.id === id)?.nombre ?? 'chalet')
    .join(', ');

  const valid =
    !!form.chaletId && !!form.fechaEntrada && !!form.fechaSalida &&
    new Date(form.fechaSalida) > new Date(form.fechaEntrada) &&
    !!form.motivo.trim() && conflictos.length === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data: hs, error: hErr } = await supabase
        .from('huespedes').select('id').eq('telefono', TELEFONO_SISTEMA).limit(1);
      if (hErr) throw hErr;
      const huespedSistema = hs?.[0];
      if (!huespedSistema) {
        throw new Error('No existe el huésped de sistema "Bloqueo Operativo". Pide a un admin crearlo.');
      }

      const targets = form.chaletId === TODOS ? chalets.map((c) => c.id) : [form.chaletId];
      const rows = targets.map((chaletId) => ({
        huesped_id: huespedSistema.id,
        chalet_id: chaletId,
        fecha_entrada: form.fechaEntrada,
        fecha_salida: form.fechaSalida,
        num_huespedes: 1,
        subtotal_neto: 0,
        iva: 0,
        impuesto_hospedaje: 0,
        monto_total: 0,
        estado: 'confirmada',
        origen: 'bloqueo',
        notas: form.motivo.trim(),
        creada_por: user?.id ?? null,
      }));

      const { error: rErr } = await supabase.from('reservas').insert(rows);
      if (rErr) throw rErr;

      onCreated?.();
      onClose?.();
    } catch (err) {
      setSubmitError(err.message ?? 'Error al crear el bloqueo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Bloquear fechas" maxWidth={520}
           dismissOnBackdrop={false} dismissOnEscape={false}>
      <form onSubmit={handleSubmit}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 14, lineHeight: 1.5 }}>
          El bloqueo aparta el chalet sin datos de huésped ni pago (limpieza,
          mantenimiento, uso interno). Se propaga a Beds24/Airbnb y se libera
          cancelándolo.
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Chalet</label>
          <select style={inputStyle} value={form.chaletId}
                  onChange={(e) => set({ chaletId: e.target.value })} required>
            <option value="">— Selecciona —</option>
            <option value={TODOS}>Todos los chalets</option>
            {chalets.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          {form.chaletId === TODOS && (
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
              Se crea un bloqueo por chalet ({chalets.length} en total).
            </div>
          )}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>
            Fechas {form.chaletId ? '(noches ocupadas tachadas en rojo)' : '— selecciona chalet primero'}
          </label>
          <RangeCalendar
            entrada={form.fechaEntrada}
            salida={form.fechaSalida}
            occupied={occupied}
            disabled={!form.chaletId}
            onChange={({ entrada, salida }) => set({ fechaEntrada: entrada, fechaSalida: salida })}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Motivo del bloqueo</label>
          <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }}
                    placeholder="Ej. limpieza profunda, mantenimiento de jacuzzi…"
                    value={form.motivo}
                    onChange={(e) => set({ motivo: e.target.value })} required />
        </div>

        {conflictos.length > 0 && (
          <div style={{ color: T.red, fontSize: 12, margin: '8px 0' }}>
            Traslape con reservas activas en: {nombresConflicto}. Ajusta las fechas
            {form.chaletId === TODOS ? ' o bloquea chalet por chalet.' : '.'}
          </div>
        )}

        {submitError && (
          <div style={{ color: T.red, fontSize: 12, margin: '8px 0' }}>{submitError}</div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={!valid || submitting}
                  style={{ ...btnPrimary, opacity: !valid || submitting ? 0.5 : 1, cursor: !valid || submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Bloqueando…' : 'Bloquear fechas'}
          </button>
        </div>
      </form>
    </Modal>
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
