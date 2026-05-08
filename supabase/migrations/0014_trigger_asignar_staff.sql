-- Migración 0014 — Trigger: al insertar tarea sin staff, asignar automáticamente por puesto
-- Reglas:
--   limpieza_salida, prep_llegada → encargada_limpieza (cualquier activa)
--   mantenimiento, revision        → encargado_mantenimiento (cualquier activo)
--   otro                           → sin asignación automática
-- Si hay varios con el mismo puesto, toma el de menor created_at (estable).
-- Round-robin se puede agregar después.

create or replace function public.asignar_staff_a_tarea()
returns trigger
language plpgsql
as $$
declare
  v_puesto_objetivo text;
  v_staff_id        uuid;
begin
  if NEW.staff_id is not null then
    return NEW;
  end if;

  v_puesto_objetivo := case NEW.tipo
    when 'limpieza_salida' then 'encargada_limpieza'
    when 'prep_llegada'    then 'encargada_limpieza'
    when 'mantenimiento'   then 'encargado_mantenimiento'
    when 'revision'        then 'encargado_mantenimiento'
    else null
  end;

  if v_puesto_objetivo is null then
    return NEW;
  end if;

  select id into v_staff_id
    from public.staff
   where puesto = v_puesto_objetivo
     and activo = true
   order by created_at asc
   limit 1;

  if v_staff_id is not null then
    NEW.staff_id := v_staff_id;
  end if;

  return NEW;
end;
$$;

create trigger tareas_asignar_staff
  before insert on public.tareas
  for each row execute procedure public.asignar_staff_a_tarea();

comment on function public.asignar_staff_a_tarea() is
  'Asigna automáticamente staff por puesto al insertar tarea, si no se especificó staff_id.';
