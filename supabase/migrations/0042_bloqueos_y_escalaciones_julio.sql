-- Mejoras julio 2026 (PLAN-MEJORAS-JULIO-2026.md).
-- YA APLICADO en producción vía MCP el 2026-07-12; este archivo documenta el DDL.

-- ── A1: candado de idempotencia de escalaciones ──
-- Máximo una escalación abierta por (reserva, tipo). La CTE de
-- "Crear Escalacion" (n8n) consulta la abierta antes de insertar y
-- devuelve ya_existia para no re-avisar a Valentina.
create unique index if not exists escalaciones_abierta_unica
  on public.escalaciones (reserva_id, tipo)
  where estado = 'abierta';

-- ── B: escalaciones tipo 'llegada' (huésped perdido, sin timeout) ──
alter table public.escalaciones drop constraint escalaciones_tipo_check;
alter table public.escalaciones add constraint escalaciones_tipo_check
  check (tipo = any (array['incidencia'::text, 'checkout'::text, 'llegada'::text]));

-- Config del video de llegada (vacío hasta que exista el asset; el workflow
-- "Tlalocan - Ayuda Llegada" salta el video si está vacío).
insert into public.config (key, value)
values ('video_llegada_url', '')
on conflict (key) do nothing;

-- ── C1: origen 'bloqueo' + huésped de sistema ──
-- Renombra la clave bloqueo_staff (0 reservas la usaban; el FK de
-- reservas.origen tiene ON UPDATE CASCADE).
update public.origenes_reserva
set clave = 'bloqueo',
    etiqueta_es = 'Bloqueo',
    solo_admin = false,
    descripcion = 'Bloqueo operativo de fechas (limpieza, mantenimiento, uso interno). No es venta: monto 0, huesped de sistema. Se crea desde la app o via Tlali (Agente Interno).',
    updated_at = now()
where clave = 'bloqueo_staff';

insert into public.huespedes (nombre, telefono, origen_inicial)
values ('Bloqueo Operativo', '0000000000', 'otro')
on conflict (telefono) do nothing;

-- ── C2: RLS para bloqueos ──
-- INSERT: origen='bloqueo' no es captura manual, se permite explícito
-- (ventas incluido, con estado confirmada).
alter policy reservas_insert_admin on public.reservas
with check (
  (is_admin_or_super() or (current_rol() = 'ventas' and estado = any (array['pendiente_pago'::text, 'cotizada'::text, 'confirmada'::text])))
  and (
    exists (
      select 1 from origenes_reserva o
      where o.clave = reservas.origen and o.captura_manual and (not o.solo_admin or is_admin_or_super())
    )
    or reservas.origen = 'bloqueo'
  )
);

-- UPDATE: ventas puede modificar SOLO bloqueos (liberar = pasar a cancelada).
alter policy reservas_update_admin on public.reservas
using (is_admin_or_super() or (current_rol() = 'ventas' and origen = 'bloqueo'))
with check (is_admin_or_super() or (current_rol() = 'ventas' and origen = 'bloqueo'));

-- PENDIENTE (requiere confirmación de D4ny — datos productivos):
-- update public.reservas
-- set origen = 'bloqueo',
--     huesped_id = (select id from public.huespedes where telefono = '0000000000')
-- where folio in (1054, 1055);
