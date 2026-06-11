-- Versionada retroactivamente: aplicada en prod el 2026-05-23 como
-- 20260523004540_create_upsert_reserva_airbnb_fn (sesión Airbnb iCal sync).
-- NOTA: esta versión fue superada por 0032 y 0033 (agregan notificaciones a admins).
-- Se conserva por fidelidad histórica. NO re-aplicar en el proyecto Tlalocan actual.

-- Función idempotente: crea o actualiza una reserva proveniente de Airbnb iCal.
-- Crea automáticamente un huésped placeholder único por reserva.
-- Si la reserva ya existe (por external_uid), actualiza fechas/estado.
-- Si la reserva externa fue cancelada (no aparece más en el iCal), el caller la marca como cancelada.

CREATE OR REPLACE FUNCTION public.upsert_reserva_airbnb(
  p_external_uid text,
  p_chalet_id uuid,
  p_fecha_entrada date,
  p_fecha_salida date,
  p_summary text DEFAULT NULL
)
RETURNS TABLE (
  reserva_id uuid,
  accion text  -- 'creada' | 'actualizada' | 'sin_cambios'
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
BEGIN
  -- Validaciones básicas
  IF p_external_uid IS NULL OR length(trim(p_external_uid)) = 0 THEN
    RAISE EXCEPTION 'external_uid es requerido';
  END IF;
  IF p_fecha_salida <= p_fecha_entrada THEN
    RAISE EXCEPTION 'fecha_salida debe ser posterior a fecha_entrada';
  END IF;

  -- Buscar si ya existe la reserva
  SELECT id, fecha_entrada, fecha_salida
    INTO v_existing_reserva_id, v_existing_entrada, v_existing_salida
  FROM public.reservas
  WHERE external_uid = p_external_uid;

  IF v_existing_reserva_id IS NOT NULL THEN
    -- Ya existe. Actualizar solo si cambiaron las fechas.
    IF v_existing_entrada = p_fecha_entrada AND v_existing_salida = p_fecha_salida THEN
      RETURN QUERY SELECT v_existing_reserva_id, 'sin_cambios'::text;
      RETURN;
    END IF;

    -- Actualizar fechas si cambiaron. EXCLUDE constraint nos protege contra overlap.
    UPDATE public.reservas
       SET fecha_entrada = p_fecha_entrada,
           fecha_salida  = p_fecha_salida,
           updated_at    = now()
     WHERE id = v_existing_reserva_id;

    RETURN QUERY SELECT v_existing_reserva_id, 'actualizada'::text;
    RETURN;
  END IF;

  -- No existe: crear huesped placeholder + reserva
  SELECT nombre INTO v_nombre_chalet FROM public.chalets WHERE id = p_chalet_id;
  IF v_nombre_chalet IS NULL THEN
    RAISE EXCEPTION 'chalet_id no existe: %', p_chalet_id;
  END IF;

  -- Telefono placeholder único basado en el UID
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

  -- Crear la reserva en estado confirmada (porque Airbnb solo emite iCal
  -- después de confirmar el pago). num_huespedes default 2 (lo edita el admin después).
  -- Monto en 0 porque no lo sabemos hasta que el admin lo capture.
  INSERT INTO public.reservas (
    external_uid,
    huesped_id,
    chalet_id,
    fecha_entrada,
    fecha_salida,
    num_huespedes,
    subtotal_neto, iva, impuesto_hospedaje, monto_total, monto_pagado,
    estado,
    origen,
    notas
  ) VALUES (
    p_external_uid,
    v_huesped_id,
    p_chalet_id,
    p_fecha_entrada,
    p_fecha_salida,
    2,
    0, 0, 0, 0, 0,
    'confirmada',
    'airbnb',
    'Reserva sincronizada desde Airbnb iCal. Completar datos del huésped y montos cuando sea posible.'
  )
  RETURNING id INTO v_existing_reserva_id;

  RETURN QUERY SELECT v_existing_reserva_id, 'creada'::text;
END;
$$;

COMMENT ON FUNCTION public.upsert_reserva_airbnb IS
  'Crea o actualiza una reserva proveniente de Airbnb iCal de forma idempotente. Llamada desde n8n workflow Tlalocan - iCal Import Airbnb.';
