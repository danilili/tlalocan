-- Sync Reservalia Fase 4 (F1): bookings nacidos en el website (MotoPress) → Supabase.
-- Función espejo de sincronizar_reserva_beds24(): upsert atómico con resolución de
-- huésped. La reserva se inserta CON mphb_booking_id (anti-eco del push F2) y con
-- origen 'website' (es_canal_externo=false → el trigger push_reserva_beds24 la
-- empuja a Beds24/Airbnb automáticamente).
-- La llama el workflow n8n "Tlalocan - Sync Bookings Website".
-- APLICADO EN PRODUCCIÓN vía MCP el 2026-07-18.

insert into public.config (key, value, descripcion) values
  ('mphb_webhook_secret',
   '81166af869ca36e330a1097ca140fa26102d3e15009796ec',
   'Secreto compartido con el plugin tlalocan-sync de WordPress para el ping de bookings. Sync Reservalia F1.')
on conflict (key) do update set value = excluded.value, descripcion = excluded.descripcion, updated_at = now();

create or replace function public.sincronizar_booking_mphb(p jsonb)
 returns table(reserva_id uuid, accion text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_bid bigint; v_status text; v_estado text;
  v_in date; v_out date; v_num int;
  v_acc_id int; v_chalet_id uuid;
  v_nombre text; v_apellidos text; v_email text; v_tel_raw text; v_tel text;
  v_subtotal numeric; v_iva numeric; v_ish numeric; v_total numeric;
  v_huesped_id uuid; v_existing_id uuid; v_existing_estado text; v_new_id uuid;
begin
  v_bid := nullif(p->>'id','')::bigint;
  if v_bid is null then raise exception 'payload MotoPress sin id'; end if;

  v_status := lower(coalesce(p->>'status',''));
  if v_status = 'confirmed' then v_estado := 'confirmada';
  elsif v_status in ('cancelled','abandoned') then v_estado := 'cancelada';
  else return; end if;

  select r.id, r.estado into v_existing_id, v_existing_estado
  from public.reservas r where r.mphb_booking_id = v_bid limit 1;

  -- Booking ya importado
  if v_existing_id is not null then
    if v_estado = 'cancelada' and v_existing_estado not in ('cancelada','no_show') then
      -- Cancelación nacida en el website: el UPDATE dispara los triggers que
      -- liberan Beds24/Airbnb y (eco inofensivo) re-cancelan en MotoPress.
      update public.reservas set estado = 'cancelada', updated_at = now()
       where id = v_existing_id;
      insert into public.sync_log (flujo, direccion, entidad, ref, resultado, detalle)
      values ('F1','mphb→supabase','booking', v_bid::text, 'ok',
              jsonb_build_object('accion','cancelada','reserva_id',v_existing_id));
      return query select v_existing_id, 'cancelada'::text;
    end if;
    return; -- sin cambios que aplicar
  end if;

  if v_estado = 'cancelada' then return; end if; -- cancelado sin reserva conocida

  -- Crear reserva nueva (booking confirmado nacido en el website)
  v_acc_id := nullif(p->>'accommodation_id','')::int;
  select id into v_chalet_id from public.chalets where mphb_accommodation_id = v_acc_id;
  if v_chalet_id is null then
    raise exception 'accommodation % no mapeado a ningun chalet', v_acc_id;
  end if;

  v_in := (p->>'check_in')::date;
  v_out := (p->>'check_out')::date;
  if v_in is null or v_out is null or v_out <= v_in then
    raise exception 'fechas invalidas: % a %', v_in, v_out;
  end if;
  v_num := greatest(1, coalesce(nullif(p->>'adults','')::int, 2)
                     + coalesce(nullif(p->>'children','')::int, 0));

  v_nombre := coalesce(nullif(trim(p->>'first_name'),''), 'Huésped Website');
  v_apellidos := nullif(trim(p->>'last_name'),'');
  v_email := nullif(trim(p->>'email'),'');
  v_tel_raw := nullif(trim(p->>'phone'),'');
  v_tel := nullif(right(regexp_replace(coalesce(v_tel_raw,''),'[^0-9]','','g'),10),'');
  if v_tel is not null and length(v_tel) < 10 then v_tel := null; end if;

  v_subtotal := coalesce(nullif(p->>'subtotal','')::numeric, 0);
  v_iva := coalesce(nullif(p->>'iva','')::numeric, 0);
  v_ish := coalesce(nullif(p->>'ish','')::numeric, 0);
  v_total := coalesce(nullif(p->>'total','')::numeric, v_subtotal + v_iva + v_ish);

  if v_tel is not null then
    select id into v_huesped_id from public.huespedes
    where right(regexp_replace(telefono,'[^0-9]','','g'),10) = v_tel
    order by created_at asc nulls last limit 1;
  end if;
  if v_huesped_id is null and v_email is not null then
    select id into v_huesped_id from public.huespedes
    where lower(email) = lower(v_email)
    order by created_at asc nulls last limit 1;
  end if;
  if v_huesped_id is not null then
    update public.huespedes
       set nombre = case when coalesce(nullif(trim(nombre),''),'Huésped')
                              in ('Huésped','Huésped Website') then v_nombre else nombre end,
           apellidos = coalesce(apellidos, v_apellidos),
           email = coalesce(email, v_email),
           telefono = case when telefono like '+web-%' and v_tel is not null then v_tel_raw else telefono end,
           updated_at = now()
     where id = v_huesped_id;
  else
    insert into public.huespedes (nombre, apellidos, telefono, email, origen_inicial, notas)
    values (v_nombre, v_apellidos, coalesce(v_tel_raw, '+web-'||v_bid),
            v_email, 'website', 'Auto-creado desde el website (MotoPress).')
    returning id into v_huesped_id;
  end if;

  insert into public.reservas (
    huesped_id, chalet_id, fecha_entrada, fecha_salida, num_huespedes,
    subtotal_neto, iva, impuesto_hospedaje, monto_total, monto_pagado,
    estado, origen, mphb_booking_id, external_uid, notas
  ) values (
    v_huesped_id, v_chalet_id, v_in, v_out, v_num,
    v_subtotal, v_iva, v_ish, v_total, v_total,
    'confirmada', 'website', v_bid, 'mphb:'||v_bid,
    'Reserva del website (MotoPress #'||v_bid||').'
  ) returning id into v_new_id;

  insert into public.sync_log (flujo, direccion, entidad, ref, resultado, detalle)
  values ('F1','mphb→supabase','booking', v_bid::text, 'ok',
          jsonb_build_object('accion','creada','reserva_id',v_new_id,'total',v_total));
  return query select v_new_id, 'creada'::text;
end;
$function$;
