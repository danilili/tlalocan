import { useEffect, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';

const ESTADOS_ACTIVOS = ['cotizada', 'pendiente_pago', 'confirmada', 'en_curso'];

// Noches ocupadas de un chalet como Set de 'YYYY-MM-DD'.
// Una reserva [entrada, salida) ocupa las noches entrada..salida-1:
// el día de salida queda libre como entrada de otra reserva.
export function useOcupacion(chaletId) {
  const [occupied, setOccupied] = useState(() => new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chaletId) { setOccupied(new Set()); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const hoy = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('reservas')
        .select('fecha_entrada, fecha_salida')
        .eq('chalet_id', chaletId)
        .in('estado', ESTADOS_ACTIVOS)
        .gt('fecha_salida', hoy);
      if (cancelled) return;
      const nights = new Set();
      if (!error) {
        for (const r of data ?? []) {
          let d = parseISO(r.fecha_entrada);
          const fin = parseISO(r.fecha_salida);
          while (d < fin) {
            nights.add(format(d, 'yyyy-MM-dd'));
            d = addDays(d, 1);
          }
        }
      }
      setOccupied(nights);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [chaletId]);

  return { occupied, loading };
}
