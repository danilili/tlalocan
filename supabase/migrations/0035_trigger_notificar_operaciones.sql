-- Versionada retroactivamente: aplicada en prod el 2026-05-23 como
-- 20260523135822_trigger_notificar_operaciones_al_confirmar.
-- NO re-aplicar en el proyecto Tlalocan actual.

-- Almacena la URL del webhook de operaciones en config (centralizado, fácil de cambiar)
INSERT INTO public.config (key, value)
VALUES ('webhook_notificar_operaciones',
        'https://reservalia.app.n8n.cloud/webhook/notificar-operaciones')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Función que llama al webhook vía pg_net (async, no bloquea la transacción de la reserva)
CREATE OR REPLACE FUNCTION public.notificar_operaciones_reserva_confirmada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_webhook_url text;
  v_request_id bigint;
BEGIN
  -- Solo disparar cuando:
  -- - Es INSERT directo en estado 'confirmada' (ej. iCal Airbnb)
  -- - O UPDATE que mueve estado de cualquier otro a 'confirmada'
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.estado = 'confirmada')
    OR (TG_OP = 'UPDATE' AND NEW.estado = 'confirmada' AND OLD.estado IS DISTINCT FROM 'confirmada')
  ) THEN
    RETURN NEW;
  END IF;

  -- Leer URL del webhook desde config
  SELECT value INTO v_webhook_url FROM public.config WHERE key = 'webhook_notificar_operaciones';

  -- Si no hay URL configurada, salir silenciosamente (no romper la transacción)
  IF v_webhook_url IS NULL OR length(trim(v_webhook_url)) = 0 THEN
    RAISE WARNING '[notificar_operaciones] webhook_notificar_operaciones no configurado en config';
    RETURN NEW;
  END IF;

  -- Llamada HTTP async vía pg_net (no espera respuesta, no bloquea)
  SELECT net.http_post(
    url := v_webhook_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('reserva_id', NEW.id::text)
  ) INTO v_request_id;

  -- pg_net guarda la request en net._http_response — podemos auditar después si hace falta
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notificar_operaciones_reserva_confirmada IS
  'Llama webhook n8n /webhook/notificar-operaciones cuando una reserva pasa a confirmada. Async via pg_net, no bloquea la transacción.';

-- Crear trigger (DROP IF EXISTS para idempotencia si se re-ejecuta)
DROP TRIGGER IF EXISTS reservas_notificar_operaciones ON public.reservas;
CREATE TRIGGER reservas_notificar_operaciones
AFTER INSERT OR UPDATE ON public.reservas
FOR EACH ROW
EXECUTE FUNCTION public.notificar_operaciones_reserva_confirmada();
