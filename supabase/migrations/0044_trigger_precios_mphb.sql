-- Sync Reservalia Fase 2 (F4): el trigger de tarifas ahora dispara TAMBIÉN
-- el push a MotoPress (workflow n8n "Tlalocan - Propagar Precios MotoPress",
-- Zce7G0MJulM3lNg9), además del push a Beds24 existente.
-- APLICADO EN PRODUCCIÓN vía MCP el 2026-07-18.

insert into public.config (key, value, descripcion) values
  ('webhook_propagar_precios_mphb',
   'https://reservalia.app.n8n.cloud/webhook/tlalocan-propagar-precios-mphb',
   'Webhook n8n que sincroniza tarifas -> seasons/rates de MotoPress (website). Sync Reservalia F4.')
on conflict (key) do update set value = excluded.value, descripcion = excluded.descripcion, updated_at = now();

create or replace function public.propagar_precios_beds24()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_webhook_url      text;
  v_webhook_url_mphb text;
  v_request_id       bigint;
begin
  select value into v_webhook_url from public.config where key = 'webhook_propagar_precios';
  select value into v_webhook_url_mphb from public.config where key = 'webhook_propagar_precios_mphb';

  if v_webhook_url is null or length(trim(v_webhook_url)) = 0 then
    raise warning '[propagar_precios] webhook_propagar_precios no configurado en config';
  else
    select net.http_post(
      url := v_webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('source', 'tarifas', 'op', TG_OP)
    ) into v_request_id;
  end if;

  if v_webhook_url_mphb is not null and length(trim(v_webhook_url_mphb)) > 0 then
    select net.http_post(
      url := v_webhook_url_mphb,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('source', 'tarifas', 'op', TG_OP)
    ) into v_request_id;
  end if;

  return coalesce(new, old);
end;
$function$;
