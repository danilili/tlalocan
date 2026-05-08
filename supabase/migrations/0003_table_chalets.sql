-- Migración 0003 — Tabla chalets
-- Inventario de propiedades. 4 hoy, crecerá a 7.

create table public.chalets (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null unique,
  slug                  text not null unique,
  descripcion           text,
  capacidad             int  not null default 2,
  fotos_url             text[] not null default '{}',
  ubicacion_maps        text,
  instrucciones_llegada text,
  codigo_chapa          text,    -- override del global (config.codigo_chapa_global). null = hereda.
  wifi_password         text,    -- override del global (config.wifi_password_global). null = hereda.
  activa                boolean not null default true,
  orden_display         int     not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger chalets_set_updated_at
  before update on public.chalets
  for each row execute procedure extensions.moddatetime(updated_at);

create index chalets_activa_idx on public.chalets (activa) where activa = true;
create index chalets_orden_idx  on public.chalets (orden_display);

comment on table  public.chalets               is 'Inventario de chalets. Se renombró de "cabanas" a "chalets" por alineación con el negocio.';
comment on column public.chalets.slug          is 'Identificador URL-safe. Usado como subcarpeta en Storage (chalets-fotos/{slug}/).';
comment on column public.chalets.codigo_chapa  is 'Override del código global. Hoy todos heredan; preparado para diferenciación futura.';
comment on column public.chalets.wifi_password is 'Override del WiFi global. Hoy todos heredan; preparado para diferenciación futura.';
