-- Migración 0027 — Agrega tipo 'saldo_no_pagado' al check constraint de notificaciones
-- Usado por el Agente 2 (Bienvenida) cuando una reserva está a 24h del check-in y
-- el huésped todavía no pagó el saldo restante. La notificación va a super_admin y
-- admin para que Don Dani decida si seguir, mover, o cancelar.

alter table public.notificaciones
  drop constraint notificaciones_tipo_check;

alter table public.notificaciones
  add constraint notificaciones_tipo_check
  check (tipo in (
    'pago_pendiente_validar',
    'reserva_nueva',
    'tarea_asignada',
    'tarea_completada',
    'tarea_rechazada',
    'huesped_pregunta',
    'saldo_no_pagado',
    'sistema'
  ));
