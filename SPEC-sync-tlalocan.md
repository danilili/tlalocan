# SPEC — Sincronización directa Website ↔ Sistema ↔ Beds24
## Tlalocan Chalets · Proyecto "Reservalia"

**Versión:** 1.1 · 18 de julio de 2026 (hallazgos Fase 0 incorporados, ver §9)
**Objetivo:** Reemplazar la sincronización iCal actual por integración vía API entre el website (WordPress + MotoPress Hotel Booking 5.2, tema Luviana) y el sistema (Supabase como fuente de verdad, orquestado por n8n), manteniendo Beds24 como channel manager hacia Airbnb. La sincronización debe cubrir **reservaciones (bidireccional)** y **precios (unidireccional, desde Supabase)**.

---

## 1. Contexto y arquitectura

### 1.1 Estado actual

```
Airbnb ⇄ Beds24 ⇄ (iCal, comportamiento no verificado) ⇄ WordPress/MotoPress
Supabase = verdad de reservaciones (alimentado por n8n)
Precios: administrados en Supabase; Beds24 los empuja a Airbnb
Website: cobra en línea al reservar; tráfico actual ≈ 0
```

### 1.2 Arquitectura objetivo

```
                        ┌─────────────┐
                        │  SUPABASE   │  ← fuente de verdad
                        │ reservas +  │     (reservas y precios)
                        │ precios     │
                        └──────┬──────┘
                               │
                        ┌──────┴──────┐
                        │     n8n     │  ← orquestador único
                        │ (Reservalia)│
                        └──┬───────┬──┘
              REST API v1  │       │  API v2 + webhooks
                 ┌─────────┘       └──────────┐
        ┌────────┴────────┐          ┌────────┴────────┐
        │ WordPress       │          │     Beds24      │ ⇄ Airbnb
        │ MotoPress HB 5.2│          │ (channel mgr)   │
        └─────────────────┘          └─────────────────┘
```

El website se trata como **un canal más**, al mismo nivel que Airbnb. Ninguna reserva viaja directo entre WordPress y Beds24: todo pasa por n8n → Supabase.

### 1.3 Entornos

| Entorno | URL | Notas |
|---|---|---|
| Producción | tlalocanchalets.mx | No tocar hasta fase de cutover |
| Staging | https://stg-36r9kc.elementor.cloud/ | Clon de producción. ✅ **CONFIRMADO 2026-07-18: IDs de accommodation types idénticos a producción** (mismos timestamps de modificación = clon fiel) |
| Staging viejo | https://stg-dgq48l.elementor.cloud/ | Clon de mayo 2026; es al que apunta el MCP de WordPress "dani" en Claude. Mismos IDs de accommodation types. NO usar para el sync; útil solo para lecturas exploratorias |

Inventario ✅ confirmado vía `wp/v2/mphb_room_type` (público) en los 3 entornos, **4 accommodation types** (no 3):

| Chalet | mphb_type_id | slug WP |
|---|---|---|
| De La Cañada | 86 | chalet-de-la-canada |
| De La Entrada | 100 | chalet-de-la-entrada |
| Del Fondo | 111 | chalet-del-fondo |
| De La Cima | 124 | chalet-de-la-cima |

---

## 2. Sistemas, APIs y credenciales

### 2.1 MotoPress Hotel Booking REST API

- **Base:** `https://{site}/wp-json/mphb/v1/`
- **Auth:** Basic Auth con Consumer Key + Consumer Secret (se generan en WP Admin → Accommodation → Settings → Advanced → Add key, nivel Read/Write). Requiere HTTPS.
- **Endpoints relevantes (confirmar lista exacta en Fase 0 vía `GET /wp-json/mphb/v1`):**
  - `GET/POST /bookings`, `GET/PUT/DELETE /bookings/{id}` — crear reservas (incl. status confirmado), consultar, cambiar status
  - `GET /accommodation_types`, `GET /accommodations`
  - `GET/POST/PUT /rates`
  - `GET/POST/PUT/DELETE /seasons`
  - `GET /payments`
  - Availability/search de disponibilidad
- **Limitación clave:** no emite webhooks salientes. Ver §4.1.
- Modelo de precios: precio se define por **rate × season** (rangos de fechas), NO por día individual. Ver §5.

### 2.2 Beds24 API v2

- **Base:** `https://api.beds24.com/v2/` (Swagger: beds24.com/api/v2)
- **Auth:** header `token: {access_token}`. Flujo: invite code (panel: Settings → Apps & Integrations → API → Generate Invite Code, con scopes; expira en 24h) → `GET /authentication/setup` con header `code:` → devuelve access token (24h) + refresh token → renovar con `GET /authentication/token` + header `refreshToken:`.
  - D4ny ya tiene credenciales generadas. **Verificar scopes: se necesita al menos `bookings` (read+write) e `inventory` (read+write).** Si los scopes no alcanzan, generar nuevo invite code (los scopes no se pueden cambiar en un token existente).
  - n8n debe implementar renovación automática del access token (sub-workflow de auth con token guardado en Data Table de n8n o en Supabase; renovar si expirado o ante 401).
