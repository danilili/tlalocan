import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const SELECT_WITH_RELATIONS =
  '*, chalet:chalets(id, nombre, slug), huesped:huespedes(id, nombre, apellidos, telefono, email)';

// Filtros: chalet, huesped, estado (string o array), rango de fechas y limit.
// Las reservas que solapan con [desde, hasta) se incluyen.
// El estado puede ser un solo valor o un array; si es array, conviene
// memoizarlo en el caller para evitar refetches en cada render.
export function useReservas({
  chaletId = null,
  huespedId = null,
  estado = null,
  desde = null, // YYYY-MM-DD
  hasta = null, // YYYY-MM-DD (exclusivo)
  limit = 200,
} = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const estadoKey = useMemo(
    () => (Array.isArray(estado) ? [...estado].sort().join('|') : estado),
    [estado],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('reservas')
      .select(SELECT_WITH_RELATIONS)
      .order('fecha_entrada', { ascending: true })
      .limit(limit);

    if (chaletId) query = query.eq('chalet_id', chaletId);
    if (huespedId) query = query.eq('huesped_id', huespedId);

    if (estado) {
      if (Array.isArray(estado)) query = query.in('estado', estado);
      else query = query.eq('estado', estado);
    }

    if (desde) query = query.gte('fecha_salida', desde);
    if (hasta) query = query.lt('fecha_entrada', hasta);

    const { data: rows, error: queryError } = await query;
    if (queryError) setError(queryError);
    else setData(rows ?? []);
    setLoading(false);
    // estadoKey en deps para captar cambios de array sin loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaletId, huespedId, estadoKey, desde, hasta, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
