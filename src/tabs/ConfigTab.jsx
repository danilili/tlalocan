import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import FadeIn from '../components/FadeIn';
import SectionTitle from '../components/SectionTitle';
import { useConfig } from '../hooks/useConfig';
import { useRol } from '../hooks/useRol';
import { formatMoney, formatDate } from '../lib/format';

const ROL_LABEL = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  ventas: 'Ventas',
};

export default function ConfigTab() {
  const { isSuperAdmin } = useRol();
  const { data: config, loading: configLoading, refetch: refetchConfig } = useConfig();
  const [tarifas, setTarifas] = useState([]);
  const [tarifasLoading, setTarifasLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosLoading, setUsuariosLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tarifasRes, usuariosRes] = await Promise.all([
        supabase.from('tarifas').select('*').order('vigente_desde', { ascending: false }),
        supabase.from('usuarios').select('id, nombre, rol, telefono, activo').order('rol'),
      ]);
      if (cancelled) return;
      setTarifas(tarifasRes.data ?? []);
      setTarifasLoading(false);
      setUsuarios(usuariosRes.data ?? []);
      setUsuariosLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <FadeIn>
        <SectionTitle>Constantes del negocio</SectionTitle>
        {configLoading && <div style={{ color: T.muted, fontSize: 12 }}>Cargando…</div>}
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.keys(config).sort().map((key) => (
              <ConfigRow
                key={key}
                k={key}
                value={config[key]}
                editable={isSuperAdmin}
                onSaved={refetchConfig}
              />
            ))}
          </div>
        </Card>
      </FadeIn>

      <FadeIn delay={150}>
        <SectionTitle>Tarifas vigentes</SectionTitle>
        {tarifasLoading && <div style={{ color: T.muted, fontSize: 12 }}>Cargando…</div>}
        {!tarifasLoading && tarifas.length === 0 && (
          <Card>
            <div style={{ color: T.muted, fontSize: 13, textAlign: 'center' }}>
              No hay tarifas registradas.
            </div>
          </Card>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tarifas.map((t) => (
            <Card key={t.id} style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{t.nombre}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                    Vigente desde {formatDate(t.vigente_desde)}
                    {t.vigente_hasta ? ` hasta ${formatDate(t.vigente_hasta)}` : ' (sin fin)'}
                    {' · '}
                    {t.activa ? 'Activa' : 'Inactiva'}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: T.muted, textAlign: 'right' }}>
                  Lun–Jue: <span style={{ color: T.text }}>{formatMoney(t.precio_lun_jue)}</span>{' · '}
                  Vie–Sáb: <span style={{ color: T.text }}>{formatMoney(t.precio_vie_sab)}</span>{' · '}
                  Dom: <span style={{ color: T.text }}>{formatMoney(t.precio_domingo)}</span>
                  <div style={{ marginTop: 4 }}>
                    IVA {t.iva_pct}% · Hospedaje {t.impuesto_hospedaje_pct}%
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 10, fontStyle: 'italic' }}>
          La edición de tarifas se hace por ahora en Supabase Studio. UI de edición queda como nice-to-have de una fase posterior.
        </div>
      </FadeIn>

      <FadeIn delay={300}>
        <SectionTitle>Usuarios</SectionTitle>
        {usuariosLoading && <div style={{ color: T.muted, fontSize: 12 }}>Cargando…</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {usuarios.map((u) => (
            <Card key={u.id} style={{ padding: '12px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{u.nombre || '(sin nombre)'}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                    {u.telefono ?? 'Sin teléfono'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: T.goldLight, fontWeight: 500 }}>
                    {ROL_LABEL[u.rol] ?? u.rol}
                  </div>
                  <div style={{ fontSize: 11, color: u.activo ? T.green : T.muted }}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 10, fontStyle: 'italic' }}>
          Crear usuarios nuevos desde Supabase Auth (dashboard) e insertarlos en la tabla
          public.usuarios con su rol.
        </div>
      </FadeIn>
    </>
  );
}

function ConfigRow({ k, value, editable, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const { error: dbError } = await supabase
      .from('config')
      .update({ value: draft })
      .eq('key', k);
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setEditing(false);
    onSaved?.();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 200, color: T.muted, fontSize: 12, fontFamily: 'monospace' }}>
        {k}
      </div>
      {editing ? (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{
              flex: 1,
              minWidth: 200,
              background: T.dark,
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              padding: '6px 10px',
              color: T.text,
              fontSize: 13,
              outline: 'none',
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
          <button type="button" onClick={save} disabled={saving} style={btnSmallPrimary}>
            {saving ? '…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setDraft(value); setError(null); }}
            style={btnSmallSecondary}
          >
            Cancelar
          </button>
        </>
      ) : (
        <>
          <div style={{ flex: 1, minWidth: 200, color: T.text, fontSize: 13 }}>{value}</div>
          {editable && (
            <button type="button" onClick={() => setEditing(true)} style={btnSmallSecondary}>
              Editar
            </button>
          )}
        </>
      )}
      {error && (
        <div style={{ width: '100%', color: T.red, fontSize: 11 }}>{error}</div>
      )}
    </div>
  );
}

const btnSmallPrimary = {
  background: T.gold,
  color: T.dark,
  border: 'none',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};

const btnSmallSecondary = {
  background: 'transparent',
  color: T.muted,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};
