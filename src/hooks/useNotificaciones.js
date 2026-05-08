import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const FETCH_LIMIT = 50;

export function useNotificaciones() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows, error: queryError } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT);
    if (queryError) setError(queryError);
    else setData(rows ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime: nuevas notificaciones aparecen sin polling.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${user.id}`,
        },
        (payload) => {
          setData((prev) => {
            if (prev.some((n) => n.id === payload.new.id)) return prev;
            return [payload.new, ...prev].slice(0, FETCH_LIMIT);
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const marcarComoLeida = useCallback(async (id) => {
    setData((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    const { error: updateError } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', id);
    if (updateError) setError(updateError);
  }, []);

  const marcarTodasLeidas = useCallback(async () => {
    if (!user) return;
    setData((prev) => prev.map((n) => ({ ...n, leida: true })));
    const { error: updateError } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('usuario_id', user.id)
      .eq('leida', false);
    if (updateError) setError(updateError);
  }, [user]);

  const unreadCount = data.filter((n) => !n.leida).length;

  return {
    data,
    loading,
    error,
    unreadCount,
    marcarComoLeida,
    marcarTodasLeidas,
    refetch: fetchData,
  };
}
