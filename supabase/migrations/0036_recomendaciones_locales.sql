-- Aplicada en prod el 2026-06-11 (Fase 4, agente conversacional de estancia).

-- Tabla de lugares recomendados cerca de Tlalocan (Mazamitla).
-- Leída por la tool n8n `recomendaciones_locales` del agente Tlali (Fase 4).
-- Don Dani cura el contenido; el seed inicial es mínimo y genérico.

create table public.recomendaciones_locales (
    id uuid primary key default gen_random_uuid(),
    categoria text not null check (categoria in ('restaurante', 'cafe', 'atractivo', 'actividad', 'servicio', 'otro')),
    nombre text not null,
    descripcion text,
    ubicacion_maps text,
    distancia_min integer,            -- minutos en auto desde los chalets
    activo boolean not null default true,
    orden integer not null default 100,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.recomendaciones_locales is
    'Lugares recomendados cerca de Tlalocan. Los lee la tool recomendaciones_locales del agente Tlali.';

drop trigger if exists trg_recomendaciones_locales_updated_at on public.recomendaciones_locales;
create trigger trg_recomendaciones_locales_updated_at
before update on public.recomendaciones_locales
for each row execute function public.set_updated_at();

-- RLS: lectura para cualquier usuario autenticado de la app; escritura solo admins.
alter table public.recomendaciones_locales enable row level security;

create policy "Lectura recomendaciones" on public.recomendaciones_locales
for select to authenticated
using (true);

create policy "Admins gestionan recomendaciones" on public.recomendaciones_locales
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

-- Seed mínimo (landmarks conocidos; Don Dani agrega restaurantes/cafés específicos)
insert into public.recomendaciones_locales (categoria, nombre, descripcion, distancia_min, orden) values
  ('atractivo', 'Centro de Mazamitla', 'Pueblo Mágico: plaza principal, parroquia de San Cristóbal, portales y artesanías. Ideal para pasear y cenar.', 15, 10),
  ('atractivo', 'Cascada El Salto', 'Cascada de ~30 metros en el bosque, a la que se llega con una caminata corta. Imperdible si les gusta la naturaleza.', 25, 20),
  ('actividad', 'Parques de aventura', 'En los alrededores hay parques con tirolesas, cuatrimotos y paseos a caballo en el bosque.', 20, 30),
  ('servicio', 'Súper y farmacias', 'En el centro de Mazamitla encuentran supermercados, farmacias y cajeros.', 15, 40);
