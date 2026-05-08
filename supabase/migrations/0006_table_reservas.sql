-- Migración 0006 — Tabla reservas
-- Núcleo transaccional. Estados:
--   cotizada → pendiente_pago → confirmada → en_curso → completada
--                                   ↓
--                               cancelada / no_show
--
-- EXCLUDE constraint previene doble booking en estados activos.
-- pendiente_pago NO bloquea: si así fuera, un huésped que no termine de pagar
-- bloquearía fechas. Mitigación: el agente avisa cuando hay otra pendiente_pago
-- en el rango antes de cotizar.

create table public.reservas (
  id                    uuid primary key default gen_random_uuid(),
  huesped_id            uuid not null references public.huespedes(id) on delete restrict,
  chalet_id             uuid not null references public.chalets(id)   on delete restrict,
  fecha_entrada         date not null,
  fecha_salida          date not null,
  num_huespedes         int  not null default 2 check (num_huespedes > 0),

  -- montos snapshot al momento de crear (no se recalculan si tarifa cambia después)
  subtotal_neto         numeric(12,2) not null check (subtotal_neto >= 0),
  iva                   numeric(12,2) not null check (iva >= 0),
  impuesto_hospedaje    numeric(12,2) not null check (impuesto_hospedaje >= 0),
  monto_total           numeric(12,2) not null check (monto_total >= 0),
  monto_pagado          numeric(12,2) not null default 0 check (monto_pagado >= 0),

  estado                text not null default 'pendiente_pago' check (estado in (
                          'cotizada',
                          'pendiente_pago',
                          'confirmada',
                          'en_curso',
                          'completada',
                          'cancelada',
                          'no_show'
                        )),

  origen                text not null default 'directa' check (origen in (
                          'directa', 'airbnb', 'booking', 'referido',
                          'agente_whatsapp', 'app_manual'
                        )),

  -- comprobante de pago
  comprobante_url        text,
  comprobante_subido_en  timestamptz,
  validado_por           uuid references public.usuarios(id) on delete set null,
  validado_en            timestamptz,
  motivo_rechazo         text,

  -- notas operativas
  notas                  text,
  notas_limpieza_post    text,    -- llenado por staff vía Agente 3 al terminar aseo de salida

  -- override de claves por reserva (futuro)
  codigo_acceso_override text,

  -- auditoría
  creada_por             uuid references public.usuarios(id) on delete set null,  -- null si la creó el agente
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  check (fecha_salida > fecha_entrada),

  -- anti doble booking: solo aplica a estados activos
  exclude using gist (
    chalet_id with =,
    daterange(fecha_entrada, fecha_salida, '[)') with &&
  ) where (estado in ('confirmada', 'en_curso'))
);

create trigger reservas_set_updated_at
  before update on public.reservas
  for each row execute procedure extensions.moddatetime(updated_at);

create index reservas_huesped_idx       on public.reservas (huesped_id);
create index reservas_chalet_fechas_idx on public.reservas (chalet_id, fecha_entrada, fecha_salida);
create index reservas_estado_idx        on public.reservas (estado);
create index reservas_fecha_entrada_idx on public.reservas (fecha_entrada);
create index reservas_pendientes_pago_idx on public.reservas (created_at desc)
  where estado = 'pendiente_pago' and comprobante_url is not null;

comment on table  public.reservas                  is 'Núcleo transaccional. EXCLUDE previene doble booking en estados activos.';
comment on column public.reservas.estado           is 'Flujo: cotizada → pendiente_pago → confirmada → en_curso → completada (o cancelada/no_show).';
comment on column public.reservas.monto_total      is 'Snapshot al crear. NO se recalcula si tarifa cambia después.';
comment on column public.reservas.notas_limpieza_post is 'Llenado por staff vía Agente 3 al terminar aseo de salida. Olvidos, averías, conducta.';
