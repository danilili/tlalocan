import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { T } from '../lib/design-tokens';
import { useNotificaciones } from '../hooks/useNotificaciones';

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'hace un momento';
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const dia = Math.round(hr / 24);
  return `hace ${dia} d`;
}

export default function NotificationBell() {
  const { data, unreadCount, marcarComoLeida, marcarTodasLeidas } = useNotificaciones();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const onClickNotif = (n) => {
    if (!n.leida) marcarComoLeida(n.id);
    if (n.link_app) navigate(n.link_app);
    setOpen(false);
  };

  const items = data.slice(0, 10);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        title="Notificaciones"
        style={btnIcon}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span style={badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={panelHeader}>
            <span style={{ fontSize: 11, color: T.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
              Notificaciones
            </span>
            {unreadCount > 0 && (
              <button type="button" onClick={marcarTodasLeidas} style={linkBtn}>
                Marcar todas
              </button>
            )}
          </div>

          {items.length === 0 && (
            <div style={{ padding: '24px 14px', color: T.muted, fontSize: 12, textAlign: 'center' }}>
              No tienes notificaciones.
            </div>
          )}

          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onClickNotif(n)}
              style={{
                ...itemStyle,
                background: n.leida ? 'transparent' : 'rgba(181,134,11,0.08)',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: n.leida ? 400 : 600,
                  color: T.text,
                  marginBottom: 2,
                }}
              >
                {n.titulo}
              </div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.35 }}>{n.mensaje}</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>
                {timeAgo(n.created_at)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

const btnIcon = {
  position: 'relative',
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: 'rgba(181,134,11,0.10)',
  border: 'none',
  color: T.goldLight,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};

const badge = {
  position: 'absolute',
  top: -2,
  right: -2,
  background: T.gold,
  color: T.dark,
  fontSize: 9,
  fontWeight: 700,
  borderRadius: 999,
  minWidth: 16,
  height: 16,
  padding: '0 4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'DM Sans', sans-serif",
};

const panelStyle = {
  position: 'absolute',
  right: 0,
  top: 'calc(100% + 8px)',
  width: 320,
  maxHeight: 420,
  overflow: 'auto',
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  boxShadow: '0 16px 32px rgba(0,0,0,0.5)',
  zIndex: 30,
  fontFamily: "'DM Sans', sans-serif",
};

const panelHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  borderBottom: `1px solid ${T.border}`,
};

const linkBtn = {
  background: 'none',
  border: 'none',
  color: T.goldLight,
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};

const itemStyle = {
  width: '100%',
  textAlign: 'left',
  padding: '12px 14px',
  background: 'transparent',
  border: 'none',
  borderBottom: `1px solid ${T.border}`,
  cursor: 'pointer',
  display: 'block',
  fontFamily: "'DM Sans', sans-serif",
};
