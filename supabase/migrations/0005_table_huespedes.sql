-- Migración 0005 — Tabla huespedes
-- Registro maestro de huéspedes. Stats denormalizados se recalculan vía trigger
-- al pasar reservas a "completada".

create table public.huespedes (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  apellidos             text,
  telefono              text not null unique,   -- WhatsApp con código país, ej. 5213335702682
  email                 text,
  notas                 text,
  origen_inicial        text check (origen_inicial in (
                          'website', 'airbnb', 'booking', 'referido',
                          'whatsapp_directo', 'walk_in', 'otro'
                        )),

  -- denormalizado, recalculado por trigger
  total_noches          int     not null default 0,
  total_estancias       int     not null default 0,
  total_gastado         numeric(12,2) not null default 0,
  primera_visita        date,
  ultima_visita         date,

  -- evaluación que el host hace del huésped (cómo se portó)
  evaluacion_anfitrion  int check (evaluacion_anfitrion between 1 and 5),
  evaluacion_notas      text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger huespedes_set_updated_at
  before update on public.huespedes
  for each row execute procedure extensions.moddatetime(updated_at);

create index huespedes_telefono_idx on public.huespedes (telefono);
create index huespedes_ultima_visita_idx on public.huespedes (ultima_visita desc nulls last);

comment on table  public.huespedes                      is 'Maestro de huéspedes. Stats agregados se recalculan vía trigger.';
comment on column public.huespedes.telefono             is 'Formato internacional sin +, ej. 5213335702682. Identificador natural.';
comment on column public.huespedes.evaluacion_anfitrion is 'Calificación del host hacia el huésped (1-5). Cuidado del chalet, conducta, etc.';
