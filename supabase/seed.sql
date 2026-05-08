-- supabase/seed.sql
-- Datos iniciales aplicables a un proyecto recién migrado.
-- IMPORTANTE: el primer usuario super_admin se crea manualmente desde el dashboard
-- de Supabase Auth (con email reservaciones@tlalocanchalets.mx) y luego se
-- inserta a mano en public.usuarios — NO se hace aquí.

-- ============================================================================
-- 1. CONFIG — constantes globales del negocio
-- ============================================================================
insert into public.config (key, value, descripcion) values
  ('checkin_hora',              '15:00',                              'Hora de check-in (24h)'),
  ('checkout_hora',             '12:00',                              'Hora de check-out (24h)'),
  ('wifi_password_global',      'Pasodelciervo2026',                  'Password WiFi compartida en los 4 chalets'),
  ('codigo_chapa_global',       '2998',                               'Código de chapa compartido en los 4 chalets'),
  ('telefono_super_admin',      '+523335702682',                      'WhatsApp de Don Dani (escalación de agentes)'),
  ('email_reservaciones',       'reservaciones@tlalocanchalets.mx',   'Email principal del negocio'),
  ('sitio_web',                 'https://tlalocanchalets.mx',         'Sitio público en WordPress'),
  ('zona_horaria',              'America/Mexico_City',                'TZ usada por triggers y schedule'),
  ('hora_recordatorio_llegada', '10:00',                              'Hora para mensaje 24h antes de check-in'),
  ('hora_recordatorio_salida',  '11:00',                              'Hora para mensaje el día del check-out')
on conflict (key) do nothing;

-- ============================================================================
-- 2. TARIFAS — tarifa estándar 2026 (aplica a TODOS los chalets)
-- ============================================================================
insert into public.tarifas (
  chalet_id, nombre, vigente_desde, vigente_hasta,
  precio_lun_jue, precio_vie_sab, precio_domingo,
  iva_pct, impuesto_hospedaje_pct, prioridad
) values (
  null, 'Tarifa estándar 2026', '2026-01-01', null,
  1500, 2000, 1500,
  16, 5, 0
)
on conflict do nothing;

-- ============================================================================
-- 3. CHALETS — los 4 chalets actuales
-- (las URLs de fotos se llenan después; ver app/scripts/seed-chalets-fotos.js)
-- ============================================================================
insert into public.chalets (nombre, slug, descripcion, capacidad, fotos_url, activa, orden_display) values
  ('De La Cima',
   'de-la-cima',
   'Chalet con vista panorámica desde lo alto del conjunto.',
   2, '{}', true, 1),
  ('De La Cañada',
   'de-la-canada',
   'Chalet rodeado de vegetación, recogido sobre la cañada.',
   2, '{}', true, 2),
  ('Del Fondo',
   'del-fondo',
   'Chalet más privado, al fondo del fraccionamiento.',
   2, '{}', true, 3),
  ('De La Entrada',
   'de-la-entrada',
   'Chalet de fácil acceso, cerca de la entrada.',
   2, '{}', true, 4)
on conflict (slug) do nothing;
