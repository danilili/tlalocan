import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useChalets({ activeOnly = true } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('chalets').select('*').order('orden_display');
    if (activeOnly) query = query.eq('activa', true);
    const { data: rows, error: queryError } = await query;
    if (queryError) setError(queryError);
    else setData(rows ?? []);
    setLoading(false);
  }, [activeOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
