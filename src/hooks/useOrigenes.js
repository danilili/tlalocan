import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Catálogo de orígenes capturables a mano (flag captura_manual): website,
// referido, extension, cortesia. Los demás (directa, agente_whatsapp, airbnb…)
// siguen activos en el sistema pero no se capturan desde la app.
// Los solo_admin se filtran en el caller.
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
        .eq('captura_manual', true)
        .order('orden_display', { ascending: true });
      if (cancelled) return;
      setData(error ? [] : rows ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}
