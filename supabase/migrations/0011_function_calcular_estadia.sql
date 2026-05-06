-- Migración 0011 — Función calcular_estadia
-- Resuelve la tarifa aplicable y devuelve desglose noche por noche con impuestos.
-- Lógica de resolución:
--   1. Tarifa con chalet_id específico que cubra todas las fechas → mayor prioridad gana.
--   2. Si no hay específica, tarifa con chalet_id = NULL.
--   3. Si la fecha no cae en ninguna tarifa, lanza excepción.
--
-- Convención días de semana (extract dow):
--   0 = domingo  → precio_domingo
--   1-4 = lun-jue → precio_lun_jue
--   5 = viernes  → precio_vie_sab
--   6 = sábado   → precio_vie_sab

create or replace function public.calcular_estadia(
  p_chalet_id     uuid,
  p_fecha_entrada date,
  p_fecha_salida  date
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_tarifa         public.tarifas%rowtype;
  v_dia            date;
  v_dow            int;
  v_precio_neto    numeric(12,2);
  v_subtotal       numeric(12,2) := 0;
  v_iva            numeric(12,2);
  v_imp_hosp       numeric(12,2);
  v_total          numeric(12,2);
  v_noches         int := 0;
  v_desglose       jsonb := '[]'::jsonb;
  v_dia_semana_lbl text;
begin
  if p_fecha_salida <= p_fecha_entrada then
    raise exception 'fecha_salida debe ser posterior a fecha_entrada';
  end if;

  -- 1. Buscar tarifa específica del chalet que cubra TODAS las fechas
  select *
    into v_tarifa
    from public.tarifas
   where activa = true
     and chalet_id = p_chalet_id
     and vigente_desde <= p_fecha_entrada
     and (vigente_hasta is null or vigente_hasta >= p_fecha_salida - 1)
   order by prioridad desc, created_at desc
   limit 1;

  -- 2. Si no hay específica, buscar global (chalet_id = NULL)
  if not found then
    select *
      into v_tarifa
      from public.tarifas
     where activa = true
       and chalet_id is null
       and vigente_desde <= p_fecha_entrada
       and (vigente_hasta is null or vigente_hasta >= p_fecha_salida - 1)
     order by prioridad desc, created_at desc
     limit 1;
  end if;

  if not found then
    raise exception 'No existe tarifa vigente para chalet % entre % y %',
      p_chalet_id, p_fecha_entrada, p_fecha_salida;
  end if;

  -- Iterar noches (rango [entrada, salida))
  v_dia := p_fecha_entrada;
  while v_dia < p_fecha_salida loop
    v_dow := extract(dow from v_dia);
    case v_dow
      when 0 then
        v_precio_neto := v_tarifa.precio_domingo;
        v_dia_semana_lbl := 'dom';
      when 5 then
        v_precio_neto := v_tarifa.precio_vie_sab;
        v_dia_semana_lbl := 'vie';
      when 6 then
        v_precio_neto := v_tarifa.precio_vie_sab;
        v_dia_semana_lbl := 'sab';
      else
        v_precio_neto := v_tarifa.precio_lun_jue;
        v_dia_semana_lbl := case v_dow
                              when 1 then 'lun'
                              when 2 then 'mar'
                              when 3 then 'mie'
                              when 4 then 'jue'
                            end;
    end case;

    v_subtotal := v_subtotal + v_precio_neto;
    v_noches   := v_noches + 1;
    v_desglose := v_desglose || jsonb_build_object(
      'fecha',       to_char(v_dia, 'YYYY-MM-DD'),
      'dia_semana',  v_dia_semana_lbl,
      'precio_neto', v_precio_neto
    );

    v_dia := v_dia + 1;
  end loop;

  v_iva       := round(v_subtotal * v_tarifa.iva_pct / 100, 2);
  v_imp_hosp  := round(v_subtotal * v_tarifa.impuesto_hospedaje_pct / 100, 2);
  v_total     := v_subtotal + v_iva + v_imp_hosp;

  return jsonb_build_object(
    'noches',                v_noches,
    'desglose',              v_desglose,
    'subtotal_neto',         v_subtotal,
    'iva',                   v_iva,
    'iva_pct',               v_tarifa.iva_pct,
    'impuesto_hospedaje',    v_imp_hosp,
    'impuesto_hospedaje_pct', v_tarifa.impuesto_hospedaje_pct,
    'total',                 v_total,
    'tarifa_aplicada',       v_tarifa.nombre,
    'tarifa_id',             v_tarifa.id
  );
end;
$$;

comment on function public.calcular_estadia(uuid, date, date) is
  'Devuelve desglose JSON de la estadía con impuestos. Usado por la app y por el agente de ventas.';
