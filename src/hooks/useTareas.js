import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Devuelve tareas en una ventana temporal (default: hoy + proximos 7 dias).
// Filtros opcionales: chaletId, estado, tipo.
export function useTareas({
  chaletId = null,
  estado = null,
  tipo = null,
  dias = 7,
} = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('tareas')
      .select('*')
      .order('programada_para', { ascending: true });

    if (chaletId) query = query.eq('chalet_id', chaletId);
    if (estado) query = query.eq('estado', estado);
    if (tipo) query = query.eq('tipo', tipo);

    if (dias != null) {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + dias);
      query = query
        .gte('programada_para', from.toISOString())
        .lte('programada_para', to.toISOString());
    }

    const { data: rows, error: queryError } = await query;
    if (queryError) setError(queryError);
    else setData(rows ?? []);
    setLoading(false);
  }, [chaletId, estado, tipo, dias]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