- **Endpoints relevantes:**
  - `GET /properties?includeAllRooms=true` — obtener propertyId y roomIds
  - `GET /bookings` — filtros: `modifiedFrom`, `status`, `checkInFrom/To`, etc.
  - `POST /bookings` — crear reserva; cierra disponibilidad en todos los demás canales (incl. Airbnb)
  - `POST /inventory/rooms/calendar` — precios/minStay/disponibilidad por rango de fechas: `[{roomId, calendar: [{from, to, price1, minStay}]}]`
  - `GET /inventory/rooms/calendar` — leer estado actual (útil para verificación/reconciliación)
- **Webhooks:** se habilitan por propiedad en Settings → Properties → Access → Booking webhooks (usar versión "2 - with personal data"). Apuntar al webhook de n8n. Disparan en creación/modificación/cancelación de reservas (incluye las que llegan de Airbnb).
- **Rate limits:** existen y son estrictos (con créditos por request). Diseñar con batch requests (múltiples rooms/rangos en un solo POST) y caching; backoff exponencial ante 429.

### 2.3 Supabase

- Verdad de reservaciones y de precios. MCP de Supabase disponible en el entorno de Claude. Proyecto: `spnqatgiopfjczqwlzms` (Tlalocan).
- ✅ **AUDITADO 2026-07-18: el esquema real ya cubre casi todo lo que este spec proponía crear.** NO crear `channel_mapping` ni `precios_calendario`; extender lo existente:

**Ya existe (no tocar, solo extender):**
- `chalets` — ya tiene `beds24_property_id`, `beds24_room_id`, `beds24_sync_enabled` (4 chalets activos, incl. De La Cañada). Hace el papel de `channel_mapping`.
- `reservas` — ya tiene `beds24_booking_id`, `codigo_airbnb`, `external_uid`, `estado`, `origen` (FK a `origenes_reserva`), montos con IVA/hospedaje desglosados.
- `tarifas` — **fuente maestra de precios** (rangos `vigente_desde/hasta` × `precio_lun_jue`/`precio_vie_sab`/`precio_domingo` + `prioridad`), con funciones `precio_del_dia(chalet,fecha)` y `calcular_estadia`. Sustituye a la `precios_calendario` por-día que proponía la v1.0 de este spec.
- `integraciones_tokens` — token Beds24 con refresh automático ya operando (workflows n8n existentes).
- `calendarios_externos` — config iCal legacy: **los 4 feeds Airbnb ya están `activo=false`** (apagados desde ~2026-06-25, sustituidos por el webhook Beds24). El "apagar iCal" del lado Supabase ya ocurrió.

**Por crear/agregar en Fase 1 (migración):**

```sql
-- En chalets (completa el mapping de canales):
alter table chalets add column mphb_type_id int;   -- 86/100/111/124, iguales en staging y prod
alter table chalets add column mphb_rate_id int;   -- rate base en MotoPress (obtener en Fase 0 con API keys)

-- En reservas (idempotencia lado website):
alter table reservas add column mphb_booking_id int unique;

-- Log de sincronización (auditoría y debugging)
create table sync_log (
  id          bigint generated always as identity primary key,
  ts          timestamptz default now(),
  flujo       text,    -- 'F1'..'F4'
  direccion   text,    -- ej. 'supabase→mphb'
  entidad     text,    -- 'booking' | 'price'
  ref         text,
  resultado   text,    -- 'ok' | 'error' | 'skipped'
  detalle     jsonb
);
```

### 2.4 n8n

- Instancia: reservalia.app.n8n.cloud, proyecto "Emi - Reservalia" (o proyecto nuevo "Tlalocan Sync" — decidir; recomendado separar).
- Credenciales a configurar en n8n: MotoPress (Basic Auth genérica con CK/CS de staging primero, producción después), Beds24 (HTTP header auth + sub-workflow de refresh), Supabase (ya existente).
- **Zona horaria:** todos los workflows y comparaciones de fecha en `America/Mexico_City`. Las fechas de check-in/out son date-only (sin hora) — no convertir a UTC en ningún punto del pipeline; tratar como strings `YYYY-MM-DD`.

---

## 3. Flujos de sincronización

### F1 — Reserva nace en el website (MotoPress → Supabase → Beds24)

1. Detección (ver §4): booking nuevo/modificado en MotoPress con status pagado/confirmado.
2. n8n normaliza y hace upsert en `reservas` (clave: `mphb_booking_id`). Si ya existe con mismo estado → `skipped` (anti-eco).
3. n8n hace `POST /bookings` a Beds24 con `roomId` del mapping, fechas, datos de huésped y nota `"origen: website · mphb #<id>"`. Guarda el `beds24_booking_id` devuelto.
4. Beds24 propaga el bloqueo a Airbnb.
5. Registrar en `sync_log`.

