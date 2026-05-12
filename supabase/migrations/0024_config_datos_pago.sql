-- Migración 0024 — Datos bancarios y reglas de pago en config
-- Usados por el Agente 1 (Ventas) para informar al huésped al cobrar el anticipo
-- y por el Agente 2 para cobrar el saldo restante 48h antes del check-in.

insert into public.config (key, value, descripcion) values
  ('clabe_bancaria',            '002320702360329478', 'CLABE para transferencias SPEI'),
  ('cuenta_bancaria',           '6032947',            'Numero de cuenta'),
  ('sucursal_bancaria',         '7023',               'Sucursal del banco'),
  ('banco_pago',                'Citibanamex',        'Banco al que pertenece la cuenta'),
  ('beneficiario_pago',         'Giovanna',           'Nombre del beneficiario de la transferencia'),
  ('anticipo_porcentaje',       '50',                 'Porcentaje del total que se cobra como anticipo al reservar'),
  ('saldo_horas_antes_checkin', '48',                 'Horas antes del check-in en que se cobra el saldo restante')
on conflict (key) do update
  set value       = excluded.value,
      descripcion = excluded.descripcion,
      updated_at  = now();
