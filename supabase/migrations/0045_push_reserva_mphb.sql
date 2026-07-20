-- Sync Reservalia Fase 3 (F2): reservas de Supabase → bookings en MotoPress (website).
-- Espejo de push_reserva_beds24() pero hacia el website. Diferencias:
--  · SIN filtro es_canal_externo: las reservas de Airbnb TAMBIÉN bloquean el website
--    (ese es el objetivo de F2). Los bloqueos staff igual.
--  · Anti-eco F1 (futuro): una reserva nacida en el website se inserta ya con
--    mphb_booking_id, así que 'confirmada + mphb_booking_id null' no dispara.
-- APLICADO EN PRODUCCIÓN vía MCP el 2026-07-18.

insert into public.config (key, value, descripcion) values
  ('webhook_mphb_push_reserva',
   'https://reservalia.app.n8n.cloud/webhook/tlalocan-push-reserva-mphb',
   'Webhook n8n que crea/cancela bookings en MotoPress (website) al confirmar/cancelar reservas. Sync Reservalia F2.')
on conflict (key) do update set value = excluded.value, descripcion = excluded.descripcion, updated_at = now();

create or replace function public.push_reserva_mphb()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare v_url text; v_op text; v_req bigint;
        v_id uuid; v_bid bigint;
begin
  if TG_OP = 'DELETE' then
    if OLD.mphb_booking_id is null then return OLD; end if;
    v_op := 'release'; v_id := OLD.id; v_bid := OLD.mphb_booking_id;
  else
    if NEW.estado = 'confirmada' and NEW.mphb_booking_id is null
       and (TG_OP = 'INSERT' or NEW.estado is distinct from OLD.estado) then
      v_op := 'block'; v_id := NEW.id; v_bid := null;
    elsif NEW.estado in ('cancelada','no_show') and NEW.mphb_booking_id is not null
       and (TG_OP = 'INSERT' or NEW.estado is distinct from OLD.estado) then
      v_op := 'release'; v_id := NEW.id; v_bid := NEW.mphb_booking_id;
    else
      return NEW;
    end if;
  end if;

  select value into v_url from public.config where key = 'webhook_mphb_push_reserva';
  if v_url is null or length(trim(v_url)) = 0 then
    raise warning '[push_reserva_mphb] webhook no configurado'; return coalesce(NEW, OLD);
  end if;

  select net.http_post(
    url := v_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('reserva_id', v_id, 'op', v_op, 'mphb_booking_id', v_bid)
  ) into v_req;
  return coalesce(NEW, OLD);
end; $function$;

drop trigger if exists reservas_push_mphb on public.reservas;
create trigger reservas_push_mphb
  after insert or update or delete on public.reservas
  for each row execute function public.push_reserva_mphb();
