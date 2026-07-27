-- 0050: buzón de mensajes WhatsApp que agotaron los reintentos largos del
-- subworkflow "Enviar WhatsApp Confiable" (incidente 26-jul: Evolution caído
-- 32 min y los mensajes se perdían sin rastro). n8n escribe aquí y notifica
-- a admins; el reenvío es manual (marcar reenviado_en al procesar).
create table if not exists public.mensajes_no_enviados (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  origen text,
  endpoint text not null,
  server_url text not null,
  instance text not null,
  body jsonb not null,
  error text,
  reenviado_en timestamptz
);

-- Solo n8n (conexión directa postgres) lo usa; la app no lo lee aún.
alter table public.mensajes_no_enviados enable row level security;
