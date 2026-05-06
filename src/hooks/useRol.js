import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export function useRol() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    supabase
      .from('usuarios')
      .select('rol, nombre, telefono, avatar_url, activo')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data: row, error: queryError }) => {
        if (!mounted) return;
        if (queryError) setError(queryError);
        setData(row ?? null);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user, authLoading]);

  const rol = data?.activo ? data.rol : null;
  const isInactive = !!user && !authLoading && !loading && (!data || !data.activo);

  return {
    rol,
    nombre: data?.nombre ?? '',
    telefono: data?.telefono ?? '',
    avatarUrl: data?.avatar_url ?? '',
    isLoading: authLoading || loading,
    isInactive,
    error,
    isSuperAdmin: rol === 'super_admin',
    isAdmin: rol === 'admin' || rol === 'super_admin',
    isVentas: rol === 'ventas',
  };
}
