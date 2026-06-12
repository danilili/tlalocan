-- Aplicada en prod el 2026-06-11 (pre-lanzamiento, captura de experiencia).

-- Opiniones de huéspedes sobre su estancia, capturadas por la tool n8n
-- `guardar_feedback` del agente Tlali (WhatsApp). Sustituye la invitación a
-- reseñar en Airbnb mientras no exista el perfil de Google Maps: Tlali pregunta
-- "¿qué les pareció la experiencia?" y guarda la respuesta aquí para reportes.

create table public.feedback_estancias (
    id           uuid primary key default gen_random_uuid(),
    reserva_id   uuid references public.reservas(id) on delete set null,
    huesped_id   uuid references public.huespedes(id) on delete set null,
    chalet_id    uuid references public.chalets(id) on delete set null,
    telefono     text,                 -- últimos 10 dígitos del remitente (respaldo si no se resolvió reserva)
    calificacion integer check (calificacion between 1 and 5),  -- solo si el huésped la dio explícitamente
    comentario   text not null,
    canal        text not null default 'whatsapp',
    created_at   timestamptz not null default now()
);

comment on table public.feedback_estancias is
    'Opiniones de huéspedes sobre su estancia. Las escribe la tool guardar_feedback del agente Tlali. Base para reportes de experiencia por chalet/periodo.';

create index feedback_estancias_chalet_idx on public.feedback_estancias (chalet_id, created_at);
create index feedback_estancias_created_idx on public.feedback_estancias (created_at);

-- RLS: lectura para usuarios autenticados de la app; gestión solo admins.
-- (n8n escribe por conexión Postgres directa, que no pasa por RLS.)
alter table public.feedback_estancias enable row level security;

create policy "Lectura feedback" on public.feedback_estancias
for select to authenticated
using (true);

create policy "Admins gestionan feedback" on public.feedback_estancias
for all to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.rol in ('admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.rol in ('admin', 'super_admin')
  )
);
