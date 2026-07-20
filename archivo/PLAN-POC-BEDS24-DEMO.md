# PLAN — PoC Beds24: demo en vivo "reserva en la app → fechas cerradas en Airbnb"

> **Objetivo de negocio:** En una reunión con Valentina y Alejandro (tío), crear una reserva directa desde la app de Tlalocan y demostrar que las fechas se bloquean automáticamente en el listing real de Airbnb de **De La Cañada**, sin intervención manual.
> **Estado:** diseño ejecutable (para Claude Code). Cada bloque valida antes de avanzar.
> **Fecha:** 2026-06-17
> **Principio rector:** certeza sobre prisa. Beds24 corre en paralelo al iCal para los otros 3 chalets; De La Cañada migra a Beds24 en limpio.
> **Alcance:** UNA chalet (De La Cañada), efecto demostrado = **bloqueo de disponibilidad** (no precio). Llega hasta el listing REAL de Airbnb.

---

## 0. La verdad sobre la latencia (LEER ANTES DE PROMETER NADA EN LA REUNIÓN)

La demo tiene dos tramos. Solo controlas el primero:

```
[App Tlalocan] → Supabase → n8n → Beds24      |      Beds24 → Airbnb
        TRAMO 1: instantáneo (segundos)         |   TRAMO 2: NO lo controlas
```

- **Tramo 1 (tuyo):** segundos. Validado hoy con el push de precio.
- **Tramo 2 (Beds24→Airbnb):** Beds24 declara "< 1 minuto", pero su propia wiki admite "un par de minutos para que Airbnb procese". Beds24 es **Preferred Partner** (no Preferred+), lo que en fuentes independientes se asocia a propagación de varios minutos. **Airbnb tiene la última palabra sobre cuándo refleja el cambio en su calendario.**

### Implicación para el guion de la demo (CRÍTICO)

❌ **NO vender "instantáneo en Airbnb"** — si ese día Airbnb va lento, quedas expuesto frente a tu tío.
✅ **Vender "automático y sin riesgo de doble-reserva"** — el valor es eliminar trabajo manual y overbooking, no la velocidad de cronómetro.

**Guion honesto sugerido:** *"Creo la reserva aquí. En Beds24 ya está bloqueado al instante [mostrar]. Airbnb lo refleja en su calendario en cuestrón de segundos a un par de minutos —su sistema procesa del lado de ellos—, pero lo importante es que pasa solo: nadie tiene que entrar a Airbnb a bloquear nada, y por lo tanto no hay forma de que entre una doble reserva."*

**Mitigación de demo (ver §6, Plan B):** mostrar el efecto primero en el **calendario de Beds24** (instantáneo y bajo tu control) como prueba inmediata, y dejar Airbnb como confirmación que llega "en vivo o en un par de minutos". Así el momento "wow" no depende de la cola de Airbnb.

---

## 1. Hechos ya VALIDADOS (certeza, no re-verificar)

- **Auth:** invite code → `GET /authentication/setup` → `refreshToken` → access tokens vía `GET /authentication/token`, **expiran 24h**. El **refreshToken NO expira mientras se use al menos cada 30 días** (corrección: no es "para siempre" incondicional). ✓
- **Impuestos Beds24 = 0 (intencional):** `calcular_estadia` ya entrega precio cerrado todo-incluido. ✓
- **Scopes:** `read/write` de `inventory`, `bookings`, `properties`. ✓
- **Linked properties:** la propiedad vive vinculada; el token necesita flag "Allow linked properties" o `&includeLinkedProperties=true`. ✓
- **De La Cañada:** propertyId **335640**, roomId **694562**, MXN, cap. 2. ✓
- **Push de PRECIO validado a mano:** `POST /inventory/rooms/calendar` con `{roomId, calendar:[{from,to,price1,minStay}]}` → `success:true`, visto en panel (3-4 jul, $2500, minStay 2). ✓
- **Push de DISPONIBILIDAD validado a mano (2026-06-18):** mismo endpoint, campo **`numAvail`** confirmado por el ejemplo oficial de Swagger. `numAvail:0` = bloqueado, `numAvail:1` = disponible. Probado con 15-17 sep → celdas 15 y 16 en rosa "0 (-1)" en el panel. ✓ Es el MISMO push del precio + el campo `numAvail`.
- **Semántica de fechas CONFIRMADA (crítica) — 2026-06-18, dos pruebas:** el `to` es **INCLUSIVO** (ambos extremos del rango se bloquean). Prueba 1: `from:09-15 to:09-17` bloqueó 15, 16 Y 17. Prueba 2: `from:09-20 to:09-21` bloqueó 20 Y 21. → **Mapeo correcto (¡con ajuste!):** `from = reserva.fecha_entrada`, **`to = reserva.fecha_salida − 1 día`**. Razón: una reserva ocupa las NOCHES entrada..salida−1; la noche de salida (check-out) debe quedar LIBRE para el siguiente huésped. Mandar las fechas crudas (`to = fecha_salida`) bloquearía el día de check-out → 1 noche vendible perdida por reserva (bug silencioso, siempre responde success:true).

