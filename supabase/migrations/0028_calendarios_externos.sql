-- Versionada retroactivamente: aplicada en prod el 2026-05-23 como
-- 20260523004204_create_calendarios_externos (sesión Airbnb iCal sync).
-- NO re-aplicar en el proyecto Tlalocan actual.

-- Tabla para almacenar URLs iCal de plataformas externas (Airbnb principalmente).
-- Un workflow horario en n8n lee estas URLs, descarga el .ics y sincroniza
-- reservas en la tabla `reservas` con origen='airbnb'.

CREATE TABLE public.calendarios_externos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chalet_id uuid NOT NULL REFERENCES public.chalets(id) ON DELETE CASCADE,
    plataforma text NOT NULL CHECK (plataforma IN ('airbnb', 'booking', 'vrbo', 'motopress', 'otro')),
    ical_url text NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    -- Diagnóstico de sincronización
    ultima_sync_at timestamptz,
    ultima_sync_status text CHECK (ultima_sync_status IN ('ok', 'error') OR ultima_sync_status IS NULL),
    ultima_sync_mensaje text,
    eventos_importados_total integer NOT NULL DEFAULT 0,
    -- Auditoría
    notas text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- Un chalet no debe tener dos veces la misma plataforma activa
    UNIQUE (chalet_id, plataforma)
);

COMMENT ON TABLE public.calendarios_externos IS
    'URLs iCal de plataformas externas (Airbnb, etc) que n8n sincroniza hacia tabla reservas.';

CREATE INDEX idx_calendarios_externos_chalet ON public.calendarios_externos(chalet_id);
CREATE INDEX idx_calendarios_externos_activo ON public.calendarios_externos(activo) WHERE activo = true;

-- Trigger para updated_at automatico
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendarios_externos_updated_at ON public.calendarios_externos;
CREATE TRIGGER trg_calendarios_externos_updated_at
BEFORE UPDATE ON public.calendarios_externos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: solo admins y super_admins pueden leer/escribir
ALTER TABLE public.calendarios_externos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestionan calendarios externos" ON public.calendarios_externos
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.rol IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.rol IN ('admin', 'super_admin')
  )
);
