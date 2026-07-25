-- 0048: interruptor de atención de Tlali a huéspedes (botón en el tablero).
-- El router Concierge v3 consulta este flag; si es 'false', los mensajes de
-- huéspedes no se responden (silencio total). La línea interna de staff no se apaga.

insert into public.config (key, value, descripcion)
values (
  'tlali_atencion_activa',
  'true',
  'Interruptor del bot Tlali para huéspedes (líneas ventas/estancia). true = Tlali responde; false = silencio total, atención manual. La línea interna de staff no se apaga. Se controla desde el tablero de la app.'
)
on conflict (key) do nothing;

-- La escritura directa de config es solo super_admin (config_write_super_admin);
-- este RPC permite que CUALQUIER usuario activo de la app (incluido rol ventas)
-- prenda/apague únicamente esta llave.
create or replace function public.set_tlali_atencion(p_activa boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value text;
begin
  if not public.is_authenticated_user() then
    raise exception 'No autorizado';
  end if;

  update public.config
     set value = case when p_activa then 'true' else 'false' end,
         updated_at = now()
   where key = 'tlali_atencion_activa'
   returning value into v_value;

  if v_value is null then
    insert into public.config (key, value, descripcion)
    values ('tlali_atencion_activa',
            case when p_activa then 'true' else 'false' end,
            'Interruptor del bot Tlali para huéspedes. Controlado desde el tablero.')
    returning value into v_value;
  end if;

  return v_value;
end;
$$;

revoke all on function public.set_tlali_atencion(boolean) from public;
revoke all on function public.set_tlali_atencion(boolean) from anon;
grant execute on function public.set_tlali_atencion(boolean) to authenticated;
