-- Versionada retroactivamente: aplicada en prod el 2026-05-23 como
-- 20260523004511_add_external_uid_to_reservas (sesión Airbnb iCal sync).
-- NO re-aplicar en el proyecto Tlalocan actual.

-- external_uid: identificador único de plataforma externa (ej. UID de Airbnb iCal)
-- Permite re-sincronizar sin duplicar y rastrear de qué reserva externa viene cada registro.
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS external_uid text;

-- Solo una reserva con un mismo external_uid (cuando no es NULL).
-- Reservas creadas a mano o por Tlali tienen external_uid NULL (no constrains).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reservas_external_uid
  ON public.reservas (external_uid)
  WHERE external_uid IS NOT NULL;

COMMENT ON COLUMN public.reservas.external_uid IS
  'UID de la reserva en plataforma externa (Airbnb iCal, etc). Usado para idempotencia en sincronizaciones.';
