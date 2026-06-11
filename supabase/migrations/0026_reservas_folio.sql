-- 0024_reservas_folio.sql
-- Folio corto y legible por reserva, para que el equipo de finanzas pueda
-- referenciar cuál pago valida por WhatsApp (ej. "APROBAR 1041") cuando hay
-- varias reservas pendientes a la vez. La PK sigue siendo el uuid; folio es solo
-- una referencia humana, secuencial, única.

create sequence if not exists public.reservas_folio_seq start with 1001;

alter table public.reservas
  add column if not exists folio bigint not null default nextval('public.reservas_folio_seq');

alter sequence public.reservas_folio_seq owned by public.reservas.folio;

create unique index if not exists reservas_folio_idx on public.reservas (folio);

comment on column public.reservas.folio is
  'Referencia humana corta y única de la reserva (secuencial desde 1001). Para uso en WhatsApp/UI; la PK real es id (uuid).';
