-- Versionada retroactivamente: aplicada en prod el 2026-05-23 como
-- 20260523004553_create_cancelar_reservas_airbnb_fn (sesión Airbnb iCal sync).
-- NOTA: esta versión fue superada por 0032 y 0033 (agregan notificaciones a admins).
-- Se conserva por fidelidad histórica. NO re-aplicar en el proyecto Tlalocan actual.

-- Marca como canceladas las reservas Airbnb que ya no aparecen en el iCal del chalet.
-- Solo procesa reservas con fecha_entrada >= hoy (no toca reservas pasadas).

CREATE OR REPLACE FUNCTION public.cancelar_reservas_airbnb_huerfanas(
  p_chalet_id uuid,
  p_uids_vigentes text[]
)
RETURNS TABLE (
  reserva_id uuid,
  external_uid text,
  fecha_entrada date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.reservas r
     SET estado = 'cancelada',
         notas = COALESCE(r.notas, '') || E'\n[Auto] Cancelada porque dejó de aparecer en iCal Airbnb el ' || to_char(now() at time zone 'America/Mexico_City', 'YYYY-MM-DD HH24:MI'),
         updated_at = now()
   WHERE r.chalet_id = p_chalet_id
     AND r.origen = 'airbnb'
     AND r.estado IN ('confirmada', 'cotizada', 'pendiente_pago')
     AND r.fecha_entrada >= CURRENT_DATE
     AND r.external_uid IS NOT NULL
     AND NOT (r.external_uid = ANY(p_uids_vigentes))
  RETURNING r.id, r.external_uid, r.fecha_entrada;
END;
$$;

COMMENT ON FUNCTION public.cancelar_reservas_airbnb_huerfanas IS
  'Marca como canceladas las reservas Airbnb futuras que dejaron de aparecer en el iCal del chalet. Llamada al final de cada sync.';
