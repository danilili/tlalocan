-- Migración 0023 — Habilitar Realtime para public.notificaciones
--
-- Sin esto, el componente NotificationBell solo recibe el fetch inicial
-- y no se actualiza cuando llegan inserts en vivo (ej. cuando un trigger
-- crea una notificación tipo 'pago_pendiente_validar').
--
-- Equivale a Supabase Studio → Database → Replication → publication
-- supabase_realtime → toggle on para la tabla.

alter publication supabase_realtime add table public.notificaciones;
