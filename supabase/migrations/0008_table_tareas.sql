-- Migración 0008 — Tabla tareas
-- Tareas operativas (limpieza, prep llegada, mantenimiento, revisión).
-- Auto-generadas al crear reservas (trigger en 0013) o ad-hoc desde la app.
-- Asignación automática por puesto al insertar (trigger en 0014).

create table public.tareas (
  id                       uuid primary key default gen_random_uuid(),
  chalet_id                uuid not null references public.chalets(id)  on delete cascade,
  reserva_id               uuid references public.reservas(id) on delete cascade,
  staff_id                 uuid references public.staff(id)    on delete set null,
  tipo                     text not null check (tipo in (
                             'limpieza_salida',
                             'prep_llegada',
                             'mantenimiento',
                             'revision',
                             'otro'
                           )),
  titulo                   text not null,
  descripcion              text,
  programada_para          timestamptz not null,
  estado                   text not null default 'pendiente' check (estado in (
                             'pendiente', 'en_curso', 'completada', 'cancelada', 'rechazada'
                           )),
  iniciada_en              timestamptz,
  completada_en            timestamptz,
  notas_staff              text,
  foto_evidencia           text,
  validacion_visual_ok     boolean,
  validacion_visual_notas  text,
  created_at               timestamptz not null default now()
);

create index tareas_chalet_idx          on public.tareas (chalet_id);
create index tareas_reserva_idx         on public.tareas (reserva_id);
create index tareas_staff_idx           on public.tareas (staff_id);
create index tareas_programada_idx      on public.tareas (programada_para);
create index tareas_pendientes_idx      on public.tareas (programada_para)
  where estado in ('pendiente', 'en_curso');

comment on table  public.tareas                   is 'Tareas operativas. Auto-generadas por trigger al crear reservas o ad-hoc.';
comment on column public.tareas.foto_evidencia    is 'URL en Supabase Storage. Subida por staff vía WhatsApp al Agente 3.';
comment on column public.tareas.validacion_visual_ok is 'Resultado del análisis multimodal del LLM sobre la foto enviada por el staff.';
