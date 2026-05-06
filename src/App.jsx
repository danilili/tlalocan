import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { T } from './lib/design-tokens';
import { supabase } from './lib/supabase';
import { useAuth } from './hooks/useAuth';
import { useRol } from './hooks/useRol';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ResumenTab from './tabs/ResumenTab';
import ReservasTab from './tabs/ReservasTab';
import HuespedesTab from './tabs/HuespedesTab';
import StaffTab from './tabs/StaffTab';
import ChaletsTab from './tabs/ChaletsTab';
import ConfigTab from './tabs/ConfigTab';

function LoadingSplash() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.dark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          color: T.muted,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12,
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}
      >
        Cargando…
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { rol, isLoading: rolLoading, isInactive } = useRol();
  const [inactiveMessage, setInactiveMessage] = useState(null);

  useEffect(() => {
    if (isInactive) {
      setInactiveMessage(
        'Tu cuenta no está activa. Contacta al administrador.',
      );
      supabase.auth.signOut();
    }
  }, [isInactive]);

  if (authLoading || (user && rolLoading && !isInactive)) {
    return <LoadingSplash />;
  }

  const isAuthed = !!user && !!rol;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthed ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage initialMessage={inactiveMessage} />
            )
          }
        />
        <Route
          path="/"
          element={isAuthed ? <DashboardPage /> : <Navigate to="/login" replace />}
        >
          <Route index element={<ResumenTab />} />
          <Route path="reservas" element={<ReservasTab />} />
          <Route path="huespedes" element={<HuespedesTab />} />
          <Route path="staff" element={<StaffTab />} />
          <Route path="chalets" element={<ChaletsTab />} />
          <Route path="config" element={<ConfigTab />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