---

## 2. Reglas duras confirmadas en documentación Beds24 (afectan el diseño)

| Regla | Fuente | Implicación |
|---|---|---|
| **No iCal + API en el mismo room** | Wiki Beds24 | Sacar De La Cañada del iCal export es OBLIGATORIO al conectar API, no opcional. |
| **Sync type correcto = "Prices & Availability" o "Limited"** | Wiki Mapping | NUNCA "Everything" (sobrescribe contenido, fotos, descripción del listing real). |
| **Airbnb debe ser Professional Host** | fuente independiente | ⚠️ PRERREQUISITO BLOQUEANTE: verificar el tipo de cuenta antes de la demo. Si es Particular, pedir cambio gratis a Airbnb (puede tardar). |
| **Solo Instant Book** | Wiki Beds24 | La conexión API solo soporta reserva instantánea. Confirmar que el listing lo permite. |
| **Airbnb no importa fechas bloqueadas** | Wiki | Si De La Cañada tiene fechas bloqueadas a mano en Airbnb, hay que re-bloquearlas en Beds24. |
| **Solo se conectan listings vivos** | Wiki | ✓ De La Cañada está vivo y reservable (confirmado por usuario). |

---

## 3. Mapeo de datos Supabase ↔ Beds24

### Decisión de mapeo: **OPCIÓN A — columnas en `chalets`** (confirmada por usuario 2026-06-17)

- **Opción A (ELEGIDA) — columnas en `chalets`:** simple, proporcional a un PoC de una sola chalet. Un `ALTER TABLE` y listo.
- ~~Opción B — tabla `beds24_mapping`~~ — descartada por ahora.
- **Nota para el futuro (proyecto Esteban):** si se materializa la reventa (40-60 cabañas, multi-cuenta, varios room types por propiedad), las columnas en `chalets` se quedan cortas y conviene migrar a tabla dedicada `beds24_mapping`. Empezar con A NO cierra esa puerta; sería una migración cuando Esteban deje de ser hipótesis.

```sql
-- Opción A (elegida):
ALTER TABLE public.chalets
  ADD COLUMN IF NOT EXISTS beds24_property_id  bigint,
  ADD COLUMN IF NOT EXISTS beds24_room_id      bigint,
  ADD COLUMN IF NOT EXISTS beds24_sync_enabled boolean DEFAULT false;

UPDATE public.chalets
   SET beds24_property_id = 335640,
       beds24_room_id     = 694562,
       beds24_sync_enabled = true
 WHERE slug = 'de-la-canada';
```
> ⚠️ `ALTER TABLE` = cambio de esquema → **confirmar con usuario antes de ejecutar**. El `UPDATE`/`INSERT` procede directo.

El flag `beds24_sync_enabled` (solo true para De La Cañada) implementa el aislamiento a nivel dato: los otros 3 chalets nunca disparan push a Beds24.

---

## 4. SALIDA — Bloqueo de disponibilidad (el efecto de la demo)

### 4.1 Subworkflow central `Beds24 - Push Disponibilidad` (NUEVO)

Un solo punto que traduce intención de negocio → llamada Beds24. Recibe:
```json
{ "chalet_id": "<uuid>", "fecha_desde": "2026-07-10", "fecha_hasta": "2026-07-12", "accion": "bloquear" | "liberar" }
```
Lógica:
1. Lee `beds24_room_id` y `beds24_sync_enabled` del chalet (mapeo §3). Si `sync_enabled=false` → no hace nada (aislamiento).
2. Obtiene access token (subworkflow auth §5).
3. Llama `POST /inventory/rooms/calendar`:
   - bloquear → disponibilidad 0 en el rango
   - liberar → disponibilidad 1 en el rango
4. Verifica `success:true` en la respuesta; loguea.

> ⚠️ **VERIFICAR EN SWAGGER ANTES DE CODEAR:** el nombre exacto del campo de disponibilidad (probablemente `numAvail`, pero NO asumir). El push de `price1` está validado; el de disponibilidad no. Bloque 3 empieza por esto.

### 4.2 Punto de mutación para el PoC

Para la demo basta cablear **un** punto: la creación de reserva directa. En el sistema real son varios (crear cotizada, cancelar, expirar TTL, cambio de tarifa), pero **el PoC solo necesita el camino "crear reserva → bloquear"**.

Punto a cablear: el flujo que crea la reserva directa desde la app (`crear_reserva_pendiente_pago` `4wYw9B6qgENSJHCh`, o el punto donde la app inserta la reserva). Tras crear la reserva, invocar `Beds24 - Push Disponibilidad` con `accion: bloquear` para las fechas de la reserva.

> Para el PoC se puede incluso disparar el push directamente desde la app/dashboard al confirmar la reserva de demo, sin tocar los workflows de producción — **menos riesgo, mismo efecto visible**. Decisión de implementación en Bloque 4.

---

