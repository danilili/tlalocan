import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Catálogo de orígenes capturables a mano: activos y NO canales externos
// (airbnb/booking entran solas vía Beds24). Los solo_admin se filtran en el caller.
export function useOrigenes() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows, error } = await supabase
        .from('origenes_reserva')
        .select('clave, etiqueta_es, aplica_precio, solo_admin, orden_display')
        .eq('activo', true)
        .eq('es_canal_externo', false)
        .order('orden_display', { ascending: true });
      if (cancelled) return;
      setData(error ? [] : rows ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}
