import { NavLink, Outlet } from 'react-router-dom';
import { T } from '../lib/design-tokens';
import { branding } from '../lib/branding.config';
import { supabase } from '../lib/supabase';
import { useRol } from '../hooks/useRol';
import { useAuth } from '../hooks/useAuth';
import NotificationBell from '../components/NotificationBell';

const TABS = [
  { to: '/', label: 'Resumen', end: true },
  { to: '/reservas', label: 'Reservas' },
  { to: '/huespedes', label: 'Huéspedes' },
  { to: '/staff', label: 'Staff' },
  { to: '/chalets', label: 'Chalets' },
  { to: '/config', label: 'Config' },
];

function getInitials(nombre, fallback) {
  const source = (nombre || fallback || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('') || '?';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { nombre } = useRol();
  const initials = getInitials(nombre, user?.email);

  return (
    <div style={{ minHeight: '100vh', background: T.dark }}>
      <header
        style={{
          padding: '14px 24px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: T.dark,
          zIndex: 10,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 20,
              fontWeight: 300,
              color: T.gold,
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}
          >
            {branding.appName}
          </span>
          <span
            style={{
              fontSize: 10,
              color: T.muted,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Panel de control
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NotificationBell />
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            title={`Cerrar sesión (${nombre || user?.email || ''})`}
            aria-label="Cerrar sesión"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(181,134,11,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: T.goldLight,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {initials}
          </button>
        </div>
      </header>

      <nav
        style={{
          padding: '0 24px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          gap: 0,
          overflowX: 'auto',
        }}
      >
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            style={({ isActive }) => ({
              padding: '14px 18px',
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? T.goldLight : T.muted,
              borderBottom: isActive ? `2px solid ${T.gold}` : '2px solid transparent',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              textDecoration: 'none',
            })}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <main style={{ padding: '0 24px 48px', maxWidth: 820, margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
