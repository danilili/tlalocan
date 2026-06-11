-- Versionada retroactivamente: aplicada en prod el 2026-05-23 como
-- 20260523005801_sincronizar_calendario_airbnb_fn (sesión Airbnb iCal sync).
-- NO re-aplicar en el proyecto Tlalocan actual.

-- Función maestra: recibe el texto completo de un .ics, lo parsea con regex,
-- y dentro de una sola transacción crea/actualiza/cancela reservas Airbnb.
-- Retorna resumen para que n8n loggee.

CREATE OR REPLACE FUNCTION public.sincronizar_calendario_airbnb(
  p_calendario_id uuid,
  p_ical_text text
)
RETURNS TABLE (
  ok boolean,
  creadas integer,
  actualizadas integer,
  sin_cambios integer,
  canceladas integer,
  ignoradas integer,
  mensaje text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_chalet_id uuid;
  v_chalet_nombre text;
  v_plataforma text;
  v_unfolded text;
  v_block text;
  v_uid text;
  v_dtstart_raw text;
  v_dtend_raw text;
  v_summary text;
  v_dtstart_str text;
  v_dtend_str text;
  v_fecha_entrada date;
  v_fecha_salida date;
  v_today date := CURRENT_DATE;
  v_creadas integer := 0;
  v_actualizadas integer := 0;
  v_sin_cambios integer := 0;
  v_canceladas integer := 0;
  v_ignoradas integer := 0;
  v_upsert_result record;
  v_uids_vigentes text[] := ARRAY[]::text[];
  v_summary_upper text;
BEGIN
  SELECT ce.chalet_id, ce.plataforma, c.nombre
    INTO v_chalet_id, v_plataforma, v_chalet_nombre
  FROM public.calendarios_externos ce
  JOIN public.chalets c ON c.id = ce.chalet_id
  WHERE ce.id = p_calendario_id AND ce.activo = true;

  IF v_chalet_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 0, 0, 0,
      ('Calendario no encontrado o inactivo: ' || p_calendario_id::text);
    RETURN;
  END IF;

  IF v_plataforma <> 'airbnb' THEN
    RETURN QUERY SELECT false, 0, 0, 0, 0, 0,
      ('Plataforma no soportada: ' || v_plataforma);
    RETURN;
  END IF;

  IF p_ical_text IS NULL OR length(trim(p_ical_text)) = 0 THEN
    RETURN QUERY SELECT false, 0, 0, 0, 0, 0, 'iCal vacío'::text;
    RETURN;
  END IF;

  -- Unfold lines: iCal usa CRLF + (space|tab) para continuar líneas largas
  v_unfolded := regexp_replace(p_ical_text, E'\\r?\\n[ \\t]', '', 'g');

  -- Recorrer todos los VEVENT
  FOR v_block IN
    SELECT (regexp_matches(v_unfolded, 'BEGIN:VEVENT(.*?)END:VEVENT', 'gs'))[1]
  LOOP
    v_uid := NULL;
    v_dtstart_raw := NULL;
    v_dtend_raw := NULL;
    v_summary := NULL;

    -- Extraer UID (línea completa después del nombre, soporta parámetros)
    v_uid := (SELECT (regexp_matches(v_block, E'\\nUID(?:;[^:\\n]*)?:([^\\r\\n]+)', 'i'))[1] LIMIT 1);
    v_dtstart_raw := (SELECT (regexp_matches(v_block, E'\\nDTSTART(?:;[^:\\n]*)?:([^\\r\\n]+)', 'i'))[1] LIMIT 1);
    v_dtend_raw := (SELECT (regexp_matches(v_block, E'\\nDTEND(?:;[^:\\n]*)?:([^\\r\\n]+)', 'i'))[1] LIMIT 1);
    v_summary := (SELECT (regexp_matches(v_block, E'\\nSUMMARY(?:;[^:\\n]*)?:([^\\r\\n]+)', 'i'))[1] LIMIT 1);

    IF v_uid IS NULL OR v_dtstart_raw IS NULL OR v_dtend_raw IS NULL THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;

    v_uid := trim(v_uid);
    v_summary := COALESCE(trim(v_summary), '');
    v_summary_upper := upper(v_summary);

    -- Ignorar bloques que Airbnb pone para "no disponible" (esos bloquean fechas pero no son reservas)
    -- Aún así los registramos como UIDs vigentes para que no se cancelen.
    IF v_summary_upper LIKE '%NOT AVAILABLE%' OR v_summary_upper LIKE '%BLOCKED%' THEN
      v_ignoradas := v_ignoradas + 1;
      v_uids_vigentes := array_append(v_uids_vigentes, v_uid);
      CONTINUE;
    END IF;

    -- Extraer YYYY-MM-DD del DTSTART/DTEND. Acepta YYYYMMDD y YYYYMMDDTHHMMSSZ
    v_dtstart_str := (SELECT (regexp_matches(trim(v_dtstart_raw), '^(\d{4})(\d{2})(\d{2})'))[1] LIMIT 1);
    v_dtend_str := (SELECT (regexp_matches(trim(v_dtend_raw), '^(\d{4})(\d{2})(\d{2})'))[1] LIMIT 1);

    IF v_dtstart_str IS NULL OR v_dtend_str IS NULL THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;

    BEGIN
      v_fecha_entrada := to_date(
        substring(trim(v_dtstart_raw) from 1 for 4) || '-' ||
        substring(trim(v_dtstart_raw) from 5 for 2) || '-' ||
        substring(trim(v_dtstart_raw) from 7 for 2),
        'YYYY-MM-DD'
      );
      v_fecha_salida := to_date(
        substring(trim(v_dtend_raw) from 1 for 4) || '-' ||
        substring(trim(v_dtend_raw) from 5 for 2) || '-' ||
        substring(trim(v_dtend_raw) from 7 for 2),
        'YYYY-MM-DD'
      );
    EXCEPTION WHEN OTHERS THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END;

    -- Solo procesar eventos cuya salida sea >= hoy (solo futuros según decidido)
    IF v_fecha_salida < v_today OR v_fecha_entrada < v_today THEN
      v_ignoradas := v_ignoradas + 1;
      v_uids_vigentes := array_append(v_uids_vigentes, v_uid);
      CONTINUE;
    END IF;

    IF v_fecha_salida <= v_fecha_entrada THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;

    -- Upsert
    BEGIN
      SELECT * INTO v_upsert_result
        FROM public.upsert_reserva_airbnb(v_uid, v_chalet_id, v_fecha_entrada, v_fecha_salida, v_summary);
      IF v_upsert_result.accion = 'creada' THEN
        v_creadas := v_creadas + 1;
      ELSIF v_upsert_result.accion = 'actualizada' THEN
        v_actualizadas := v_actualizadas + 1;
      ELSE
        v_sin_cambios := v_sin_cambios + 1;
      END IF;
      v_uids_vigentes := array_append(v_uids_vigentes, v_uid);
    EXCEPTION WHEN OTHERS THEN
      -- No abortar todo el sync; solo loggear y continuar.
      v_ignoradas := v_ignoradas + 1;
      RAISE WARNING 'Error procesando UID %: %', v_uid, SQLERRM;
    END;
  END LOOP;

  -- Cancelar reservas Airbnb futuras que ya no aparecen
  SELECT count(*) INTO v_canceladas
    FROM public.cancelar_reservas_airbnb_huerfanas(v_chalet_id, v_uids_vigentes);

  -- Actualizar diagnóstico
  UPDATE public.calendarios_externos
     SET ultima_sync_at = now(),
         ultima_sync_status = 'ok',
         ultima_sync_mensaje =
           'Creadas: ' || v_creadas ||
           ', Actualizadas: ' || v_actualizadas ||
           ', Sin cambios: ' || v_sin_cambios ||
           ', Canceladas: ' || v_canceladas ||
           ', Ignoradas: ' || v_ignoradas,
         eventos_importados_total = eventos_importados_total + v_creadas
   WHERE id = p_calendario_id;

  RETURN QUERY SELECT
    true,
    v_creadas,
    v_actualizadas,
    v_sin_cambios,
    v_canceladas,
    v_ignoradas,
    ('Sync OK para ' || v_chalet_nombre)::text;
END;
$func$;

COMMENT ON FUNCTION public.sincronizar_calendario_airbnb IS
  'Recibe el texto de un .ics de Airbnb, lo parsea, y crea/actualiza/cancela reservas en una sola transacción. Llamada desde n8n workflow Tlalocan - iCal Import Airbnb.';
