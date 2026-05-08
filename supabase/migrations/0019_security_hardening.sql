-- Migración 0019 — Hardening de seguridad sugerido por get_advisors
-- 1) Mover btree_gist al esquema extensions (pg_net no soporta SET SCHEMA, se queda en public)
-- 2) Pinear search_path en todas las funciones plpgsql
-- 3) Revocar EXECUTE de helpers RLS al rol anon

alter extension btree_gist set schema extensions;

alter function public.calcular_estadia(uuid, date, date)
  set search_path = public, extensions;
alter function public.recalcular_stats_huesped()
  set search_path = public, extensions;
alter function public.autogenerar_tareas_reserva()
  set search_path = public, extensions;
alter function public.asignar_staff_a_tarea()
  set search_path = public, extensions;
alter function public.notificar_pago_pendiente()
  set search_path = public, extensions;

revoke execute on function public.current_rol()           from anon, public;
revoke execute on function public.is_super_admin()        from anon, public;
revoke execute on function public.is_admin_or_super()     from anon, public;
revoke execute on function public.is_authenticated_user() from anon, public;

grant execute on function public.current_rol()           to authenticated, service_role;
grant execute on function public.is_super_admin()        to authenticated, service_role;
grant execute on function public.is_admin_or_super()     to authenticated, service_role;
grant execute on function public.is_authenticated_user() to authenticated, service_role;

revoke execute on function public.calcular_estadia(uuid, date, date) from anon, public;
grant  execute on function public.calcular_estadia(uuid, date, date) to authenticated, service_role;
