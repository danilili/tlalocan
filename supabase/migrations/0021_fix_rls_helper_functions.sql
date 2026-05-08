-- Migración 0021 — Fix de helpers RLS para que auth.uid() funcione
--
-- Bug detectado en smoke test (2026-05-08): los helpers de 0016 estaban
-- declarados como SECURITY DEFINER + SET search_path TO 'public'. Esa
-- combinación hace que auth.uid() devuelva NULL al ser invocada desde
-- las políticas RLS, porque el contexto de seguridad cambia al del
-- function owner y no preserva la GUC del JWT en algunos paths.
--
-- Síntoma: el usuario hace login OK, pero useRol().rol siempre regresa
-- null, y App.jsx muestra "Tu cuenta no está activa" haciendo signOut
-- inmediato. Mismo problema bloquea queries a chalets, reservas, etc.
-- desde la app.
--
-- Fix: reescribir los helpers como SECURITY INVOKER (default) y sin
-- SET search_path. La policy SELECT de usuarios queda separada (ver
-- 0022) para evitar referencia circular.

create or replace function public.is_authenticated_user()
  returns boolean
  language sql
  stable
as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and activo = true
  );
$$;

create or replace function public.is_super_admin()
  returns boolean
  language sql
  stable
as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and activo = true and rol = 'super_admin'
  );
$$;

create or replace function public.is_admin_or_super()
  returns boolean
  language sql
  stable
as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and activo = true and rol in ('super_admin', 'admin')
  );
$$;
