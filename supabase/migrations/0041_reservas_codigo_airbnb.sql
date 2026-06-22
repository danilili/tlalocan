-- 0041_reservas_codigo_airbnb.sql
-- Aplicada en prod 2026-06-22 vía MCP (apply_migration reservas_codigo_airbnb).
--
-- Código de confirmación de Airbnb (tipo HMXXXXXXXX) capturado a mano para
-- conciliación con pagos/reportes de Airbnb. El iCal NO entrega este código
-- (solo el external_uid opaco '..@airbnb.com'), por eso es manual.
alter table public.reservas add column if not exists codigo_airbnb text;
