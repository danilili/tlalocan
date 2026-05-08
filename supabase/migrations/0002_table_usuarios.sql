-- Migración 0002 — Tabla usuarios
-- Extiende auth.users con rol y datos del negocio.
-- Va primero porque otras tablas (reservas.validado_por, etc.) la referencian.

create table public.usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  rol         text not null check (rol in ('super_admin', 'admin', 'ventas')),
  telefono    text,
  avatar_url  text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger usuarios_set_updated_at
  before update on public.usuarios
  for each row execute procedure extensions.moddatetime(updated_at);

create index usuarios_rol_activo_idx on public.usuarios (rol) where activo = true;

comment on table  public.usuarios            is 'Extensión de auth.users con rol y metadatos del negocio.';
comment on column public.usuarios.rol        is 'super_admin | admin | ventas. Permisos en RLS.';
comment on column public.usuarios.activo     is 'Soft-disable: false bloquea acceso vía RLS sin borrar el usuario de auth.';
