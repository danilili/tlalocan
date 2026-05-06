-- Migración 0010 — Tabla config
-- Constantes del negocio en DB (no en código), editables por Super Admin
-- desde la app sin redeploy.

create table public.config (
  key         text primary key,
  value       text not null,
  descripcion text,
  updated_at  timestamptz not null default now()
);

create trigger config_set_updated_at
  before update on public.config
  for each row execute procedure extensions.moddatetime(updated_at);

comment on table public.config is 'Configuración global del negocio. Editable por Super Admin desde la app.';
