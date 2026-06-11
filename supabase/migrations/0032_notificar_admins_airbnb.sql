-- Versionada retroactivamente: aplicada en prod el 2026-05-23 como
-- 20260523005111_notificar_admins_airbnb (sesión Airbnb iCal sync).
-- NOTA: usaba tipos de notificación inexistentes ('airbnb_nueva_reserva',
-- 'airbnb_reserva_cancelada'); corregido en 0033. Se conserva por fidelidad
-- histórica. NO re-aplicar en el proyecto Tlalocan actual.

-- Helper interno: crea una notificación in-app para todos los admins/super_admins activos.
CREATE OR REPLACE FUNCTION public.notificar_admins(
  p_tipo text,
  p_titulo text,
  p_mensaje text,
  p_link_app text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.notificaciones (usuario_id, tipo, titulo, mensaje, link_app)
  SELECT u.id, p_tipo, p_titulo, p_mensaje, p_link_app
    FROM public.usuarios u
   WHERE u.rol IN ('admin','super_admin')
     AND u.activo = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Las redefiniciones de upsert_reserva_airbnb y cancelar_reservas_airbnb_huerfanas
-- de esta migración usaban tipos de notificación que violaban el check constraint;
-- ver 0033_fix_tipos_notificacion_airbnb.sql para la versión vigente.
-- (El SQL original completo está en supabase_migrations.schema_migrations
-- version 20260523005111 si se necesita auditar.)
