-- Versionada retroactivamente: aplicada en prod el 2026-05-23 como
-- 20260523005202_fix_tipos_notificacion_airbnb (sesión Airbnb iCal sync).
-- Versión VIGENTE de upsert_reserva_airbnb y cancelar_reservas_airbnb_huerfanas.
-- NO re-aplicar en el proyecto Tlalocan actual.

-- Ajuste: la tabla notificaciones tiene check constraint sobre tipo.
-- Usamos tipos ya soportados: 'reserva_nueva' para nuevas, 'sistema' para cancelaciones.

CREATE OR REPLACE FUNCTION public.upsert_reserva_airbnb(
  p_external_uid text,
  p_chalet_id uuid,
  p_fecha_entrada date,
  p_fecha_salida date,
  p_summary text DEFAULT NULL
)
RETURNS TABLE (
  reserva_id uuid,
  accion text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_reserva_id uuid;
  v_existing_entrada date;
  v_existing_salida date;
  v_huesped_id uuid;
  v_nombre_chalet text;
  v_placeholder_phone text;
  v_new_reserva_id uuid;
  v_titulo text;
  v_mensaje text;
BEGIN
  IF p_external_uid IS NULL OR length(trim(p_external_uid)) = 0 THEN
    RAISE EXCEPTION 'external_uid es requerido';
  END IF;
  IF p_fecha_salida <= p_fecha_entrada THEN
    RAISE EXCEPTION 'fecha_salida debe ser posterior a fecha_entrada';
  END IF;

  SELECT id, fecha_entrada, fecha_salida
    INTO v_existing_reserva_id, v_existing_entrada, v_existing_salida
  FROM public.reservas
  WHERE external_uid = p_external_uid;

  IF v_existing_reserva_id IS NOT NULL THEN
    IF v_existing_entrada = p_fecha_entrada AND v_existing_salida = p_fecha_salida THEN
      RETURN QUERY SELECT v_existing_reserva_id, 'sin_cambios'::text;
      RETURN;
    END IF;
    UPDATE public.reservas
       SET fecha_entrada = p_fecha_entrada,
           fecha_salida  = p_fecha_salida,
           updated_at    = now()
     WHERE id = v_existing_reserva_id;
    RETURN QUERY SELECT v_existing_reserva_id, 'actualizada'::text;
    RETURN;
  END IF;

  SELECT nombre INTO v_nombre_chalet FROM public.chalets WHERE id = p_chalet_id;
  IF v_nombre_chalet IS NULL THEN
    RAISE EXCEPTION 'chalet_id no existe: %', p_chalet_id;
  END IF;

  v_placeholder_phone := '+airbnb-' || substring(p_external_uid from 1 for 30);

  INSERT INTO public.huespedes (nombre, telefono, origen_inicial, notas)
  VALUES (
    'Huésped Airbnb',
    v_placeholder_phone,
    'airbnb',
    'Auto-creado desde iCal Airbnb. UID: ' || p_external_uid ||
      CASE WHEN p_summary IS NOT NULL THEN E'\nSummary iCal: ' || p_summary ELSE '' END
  )
  RETURNING id INTO v_huesped_id;

  INSERT INTO public.reservas (
    external_uid, huesped_id, chalet_id, fecha_entrada, fecha_salida, num_huespedes,
    subtotal_neto, iva, impuesto_hospedaje, monto_total, monto_pagado,
    estado, origen, notas
  ) VALUES (
    p_external_uid, v_huesped_id, p_chalet_id, p_fecha_entrada, p_fecha_salida, 2,
    0, 0, 0, 0, 0,
    'confirmada', 'airbnb',
    'Reserva sincronizada desde Airbnb iCal. Completar datos del huésped y montos cuando sea posible.'
  )
  RETURNING id INTO v_new_reserva_id;

  v_titulo := 'Nueva reserva Airbnb';
  v_mensaje := 'Reserva en ' || v_nombre_chalet ||
               ' del ' || to_char(p_fecha_entrada, 'DD/MM/YYYY') ||
               ' al ' || to_char(p_fecha_salida, 'DD/MM/YYYY') ||
               '. Completa los datos del huésped en la app.';
  PERFORM notificar_admins('reserva_nueva', v_titulo, v_mensaje, '/reservas/' || v_new_reserva_id::text);

  RETURN QUERY SELECT v_new_reserva_id, 'creada'::text;
END;
$$;

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
DECLARE
  v_canceladas record;
  v_nombre_chalet text;
BEGIN
  SELECT nombre INTO v_nombre_chalet FROM public.chalets WHERE id = p_chalet_id;

  FOR v_canceladas IN
    UPDATE public.reservas r
       SET estado = 'cancelada',
           notas = COALESCE(r.notas, '') ||
                   E'\n[Auto] Cancelada porque dejó de aparecer en iCal Airbnb el ' ||
                   to_char(now() at time zone 'America/Mexico_City', 'YYYY-MM-DD HH24:MI'),
           updated_at = now()
     WHERE r.chalet_id = p_chalet_id
       AND r.origen = 'airbnb'
       AND r.estado IN ('confirmada', 'cotizada', 'pendiente_pago')
       AND r.fecha_entrada >= CURRENT_DATE
       AND r.external_uid IS NOT NULL
       AND NOT (r.external_uid = ANY(p_uids_vigentes))
    RETURNING r.id, r.external_uid, r.fecha_entrada, r.fecha_salida
  LOOP
    PERFORM notificar_admins(
      'sistema',
      'Reserva Airbnb cancelada',
      'Cancelada reserva en ' || v_nombre_chalet ||
        ' del ' || to_char(v_canceladas.fecha_entrada, 'DD/MM/YYYY') ||
        ' al ' || to_char(v_canceladas.fecha_salida, 'DD/MM/YYYY') ||
        '. Detectada por sync iCal.',
      '/reservas/' || v_canceladas.id::text
    );
    reserva_id := v_canceladas.id;
    external_uid := v_canceladas.external_uid;
    fecha_entrada := v_canceladas.fecha_entrada;
    RETURN NEXT;
  END LOOP;
END;
$$;
