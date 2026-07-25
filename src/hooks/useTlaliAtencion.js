import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Estado del interruptor de Tlali (config.tlali_atencion_activa).
// El toggle va por RPC porque la escritura directa de config es solo super_admin
// y este botón lo puede usar cualquier usuario activo (incluido rol ventas).
export function useTlaliAtencion() {
  const [activa, setActiva] = useState(null); // null = cargando
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchEstado = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'tlali_atencion_activa')
      .maybeSingle();
    if (queryError) {
      setError(queryError);
    } else {
      setError(null);
      setActiva(data ? data.value === 'true' : true);
    }
  }, []);

  useEffect(() => {
    fetchEstado();
    // El flag puede cambiarlo otro usuario desde su dispositivo: refrescar al volver a la pestaña.
    const onFocus = () => fetchEstado();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchEstado]);

  const toggle = useCallback(async () => {
    if (activa === null || saving) return;
    const objetivo = !activa;
    setSaving(true);
    const { data, error: rpcError } = await supabase.rpc('set_tlali_atencion', {
      p_activa: objetivo,
    });
    if (rpcError) {
      setError(rpcError);
    } else {
      setError(null);
      setActiva(data === 'true');
    }
    setSaving(false);
  }, [activa, saving]);

  return { activa, saving, error, toggle, refetch: fetchEstado };
}