## 5. Autenticación en n8n `Beds24 - Auth Token` (NUEVO)

- `refreshToken` guardado como **credencial/secret de n8n** (nunca en tabla ni código).
- Genera access token vía `GET /authentication/token`; cachea en Redis TTL ~23h; renueva al expirar.
- ⚠️ Rotar el refreshToken antes de producción (en la sesión de prueba se expuso un access token en texto).

---

## 6. Orden de ejecución — camino al PoC (cada bloque valida)

### Bloque 0 — Prerrequisito BLOQUEANTE — ✅ CERRADO (2026-06-17)
- ✅ Cuenta Airbnb de De La Cañada confirmada en **Professional Host**: el multicalendario, conjuntos de reglas y precios de temporada ya aparecen en el panel (verificado por captura). El toggle "herramientas para anfitriones profesionales" quedó ENCENDIDO y guardado.
- ⚠️ **No apagar nunca el modo pro** una vez en producción: al desactivar, Airbnb borra reglas de precio/disponibilidad con 1-2 días de retraso.
- **Pendiente menor de higiene:** los 4 anuncios tienen nombres genéricos en Airbnb. Ponerles **nombre interno claro** (ej. "De La Cañada") ANTES del Bloque 5, para no mapear el anuncio equivocado a su room en Beds24 durante la conexión OAuth.

### Bloque 1 — Mapeo de datos (Supabase) — ✅ CERRADO (2026-06-18)
- ✅ Migración `add_beds24_mapping_to_chalets` aplicada. Columnas `beds24_property_id`, `beds24_room_id`, `beds24_sync_enabled` (default false) agregadas a `chalets`.
- ✅ De La Cañada sembrada: property 335640, room 694562, sync_enabled=true. Los otros 3 chalets en NULL/false (aislamiento a nivel dato confirmado por SELECT).

### Bloque 2 — Auth subworkflow (n8n)
- Crear `Beds24 - Auth Token`.
- **Validación:** devuelve token → `GET /properties?includeLinkedProperties=true` devuelve De La Cañada.

### Bloque 3 — Push de disponibilidad (EL EFECTO ESTRELLA — validar a mano primero)
- **Primero:** abrir Swagger, confirmar campo de disponibilidad exacto en `POST /inventory/rooms/calendar`.
- Probar a mano (curl) bloquear un rango en roomId 694562 → verificar en **calendario del panel Beds24** que quedó NO disponible. Liberar → verificar vuelve disponible.
- Solo cuando funciona a mano, crear subworkflow `Beds24 - Push Disponibilidad`.
- **Validación:** invocar subworkflow → mismo efecto en panel Beds24.

### Bloque 4 — Cablear "crear reserva → bloquear" (solo De La Cañada)
- Conectar el punto de creación de reserva al subworkflow (o disparar desde la app para el PoC).
- **Validación interna (SIN Airbnb todavía):** crear reserva de prueba en la app → ver el bloqueo aparecer en el calendario de Beds24 automáticamente. **Este es el PoC funcionando end-to-end del lado controlado.**

### ✅ ESTADO AL 2026-06-18 (cierre de sesión 21:00) — CONEXIÓN LOGRADA

**De La Cañada está conectada y sincronizando con Airbnb vía API V2.** PoC técnico funcionando de punta a punta.

Hecho y verificado hoy:
- Bloque 0 (Professional Host) ✅ ; Bloque 1 (mapeo Supabase) ✅ ; Bloque 3 (push disponibilidad+precio) ✅
- iCal de De La Cañada desvinculado en Airbnb + desactivado en `calendarios_externos` (id 577748a0). Los otros 3 chalets siguen en iCal intactos.
- Precio base actualizado en `tarifas`: De La Cañada $2,700 lun-jue/dom, $3,200 vie-sab. Columna nueva `descuento_directo_pct` = 10% (solo Cañada).
- Calendario Beds24 abierto con precio+disponibilidad del 19-jun-2026 al 12-ene-2027 (60 bloques, push exitoso).
- Conexión Airbnb: cuenta 750250279, listing **1637178495446226204** (De La Cañada) ↔ room 694562. Sync Type **"Prices and Availability"** (NO toca impuestos de Airbnb). Estado: **Connected**.

**DATO CLAVE PARA LA DEMO — latencia CONFIRMADA (2 mediciones):** bloqueo (10-11 oct) tardó ~23 min ayer; liberación (10-11 oct) tardó ~18-22 min hoy. **Consistente entre operaciones y entre días → ~20 min es el ritmo real del listing, NO costo de primera sincronización.** Posible factor adicional: alta demanda global (Mundial de fútbol) — medir de nuevo post-evento para aislar. **Implicación de guion (FIRME):** el "wow" NO puede depender de ver el cambio en Airbnb en vivo (nadie espera 20 min en una demo). Mostrar efecto instantáneo en app/Beds24 (bajo control propio) y presentar Airbnb como "se propaga solo, sin trabajo manual, sin riesgo de overbooking". El valor es automatización confiable, no velocidad.

