import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { T } from '../lib/design-tokens';
import { branding } from '../lib/branding.config';
import { supabase } from '../lib/supabase';
import { useRol } from '../hooks/useRol';
import { useAuth } from '../hooks/useAuth';
import NotificationBell from '../components/NotificationBell';

const ROL_LABEL = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  ventas: 'Ventas',
};

const ALL_ROLES = ['super_admin', 'admin', 'ventas'];
const ADMIN_ROLES = ['super_admin', 'admin'];
const SUPER_ONLY = ['super_admin'];

const TABS = [
  { to: '/', label: 'Resumen', end: true, roles: ALL_ROLES },
  { to: '/reservas', label: 'Reservas', roles: ALL_ROLES },
  { to: '/huespedes', label: 'Huéspedes', roles: ALL_ROLES },
  { to: '/staff', label: 'Staff', roles: ADMIN_ROLES },
  { to: '/chalets', label: 'Chalets', roles: ADMIN_ROLES },
  { to: '/precios', label: 'Precios', roles: SUPER_ONLY },
  { to: '/config', label: 'Config', roles: SUPER_ONLY },
];

function getInitials(nombre, fallback) {
  const source = (nombre || fallback || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('') || '?';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { nombre, rol } = useRol();
  const initials = getInitials(nombre, user?.email);
  const visibleTabs = TABS.filter((t) => !rol || t.roles.includes(rol));

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

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
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Cuenta"
              aria-expanded={menuOpen}
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
            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: 40,
                  right: 0,
                  minWidth: 220,
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  fontFamily: "'DM Sans', sans-serif",
                  overflow: 'hidden',
                  zIndex: 20,
                }}
              >
                <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>
                    {nombre || 'Sin nombre'}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                    {user?.email}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: T.goldLight,
                      marginTop: 6,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    {ROL_LABEL[rol] || rol}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    supabase.auth.signOut();
                  }}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    color: T.text,
                    border: 'none',
                    padding: '12px 14px',
                    fontSize: 13,
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
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
        {visibleTabs.map((t) => (
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
