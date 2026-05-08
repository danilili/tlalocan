-- Migración 0022 — Fix de policy SELECT en usuarios
--
-- La policy original usaba is_authenticated_user(), que a su vez consulta
-- public.usuarios. Aunque el helper era SECURITY DEFINER, la combinación
-- creaba recursión efectiva en la evaluación del RLS check.
--
-- Reemplazo: la policy SELECT permite a cualquier usuario con sesión
-- válida (auth.uid() IS NOT NULL) leer usuarios. Esto es consistente
-- con la matriz de §3.5 del PLAN.md, donde "todos los autenticados"
-- pueden ver todos los usuarios.

drop policy if exists usuarios_select_authenticated on public.usuarios;

create policy "usuarios_select_authenticated" on public.usuarios
  for select
  using (auth.uid() is not null);
