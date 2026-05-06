-- Migración 0017 — Políticas RLS: usuarios + lecturas universales para autenticados
-- Matriz de roles está documentada en PLAN.md §3.5

-- ============================================================================
-- USUARIOS
-- ============================================================================
create policy "usuarios_select_authenticated"
  on public.usuarios for select to authenticated
  using (public.is_authenticated_user());

create policy "usuarios_update_self"
  on public.usuarios for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and rol = (select rol from public.usuarios where id = auth.uid()));

create policy "usuarios_insert_super_admin"
  on public.usuarios for insert to authenticated
  with check (public.is_super_admin());

create policy "usuarios_update_super_admin"
  on public.usuarios for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "usuarios_delete_super_admin"
  on public.usuarios for delete to authenticated
  using (public.is_super_admin());

-- ============================================================================
-- CHALETS
-- ============================================================================
create policy "chalets_select_authenticated"
  on public.chalets for select to authenticated
  using (public.is_authenticated_user());

create policy "chalets_write_super_admin"
  on public.chalets for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================================
-- TARIFAS
-- ============================================================================
create policy "tarifas_select_authenticated"
  on public.tarifas for select to authenticated
  using (public.is_authenticated_user());

create policy "tarifas_write_super_admin"
  on public.tarifas for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================================
-- HUESPEDES
-- ============================================================================
create policy "huespedes_select_authenticated"
  on public.huespedes for select to authenticated
  using (public.is_authenticated_user());

create policy "huespedes_insert_authenticated"
  on public.huespedes for insert to authenticated
  with check (public.is_authenticated_user());

create policy "huespedes_update_authenticated"
  on public.huespedes for update to authenticated
  using (public.is_authenticated_user())
  with check (public.is_authenticated_user());

create policy "huespedes_delete_admin"
  on public.huespedes for delete to authenticated
  using (public.is_admin_or_super());
