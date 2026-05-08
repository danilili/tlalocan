import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

function sanitize(input) {
  return (input || '').replace(/[,()]/g, '').slice(0, 80).trim();
}

export function useHuespedes({ search = '', limit = 50 } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase
      .from('huespedes')
      .select('*')
      .order('ultima_visita', { ascending: false, nullsFirst: false })
      .limit(limit);

    const term = sanitize(search);
    if (term) {
      query = query.or(
        `nombre.ilike.%${term}%,apellidos.ilike.%${term}%,telefono.ilike.%${term}%`,
      );
    }

    const { data: rows, error: queryError } = await query;
    if (queryError) setError(queryError);
    else setData(rows ?? []);
    setLoading(false);
  }, [search, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
