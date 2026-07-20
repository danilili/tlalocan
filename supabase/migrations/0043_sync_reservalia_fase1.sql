-- Sync Reservalia Fase 1 (SPEC-sync-tlalocan.md §2.3 y §6).
-- PENDIENTE DE APLICAR — preparado el 2026-07-18; aplicar al arrancar Fase 1.
-- El esquema existente ya cubre el lado Beds24; esto agrega solo el lado MotoPress.

-- ── Mapping de canales: chalets hace el papel de channel_mapping ──
-- mphb_type_id: ID del accommodation type en MotoPress. Confirmado idéntico
-- en staging (stg-36r9kc) y producción vía wp/v2/mphb_room_type (2026-07-18).
-- mphb_accommodation_id: unidad física (CPT mphb_room); es lo que exige el
-- POST /bookings (reserved_accommodations[].accommodation). Mapeo 1:1 con el
-- type. IDs confirmados en staging 2026-07-18; VERIFICAR EN PROD al cutover
-- (Fase 5) con GET /accommodations — no hay endpoint público para compararlos.
-- mphb_rate_id: rate único por chalet (el "Reembolsable"). D4ny decidió
-- 2026-07-18 quitar No-Reembolsable del sitio; esos rates quedaron status
-- 'disabled' en staging (no borrados: bookings históricos los referencian).
alter table public.chalets add column if not exists mphb_type_id integer;
alter table public.chalets add column if not exists mphb_accommodation_id integer;
alter table public.chalets add column if not exists mphb_rate_id integer;

update public.chalets set mphb_type_id = 86,  mphb_accommodation_id = 1349, mphb_rate_id = 156 where slug = 'de-la-canada'  and mphb_type_id is null;
update public.chalets set mphb_type_id = 100, mphb_accommodation_id = 1350, mphb_rate_id = 159 where slug = 'de-la-entrada' and mphb_type_id is null;
update public.chalets set mphb_type_id = 111, mphb_accommodation_id = 1351, mphb_rate_id = 161 where slug = 'del-fondo'     and mphb_type_id is null;
update public.chalets set mphb_type_id = 124, mphb_accommodation_id = 130,  mphb_rate_id = 163 where slug = 'de-la-cima'    and mphb_type_id is null;

-- ── Idempotencia lado website: referencia externa a MotoPress ──
-- Complementa a beds24_booking_id/codigo_airbnb. Clave del upsert de F1
-- y anti-eco de F2 (una reserva creada por el sync en MotoPress guarda
-- aquí su ID para que el polling no la re-importe).
alter table public.reservas add column if not exists mphb_booking_id bigint;
create unique index if not exists reservas_mphb_booking_id_unica
  on public.reservas (mphb_booking_id)
  where mphb_booking_id is not null;

-- ── Log de sincronización (auditoría y debugging de F1–F4) ──
-- Escriben los workflows n8n (service role, bypass RLS). La app solo lee (admins).
create table if not exists public.sync_log (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  flujo       text not null,   -- 'F1'..'F4' | 'reconciliacion'
  direccion   text,            -- ej. 'supabase→mphb', 'beds24→supabase'
  entidad     text,            -- 'booking' | 'price'
  ref         text,            -- folio, mphb_booking_id, beds24_booking_id...
  resultado   text not null,   -- 'ok' | 'error' | 'skipped'
  detalle     jsonb
);

create index if not exists sync_log_ts_idx on public.sync_log (ts desc);
create index if not exists sync_log_flujo_resultado_idx on public.sync_log (flujo, resultado);

alter table public.sync_log enable row level security;

drop policy if exists sync_log_select_admin on public.sync_log;
create policy sync_log_select_admin on public.sync_log
  for select using (is_admin_or_super());
-- Sin policies de INSERT/UPDATE/DELETE: solo escribe n8n con service role.