**Manejo de estados de pago:** solo sincronizar bookings con pago completado (status `confirmed` en MotoPress). Los `pending`/abandonados NO viajan a Beds24. Definir en Fase 0 qué statuses exactos usa MotoPress 5.2 con la pasarela configurada.

### F2 — Reserva nace en Airbnb (Beds24 webhook → Supabase → MotoPress)

1. Beds24 dispara webhook a n8n al recibir la reserva de Airbnb.
2. n8n upsert en `reservas` (clave: `beds24_booking_id`, origen `airbnb`).
3. **Anti-eco crítico:** si la reserva del webhook corresponde a una que n8n mismo creó (ya existe `beds24_booking_id` en Supabase, o la nota contiene `origen: website`) → terminar sin acción.
4. n8n crea booking en MotoPress: `POST /wp-json/mphb/v1/bookings` con status confirmado, fechas y accommodation del mapping. Huésped: usar los datos reales del guest pero con marcador interno (nota/`internal_notes` si el API lo expone) `"SYNC beds24 #<id>"`.
5. **Emails:** verificar en Fase 0 si el POST vía API dispara emails de confirmación al huésped desde WordPress. Si sí, desactivarlos para bookings creados por API (o usar email interno tipo `sync+<id>@tlalocanchalets.mx`) — el huésped de Airbnb ya recibió confirmación de Airbnb y un segundo email causaría confusión.
6. Guardar `mphb_booking_id` en la fila de Supabase. Registrar en `sync_log`.

### F3 — Cancelaciones y modificaciones (bidireccional)

- **Airbnb/Beds24 → sistema:** el mismo webhook de F2 trae cambios de status. Si `cancelled`: actualizar Supabase y `PUT /bookings/{mphb_booking_id}` en MotoPress para cancelar/liberar fechas.
- **Website → sistema:** la detección de F1 debe incluir bookings modificados (no solo nuevos). Si un booking web se cancela: actualizar Supabase y cancelar en Beds24 (`POST /bookings` con id + status cancelled).
- Modificación de fechas = cancelar bloque anterior + crear nuevo (más simple y seguro que edición in-place; validar en Fase 0 si Beds24/MotoPress soportan edición limpia de fechas).

### F4 — Precios (Supabase → Beds24 + MotoPress)

Fuente maestra: `precios_calendario` en Supabase.

**Trigger:** cambio en la tabla (Supabase webhook/trigger → n8n) o corrida programada diaria (respaldo). Ventana de sync: hoy + 365 días.

**Hacia Beds24 (directo, simple):**
- `POST /inventory/rooms/calendar` con rangos comprimidos: días consecutivos con mismo `precio` y `min_stay` se agrupan en un solo `{from, to, price1, minStay}`. Un POST por batch con los 3 rooms.
- Beds24 propaga a Airbnb (según la configuración de precios existente entre Beds24 y Airbnb — no tocar esa parte, ya funciona).

**Hacia MotoPress (✅ SIMPLIFICADO 2026-07-18 — el modelo encaja casi 1:1):**
- MotoPress no tiene precio-por-día; tiene `seasons` y `rates`. Confirmado por el schema del API: `POST /seasons` acepta `title`, `start_date`, `end_date`, **`days` (array de días de la semana)** y `repeat_period` (`none`|`year`); `POST /rates` acepta `accommodation_type_id` + `season_prices[]`.
- El soporte de `days` hace que el modelo de `tarifas` de Supabase (rangos × precio lun–jue / vie–sáb / domingo) sea **isomorfo a seasons**: NO se necesitan seasons diarias.
- **Algoritmo ("seasons generadas", versión tarifas):**
  1. Leer `tarifas` activas por chalet para la ventana (hoy → +365d), resolviendo traslapes por `prioridad` (misma semántica que `precio_del_dia`).
  2. Por cada rango de vigencia efectivo → 3 seasons: `SYNC <rango> L-J` (days lun–jue), `SYNC <rango> V-S` (vie–sáb), `SYNC <rango> DOM` (domingo). Si varios chalets comparten el mismo rango, las seasons se comparten (las seasons son globales; el precio va en el rate).
  3. Por chalet: un rate `SYNC <chalet>` con `season_prices` = [(season, precio)] según sus columnas de tarifa.
  4. Reconciliar contra seasons/rates existentes con prefijo `SYNC` (crear faltantes, actualizar cambiadas, borrar obsoletas); nunca tocar seasons/rates sin prefijo. Idempotente: correr dos veces no produce cambios.
- **Pendiente validar con API keys (Fase 0):** comportamiento real de un POST/PUT de season+rate y cómo se refleja en el sitio; qué rate usa hoy el sitio (para decidir si el rate SYNC lo sustituye o lo edita).
- **Impuestos:** el sitio muestra "+ impuestos". Confirmar si los precios en Supabase son netos o finales, y cómo está configurado el tax en MotoPress y en Beds24/Airbnb, para que el huésped vea números consistentes entre canales.

