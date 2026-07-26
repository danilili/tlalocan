-- 0049: "Sitio web" deja de ser capturable a mano en la app.
-- El cableado Website↔Supabase↔Beds24 (sync MotoPress, fases 0-4) ya crea estas
-- reservas automáticamente; la captura manual solo duplicaba. El origen sigue
-- activo porque el sync lo usa como FK en reservas.origen.
update public.origenes_reserva
set captura_manual = false
where clave = 'website';
