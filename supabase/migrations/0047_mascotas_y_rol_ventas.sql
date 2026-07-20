-- Mejoras app 2026-07-19 (pedidas por D4ny):
--  1. reservas.num_mascotas — para la gráfica mascotas vs sin mascota y captura en forms.
--  2. Rol ventas: puede crear cortesías (deja de ser solo_admin) y editar
--     cualquier reservación (antes solo bloqueos). Precios sigue vetado
--     (tarifas_write_super_admin intacta; tab/ruta ya eran super_admin).
-- APLICADO EN PRODUCCIÓN vía MCP el 2026-07-19.

alter table public.reservas add column if not exists num_mascotas integer not null default 0;

update public.origenes_reserva
set solo_admin = false, updated_at = now()
where clave = 'cortesia';

alter policy reservas_update_admin on public.reservas
using (is_admin_or_super() or current_rol() = 'ventas')
with check (is_admin_or_super() or current_rol() = 'ventas');
