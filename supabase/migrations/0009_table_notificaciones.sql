-- Migración 0009 — Tabla notificaciones
-- Notificaciones in-app, leídas por la app vía Supabase Realtime.
-- Email se manda en paralelo desde n8n para tipos críticos.

create table public.notificaciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios(id) on delete cascade,
  tipo        text not null check (tipo in (
                'pago_pendiente_validar',
                'reserva_nueva',
                'tarea_asignada',
                'tarea_completada',
                'tarea_rechazada',
                'huesped_pregunta',
                'sistema'
              )),
  titulo      text not null,
  mensaje     text not null,
  link_app    text,
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);

create index notificaciones_usuario_idx       on public.notificaciones (usuario_id, created_at desc);
create index notificaciones_no_leidas_idx     on public.notificaciones (usuario_id, created_at desc)
  where leida = false;

comment on table  public.notificaciones        is 'Notificaciones in-app. Realtime habilitado. Email paralelo desde n8n para críticas.';
