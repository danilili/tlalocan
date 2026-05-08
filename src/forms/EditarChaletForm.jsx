import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import Modal from '../components/Modal';

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

const EMPTY = {
  nombre: '',
  slug: '',
  descripcion: '',
  capacidad: 2,
  ubicacion_maps: '',
  instrucciones_llegada: '',
  codigo_chapa: '',
  wifi_password: '',
  activa: true,
  orden_display: 0,
};

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function EditarChaletForm({ open, chalet, onClose, onSaved }) {
  const isNew = !chalet?.id;
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [autoSlug, setAutoSlug] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (chalet) {
      setForm({
        nombre: chalet.nombre ?? '',
        slug: chalet.slug ?? '',
        descripcion: chalet.descripcion ?? '',
        capacidad: chalet.capacidad ?? 2,
        ubicacion_maps: chalet.ubicacion_maps ?? '',
        instrucciones_llegada: chalet.instrucciones_llegada ?? '',
        codigo_chapa: chalet.codigo_chapa ?? '',
        wifi_password: chalet.wifi_password ?? '',
        activa: chalet.activa ?? true,
        orden_display: chalet.orden_display ?? 0,
      });
      setAutoSlug(false);
    } else {
      setForm(EMPTY);
      setAutoSlug(true);
    }
    setError(null);
  }, [open, chalet?.id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const onNombreChange = (value) => {
    set({ nombre: value, ...(autoSlug ? { slug: slugify(value) } : {}) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const payload = {
      nombre: form.nombre.trim(),
      slug: form.slug.trim() || slugify(form.nombre),
      descripcion: form.descripcion.trim() || null,
      capacidad: Number(form.capacidad) || 2,
      ubicacion_maps: form.ubicacion_maps.trim() || null,
      instrucciones_llegada: form.instrucciones_llegada.trim() || null,
      codigo_chapa: form.codigo_chapa.trim() || null,
      wifi_password: form.wifi_password.trim() || null,
      activa: form.activa,
      orden_display: Number(form.orden_display) || 0,
    };

    const { error: dbError } = isNew
      ? await supabase.from('chalets').insert(payload)
      : await supabase.from('chalets').update(payload).eq('id', chalet.id);

    setSubmitting(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    onSaved?.();
    onClose?.();
  };

  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Nuevo chalet' : 'Editar chalet'} maxWidth={580}>
      <form onSubmit={handleSubmit}>
        <div style={rowStyle}>
          <div style={{ ...fieldStyle, flex: 2, minWidth: 200 }}>
            <label style={labelStyle}>Nombre</label>
            <input style={inputStyle} value={form.nombre}
                   onChange={(e) => onNombreChange(e.target.value)} required />
          </div>
          <div style={{ ...fieldStyle, flex: 1, minWidth: 140 }}>
            <label style={labelStyle}>Slug</label>
            <input style={inputStyle} value={form.slug}
                   onChange={(e) => { setAutoSlug(false); set({ slug: e.target.value }); }} required />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Descripción</label>
          <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }}
                    value={form.descripcion} onChange={(e) => set({ descripcion: e.target.value })} />
        </div>

        <div style={rowStyle}>
          <div style={{ ...fieldStyle, width: 110 }}>
            <label style={labelStyle}>Capacidad</label>
            <input style={inputStyle} type="number" min={1} max={10} value={form.capacidad}
                   onChange={(e) => set({ capacidad: e.target.value })} />
          </div>
          <div style={{ ...fieldStyle, width: 110 }}>
            <label style={labelStyle}>Orden</label>
            <input style={inputStyle} type="number" value={form.orden_display}
                   onChange={(e) => set({ orden_display: e.target.value })} />
          </div>
          <div style={{ ...fieldStyle, flex: 1, minWidth: 160, display: 'flex', alignItems: 'flex-end' }}>
            <label style={{ ...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
              <input type="checkbox" checked={form.activa}
                     onChange={(e) => set({ activa: e.target.checked })} />
              Activo
            </label>
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Ubicación (link Google Maps)</label>
          <input style={inputStyle} type="url" value={form.ubicacion_maps}
                 onChange={(e) => set({ ubicacion_maps: e.target.value })}
                 placeholder="https://maps.google.com/…" />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Instrucciones de llegada (override)</label>
          <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }}
                    value={form.instrucciones_llegada}
                    onChange={(e) => set({ instrucciones_llegada: e.target.value })}
                    placeholder="Si está vacío, los agentes usan el texto por defecto." />
        </div>

        <div style={rowStyle}>
          <div style={{ ...fieldStyle, flex: 1, minWidth: 160 }}>
            <label style={labelStyle}>Código de chapa (override)</label>
            <input style={inputStyle} value={form.codigo_chapa}
                   onChange={(e) => set({ codigo_chapa: e.target.value })}
                   placeholder="vacío = usa el global" />
          </div>
          <div style={{ ...fieldStyle, flex: 1, minWidth: 160 }}>
            <label style={labelStyle}>WiFi password (override)</label>
            <input style={inputStyle} value={form.wifi_password}
                   onChange={(e) => set({ wifi_password: e.target.value })}
                   placeholder="vacío = usa el global" />
          </div>
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