**FILTRO POR CANAL — ✅ IMPLEMENTADO (2026-06-19):**
- `calcular_estadia` ahora acepta 4º parámetro `p_canal` (default `'directo'`). Migración `add_canal_param_to_calcular_estadia` aplicada.
- Canal 'directo' aplica `descuento_directo_pct` (10%) sobre el NETO por noche, antes de impuestos. Canal 'airbnb' usa precio base sin descuento.
- Verificado con prueba comparativa (2 noches vie-sáb De La Cañada): directo $7,000 vs airbnb $7,700. Descuento e impuestos correctos.
- Tlali (`cotizar_estadia` 7DX5VPXMJRRaqw96) llama con 3 args → hereda default 'directo' → cotiza con descuento SIN cambios al workflow.
- ⚠️ **REGLA CRÍTICA Bloque 4:** el flujo que empuje precios A Beds24/Airbnb DEBE pasar `'airbnb'` explícito, o empujaría precios con descuento a Airbnb (pérdida de margen silenciosa).
- **PENDIENTE:** prueba end-to-end real — cotizar por WhatsApp con Tlali y confirmar que entrega precio directo ($7,000), no solo que la función calcula bien.

### PENDIENTES INMEDIATOS (retomar):
1. **Medir latencia en régimen:** 2º bloqueo de prueba (ej. 17-18 oct, `numAvail:0`) y cronometrar. Si es 2-3 min, la 1ª fue arranque; si sigue alto, ajustar expectativa de demo.
2. **Liberar fechas de prueba** dejadas bloqueadas: 10-11 oct (y 17-18 si se hace la 2ª prueba) → `numAvail:1`.
3. **Verificar ventana de disponibilidad de Airbnb** = "All future dates" (posible causa de lentitud; revisar).
4. **`calcular_estadia` por canal: ✅ HECHO** (ver sección de filtro por canal arriba). Pendiente solo la prueba end-to-end por WhatsApp con Tlali.
5. **Impuestos:** se empuja precio base sin impuestos; confirmar config fiscal del listing de Airbnb (Beds24 no la toca con sync "Prices & Availability").
6. **Nombres internos en Airbnb:** los 4 listings tienen nombres genéricos; poner nombre interno claro antes de conectar los otros 3 (riesgo de mapear el equivocado).

### Bloque 5 — Conectar el Airbnb REAL de De La Cañada (paso atómico, alto cuidado) — ✅ EJECUTADO
> Punto de no-retorno. Hacer con calma, no el día de la demo.
1. En Beds24: CHANNEL MANAGER → Airbnb → conectar cuenta (OAuth, "Allow").
2. Mapear el listing de De La Cañada al room 694562.
3. Elegir Sync type = **"Prices & Availability"** o **"Limited"** (NUNCA "Everything").
4. **En el mismo momento: sacar De La Cañada del iCal** (quitar la URL de Beds24/Airbnb del iCal export y/o desactivar su fila en `calendarios_externos`). Regla "no iCal+API en el mismo room".
5. Re-bloquear en Beds24 cualquier fecha que estuviera bloqueada a mano en Airbnb (Airbnb no las exporta).
6. **Validación:** bloquear un rango de prueba desde la app → confirmar que en 1-5 min aparece bloqueado en el calendario real de Airbnb. **Medir el tiempo real de propagación varias veces** para saber qué esperar el día de la demo.

### Bloque 6 — Ensayo de la demo (imprescindible)
- Ensayar el flujo completo 2-3 veces con fechas reales, **cronometrando el tramo Beds24→Airbnb**, para conocer la latencia típica de ESTE listing a ESTA hora.
- Preparar Plan A y Plan B (§ siguiente).

---

## 7. Guion y contingencia de la reunión

### Plan A (ideal): efecto en vivo
1. Pantalla 1: app de Tlalocan. Pantalla 2: calendario de Beds24. Pantalla 3: listing de Airbnb (vista pública o extranet) abierto en las fechas objetivo.
2. Crear la reserva directa en la app.
3. **Inmediato:** mostrar el bloqueo en Beds24 (instantáneo, bajo tu control) → primer "wow".
4. Cambiar a Airbnb, refrescar → el bloqueo aparece (segundos a minutos).

### Plan B (contingencia si Airbnb va lento ese día)
- El "wow" ya ocurrió en el paso 3 (Beds24 instantáneo). Airbnb se presenta como "y esto se propaga solo a Airbnb, aquí está procesándose" — refrescar tranquilamente. Si tarda, no pasa nada: el mensaje es "automático y sin trabajo manual", no "instantáneo".
- Tener un **bloqueo de prueba hecho 10 min antes** ya visible en Airbnb como respaldo: "este lo hice hace un rato desde la app y ahí está en Airbnb, sin que nadie tocara Airbnb".

