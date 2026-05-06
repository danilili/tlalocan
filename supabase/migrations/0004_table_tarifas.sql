-- Migración 0004 — Tabla tarifas
-- Diseñada para soportar precio por chalet, temporadas, festivos.
-- Hoy se carga UNA fila aplicable a todos los chalets todo el año.

create table public.tarifas (
  id                       uuid primary key default gen_random_uuid(),
  chalet_id                uuid references public.chalets(id) on delete cascade,  -- null = aplica a todos
  nombre                   text not null,
  vigente_desde            date not null,
  vigente_hasta            date,            -- null = sin fin definido
  precio_lun_jue           numeric(10,2) not null check (precio_lun_jue >= 0),
  precio_vie_sab           numeric(10,2) not null check (precio_vie_sab >= 0),
  precio_domingo           numeric(10,2) not null check (precio_domingo >= 0),
  iva_pct                  numeric(5,2)  not null default 16 check (iva_pct >= 0),
  impuesto_hospedaje_pct   numeric(5,2)  not null default 5  check (impuesto_hospedaje_pct >= 0),
  prioridad                int not null default 0,
  activa                   boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create trigger tarifas_set_updated_at
  before update on public.tarifas
  for each row execute procedure extensions.moddatetime(updated_at);

create index tarifas_lookup_idx on public.tarifas (chalet_id, vigente_desde, vigente_hasta) where activa = true;
create index tarifas_global_idx on public.tarifas (vigente_desde, vigente_hasta) where chalet_id is null and activa = true;

comment on table  public.tarifas             is 'Tarifas vigentes. La función calcular_estadia las resuelve.';
comment on column public.tarifas.chalet_id   is 'NULL = aplica a TODOS los chalets. Específico = override para ese chalet.';
comment on column public.tarifas.prioridad   is 'Mayor gana sobre menor cuando hay solapes.';
