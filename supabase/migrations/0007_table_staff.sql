-- Migración 0007 — Tabla staff
-- Personal operativo (limpieza, mantenimiento). Identificado por puesto, no por nombre.
-- nombre_visible es opcional para personalizar mensajes si Don Dani lo desea.

create table public.staff (
  id              uuid primary key default gen_random_uuid(),
  puesto          text not null check (puesto in (
                    'encargada_limpieza',
                    'encargado_mantenimiento',
                    'otro'
                  )),
  nombre_visible  text,
  telefono        text not null unique,
  activo          boolean not null default true,
  created_at      timestamptz not null default now()
);

create index staff_puesto_activo_idx on public.staff (puesto) where activo = true;

comment on table  public.staff               is 'Personal operativo. Coordinado por el Agente 3 vía WhatsApp.';
comment on column public.staff.puesto        is 'Determina la asignación automática de tareas (ver trigger en 0014).';
comment on column public.staff.nombre_visible is 'Opcional. Si null, los mensajes usan el puesto.';
