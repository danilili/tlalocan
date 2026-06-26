import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import Modal from '../components/Modal';

// Modal único para crear/editar una fila de `tarifas`, en tres modos:
//  - 'global'    → chalet_id NULL, prioridad 0 (precio base que afecta a los 4).
//  - 'chalet'    → chalet_id fijo, prioridad 0 (override de un chalet).
//  - 'temporada' → prioridad 100, con rango de fechas; scope global o por chalet.
// La tarifa es un solo precio base por noche (sin impuestos). Cada plataforma
// (web, Airbnb, Tlali) aplica sus propias reglas de impuestos/comisiones.

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

const MODE_TITLE = {
  global: 'Precio global',
  chalet: 'Precio por chalet',
  temporada: 'Temporada',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Solape de rangos [a1,a2] y [b1,b2], tratando hasta vacío como +infinito.
function rangosSolapan(a1, a2, b1, b2) {
  const aEnd = a2 || '9999-12-31';
  const bEnd = b2 || '9999-12-31';
  return a1 <= bEnd && b1 <= aEnd;
}

export default function TarifaForm({
  open,
  mode = 'global',
  tarifa = null,
  chalets = [],
  presetChaletId = null,
  temporadas = [],
  onClose,
  onSaved,
}) {
  const isNew = !tarifa?.id;
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (tarifa) {
      setForm({
        nombre: tarifa.nombre ?? '',
        chalet_id: tarifa.chalet_id ?? '',
        vigente_desde: tarifa.vigente_desde ?? todayISO(),
        vigente_hasta: tarifa.vigente_hasta ?? '',
        precio_lun_jue: String(tarifa.precio_lun_jue ?? ''),
        precio_vie_sab: String(tarifa.precio_vie_sab ?? ''),
        precio_domingo: String(tarifa.precio_domingo ?? ''),
        iva_pct: tarifa.iva_pct ?? 16,
        impuesto_hospedaje_pct: tarifa.impuesto_hospedaje_pct ?? 5,
        activa: tarifa.activa ?? true,
      });
    } else {
      setForm({
        nombre: mode === 'temporada' ? '' : '',
        chalet_id: mode === 'chalet' ? presetChaletId ?? '' : '',
        vigente_desde: todayISO(),
        vigente_hasta: '',
        precio_lun_jue: '',
        precio_vie_sab: '',
        precio_domingo: '',
        iva_pct: 16,
        impuesto_hospedaje_pct: 5,
        activa: true,
      });
    }
  }, [open, tarifa?.id, mode, presetChaletId]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Aviso (no bloqueante) de solapamiento con otras temporadas del mismo scope.
  const overlapWarn = useMemo(() => {
    if (mode !== 'temporada' || !form) return null;
    const scope = form.chalet_id || null;
    const desde = form.vigente_desde;
    if (!desde) return null;
    const choca = temporadas.filter((t) => {
      if (t.id === tarifa?.id) return false;
      if ((t.chalet_id ?? null) !== scope) return false;
      return rangosSolapan(desde, form.vigente_hasta, t.vigente_desde, t.vigente_hasta);
    });
    if (choca.length === 0) return null;
    return `Se solapa en fechas con: ${choca.map((t) => t.nombre).join(', ')}. La de mayor prioridad / vigente_desde más reciente gana.`;
  }, [mode, form, temporadas, tarifa?.id]);

  if (!open || !form) return null;

  const scopeChalet =
    mode === 'chalet'
      ? chalets.find((c) => c.id === (form.chalet_id || presetChaletId))
      : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (mode === 'temporada') {
      if (!form.nombre.trim()) { setError('La temporada necesita un nombre.'); return; }
      if (!form.vigente_hasta) { setError('La temporada necesita fecha de fin.'); return; }
      if (form.vigente_hasta < form.vigente_desde) {
        setError('La fecha de fin debe ser posterior o igual a la de inicio.'); return;
      }
    }
    const precios = ['precio_lun_jue', 'precio_vie_sab', 'precio_domingo'];
    for (const k of precios) {
      if (form[k] === '' || Number(form[k]) <= 0) {
        setError('Los tres precios deben ser mayores a 0.'); return;
      }
    }

    setSubmitting(true);
    setError(null);

    // chalet_id y prioridad según el modo.
    const chaletId =
      mode === 'global' ? null
      : mode === 'chalet' ? (form.chalet_id || presetChaletId)
      : (form.chalet_id || null); // temporada: '' = global
    const prioridad = mode === 'temporada' ? 100 : 0;

    let nombre = form.nombre.trim();
    if (!nombre) {
      if (mode === 'global') nombre = 'Tarifa global';
      else if (mode === 'chalet') nombre = `Tarifa ${scopeChalet?.nombre ?? 'chalet'}`;
    }

    const payload = {
      chalet_id: chaletId,
      nombre,
      vigente_desde: form.vigente_desde,
      vigente_hasta: mode === 'temporada' ? form.vigente_hasta : null,
      precio_lun_jue: Number(form.precio_lun_jue),
      precio_vie_sab: Number(form.precio_vie_sab),
      precio_domingo: Number(form.precio_domingo),
      iva_pct: Number(form.iva_pct) || 16,
      impuesto_hospedaje_pct: Number(form.impuesto_hospedaje_pct) || 5,
      prioridad,
      activa: form.activa,
    };

    const { error: dbError } = isNew
      ? await supabase.from('tarifas').insert(payload)
      : await supabase.from('tarifas').update(payload).eq('id', tarifa.id);

    setSubmitting(false);
    if (dbError) { setError(dbError.message); return; }
    onSaved?.();
    onClose?.();
  };

  const title = `${isNew ? 'Nueva/o' : 'Editar'} · ${MODE_TITLE[mode]}`;

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={580}
           dismissOnBackdrop={false} dismissOnEscape={false}>
      <form onSubmit={handleSubmit}>
        {mode === 'temporada' && (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Nombre de la temporada</label>
              <input style={inputStyle} value={form.nombre}
                     onChange={(e) => set({ nombre: e.target.value })}
                     placeholder="Navidad 2026, Semana Santa…" required />
            </div>
            <div style={rowStyle}>
              <div style={{ ...fieldStyle, flex: 1, minWidth: 180 }}>
                <label style={labelStyle}>Aplica a</label>
                <select style={inputStyle} value={form.chalet_id}
                        onChange={(e) => set({ chalet_id: e.target.value })}>
                  <option value="">Todos los chalets (global)</option>
                  {chalets.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={rowStyle}>
              <div style={{ ...fieldStyle, flex: 1, minWidth: 150 }}>
                <label style={labelStyle}>Desde</label>
                <input style={inputStyle} type="date" value={form.vigente_desde}
                       onChange={(e) => set({ vigente_desde: e.target.value })} required />
              </div>
              <div style={{ ...fieldStyle, flex: 1, minWidth: 150 }}>
                <label style={labelStyle}>Hasta (incl.)</label>
                <input style={inputStyle} type="date" value={form.vigente_hasta}
                       onChange={(e) => set({ vigente_hasta: e.target.value })} required />
              </div>
            </div>
            {overlapWarn && (
              <div style={{ color: T.goldLight, fontSize: 12, marginBottom: 12 }}>⚠ {overlapWarn}</div>
            )}
          </>
        )}

        {mode === 'global' && (
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>
            Precio base que aplica a los 4 chalets cuando no hay override ni temporada.
          </div>
        )}
        {mode === 'chalet' && (
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>
            Override de <span style={{ color: T.text }}>{scopeChalet?.nombre ?? 'chalet'}</span>.
            Sustituye al precio global para este chalet.
          </div>
        )}

        <div style={rowStyle}>
          <PrecioField label="Lun–Jue" value={form.precio_lun_jue}
                       onChange={(v) => set({ precio_lun_jue: v })} />
          <PrecioField label="Vie–Sáb" value={form.precio_vie_sab}
                       onChange={(v) => set({ precio_vie_sab: v })} />
          <PrecioField label="Domingo" value={form.precio_domingo}
                       onChange={(v) => set({ precio_domingo: v })} />
        </div>

        <div style={{ fontSize: 11, color: T.muted, marginBottom: 14 }}>
          Precio base por noche, <strong>sin impuestos</strong>. Cada plataforma (web, Airbnb, Tlali)
          aplica sus propios impuestos y comisiones.
        </div>

        <div style={fieldStyle}>
          <label style={{ ...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
            <input type="checkbox" checked={form.activa}
                   onChange={(e) => set({ activa: e.target.checked })} />
            Activa
          </label>
        </div>

        {error && <div style={{ color: T.red, fontSize: 12, marginBottom: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={submitting} style={{
            ...btnPrimary, opacity: submitting ? 0.5 : 1, cursor: submitting ? 'wait' : 'pointer',
          }}>
            {submitting ? 'Guardando…' : isNew ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PrecioField({ label, value, onChange }) {
  return (
    <div style={{ ...fieldStyle, flex: 1, minWidth: 140 }}>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} type="number" min={0} step="50" value={value}
             onChange={(e) => onChange(e.target.value)} required />
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
