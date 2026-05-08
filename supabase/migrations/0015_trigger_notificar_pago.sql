-- Migración 0015 — Trigger: al subir comprobante de pago, notificar a Super Admin + Admin
-- Se dispara cuando una reserva queda en pendiente_pago Y tiene comprobante_url.

create or replace function public.notificar_pago_pendiente()
returns trigger
language plpgsql
as $$
declare
  v_chalet_nombre  text;
  v_huesped_nombre text;
begin
  -- Sólo cuando el comprobante acaba de cargarse y estado es pendiente_pago
  if NEW.estado = 'pendiente_pago'
     and NEW.comprobante_url is not null
     and (
       TG_OP = 'INSERT'
       or OLD.comprobante_url is distinct from NEW.comprobante_url
       or OLD.estado is distinct from NEW.estado
     ) then

    select c.nombre, h.nombre || coalesce(' ' || h.apellidos, '')
      into v_chalet_nombre, v_huesped_nombre
      from public.chalets   c,
           public.huespedes h
     where c.id = NEW.chalet_id and h.id = NEW.huesped_id;

    insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, link_app)
    select u.id,
           'pago_pendiente_validar',
           'Pago pendiente de validar',
           format('Reserva de %s en %s del %s al %s. Total $%s. Revisa el comprobante.',
                  v_huesped_nombre, v_chalet_nombre,
                  to_char(NEW.fecha_entrada, 'DD/MM/YYYY'),
                  to_char(NEW.fecha_salida,  'DD/MM/YYYY'),
                  to_char(NEW.monto_total,   'FM999,999.00')),
           '/reservas/' || NEW.id::text
      from public.usuarios u
     where u.activo = true
       and u.rol in ('super_admin', 'admin');
  end if;

  return NEW;
end;
$$;

create trigger reservas_notificar_pago_pendiente
  after insert or update of estado, comprobante_url on public.reservas
  for each row execute procedure public.notificar_pago_pendiente();

comment on function public.notificar_pago_pendiente() is
  'Crea notificaciones para super_admin y admin cuando llega un comprobante de pago a validar.';
