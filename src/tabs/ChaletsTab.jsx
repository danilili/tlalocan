import { useState } from 'react';
import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import StatusBadge from '../components/badges/StatusBadge';
import FadeIn from '../components/FadeIn';
import { useChalets } from '../hooks/useChalets';
import { useRol } from '../hooks/useRol';
import EditarChaletForm from '../forms/EditarChaletForm';

export default function ChaletsTab() {
  const { data: chalets, loading, error, refetch } = useChalets({ activeOnly: false });
  const { isSuperAdmin } = useRol();
  const [editing, setEditing] = useState(null); // chalet | { __new: true } | null

  const openNew = () => setEditing({ __new: true });
  const openEdit = (c) => setEditing(c);
  const close = () => setEditing(null);

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
            Chalets
          </h2>
          {isSuperAdmin && (
            <button type="button" onClick={openNew} style={btnNuevo}>
              + Nuevo chalet
            </button>
          )}
        </div>

        {loading && <div style={{ color: T.muted, fontSize: 12 }}>Cargando…</div>}
        {error && <div style={{ color: T.red, fontSize: 12 }}>Error: {error.message}</div>}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {chalets.map((c) => (
            <Card
              key={c.id}
              onClick={isSuperAdmin ? () => openEdit(c) : undefined}
              style={{ padding: '16px 18px' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 500, color: T.text, lineHeight: 1.3 }}>
                  {c.nombre}
                </div>
                <StatusBadge status={c.activa ? 'available' : 'cleaning'} />
              </div>

              {c.descripcion && (
                <div
                  style={{
                    fontSize: 12,
                    color: T.muted,
                    lineHeight: 1.4,
                    marginBottom: 8,
                  }}
                >
                  {c.descripcion}
                </div>
              )}

              <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
                <div>Slug: <span style={{ color: T.text }}>{c.slug}</span></div>
                <div>Capacidad: <span style={{ color: T.text }}>{c.capacidad}</span></div>
                <div>
                  Fotos: <span style={{ color: T.text }}>{(c.fotos_url ?? []).length}</span>
                </div>
                <div>
                  Código de chapa:{' '}
                  <span style={{ color: T.text }}>{c.codigo_chapa ?? '(global)'}</span>
                </div>
                <div>
                  WiFi:{' '}
                  <span style={{ color: T.text }}>{c.wifi_password ?? '(global)'}</span>
                </div>
              </div>

              {!isSuperAdmin && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 10,
                    color: T.muted,
                    fontStyle: 'italic',
                  }}
                >
                  Solo lectura — pide a un super admin para editar.
                </div>
              )}
            </Card>
          ))}
        </div>
      </FadeIn>

      <EditarChaletForm
        open={!!editing}
        chalet={editing && !editing.__new ? editing : null}
        onClose={close}
        onSaved={refetch}
      />
    </>
  );
}

const btnNuevo = {
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