### Mensaje de cierre para Valentina y Alejandro
- A **Valentina** (operaciones): "Ya no tienes que vigilar dos calendarios ni bloquear a mano. Una reserva por cualquier vía cierra las fechas en todos lados sola." (Respeta su autoridad operativa, le quita carga, no se la impone.)
- A **Alejandro** (dueño): "Esto es lo que nos permite abrir Airbnb de último momento sin miedo a doble-reserva — el mercado que hoy estamos rechazando."

---

## 8. Riesgos específicos del PoC

| Riesgo | Mitigación |
|---|---|
| Campo de disponibilidad asumido | Bloque 3 verifica en Swagger antes de codear |
| Airbnb cuenta = Particular Host | Bloque 0, con días de anticipación |
| Latencia Airbnb arruina el "wow" en vivo | Plan B: el efecto se muestra primero en Beds24 (instantáneo); Airbnb es confirmación |
| Doble-canal iCal+API sobre De La Cañada | Bloque 5 paso 4: sacar del iCal en el mismo momento de conectar API |
| Sync type "Everything" sobrescribe el listing real | Bloque 5 paso 3: usar SOLO "Prices & Availability"/"Limited" |
| El listing se bloquea "para siempre" tras la demo | Tras la demo, liberar las fechas desde la app (acción `liberar`) y verificar que se reabren en Airbnb |
| Reserva real entra durante la demo en las fechas usadas | Usar fechas lejanas/improbables para la demo; liberar al terminar |
| Token expuesto en pruebas | Rotar refreshToken antes de producción |
| Update de workflows vía MCP pierde credencial Evolution | No aplica a nodos Beds24; si se tocan workflows con nodos Evolution, reasignar en UI |

---

## 9. Fuera de alcance de este PoC (explícito)

- Los otros 3 chalets (siguen en iCal, intactos).
- El flujo de ENTRADA básico no es necesario para la demo de bloqueo, pero el usuario pidió agregarlo al plan de Code (ver §11 — Flujo de entrada Airbnb→Supabase).
- Cambio de precio reflejado en Airbnb (el efecto elegido fue bloqueo; el precio ya está técnicamente validado y se puede sumar luego).
- Modelo white-label/reseller de Esteban (este PoC deja la base de mapeo §3 lista para extenderlo si se elige Opción B).
- Apagar los workflows iCal (`zOISy7fPpAmIULeF`, `QzvtLHPtGEDSiukZ`) — siguen vivos para los otros 3 chalets.

---

## 10. Decisiones pendientes del usuario (antes del Bloque 1)

1. **Mapeo Opción A o B** (§3). Recomendación: B si el PoC también pavimenta el camino a Esteban.
2. **Dónde se dispara el push en el PoC:** ¿desde el workflow de creación de reserva, o directo desde la app/dashboard? (lo segundo = menos riesgo para producción).
3. **Confirmar tipo de cuenta Airbnb** (Professional vs Particular) — Bloque 0.
4. **Fechas de demo:** elegir un rango lejano e improbable para no chocar con reservas reales.

---

## 11. Flujo de ENTRADA — Airbnb → Supabase automatizado (para sesión de Code)

> **Objetivo:** reemplazar el proceso MANUAL actual de capturar reservas de Airbnb en Supabase por un flujo automático vía Beds24. Cuando entra una reserva en Airbnb → Beds24 dispara webhook → n8n la inserta en Supabase con `origen=airbnb`, habilitando el seguimiento operativo interno.

### Lo que SÍ se automatiza (mejora enorme vs. proceso manual)
La conexión API de Beds24 importa reservas de Airbnb **con datos personales, nº de huéspedes y precio** (a diferencia del iCal, que no daba nombre/precio/email). Mecanismo:
- **Booking webhook** de Beds24: Settings > Properties > Access > Booking webhooks. Usar la **versión de webhook que incluye datos personales** (V2 changelog confirma que se agregó info personal a los webhooks).
- El webhook **trae los datos de la reserva como JSON en el body** → en muchos casos NO hace falta un GET adicional. Si hiciera falta, `GET /bookings`.
- Delay típico del webhook: ~1 min promedio (asíncrono, variable). No es notificación instantánea.
- Workflow n8n nuevo `Beds24 - Webhook Reservas`: dedupe por bookId (Redis, igual que el Concierge) → mapear propertyId/roomId → `chalet_id` (tabla mapeo §3) → función SQL nueva `sincronizar_reserva_beds24(payload jsonb)` con `origen='airbnb'`, `external_uid = beds24 bookId`, idempotente. Trigger webhook POST.

Esto desbloquea: seguimiento operativo interno (Valentina, recordatorios, transiciones de estado, dashboard) para reservas de Airbnb, sin captura manual.

### ⚠️ EL MATIZ CRÍTICO (decisión de diseño, no asumir)
**Airbnb NO entrega teléfono ni email real del huésped.** Por privacidad, da nombre + email/teléfono ENMASCARADO (`xxxxx@guest.airbnb.com`). Implicación:
- **NO se puede escribir al huésped de Airbnb por WhatsApp automáticamente** — no tienes su WhatsApp real.
- La comunicación con el huésped mientras está en Airbnb es vía la **mensajería de Airbnb** (accesible desde Beds24 / `POST /bookings/messages`), NO WhatsApp.