---

## 4. Detección de reservas en MotoPress (sin webhooks nativos)

### 4.1 Fase A — Polling (arranque)

- Workflow n8n cada 5 minutos: `GET /wp-json/mphb/v1/bookings` filtrando por fecha de modificación (verificar en Fase 0 qué parámetros de filtro soporta el endpoint; si no soporta `modified_after`, traer últimos N y deduplicar contra Supabase).
- Ventaja: cero cambios al sitio. Latencia máx. ~5 min, aceptable: Beds24→Airbnb tiene su propia latencia de propagación de todos modos.

### 4.2 Fase B — mu-plugin webhook (tiempo real, recomendado antes de la campaña de promoción)

- mu-plugin de ~30–40 líneas en `wp-content/mu-plugins/tlalocan-sync.php`:
  - Hook `mphb_booking_status_changed` → `wp_remote_post()` al webhook de n8n con `booking_id`, `old_status`, `new_status`.
  - Firmar el payload con un secreto compartido (header HMAC) que n8n valida.
  - El payload solo lleva el ID; n8n hace GET del booking completo vía REST API (patrón "thin webhook", evita exponer datos y simplifica el plugin).
- El polling de Fase A se conserva como respaldo con frecuencia reducida (cada hora) + reconciliación nocturna.

---

## 5. Idempotencia, anti-eco y reconciliación

