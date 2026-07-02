import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import { formatMoney, formatDateShort, normalizePhone } from '../lib/format';
import Modal from '../components/Modal';
import RangeCalendar from '../components/RangeCalendar';
import PagosDraftEditor, { FORMAS_PAGO } from '../components/PagosDraftEditor';
import { useChalets } from '../hooks/useChalets';
import { useRol } from '../hooks/useRol';
import { useAuth } from '../hooks/useAuth';
import { useOrigenes } from '../hooks/useOrigenes';
import { useOcupacion } from '../hooks/useOcupacion';
import { useConfig } from '../hooks/useConfig';
import { useReservas } from '../hooks/useReservas';

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
  phone: '', nombre: '', apellidos: '', email: '', origenInicial: 'whatsapp_directo',
  chaletId: '', fechaEntrada: '', fechaSalida: '', numHuespedes: 2,
  notas: '', estado: 'pendiente_pago', origenReserva: 'referido',
  montoManual: '', vendedor: '',
  reservaOrigenId: '', formaPagoExt: '', pagoEfectivoCompleto: false, pagos: [],
};

// reservaAExtender: si viene, el form abre directo en modo extensión
// prellenado con esa estancia (botón "Extender reservación" de Editar reserva).
export default function NuevaReservaForm({ open, onClose, onCreated, reservaAExtender }) {
  const { data: chalets } = useChalets();
  const { isAdmin } = useRol();
  const { user } = useAuth();
  const { data: origenes } = useOrigenes();
  const { data: config } = useConfig();
  const { data: reservasEnCurso, refetch: refetchEnCurso } = useReservas({ estado: 'en_curso' });

  const [form, setForm] = useState(INITIAL);
  const [huespedFound, setHuespedFound] = useState(null);
  const [calculo, setCalculo] = useState(null);
  const [calculoError, setCalculoError] = useState(null);
  const [solape, setSolape] = useState({ blocking: false, warning: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const descExtPct = Number(config.descuento_extension_pct ?? 15);
  const descEfPct = Number(config.descuento_efectivo_pct ?? 10);

  const origenesVisibles = origenes.filter((o) => isAdmin || !o.solo_admin);
  const origenSel = origenes.find((o) => o.clave === form.origenReserva);
  const precioArbitrario = origenSel?.aplica_precio === 'arbitrario';
  const esExtension = form.origenReserva === 'extension';
  const esComisionable = form.origenReserva === 'referido' || esExtension;
  const { occupied } = useOcupacion(form.chaletId);

  // Reset al abrir (+ refrescar reservas en curso para el selector de extensión).
  // Si viene reservaAExtender, arranca prellenado en modo extensión.
  useEffect(() => {
    if (open) {
      if (reservaAExtender) {
        setForm({
          ...INITIAL,
          origenReserva: 'extension',
          reservaOrigenId: reservaAExtender.id,
          chaletId: reservaAExtender.chalet_id ?? reservaAExtender.chalet?.id ?? '',
          fechaEntrada: reservaAExtender.fecha_salida ?? '',
          phone: reservaAExtender.huesped?.telefono ?? '',
          numHuespedes: reservaAExtender.num_huespedes ?? 2,
        });
      } else {
        setForm({ ...INITIAL });
      }
      setHuespedFound(null); setCalculo(null); setCalculoError(null);
      setSolape({ blocking: false, warning: false }); setSubmitError(null);
      refetchEnCurso();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservaAExtender]);

  // Opciones del selector de extensión: garantiza que la estancia prellenada
  // aparezca aunque el fetch de en_curso aún no la traiga.
  const opcionesExtension = reservaAExtender &&
    !reservasEnCurso.some((r) => r.id === reservaAExtender.id)
    ? [reservaAExtender, ...reservasEnCurso]
    : reservasEnCurso;

  // Si el origen actual no es visible para este rol, caer al primero visible.
  useEffect(() => {
    if (!origenesVisibles.length) return;
    if (!origenesVisibles.some((o) => o.clave === form.origenReserva)) {
      set({ origenReserva: origenesVisibles[0].clave });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origenesVisibles.length, form.origenReserva]);

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

  // Disponibilidad (backstop del calendario).
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
      const ACTIVE = ['cotizada', 'pendiente_pago', 'confirmada', 'en_curso'];
      const blocking = (data ?? []).some((r) => ACTIVE.includes(r.estado));
      setSolape({ blocking, warning: false });
    })();
    return () => { cancelled = true; };
  }, [form.chaletId, form.fechaEntrada, form.fechaSalida]);

  // Cambiar de origen limpia lo específico del origen anterior.
  const onOrigenChange = (clave) => {
    set({
      origenReserva: clave,
      reservaOrigenId: '', formaPagoExt: '', pagoEfectivoCompleto: false,
      pagos: [], montoManual: '', vendedor: '',
      estado: 'pendiente_pago',
    });
  };

  // Extensión: elegir la reserva en curso fija chalet, entrada y huésped.
  const onSelectReservaOrigen = (id) => {
    const r = opcionesExtension.find((x) => x.id === id);
    set({
      reservaOrigenId: id,
      chaletId: r?.chalet_id ?? r?.chalet?.id ?? '',
      fechaEntrada: r?.fecha_salida ?? '',
      fechaSalida: '',
      phone: r?.huesped?.telefono ?? '',
      numHuespedes: r?.num_huespedes ?? 2,
    });
  };

  // ── Totales con descuentos ──
  const montoManualNum = form.montoManual === '' ? null : Number(form.montoManual);
  const totalCalculado = precioArbitrario
    ? montoManualNum
    : (calculo ? Number(calculo.total) : null);

  const pagoUnicoEfectivo = esExtension
    ? form.formaPagoExt === 'efectivo'
    : form.pagoEfectivoCompleto;
  const aplicaDescEf = !precioArbitrario && pagoUnicoEfectivo;
  const hayDescuento = (esExtension || aplicaDescEf) && !precioArbitrario;

  let totalFinal = totalCalculado;
  if (totalFinal != null && !precioArbitrario) {
    if (esExtension) totalFinal *= 1 - descExtPct / 100;
    if (aplicaDescEf) totalFinal *= 1 - descEfPct / 100;
    if (hayDescuento) totalFinal = Math.round(totalFinal);
  }

  // ── Pagos efectivos según el modo ──
  const pagosEfectivos = esExtension
    ? (form.formaPagoExt && totalFinal != null
        ? [{ forma: form.formaPagoExt, monto: totalFinal }] : [])
    : form.pagoEfectivoCompleto && totalFinal != null
      ? [{ forma: 'efectivo', monto: totalFinal }]
      : form.pagos;

  const sumaPagos = pagosEfectivos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const pagosValidos = pagosEfectivos.every((p) => p.forma && Number(p.monto) > 0);
  const pagosOk = esExtension
    ? pagosEfectivos.length === 1 && pagosValidos
    : pagosEfectivos.length === 0 ||
      (pagosValidos && (totalFinal == null || sumaPagos <= totalFinal + 0.009));

  const montoOk = precioArbitrario
    ? montoManualNum !== null && Number.isFinite(montoManualNum) && montoManualNum >= 0
    : !!calculo && !calculoError;

  const estadoFinal = esExtension || form.pagoEfectivoCompleto ? 'confirmada' : form.estado;

  const valid =
    !!form.nombre.trim() && normalizePhone(form.phone).length >= 10 &&
    !!form.chaletId && !!form.fechaEntrada && !!form.fechaSalida &&
    montoOk && pagosOk && !solape.blocking &&
    (!esComisionable || !!form.vendedor.trim()) &&
    (!esExtension || !!form.reservaOrigenId);

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

      // Desglose proporcional al descuento: sub+iva+ish siguen sumando el total.
      let sub = 0; let iva = 0; let imp = 0;
      if (!precioArbitrario && calculo) {
        const factor = hayDescuento ? totalFinal / Number(calculo.total || 1) : 1;
        sub = round2(calculo.subtotal_neto * factor);
        iva = round2(calculo.iva * factor);
        imp = round2(calculo.impuesto_hospedaje * factor);
      }

      const etiquetas = [];
      if (esExtension) etiquetas.push(`Extensión −${descExtPct}%`);
      if (aplicaDescEf) etiquetas.push(`Pago en efectivo −${descEfPct}%`);
      const notas = [form.notas.trim(), etiquetas.length ? `[${etiquetas.join(' · ')}]` : '']
        .filter(Boolean).join(' ');

      const { data: nuevaReserva, error: rErr } = await supabase.from('reservas').insert({
        huesped_id: huespedId,
        chalet_id: form.chaletId,
        fecha_entrada: form.fechaEntrada,
        fecha_salida: form.fechaSalida,
        num_huespedes: Number(form.numHuespedes) || 2,
        subtotal_neto: sub,
        iva,
        impuesto_hospedaje: imp,
        monto_total: totalFinal ?? 0,
        estado: estadoFinal,
        origen: form.origenReserva,
        vendedor: esComisionable ? form.vendedor.trim() : null,
        continuacion_de_reserva_id: esExtension ? form.reservaOrigenId : null,
        notas: notas || null,
        creada_por: user?.id ?? null,
      }).select('id').single();
      if (rErr) throw rErr;

      // Registrar los pagos en el ledger (el trigger actualiza monto_pagado).
      if (pagosEfectivos.length > 0) {
        const { error: pErr } = await supabase.from('pagos').insert(
          pagosEfectivos.map((p) => ({
            reserva_id: nuevaReserva.id,
            forma_pago: p.forma,
            monto: Number(p.monto),
            registrado_por: user?.id ?? null,
          })),
        );
        if (pErr) {
          setSubmitError(
            `La reserva se creó, pero los pagos no se registraron: ${pErr.message}. Regístralos desde Editar reserva.`,
          );
          onCreated?.();
          setSubmitting(false);
          return;
        }
      }
      onCreated?.();
      onClose?.();
    } catch (err) {
      setSubmitError(err.message ?? 'Error al crear la reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={reservaAExtender ? 'Extender reservación' : 'Nueva reserva'} maxWidth={580} dismissOnBackdrop={false} dismissOnEscape={false}>
      <form onSubmit={handleSubmit}>
        {/* Origen primero: define el flujo completo */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Origen de la reserva</label>
          <select style={inputStyle} value={form.origenReserva}
                  onChange={(e) => onOrigenChange(e.target.value)}>
            {origenesVisibles.map((o) => (
              <option key={o.clave} value={o.clave}>{o.etiqueta_es}</option>
            ))}
          </select>
        </div>

        {esExtension && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Reserva a extender (huésped en curso)</label>
            <select style={inputStyle} value={form.reservaOrigenId}
                    onChange={(e) => onSelectReservaOrigen(e.target.value)} required>
              <option value="">— Selecciona la estancia en curso —</option>
              {opcionesExtension.map((r) => (
                <option key={r.id} value={r.id}>
                  {[r.huesped?.nombre, r.huesped?.apellidos].filter(Boolean).join(' ') || 'Huésped'}
                  {' · '}{r.chalet?.nombre ?? ''}
                  {' · sale '}{formatDateShort(r.fecha_salida)}
                </option>
              ))}
            </select>
            {opcionesExtension.length === 0 && (
              <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
                No hay estancias en curso en este momento.
              </div>
            )}
          </div>
        )}

        {esComisionable && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Vendedor que refirió / vendió</label>
            <input style={inputStyle} placeholder="Nombre del vendedor"
                   value={form.vendedor}
                   onChange={(e) => set({ vendedor: e.target.value })} required />
          </div>
        )}

        {/* Huesped */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Teléfono WhatsApp (con lada)</label>
          <input style={inputStyle} type="tel" placeholder="5213335702682"
                 value={form.phone} onChange={(e) => set({ phone: e.target.value })}
                 readOnly={esExtension} required />
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
        <div style={rowStyle}>
          <div style={{ ...fieldStyle, flex: 1, minWidth: 180 }}>
            <label style={labelStyle}>Chalet{esExtension ? ' (el de la estancia en curso)' : ''}</label>
            <select style={inputStyle} value={form.chaletId} disabled={esExtension}
                    onChange={(e) => set({ chaletId: e.target.value })} required>
              <option value="">— Selecciona —</option>
              {chalets.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div style={{ ...fieldStyle, width: 100 }}>
            <label style={labelStyle}># Huéspedes</label>
            <input style={inputStyle} type="number" min={1} max={10} value={form.numHuespedes}
                   onChange={(e) => set({ numHuespedes: e.target.value })} />
          </div>
        </div>

        {precioArbitrario && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Monto total (MXN) — cortesía, $0 válido</label>
            <input style={inputStyle} type="number" min={0} step="0.01"
                   placeholder="0"
                   value={form.montoManual}
                   onChange={(e) => set({ montoManual: e.target.value })} required />
          </div>
        )}

        <div style={fieldStyle}>
          <label style={labelStyle}>
            {esExtension
              ? 'Noches extra (la entrada es la salida de la estancia en curso)'
              : `Fechas ${form.chaletId ? '(noches ocupadas tachadas en rojo)' : '— selecciona un chalet primero'}`}
          </label>
          <RangeCalendar
            entrada={form.fechaEntrada}
            salida={form.fechaSalida}
            occupied={occupied}
            disabled={!form.chaletId || (esExtension && !form.reservaOrigenId)}
            fixedEntrada={esExtension}
            onChange={({ entrada, salida }) => set({ fechaEntrada: entrada, fechaSalida: salida })}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Notas (opcional)</label>
          <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }}
                    value={form.notas} onChange={(e) => set({ notas: e.target.value })} />
        </div>

        {/* Estado al crear (la extensión siempre nace confirmada y cobrada) */}
        {isAdmin && !esExtension && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Estado al crear</label>
            <select style={inputStyle} value={form.estado} disabled={form.pagoEfectivoCompleto}
                    onChange={(e) => set({ estado: e.target.value })}>
              <option value="pendiente_pago">Pendiente de pago</option>
              <option value="confirmada">Confirmada</option>
            </select>
          </div>
        )}

        {/* Cálculo */}
        {precioArbitrario ? (
          montoManualNum !== null && (
            <div style={cajaTotalStyle}>
              <span>Total ({origenSel?.etiqueta_es})</span>
              <span>{formatMoney(montoManualNum)}</span>
            </div>
          )
        ) : (
          <Breakdown calculo={calculo} error={calculoError} />
        )}

        {hayDescuento && totalFinal != null && (
          <div style={{
            background: 'rgba(91,140,90,0.08)', border: '1px solid rgba(91,140,90,0.35)',
            borderRadius: 8, padding: '12px 14px', margin: '14px 0', fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {esExtension && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: T.muted, marginBottom: 4 }}>
                <span>Descuento extensión</span><span>−{descExtPct}%</span>
              </div>
            )}
            {aplicaDescEf && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: T.muted, marginBottom: 4 }}>
                <span>Descuento pago en efectivo</span><span>−{descEfPct}%</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: T.green, fontWeight: 700, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
              <span>Total a cobrar</span><span>{formatMoney(totalFinal)}</span>
            </div>
          </div>
        )}

        {/* Pagos */}
        {esExtension ? (
          <div style={fieldStyle}>
            <label style={labelStyle}>Pago único de la extensión (se cobra al crear)</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select style={{ ...inputStyle, flex: 1 }} value={form.formaPagoExt}
                      onChange={(e) => set({ formaPagoExt: e.target.value })} required>
                <option value="">— Forma de pago —</option>
                {FORMAS_PAGO.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <div style={{ ...inputStyle, width: 140, color: T.goldLight, fontWeight: 600 }}>
                {totalFinal != null ? formatMoney(totalFinal) : '—'}
              </div>
            </div>
          </div>
        ) : (
          <>
            {!precioArbitrario && totalCalculado != null && (
              <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input id="efectivo-completo" type="checkbox"
                       checked={form.pagoEfectivoCompleto}
                       onChange={(e) => set({
                         pagoEfectivoCompleto: e.target.checked,
                         estado: e.target.checked ? 'confirmada' : 'pendiente_pago',
                         pagos: [],
                       })} />
                <label htmlFor="efectivo-completo"
                       style={{ fontSize: 13, color: T.text, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  Pago completo en efectivo ahora (−{descEfPct}%) — queda confirmada
                </label>
              </div>
            )}
            {!form.pagoEfectivoCompleto && (
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Pagos{form.estado === 'pendiente_pago' ? ' / anticipo' : ''} (pueden ser mixtos)
                </label>
                <PagosDraftEditor
                  pagos={form.pagos}
                  onChange={(pagos) => set({ pagos })}
                  total={totalFinal}
                />
              </div>
            )}
          </>
        )}

        {/* Disponibilidad */}
        {solape.blocking && (
          <div style={{ color: T.red, fontSize: 12, margin: '8px 0' }}>
            Fechas no disponibles: ya hay una reserva activa en este chalet en el rango seleccionado.
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

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
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

const cajaTotalStyle = {
  background: T.dark, border: `1px solid ${T.border}`, borderRadius: 8,
  padding: '12px 14px', margin: '14px 0', fontSize: 13,
  display: 'flex', justifyContent: 'space-between',
  color: T.goldLight, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
};

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
