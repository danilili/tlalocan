-- Migración 0012 — Trigger: al pasar reserva a "completada", recalcular stats del huésped
-- Recalcula desde cero (no incrementa) para evitar drift.

create or replace function public.recalcular_stats_huesped()
returns trigger
language plpgsql
as $$
begin
  -- Solo actuar cuando el estado pasa A completada
  if (TG_OP = 'UPDATE' and NEW.estado = 'completada' and OLD.estado is distinct from 'completada')
     or (TG_OP = 'INSERT' and NEW.estado = 'completada') then

    update public.huespedes h
       set total_noches    = coalesce(s.total_noches, 0),
           total_estancias = coalesce(s.total_estancias, 0),
           total_gastado   = coalesce(s.total_gastado, 0),
           primera_visita  = s.primera_visita,
           ultima_visita   = s.ultima_visita,
           updated_at      = now()
      from (
        select sum(fecha_salida - fecha_entrada)::int as total_noches,
               count(*)::int                          as total_estancias,
               sum(monto_total)                        as total_gastado,
               min(fecha_entrada)                      as primera_visita,
               max(fecha_entrada)                      as ultima_visita
          from public.reservas
         where huesped_id = NEW.huesped_id
           and estado = 'completada'
      ) s
     where h.id = NEW.huesped_id;
  end if;

  return NEW;
end;
$$;

create trigger reservas_recalcular_stats_huesped
  after insert or update of estado on public.reservas
  for each row execute procedure public.recalcular_stats_huesped();

comment on function public.recalcular_stats_huesped() is
  'Recalcula total_noches/estancias/gastado/visitas del huésped cuando una reserva pasa a completada.';
