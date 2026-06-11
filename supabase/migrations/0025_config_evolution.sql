-- Migración 0025 — Settings de Evolution API en config
-- Los workflows de n8n los leen para construir URLs e instancias.
-- La apikey NO se almacena aqui — vive en una credencial de n8n por seguridad.

insert into public.config (key, value, descripcion) values
  ('evolution_server_url',      'https://placeholder.evolution.api', 'Base URL de Evolution API. Actualizar con valor real desde Supabase.'),
  ('evolution_instance_ventas', 'tlalocan_ventas',                   'Nombre de la instancia Evolution para el agente de ventas.')
on conflict (key) do update
  set descripcion = excluded.descripcion,
      updated_at  = now();
