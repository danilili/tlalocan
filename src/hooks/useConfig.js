import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Lee toda la tabla config y devuelve un objeto { key: value }
// para acceso ergonomico desde la UI.
export function useConfig() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: rows, error: queryError } = await supabase
      .from('config')
      .select('key, value, descripcion');

    if (queryError) {
      setError(queryError);
    } else {
      const map = {};
      (rows ?? []).forEach((r) => {
        map[r.key] = r.value;
      });
      setData(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
