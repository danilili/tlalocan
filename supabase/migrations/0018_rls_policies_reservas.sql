-- Migración 0018 — Políticas RLS: reservas, staff, tareas, notificaciones, config

-- ============================================================================
-- RESERVAS
-- ============================================================================
create policy "reservas_select_authenticated"
  on public.reservas for select to authenticated
  using (public.is_authenticated_user());

create policy "reservas_insert_admin"
  on public.reservas for insert to authenticated
  with check (
    public.is_admin_or_super()
    or (public.current_rol() = 'ventas' and estado in ('pendiente_pago', 'cotizada'))
  );

create policy "reservas_update_admin"
  on public.reservas for update to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

create policy "reservas_delete_super_admin"
  on public.reservas for delete to authenticated
  using (public.is_super_admin());

-- ============================================================================
-- STAFF
-- ============================================================================
create policy "staff_select_admin"
  on public.staff for select to authenticated
  using (public.is_admin_or_super());

create policy "staff_write_admin"
  on public.staff for all to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

-- ============================================================================
-- TAREAS
-- ============================================================================
create policy "tareas_select_admin"
  on public.tareas for select to authenticated
  using (public.is_admin_or_super());

create policy "tareas_write_admin"
  on public.tareas for all to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());

-- ============================================================================
-- NOTIFICACIONES — cada usuario solo ve las suyas
-- ============================================================================
create policy "notificaciones_select_own"
  on public.notificaciones for select to authenticated
  using (usuario_id = auth.uid());

create policy "notificaciones_update_own"
  on public.notificaciones for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "notificaciones_delete_own"
  on public.notificaciones for delete to authenticated
  using (usuario_id = auth.uid());

-- ============================================================================
-- CONFIG
-- ============================================================================
create policy "config_select_authenticated"
  on public.config for select to authenticated
  using (public.is_authenticated_user());

create policy "config_write_super_admin"
  on public.config for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