### ⚠️ EL MATIZ CRÍTICO (decisión de diseño, no asumir)
**ACTUALIZACIÓN 2026-06-23 — RESUELTO el acceso a datos, y SORPRESA con el teléfono:**
- **Causa del "solo fechas y código":** faltaban scopes `bookings-personal` y `bookings-financial` en el token. Token viejo solo tenía `read:bookings`. Regenerado invite code con TODOS los scopes read+write (sin delete) + "All owned by account" (= linked properties). Nuevo refreshToken con scopes completos → guardar en n8n.
- **Con scopes correctos, `GET /bookings?includeInvoiceItems=true&includeGuests=true` SÍ devuelve:** `firstName`, `lastName`, `phone`, `invoiceItems` (monto), `price`, `commission`, y un `rateDescription` con desglose fiscal COMPLETO (Base Price, VAT/IVA, ISH Mazamitla, Host Fee, Expected Payout).
- **🔔 SORPRESA — llegó TELÉFONO con formato real mexicano** (ej. 523315281543, 523511356772), NO el email/teléfono enmascarado `@guest.airbnb.com` que la doc anticipaba. **Esto REABRE la posibilidad de disparar WhatsApp automático al huésped de Airbnb.** ⚠️ PENDIENTE VERIFICAR: enviar un WhatsApp de prueba a uno de esos números para confirmar que llega al huésped real (puede ser número directo, o un relay de Airbnb — no confirmado aún). Si es contactable → el "protocolo de mensajes WhatsApp ya probado" SÍ se puede disparar desde la carga automática, sin necesidad del flujo opt-in.
- Campo `guests:[]` viene vacío (los datos del huésped principal están en los campos raíz firstName/lastName/phone, no en el array `guests`).
- **Confirmación fiscal:** el `rateDescription` muestra que Airbnb aplica SUS impuestos (VAT+ISH) sobre el base price. Como se empujó precio base sin impuestos y sync "Prices & Availability" no los toca → NO hay duplicación. Decisión fiscal correcta.

### Para conseguir el WhatsApp real (seguimiento por Tlali) — flujo de OPT-IN aparte
El número real solo se obtiene si el huésped lo da voluntariamente. Patrón:
1. Mensaje de bienvenida vía mensajería de Airbnb invitando a coordinar la llegada por WhatsApp (el huésped inicia el contacto a un número/wa.me).
2. Cuando el huésped escribe a Tlali, se vincula su WhatsApp real a la reserva `origen=airbnb` existente (match por nombre/fechas).
3. **Deduplicación:** este es el pendiente que ya estaba en el expediente ("capturar datos de contacto de huéspedes Airbnb con dedupe") — ahora se entiende POR QUÉ es paso aparte: Airbnb no regala el contacto.

### Resumen de alcance del flujo de entrada
- **Automático (Code puede construirlo):** reserva Airbnb → Supabase con nombre/fechas/precio/origen. Seguimiento interno completo.
- **Requiere opt-in del huésped (no automatizable solo con Beds24):** obtener su WhatsApp real para que Tlali le escriba. Diseñar como flujo de captura con deduplicación.

---

## 12. Flujo de ENTRADA — Plan ejecutable de Code (decisiones cerradas 2026-06-24)

### Decisiones tomadas
1. **Deduplicación por `codigo_airbnb`** (NO `external_uid`). Razón: conviven dos formatos de external_uid en datos reales — los del iCal viejo (`1418fb94...@airbnb.com`) y los nuevos (`beds24:{id}`). El `codigo_airbnb` (ej. HMHQKBSFHD) es el único identificador estable en ambos. Dedup: si existe reserva con ese `codigo_airbnb`, UPDATE; si no, INSERT.
2. **`monto_total` y `monto_pagado` = payout neto** de Airbnb (lo que Daniel recibe tras comisión).
3. **Columnas nuevas en `reservas`** (opción C — híbrido, camino abierto a B):
   - `airbnb_precio_huesped numeric(12,2)` — campo `price` del GET (lo que paga el huésped)
   - `airbnb_comision numeric(12,2)` — campo `commission` (host fee)
   - `airbnb_payout numeric(12,2)` — payout neto (= monto_total)
   - `airbnb_rate_description text` — el `rateDescription` CRUDO completo (respaldo; permite migrar a B parseando offline después, retroactivo y sin riesgo)
   - Componentes del modelo directo (`subtotal_neto/iva/impuesto_hospedaje`) quedan en 0 para origen=airbnb. La invariante directa no aplica; el detalle fiscal real vive en columnas airbnb_* (que sí cuadran: el rateDescription tiene base+iva+ish=precio, precio−comision=payout).
