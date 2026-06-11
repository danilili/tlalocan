-- Migración 0026 — Link de Google Maps del fraccionamiento Paso del Ciervo en config
-- Usado por el Agente 2 (Bienvenida) en el Recordatorio de Llegada 24h antes del check-in.
-- Los 4 chalets comparten el mismo estacionamiento, así que un solo link sirve para todos.
-- chalets.ubicacion_maps puede sobrescribir este global por chalet si en el futuro
-- cambia el patrón.

insert into public.config (key, value, descripcion) values
  ('ubicacion_maps_global', 'https://maps.app.goo.gl/JAqWXGMr3TMXvW6P6', 'Link Google Maps del fraccionamiento Paso del Ciervo (comparten estacionamiento los 4 chalets)')
on conflict (key) do update
  set value       = excluded.value,
      descripcion = excluded.descripcion,
      updated_at  = now();
