-- Migración 0013 — Trigger: al confirmar reserva, auto-generar tareas
-- Crea: prep_llegada (día entrada 11:00) y limpieza_salida (día salida 12:00).
-- Las tareas se asignan automáticamente al staff por puesto (trigger 0014).
-- Si la reserva nace pendiente_pago, las tareas se generan cuando pase a confirmada.

create or replace function public.autogenerar_tareas_reserva()
returns trigger
language plpgsql
as $$
declare
  v_zona text;
begin
  -- zona horaria desde config (default America/Mexico_City si no está)
  select value into v_zona from public.config where key = 'zona_horaria';
  v_zona := coalesce(v_zona, 'America/Mexico_City');

  -- INSERT directo en confirmada, o UPDATE que mueve a confirmada por primera vez
  if (TG_OP = 'INSERT' and NEW.estado = 'confirmada')
     or (TG_OP = 'UPDATE' and NEW.estado = 'confirmada' and OLD.estado is distinct from 'confirmada') then

    -- Evitar duplicados si esta reserva ya generó tareas alguna vez
    if not exists (select 1 from public.tareas where reserva_id = NEW.id) then

      insert into public.tareas (chalet_id, reserva_id, tipo, titulo, descripcion, programada_para)
      values
        (NEW.chalet_id, NEW.id, 'prep_llegada',
         'Preparar llegada',
         'Preparar el chalet antes del check-in del huésped.',
         (NEW.fecha_entrada::text || ' 11:00')::timestamp at time zone v_zona),
        (NEW.chalet_id, NEW.id, 'limpieza_salida',
         'Limpieza después de salida',
         'Limpieza completa al terminar la estancia. Reportar olvidos o daños en notas.',
         (NEW.fecha_salida::text || ' 12:00')::timestamp at time zone v_zona);
    end if;
  end if;

  return NEW;
end;
$$;

create trigger reservas_autogenerar_tareas
  after insert or update of estado on public.reservas
  for each row execute procedure public.autogenerar_tareas_reserva();

comment on function public.autogenerar_tareas_reserva() is
  'Crea tareas prep_llegada y limpieza_salida cuando la reserva pasa a confirmada.';