4. **Teléfono normalizado a 10 dígitos** — el GET da `523315281543` (52+10); quitar el prefijo 52 para coincidir con `huespedes.telefono` y el match de Tlali por últimos 10 dígitos.
5. **WhatsApp:** el teléfono de Airbnb llegó REAL (no enmascarado), Daniel confirma que Airbnb también lo muestra públicamente. PENDIENTE prueba de envío real para confirmar contactabilidad antes de automatizar el disparo. Si contactable → disparar el protocolo de mensajes ya probado; si no → flujo opt-in.

### Migración SQL (Bloque de entrada — requiere confirmación, es DDL)
```sql
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS airbnb_precio_huesped   numeric(12,2),
  ADD COLUMN IF NOT EXISTS airbnb_comision         numeric(12,2),
  ADD COLUMN IF NOT EXISTS airbnb_payout           numeric(12,2),
  ADD COLUMN IF NOT EXISTS airbnb_rate_description text;
```

### Función SQL `sincronizar_reserva_beds24(payload jsonb)` — diseño
Recibe el objeto booking de Beds24 (del webhook o GET). Lógica:
1. Extraer: `apiReference` (→ codigo_airbnb), `id` (→ external_uid `beds24:{id}`), `arrival`, `departure`, `numAdult+numChild` (→ num_huespedes), `firstName`, `lastName`, `phone`, `price`, `commission`, payout (price−commission o campo directo), `rateDescription`, `status`, `propertyId/roomId`.
2. Normalizar teléfono: quitar prefijo `52` → 10 dígitos.
3. Mapear `roomId` (694562) → `chalet_id` vía tabla chalets (beds24_room_id).
4. UPSERT huésped por teléfono (10 díg) — reusar lógica de upsert existente; `origen_inicial='airbnb'` si nuevo.
5. **Dedup por codigo_airbnb:** existe → UPDATE (fechas, montos, estado); no existe → INSERT con `origen='airbnb'`, `estado` mapeado.
6. Mapear estado Beds24 → Reservalia: `new/confirmed`→`confirmada`, `cancelled`→`cancelada`, etc. (documentar tabla en la función).
7. Llenar columnas airbnb_*. `monto_total=monto_pagado=payout`. Componentes directos en 0.
8. Idempotente: re-ejecutar con mismo booking no duplica ni corrompe.

### Workflow n8n `Beds24 - Webhook Reservas` (NUEVO)
- Trigger: Webhook POST (Beds24 booking webhook, configurar en Settings>Properties>Access>Booking webhooks, versión con datos personales).
- Dedupe de reenvíos: Redis INCR por `{bookingId}` TTL, igual patrón que el Concierge.
- Si el webhook trae el booking completo en el body → usarlo directo. Si no → GET /bookings con includeInvoiceItems+includeGuests usando el token de scopes completos (bookings-personal + bookings-financial).
- Llamar `sincronizar_reserva_beds24(payload)`.
- Tras INSERT exitoso de reserva nueva confirmada → disparar protocolo de notificaciones (el ya probado: pg_net→n8n→Evolution→WhatsApp). OJO: este dispara a Valentina/operaciones (números internos, 100% seguro) y, SI se confirma contactabilidad, al huésped.
- Responder 200 OK, sin datos.

### Token para el flujo
- Usar el refreshToken NUEVO con scopes completos (read+write de bookings, bookings-personal, bookings-financial, inventory, properties, accounts, channels; sin delete) + "All owned by account".
- Guardar en credenciales de n8n. Renovar access token cada 24h (subworkflow auth, cachear en Redis ~23h).
- Descartar el refreshToken viejo (scopes limitados) tras confirmar el nuevo.

### Validación del bloque de entrada
1. Configurar webhook en Beds24 apuntando a n8n.
2. Crear/modificar una reserva de prueba (o esperar una real) → confirmar que aparece en Supabase con datos completos y SIN duplicar las ya existentes (Nancy 1019, Luis 1020 ya están — el flujo debe reconocerlas por codigo_airbnb y UPDATE, no duplicar).
3. Probar cancelación → estado `cancelada`.
4. Confirmar disparo de notificación interna a Valentina.
5. PENDIENTE separado: prueba real de WhatsApp al huésped para decidir disparo automático vs opt-in.

---

## 13. Estado de implementación del flujo de ENTRADA (2026-06-24)

