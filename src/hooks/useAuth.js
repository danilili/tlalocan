import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      // Supabase emite TOKEN_REFRESHED / SIGNED_IN al volver el foco a la pestaña.
      // Si sigue siendo el mismo usuario, conservamos el objeto de sesión previo
      // para NO cambiar la identidad de `user` aguas abajo. Si cambia, useRol
      // recarga el rol → LoadingSplash → se desmonta el dashboard y se pierde el
      // modal de edición abierto. supabase-js mantiene su propio token internamente,
      // así que conservar `prev` no afecta las llamadas autenticadas.
      setSession((prev) => {
        const sameUser =
          prev?.user?.id && newSession?.user?.id && prev.user.id === newSession.user.id;
        return sameUser ? prev : (newSession ?? null);
      });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = () => supabase.auth.signOut();

  return {
    session,
    user: session?.user ?? null,
    loading,
    signOut,
  };
}
