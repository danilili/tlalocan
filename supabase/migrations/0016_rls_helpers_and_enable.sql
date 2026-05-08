-- Migración 0016 — RLS: helpers + habilitación
-- Funciones helper que devuelven el rol del usuario actual y si es admin/super_admin.
-- Marcadas SECURITY DEFINER + STABLE para que RLS pueda usarlas sin recursión.

create or replace function public.current_rol()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select rol from public.usuarios where id = auth.uid() and activo = true
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.usuarios where id = auth.uid() and activo = true and rol = 'super_admin')
$$;

create or replace function public.is_admin_or_super()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.usuarios where id = auth.uid() and activo = true and rol in ('super_admin', 'admin'))
$$;

create or replace function public.is_authenticated_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.usuarios where id = auth.uid() and activo = true)
$$;

comment on function public.current_rol()           is 'Devuelve el rol del usuario autenticado. NULL si no está activo.';
comment on function public.is_super_admin()        is 'true si el usuario actual es super_admin activo.';
comment on function public.is_admin_or_super()     is 'true si el usuario actual es admin o super_admin activo.';
comment on function public.is_authenticated_user() is 'true si el usuario actual existe en usuarios y está activo.';

-- Habilitar RLS en TODAS las tablas
alter table public.usuarios       enable row level security;
alter table public.chalets        enable row level security;
alter table public.tarifas        enable row level security;
alter table public.huespedes      enable row level security;
alter table public.reservas       enable row level security;
alter table public.staff          enable row level security;
alter table public.tareas         enable row level security;
alter table public.notificaciones enable row level security;
alter table public.config         enable row level security;
