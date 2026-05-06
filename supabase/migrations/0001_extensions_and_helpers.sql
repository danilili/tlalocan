-- Migración 0001 — Extensiones requeridas
-- btree_gist  → necesario para EXCLUDE constraint en reservas (anti doble booking)
-- moddatetime → trigger function genérica para updated_at
-- pg_net      → llamadas HTTP async desde triggers (webhook a n8n al confirmar pago)

create extension if not exists btree_gist;
create extension if not exists moddatetime schema extensions;
create extension if not exists pg_net;