### ✅ HECHO Y VALIDADO (lado Supabase)
- **Migración `add_airbnb_columns_to_reservas`** aplicada: `airbnb_precio_huesped`, `airbnb_comision`, `airbnb_payout` (numeric 12,2), `airbnb_rate_description` (text). Todas nullable, con COMMENT.
- **Función `sincronizar_reserva_beds24(jsonb)` reemplazada** (migración `sincronizar_reserva_beds24_v2_codigo_airbnb`) por el diseño §12. La versión vieja deduplicaba por `external_uid` y hacía INSERT ciego de huésped (habría roto el `UNIQUE(telefono)`). La nueva: dedup por `codigo_airbnb` (fallback `external_uid`), UPSERT de huésped por últimos 10 díg del teléfono, payout = `price − commission`, llena `airbnb_*`, COALESCE para no pisar datos al re-ejecutar, mapeo de estado documentado (`confirmed/new`→confirmada, `cancelled`→cancelada, `request/black/inquiry`→ignora).
- **Gate validado en transacción con ROLLBACK** (sin tocar datos reales ni disparar webhooks): Nancy `HMHQKBSFHD`→UPDATE folio 1019, Luis `HMWXKHWWPR`→UPDATE folio 1020, reserva nueva→INSERT, idempotencia OK, reservas +1 / huéspedes +1 exactos, payout 5000−750=4250 correcto, teléfono `523300001111`→`3300001111`. Cancelación→`cancelada`. `request`→0 filas.
- **Hallazgo clave:** la notificación a operaciones es **automática** vía trigger de BD `reservas_notificar_operaciones` (pg_net → `webhook_notificar_operaciones`) al insertar/transicionar a `confirmada`. El workflow n8n NO la dispara (evita doble). Idempotente: re-UPDATE de una reserva ya confirmada no re-notifica.

### ✅ CONSTRUIDO (lado n8n) — falta cablear credenciales y capturar sample
- **Workflow `Beds24 - Webhook Reservas`** (ID `RW7wbpCZDm1zm6pG`, proyecto Emi - Reservalia ▸ Tlalocan). Flujo: Webhook POST → Extraer Booking (Code) → ¿Booking válido? → Dedupe Redis INCR (TTL 24h) → ¿Primera entrega? → Postgres `sincronizar_reserva_beds24($1::jsonb)` → Responder 200. Ramas de ignorado/duplicado también responden 200.
- **URLs:** prod `https://reservalia.app.n8n.cloud/webhook/beds24-reservas` · test `…/webhook-test/beds24-reservas`.
- **⚠️ Credenciales perdidas en el import vía SDK** (caveat conocido): reasignar a mano en la UI → `Dedupe Reenvio`=Redis account, `Sincronizar Reserva`=Tlalocan Postgres.
- **Mapeo de campos PROVISIONAL:** `Extraer Booking` pasa el booking tal cual (la función solo lee las claves que necesita). Falta capturar un payload REAL del webhook para confirmar nombres de campo (pueden diferir del GET).

### ✅ VALIDADO END-TO-END CON DATOS REALES (2026-06-24, ejecución n8n 9036)
- Credenciales reasignadas (Redis/Postgres) y workflow ACTIVO. Webhook configurado en Beds24: **Webhook Version `2 – with personal data`**, Additional Data `None` (CVC/Token = datos de tarjeta, irrelevantes), URL prod `/webhook/beds24-reservas`.
- Disparo real: modificación de la reserva de Luis (folio 1020) en Beds24 → webhook llegó en ~delay normal.
- **DESCUBRIMIENTO CLAVE: el webhook V2 "with personal data" SÍ trae los financieros** (`price`, `commission`, `rateDescription` completo) además de identidad (`firstName/lastName/phone`, `apiReference`, `roomId`, `status`). **→ NO se necesita la iteración 2 (GET enriquecido). El subworkflow `Beds24 - Auth Token` queda innecesario para la ENTRADA.**
- **Estructura del payload:** booking bajo `body.booking`; nombres de campo idénticos al GET. El nodo `Extraer Booking` lo manejó sin cambios. Hermanos del booking en el body: `timeStamp`, `infoItems`, `invoiceItems` (`amount` = payout), `messages` (mensajería Airbnb), `retries`. Header `User-Agent: Booking Notifier`.
- **Gate con datos reales:** `Sincronizar Reserva` → `accion: actualizada`, folio 1020 UPDATE (no duplicó). Fila resultante correcta: `monto_total=monto_pagado=airbnb_payout=7135.86` (= `price 8444.80 − commission 1308.94`, coincide con "Expected Payout Amount" del rateDescription), `airbnb_precio_huesped=8444.80`, `airbnb_comision=1308.94`, componentes directos en 0, rate_description crudo guardado.
- **Hallazgo de negocio:** el monto manual previo de 1020 era $6,262; el flujo lo corrigió al payout real $7,135.86 → **la carga automática es más precisa que la captura manual** y corrige montos mal capturados.
- Notificación a operaciones: NO se disparó (reserva ya estaba `confirmada` → sin transición → trigger no notifica). Idempotencia confirmada.

### FLUJO DE ENTRADA = COMPLETO. Pendientes menores:
1. Revertir en Beds24 el conteo de huéspedes de Luis (se le agregó 1 child para el test) → otro webhook hará UPDATE de num_huespedes 3→2.
2. PENDIENTE separado (no bloqueante): prueba real de WhatsApp al huésped Airbnb para decidir disparo automático vs opt-in (el teléfono llega real, `523511356772`).
3. Cancelación: validada en gate con rollback; NO se prueba en vivo sobre reserva real de Airbnb.
4. Replicar a los otros 3 chalets cuando se decida (poblar `beds24_room_id` + conectar en Beds24); la función ya es genérica por room_id.