1. **Claves externas obligatorias:** ninguna escritura cruzada sin registrar `mphb_booking_id` ↔ `beds24_booking_id` en Supabase. Es el mecanismo central anti-duplicados.
2. **Marcadores de origen:** todo booking creado por el sync lleva marca (`SYNC ...` en notas). Los flujos ignoran eventos cuyo objeto tenga marca propia.
3. **Reconciliación nocturna** — ✅ **CONSTRUIDA 2026-07-18:** workflow **`Tlalocan - Reconciliacion Nocturna` (XpNg3MhC7YlqqOGJ, publicado)**, cron 03:00 (1 ejecución/día). Compara noches ocupadas por chalet (Supabase estados `confirmada`+`en_curso` vs bookings confirmed de MotoPress vs bookings confirmed/new de Beds24, ventana hoy+180d) + detecta bookings huérfanos por ID en ambos canales. NO auto-corrige: registra 1 fila/día en `sync_log` (flujo `reconciliacion` — el criterio #6 pide 7 días seguidos en `ok`) y si hay discrepancias notifica **in-app** a admin/super_admin (el canal WhatsApp "Notificar Operaciones" está inactivo; escalar a WhatsApp queda como opción futura). **Primera corrida encontró y se corrigieron 4 hallazgos reales:** 4 reservas pre-F2 sin bloquear en website (backfill vía webhook F2, folios 1037/1052/1057/1058) y un punto ciego propio (excluía `en_curso`). Fix adicional en F2: reservas ya en curso bloquean solo las noches restantes (MotoPress rechaza check-in en el pasado). Tras el backfill: **los 3 calendarios en `ok`**.
4. **Doble reserva (race condition):** ventana de riesgo = huésped reserva en web y en Airbnb las mismas fechas dentro del intervalo de latencia. Mitigación v1: latencia corta (Fase B) + reconciliación. La política ante colisión detectada: gana la primera por timestamp; la segunda se marca para gestión manual (el website cobra en línea → un conflicto implica reembolso manual, no automatizar reembolsos en v1).

---

## 6. Plan de implementación por fases

### Fase 0 — Discovery en staging (Claude Code)
- [x] Generar API keys de MotoPress en staging (Read/Write). **HECHO 2026-07-18** — en `.env.local` (`MPHB_CK`, `MPHB_CS`, `MPHB_BASE_URL`).
- [x] `GET /wp-json/mphb/v1` → enumerar rutas reales de HB 5.2 y sus parámetros. **HECHO 2026-07-18** (índice es público; JSON en `archivo/mphb-v1-index-staging-2026-07-18.json`). Ver §9.
- [x] Crear un booking de prueba vía API en staging. **HECHO 2026-07-18** (booking 1516, creado→cancelado→borrado): status `confirmed` directo funciona, bloquea/libera disponibilidad, MotoPress calcula precio+impuestos solo, campo `note` persiste. **Pendiente: D4ny confirma si llegó email a dnl.mendez.a@gmail.com.** Ver §9.5.
- [x] Crear/editar una season + rate de prueba vía API. **HECHO 2026-07-18** (ciclo completo POST/PUT/DELETE validado). Ver §9.5.
- [x] Confirmar IDs de accommodation types en staging vs producción. **HECHO 2026-07-18: idénticos (86/100/111/124), vía `wp/v2/mphb_room_type` público.**
- [x] Beds24: `GET /properties?includeAllRooms=true` → mapping confirmado (coincide con `chalets`). Scopes del token: **completos** (read+write de bookings/inventory/properties/channels). **HECHO 2026-07-18.**
- [~] Documentar qué hace hoy el iCal: lado Supabase ya está apagado (`calendarios_externos` todo `activo=false` desde ~06-25). **Falta revisar MotoPress → Settings → Sync y los iCal export/import en Beds24** (requiere admin WP o keys).

### Fase 1 — Fundaciones
- [ ] Crear tablas en Supabase (§2.3) y poblar `channel_mapping`.
- [ ] Sub-workflow n8n de auth Beds24 (refresh automático).
- [ ] Poblar `precios_calendario` con los precios vigentes (import inicial desde Beds24 `GET /inventory/rooms/calendar` como semilla).

### Fase 2 — Precios (F4) — ✅ **COMPLETADA 2026-07-18 (staging)**
- Supabase → Beds24 ya existía (`Tlalocan - Propagar Precios Beds24`).
- Supabase → MotoPress: workflow nuevo **`Tlalocan - Propagar Precios MotoPress` (Zce7G0MJulM3lNg9, publicado)**. Triggers: manual + cron diario 05:15 + webhook `tlalocan-propagar-precios-mphb`.
  - Postgres: islas de precio vía `precio_del_dia()` (hoy+365d) por clase de día (LJ/VS/DOM) + config (`mphb_base_url`, `mphb_auth_basic`).
  - Code: reconcilia seasons prefijo `SYNC` (crea faltantes/borra obsoletas, nunca toca manuales) y hace PUT al rate único por chalet solo si cambió. Sanea caracteres de control de las respuestas.
  - Registra en `sync_log` (flujo F4).
- Migración `0044_trigger_precios_mphb.sql` (**aplicada en prod**): `propagar_precios_beds24()` ahora dispara ambos webhooks (Beds24 + MotoPress) al cambiar `tarifas`; URL nueva en `config.webhook_propagar_precios_mphb`.
- **Validado:** primera corrida creó 3 seasons + actualizó 4 rates; segunda corrida 0 cambios (idempotente); E2E tarifa→trigger BD→webhook→MotoPress OK; precios del huésped en staging = tarifas de Supabase (martes $2,300/Fondo $2,000; sábado $3,200).
- **Consecuencia deliberada:** el rate del sitio queda 100% gobernado por Supabase. Las seasons manuales de WP (puentes, etc.) ya no aplican al rate activo — los precios especiales de puentes se capturan como `tarifas` en la app (igual que ya lo hace Airbnb vía Beds24). Todos los canales quedan consistentes.

### Fase 3 — Reservas entrantes al sitio (F2) — ✅ **COMPLETADA 2026-07-18 (staging)**
- Diseño final (mejor que el original): en vez de colgarse del webhook de Beds24, se cuelga de **Supabase como hub** — cualquier reserva que se confirme (Airbnb vía Beds24, captura manual, bloqueo staff/Tlali) bloquea el website; cancelada/no_show o DELETE lo libera. Espejo exacto del patrón Bloque C.
- Migración `0044`/`0045` (**aplicadas en prod**): trigger `reservas_push_mphb` → `config.webhook_mphb_push_reserva`. Sin filtro `es_canal_externo` (las de Airbnb SÍ se empujan). Anti-eco F1: solo dispara block si `mphb_booking_id is null` (las nacidas en el website llegarán con él puesto).
- Workflow **`Tlalocan - Push Reserva MotoPress` (lBrsS90beSpkHllx, publicado)**: webhook → contexto (config + reserva + mapping) → Code (POST booking `confirmed` con nota `SYNC supabase folio N origen X` / PUT `cancelled`) → guarda `mphb_booking_id` + `sync_log` F2.
- **Validado E2E con folio 1059 (borrado tras la prueba):** INSERT confirmada → booking 1525 en MotoPress (bloqueó Cima 8-jun-2027 en el website) Y beds24_booking_id 90045975 (flujo existente, ambos canales a la vez); cancelada → cancelled en MotoPress + fechas liberadas + ambos ids limpiados. `sync_log` registró block y release.
- **Nota cutover:** mientras el import iCal de MotoPress siga activo, las reservas se bloquean por dos vías (API + iCal) — el import puede loguear errores de disponibilidad por fechas ya tomadas. Inofensivo pero ruidoso; al quitar los External Calendars (Fase 5) desaparece. En staging se puede quitar ya.

### Fase 4 — Reservas del sitio hacia afuera (F1 + F3) — ✅ **COMPLETADA 2026-07-18 (staging)**
- Migración `0046` (**aplicada en prod**): función `sincronizar_booking_mphb(jsonb)` — espejo de `sincronizar_reserva_beds24`: upsert atómico, resuelve huésped (tel→email→crear con placeholder `+web-<id>`, `origen_inicial='website'`), desglose subtotal/IVA/ISH, inserta reserva `origen='website'` **con `mphb_booking_id` ya puesto** (anti-eco F2) → el trigger existente la empuja a Beds24/Airbnb. Cancelled/abandoned en WP → reserva cancelada → libera Beds24. Escribe `sync_log` F1.
- Workflow **`Tlalocan - Sync Bookings Website` (1l0ijGz7HtEuXJpc, publicado)**: **diseño event-driven** (decisión D4ny 2026-07-18, para no ensuciar el tablero de ejecuciones): el ping del plugin (webhook `tlalocan-mphb-booking`, valida secreto de `config.mphb_webhook_secret`) es el mecanismo primario en tiempo real; respaldo = barrido cada 12 h (05:30 y 17:30) + manual + la reconciliación nocturna. **El plugin pasa de opcional a REQUERIDO.** Filtros anti-eco: note `SYNC supabase` (F2) e `imported=true` (iCal).
- **Plugin WordPress (Fase B):** `wordpress/tlalocan-sync.zip` — thin webhook en `mphb_booking_status_changed` → ping no-bloqueante a n8n con secreto; el webhook dispara el mismo barrido idempotente. ✅ **INSTALADO Y VALIDADO E2E en staging 2026-07-18:** booking creado vía API → ping en 5 s → reserva en Supabase + bloqueo en Beds24/Airbnb (~10 s checkout→Airbnb); cancelación igual de rápida. MotoPress dispara el hook 2 veces al crear (transición intermedia) — la idempotencia absorbe el ping doble. En prod viaja con el push de Elementor; solo verificar que quede activo.
- **Validado E2E con booking 1527 (borrado tras la prueba):** checkout simulado en staging → folio 1060 en Supabase (huésped real, montos $2,000+$320+$100=$2,420) → **beds24_booking_id 90047889 automático (Airbnb bloqueado)**, sin eco a MotoPress, idempotente (2ª corrida: 0 acciones). Cancelación en WP → reserva cancelada → Airbnb liberado. Todo en `sync_log`.
- **Limitación v1 (deliberada):** cambios de fechas de un booking ya importado NO se detectan (spec §F3: modificación = cancelar + recrear); los atrapará la reconciliación nocturna (pendiente, §5.3).

### Fase 5 — Cutover a producción
- [ ] Generar API keys de MotoPress en producción; duplicar workflows con credenciales prod (o parametrizar por env).
- [ ] Verificar en prod los IDs de unidades físicas (`GET /accommodations`) y de rates (`GET /rates`) contra `chalets.mphb_accommodation_id`/`mphb_rate_id` (confirmados solo en staging).
- [ ] Deshabilitar los 4 rates No-Reembolsable en producción (mismo cambio hecho en staging el 2026-07-18).
- [ ] Re-verificar emails: crear booking de prueba vía API en prod y confirmar que no dispara correo al huésped (en staging no disparó, pero el staging podría tener el correo saliente bloqueado).
- [ ] Correr en paralelo con iCal activo 1–2 semanas; la reconciliación nocturna compara ambos.
- [ ] Apagar iCal en MotoPress y en Beds24. Monitorear 1 semana.
- [ ] Post-cutover: activar mu-plugin en producción.

---

## 7. Criterios de aceptación

1. Cambiar un precio en Supabase se refleja en el website y en Airbnb (vía Beds24) en < 15 min, sin intervención manual.
2. Una reserva pagada en el website bloquea las fechas en Airbnb en < 10 min y existe en Supabase con ambas referencias externas.
3. Una reserva de Airbnb bloquea las fechas en el website en < 5 min, sin enviar emails duplicados al huésped.
4. Una cancelación en cualquier canal libera fechas en los demás.
5. Correr cualquier workflow dos veces no genera duplicados (idempotencia).
6. La reconciliación nocturna corre sin discrepancias durante 7 días consecutivos antes de apagar iCal.
7. Cero reservas/bloqueos fantasma en Airbnb durante el paralelo.

---

## 8. Riesgos y decisiones abiertas

| # | Riesgo/Decisión | Mitigación / Dueño |
|---|---|---|
| 1 | ~~Modelo seasons no soporta granularidad diaria~~ | ✅ **RESUELTO 2026-07-18:** seasons soportan `days` (días de semana) + repeat; el modelo `tarifas` mapea 1:1. Ver §F4 |
| 2 | Emails duplicados al huésped en F2 | ✅ Validado en staging 2026-07-18: booking por API NO disparó email. Re-verificar en prod al cutover (staging podría bloquear correo saliente) |
| 3 | Rate limits de Beds24 | Batching, caching, backoff; reconciliación 1×/día |
| 4 | ~~Scopes insuficientes en token Beds24~~ | ✅ **RESUELTO 2026-07-18:** token "Reservalia-full-readwrite" tiene todos los scopes necesarios |
| 5 | ~~IDs staging ≠ producción~~ | ✅ **RESUELTO 2026-07-18:** idénticos en ambos entornos (y en el staging viejo) |
| 6 | Reembolsos por doble reserva | Manual en v1, con alerta inmediata |
| 7 | Impuestos inconsistentes entre canales | Auditar configuración tax en Fase 0/2. Dato: `tarifas` ya desglosa `iva_pct` + `impuesto_hospedaje_pct`; el sitio muestra "+ impuestos" y existe endpoint `GET /taxes_and_fees` |
| 8 | El sitio vende 4 chalets (incl. La Cañada), no 3 como asumía la v1.0 | Incluir La Cañada en mapping y flujos desde el inicio |
| 9 | ~~Rates duales vs tarifa única~~ | ✅ **RESUELTO 2026-07-18:** D4ny eligió rate único; No-Reembolsable deshabilitado en staging (repetir en prod al cutover). Ver §9.4.5 |

---

## 9. Hallazgos Fase 0 (2026-07-18)

### 9.1 Mucho del spec ya existe — alcance real reducido

Los tramos **Supabase ⇄ Beds24** de los 4 flujos ya están construidos y en producción (trabajo de los bloques C y anteriores):

| Flujo del spec | Tramo Beds24 | Workflow n8n existente | Tramo MotoPress |
|---|---|---|---|
| F1 (web → afuera) | Supabase → Beds24: **YA EXISTE** | `Tlalocan - Push Reserva Beds24` (n2yU2wMZx4lCOOu4), trigger BD `push_reserva_beds24()`, anti-eco por `beds24_booking_id` | **POR CONSTRUIR** (detección MotoPress → Supabase) |
| F2 (Airbnb → web) | Beds24 → Supabase: **YA EXISTE** | `Beds24 - Webhook Reservas` (RW7wbpCZDm1zm6pG), dedupe Redis, `sincronizar_reserva_beds24()` | **POR CONSTRUIR** (Supabase → `POST /bookings` MotoPress) |
| F3 (cancelaciones) | Cubierto por los dos anteriores | ídem | **POR CONSTRUIR** (ambas direcciones del lado MotoPress) |
| F4 (precios) | Supabase → Beds24: **YA EXISTE** | `Tlalocan - Propagar Precios Beds24` (CZwlUXGduWweDbje) | **POR CONSTRUIR** (tarifas → seasons/rates) |

También existe `Tlalocan - Crear Bloqueo Staff` (aL5SRTPjLDttBOR0): los bloqueos operativos ya viajan a Beds24; deberán viajar también a MotoPress por la misma pata nueva de F2.

**Conclusión: el proyecto es esencialmente "conectar MotoPress al hub ya existente", no construir el hub.**

### 9.2 MotoPress REST API (HB 5.2) — confirmado en staging

- Índice `GET /wp-json/mphb/v1` es **público** (JSON completo en `archivo/mphb-v1-index-staging-2026-07-18.json`). Recursos: `bookings` (+`/batch`, `/availability`), `payments`, `accommodations`, `accommodation_types` (+categorías/tags/amenities/servicios/imágenes/atributos), `coupons`, `rates`, `seasons`, `booking_rules`, `taxes_and_fees`. Todos con CRUD completo; las lecturas de datos requieren Basic Auth (401 sin keys).
- `POST /bookings`: `status` enum = `pending-user | pending-payment | pending | abandoned | confirmed | cancelled` (default `pending-payment`); `check_in_date`/`check_out_date` requeridos (Y-m-d); objeto `customer` (first/last name, email, …). → F1 debe filtrar por `confirmed`; F2 crea con `confirmed`.
- `GET /bookings` filtros: `after`/`before` (fecha de publicación ISO8601), `orderby` incluye **`modified`**, `search`, `filter` (WP Query args). **No hay `modified_after` directo** → polling: `orderby=modified&order=desc` + dedupe contra Supabase por `mphb_booking_id` + `post_modified`.
- `POST /seasons`: `title`, `start_date`, `end_date`, **`days[]` (requerido)**, `repeat_period` (`none|year`), `repeat_until_date`. `POST /rates`: `accommodation_type_id` (requerido), `season_prices[]` (requerido), `status` (`active|disabled`).

### 9.3 Beds24 — token y mapping verificados

- Token activo `Reservalia-full-readwrite` (ownerId 169282), refresh automático ya operando vía `integraciones_tokens`. Scopes completos: bookings/inventory/properties/channels/accounts, read+write, incl. personal+financial.
- Properties/rooms coinciden exactamente con `chalets.beds24_property_id/room_id`: Cañada 335640/694562 · Entrada 337213/697368 · Cima 337352/697556 · Fondo 337360/697576.

### 9.4 Pendientes que solo D4ny puede destrabar

1. ~~API keys MotoPress en staging~~ ✅ entregadas y validadas 2026-07-18.
2. ~~Revisar MotoPress → Settings → Sync~~ ✅ **DOCUMENTADO 2026-07-18** (captura de D4ny): MotoPress **importa** un iCal por chalet desde n8n (`.../webhook/e1eefb7a-…/tlalocan-ical/<slug>` = workflow `Tlalocan - iCal Export v2`, QzvtLHPtGEDSiukZ, activo) — así se bloquean hoy las fechas en el website desde Supabase. MotoPress también **exporta** feeds (`?feed=mphb.ics&accommodation_id=<unidad>`); confirmar si algo los consume (¿Beds24?) antes del cutover. Al cutover: la Fase 3 (F2 por API) sustituye al import; entonces quitar los External Calendars en MotoPress y, si ya nada consume el export de n8n, despublicar `iCal Export v2`.
3. Decidir dónde correr los workflows nuevos: proyecto "Emi - Reservalia" vs proyecto nuevo "Tlalocan Sync" (recomendado: el mismo proyecto donde ya viven los 4 workflows Tlalocan).
4. ~~Confirmar email del booking de prueba~~ ✅ **RESUELTO 2026-07-18: NO llegó email** por el booking creado vía API con status `confirmed`. Matiz: staging de Elementor Cloud podría tener el correo saliente bloqueado — re-verificar durante el paralelo en prod (Fase 5) antes de dar el riesgo #2 por cerrado.
5. ~~Decisión de rates duales~~ ✅ **RESUELTO 2026-07-18: D4ny eligió opción (b)** — quitar No-Reembolsable. Los 4 rates No-Reembolsable quedaron `status: disabled` en staging (157/160/162/164; deshabilitados, no borrados, porque bookings históricos los referencian). Cada chalet queda con un solo rate activo: Cañada 156, Entrada 159, Fondo 161, Cima 163. **Repetir el disable en producción al cutover.** Nota menor: el rate activo se titula "Reembolsable" — con rate único ese título ya no aparece como elección, pero si algún texto del sitio lo muestra, D4ny puede renombrarlo en WP admin.

### 9.5 Resultados de pruebas API en staging (2026-07-18, con keys)

**Datos y precios del sitio (leídos vía API):**
- Unidades físicas (mapping 1:1 con el type; el `POST /bookings` exige la unidad): Cañada 1349, Entrada 1350, Fondo 1351, Cima 130. Confirmados en staging; **verificar en prod al cutover** (no hay endpoint público).
- El sitio YA usa seasons por día de semana: "Temporada 2026 entre semana" (1345, dom–jue), "Fines de semana 2026" (1346, vie–sáb), + puentes (Revolución 1046, Día del Trabajo 1045, Guadalupe-Reyes 1042…). Nota: el sitio agrupa domingo con entre-semana; `tarifas` tiene `precio_domingo` aparte — el generador de seasons emitirá 3 grupos y cubre ambos casos.
- **Dos rates por chalet** (Reembolsable / No-Reembolsable), ~$100 MXN de diferencia. Ej. Cima: Reemb 163, No-Reemb 164. Ver decisión pendiente §9.4.5.
- Impuestos: MotoPress calcula ISH 5% + IVA 16% ENCIMA del precio del rate → **los precios de MotoPress son netos, igual que `tarifas`**. Consistencia confirmada (riesgo #7 mitigado). El endpoint `taxes_and_fees` devuelve los taxes porcentuales con error de esquema (solo modela `per_guest_per_day`) — los impuestos se administran en WP admin, el sync no los toca.
- Booking rules: estancia mínima 4 noches en seasons 1040/1041 (decembrinas).

**Booking de prueba (id 1516, Cima, 15→16 sep, creado→cancelado→borrado):**
- `POST /bookings` con `status: confirmed` funciona directo; payload mínimo: `check_in_date`, `check_out_date`, `customer{first_name,last_name,email}`, `reserved_accommodations[{accommodation: <unidad>, adults}]`, `note`.
- MotoPress auto-calcula precio por noche según season/rate vigente (asignó rate Reembolsable solo) y agrega impuestos: noche $2,800 + ISH $140 + IVA $448 = $3,388.
- El booking confirmado **bloquea disponibilidad** (desaparece de `GET /bookings/availability`); `PUT {status: cancelled}` la **libera**; `DELETE ?force=true` lo elimina.
- El campo `note` persiste → sirve como marcador anti-eco `SYNC beds24 #<id>`.
- El booking también expone `ical_*` fields (uid/summary) — útil para reconciliación con lo que Beds24 ve por iCal durante el paralelo.

**Seasons/rates (ciclo CRUD completo validado):**
- `POST /seasons` con `days[]` funciona (creó las fechas correctas del rango, solo lun–jue).
- `POST /rates` (201) y `PUT /rates/{id}` (200): **`season_prices[]` exige el objeto completo**: `{season_id, base_price, priority, base_adults, base_children, variations: []}` — con solo `season_id`+`base_price` da 400. Gotcha: algunas respuestas traen caracteres de control (descripciones con saltos de línea); el consumidor debe sanear antes de parsear JSON.
- `DELETE /rates/{id}?force=true` y `DELETE /seasons/{id}?force=true` → 200.
