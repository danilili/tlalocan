-- Migración 0020 — Buckets de Supabase Storage
-- Crea los 4 buckets definidos en PLAN.md §3.10 con sus políticas RLS.

insert into storage.buckets (id, name, public)
values
  ('chalets-fotos',     'chalets-fotos',     true),
  ('comprobantes-pago', 'comprobantes-pago', false),
  ('tareas-evidencia',  'tareas-evidencia',  false),
  ('avatars',           'avatars',           true)
on conflict (id) do nothing;

-- chalets-fotos: público para lectura, escritura solo super_admin
create policy "chalets_fotos_public_read"
  on storage.objects for select
  using (bucket_id = 'chalets-fotos');

create policy "chalets_fotos_super_admin_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chalets-fotos' and public.is_super_admin());

create policy "chalets_fotos_super_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'chalets-fotos' and public.is_super_admin());

create policy "chalets_fotos_super_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'chalets-fotos' and public.is_super_admin());

-- comprobantes-pago: privado, lectura admin/super, escritura todos los autenticados
create policy "comprobantes_admin_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes-pago' and public.is_admin_or_super());

create policy "comprobantes_authenticated_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes-pago' and public.is_authenticated_user());

create policy "comprobantes_super_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes-pago' and public.is_super_admin());

-- tareas-evidencia: privado, lectura admin/super
create policy "tareas_evidencia_admin_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'tareas-evidencia' and public.is_admin_or_super());

create policy "tareas_evidencia_authenticated_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tareas-evidencia' and public.is_authenticated_user());

create policy "tareas_evidencia_super_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'tareas-evidencia' and public.is_super_admin());

-- avatars: público, cada usuario sube/borra el suyo (subdir = uid)
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_user_write_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_user_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_user_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
