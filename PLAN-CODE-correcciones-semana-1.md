# Plan de implementación — Correcciones tras semana 1 de operación

> **Audiencia:** equipo de implementación (code).
> **Origen:** `correcciones_tras_una_semana_de_operacion.pdf` + decisiones de arquitectura cerradas 2026-06-28.
> **Principio rector:** *certeza sobre prisa*. Mostrar SQL antes de ejecutar, validar incrementalmente, migraciones nombradas, confirmar destructivo.
> **Convención:** código en inglés; UI/commits/mensajes al huésped en español.

---

## Estado de ejecución (actualizado 2026-06-28)

| Bloque | Estado | Notas |
|---|---|---|
| **B — Modelo de datos: origen + contactos** | ✅ **HECHO** | Migraciones `consolidar_origenes_reserva_catalogo`, `consolidar_origenes_reserva_fk` (Opción A: `reservas.origen` ahora FK al catálogo), `crear_tabla_contactos`. Falta **B3** (alta de contacto en el Concierge) — diferido, es edición de workflow. |
| **C — Beds24 push (anti-overbooking)** | ✅ **HECHO y validado E2E** | Push en `confirmada`, release en `cancelada`/`no_show` **y en DELETE** (botón rojo). Migraciones `agregar_beds24_booking_id`, `beds24_anti_eco_guard`, `trigger_push_reserva_beds24`, `push_reserva_beds24_delete_release`. Workflow n8n `Tlalocan - Push Reserva Beds24` (`n2yU2wMZx4lCOOu4`) publicado. Propagación a Airbnb medida <15 min (ida y vuelta). |
| A, D, E, F, G, H, I, J, K, L | ⬜ pendientes | — |

> **Hallazgo (resuelve gate #3):** `reservas.codigo_airbnb` ya guarda el código legible `HMXXXX` poblado → **no** hace falta la migración `agregar_codigo_confirmacion_airbnb` de D2.
> **Nota:** B y C viven en Supabase (DDL) + n8n (workflows); **no tocaron código de la app**. El dropdown de origen de la app es subconjunto del catálogo, compatible con la nueva FK.

---

## 0. Decisiones cerradas (contexto para todo el plan)

| # | Tema | Decisión |
|---|---|---|
| 1 | Mensajería Airbnb | Explorar envío vía **Beds24 API** (spike previo antes de comprometer). Si no es viable, fallback = solo validar WhatsApp + contacto manual. |
| 2 | Simuladora de precios | **Precio cerrado** como número principal (lo que el huésped ve hoy). Desglose tarifa+impuestos como detalle opcional. |
| 3 | Notas de voz | Construir rama en **duplicado por MCP**; **merge final al Concierge productivo lo hace D4ny desde UI**. |
| 4 | Extensión de estadía | **Reserva nueva ligada** (no mutar la original), cotizada a **precio directo**. |
| 5 | Contactos | **Separar `contactos` (todos) de `huespedes` (con relación comercial)**. |
| 6 | Etiquetas WhatsApp | **Condicionado** a spike de Evolution. No bloquea el plan; queda como tarea con gate. |
| 7 | Pausa de Tlali | **Global**, reactivación por **timeout**, respuesta humana vía **WhatsApp externo**. |
| 8 | Reporte de ingresos | **Completo**: facturado + payout neto + por canal, con rango de fechas. |

**Entidad transversal `origen`:** una sola taxonomía canónica alimenta dropdown de reservas, contexto de Tlali, etiqueta de WhatsApp (si aplica), tarifa aplicada y herencia en extensiones. Definirla una vez (Bloque B) y referenciarla en todos los módulos.

---

## Secuencia de implementación (por dependencia y riesgo)

```
A. Quick wins (sin riesgo de infra)        ──► independientes, salen ya
B. Modelo de datos: origen + contactos     ──► fundacional, lo consumen C,D,E,F
C. Beds24 push (app → bloquea Airbnb)       ──► cierra el hoyo de overbooking
D. Contactos Airbnb + identificación        ──► depende de B; spike Beds24 (#1)
E. Pausa de Tlali (global + timeout)         ──► toca Concierge (check al inicio)
F. Notas de voz                              ──► duplicado MCP, merge UI
G. Orígenes de reserva (personal/cortesía/referido) ──► depende de B
H. Extensión de estadía                      ──► tool nueva + crons
I. Reporte de ingresos por rango             ──► frontend + query
J. Simuladora de precios                     ──► al final; depende de reglas cerradas
K. Calendario público Google                 ──► consumidor del iCal export
L. Etiquetas WhatsApp (GATED por spike)      ──► condicionado a #6
```

---

## Bloque A — Quick wins (sin riesgo de infraestructura)

### A1. Concisión de Tlali (ajuste de prompt)
- **Workflow:** Tlalocan Concierge (`TQKziRbmCiyNC6CQ`), nodo del agente OpenAI.
- **Cambio:** ajustar el system prompt para: (a) respuestas más breves; (b) dividir en 2–3 mensajes en vez de un bloque largo; (c) responder con precisión **solo** a lo preguntado, sobre todo a huéspedes.
- **Riesgo:** nulo a nivel infra (es texto). Pero el envío multi-mensaje puede requerir ajuste del nodo de salida de Evolution si hoy concatena. Verificar si el prompt puede emitir separadores y el flujo los parte, o si hay que añadir un nodo split.
- **Validación:** batería corta de mensajes de prueba (saludo, pregunta puntual de WiFi, cotización) revisando longitud y número de envíos.

### A2. Calendario público de Google (prioridad media del PDF)
- **Qué:** dar visibilidad del conjunto de reservas de todos los canales en un calendario Google público (solo lectura).
- **Cómo:** es un consumidor más del `iCal Export v2` (`QzvtLHPtGEDSiukZ`) que ya existe. Google Calendar puede suscribirse por URL iCal (sin datos personales, ya cumple).
- **Tarea:** suscribir un calendario Google a las 4 URLs `…/tlalocan-ical/<slug>`, o construir un feed agregado único si se quiere una sola vista. Evaluar latencia de refresh de Google (puede ser de horas; documentarlo como limitación, igual que el iCal lento).
- **Riesgo:** bajo. No toca Supabase ni el Concierge.

---

## Bloque B — Modelo de datos fundacional: `origen` + `contactos`  ✅ HECHO (falta B3)

> Fundacional. C, D, E, G, H consumen esto. Hacerlo bien aquí evita 5 definiciones divergentes de "referido".

### B1. Tabla `contactos` (separada de `huespedes`)
- **Decisión 5:** `contactos` = todo el que escribe; `huespedes` = con relación comercial.
- **Migración nombrada** (mostrar antes de aplicar): `crear_tabla_contactos`.
- **Esquema propuesto** (a validar con D4ny antes de DDL):
  - `id` (uuid pk), `telefono` (10 díg, único), `nombre` nullable, `estado_contacto` ∈ `lead`/`prospecto`/`huesped`, `origen` (FK a taxonomía), `whatsapp_verificado` (bool), `primer_contacto_en`, `ultimo_contacto_en`, `huesped_id` nullable (FK a `huespedes` cuando se concreta).
- **Relación:** un `contacto` se promueve a `huesped` al crear primera reserva (set `huesped_id`, `estado_contacto='huesped'`).
- **RLS:** misma política de rol que `huespedes`.

### B2. Taxonomía canónica de `origen`
- Hoy `reservas.origen` ∈ `directa`, `airbnb`, `booking`, `referido`, `agente_whatsapp`, `app_manual`.
- **Nuevos valores de negocio** (decisión del PDF): `personal`, `cortesia`, `referido` (con semántica de precio/permiso, ver Bloque G).
- **Tarea:** consolidar en un solo `enum`/tabla de catálogo `origenes_reserva` con metadatos: `clave`, `etiqueta_es`, `aplica_precio` (directo/cero/arbitrario/plataforma), `solo_admin` (bool), `label_whatsapp` (para #6).
- **Migración nombrada:** `consolidar_origenes_reserva`.
- **Cuidado destructivo:** si se cambia el tipo de `reservas.origen`, es ALTER → mostrar y confirmar. Migrar valores existentes con mapeo explícito.

### B3. Creación de contacto al iniciar conversación
- **Workflow:** Concierge, tras el dedupe y el lookup de teléfono.
- **Lógica:** si el teléfono no existe en `contactos`, **upsert** con `estado_contacto='lead'`, `origen` inferido (entrante directo → `directa`/`agente_whatsapp`), `whatsapp_verificado=true` (escribió, luego su número recibe WA).
- **Anti-basura:** el upsert por teléfono protege duplicados. Para números inválidos importados (problema Airbnb), marcar `whatsapp_verificado=false` hasta confirmar.

---

## Bloque C — Beds24 push (app/directa → bloquea Airbnb) **[PRIORIDAD]**  ✅ HECHO Y VALIDADO E2E

> El "HOYO" de la tabla del PDF. Reservas creadas en la app/Tlali **no** apartan fechas en Airbnb hoy → riesgo de overbooking real.

- **Estado actual:** los 4 chalets ya conectados a Beds24 (mapeos en memoria del proyecto); webhooks Beds24→n8n configurados (entrada). Falta el **sentido inverso**: cuando se crea/confirma una reserva directa en Supabase, **empujarla a Beds24** para que Beds24 bloquee Airbnb.
- **Tarea:**
  1. Workflow n8n nuevo (o extensión de `Notificar Operaciones`/trigger de confirmación) que al pasar reserva a `confirmada` (o `cotizada`, decidir el estado de bloqueo) llame a Beds24 API V2 para crear/actualizar el booking en el room mapeado.
  2. Mapear `chalet_id` → `roomId/propId` de Beds24 (ya documentados: De La Entrada 337213/697368, De La Cima 337352/697556, Del Fondo 337360/697576, De La Cañada mapped).
  3. Idempotencia: guardar el `bookingId` de Beds24 en la reserva (campo nuevo, ej. `beds24_booking_id`) para no duplicar.
- **Cuidado:** evitar bucle de eco — una reserva que entra POR Beds24 (webhook) no debe re-empujarse a Beds24. Filtrar por `origen != 'airbnb'` o por presencia de `external_uid`.
- **Red de seguridad:** **no eliminar la entrada manual de reservas en la app.** El iCal del website es lento (minutos–1h); para fechas próximas no protege. La app manual sigue siendo respaldo. (Corrige la afirmación del PDF de que "ya no hay motivo para ingresar manualmente".)
- **Validación:** crear reserva directa de prueba → confirmar que Beds24 la recibe → confirmar que Airbnb bloquea esas fechas. End-to-end con fechas dummy lejanas.

---

## Bloque D — Contacto de huésped Airbnb + identificación por código

> Cimiento del futuro programa de lealtad. Depende de B (contactos) y del spike Beds24 (#1).

### D1. Validación de WhatsApp del número Airbnb
- Al entrar reserva Airbnb (webhook Beds24), tomar el teléfono del huésped y **verificar si existe en WhatsApp** vía Evolution (endpoint de check de número).
- Persistir `whatsapp_verificado` en `contactos`. Si inválido, marcar y escalar a contacto manual (notificación a operaciones).
- **Dato real:** Airbnb a veces entrega números proxy/enmascarados que caducan tras checkout. Diseñar asumiendo que un % **siempre** fallará — no es excepción. (Coincide con Felipe, folio 1027, número de 12 díg → normalizar a 10.)

### D2. Identificación por código de reserva Airbnb (capacidad nueva de Tlali)
- **Tool nueva:** `identificar_por_codigo_airbnb`. El huésped escribe su código de confirmación Airbnb (formato `HMXXXXXXXX`) y Tlali lo empata con su reserva.
- **VERIFICAR PRIMERO:** ¿qué guarda hoy `reservas.external_uid`? ¿El código legible `HMXXXX` que el huésped conoce, o el UID interno de Beds24? El huésped solo conoce el primero. Si no se guarda el código legible, añadir campo `codigo_confirmacion_airbnb` y poblarlo desde el webhook Beds24.
- **Flujo:** huésped sin reserva por teléfono → Tlali ofrece identificarse por código → match → vincula `contacto`↔`reserva`, set teléfono verificado.

### D3. Mensajería saliente por Airbnb (SPIKE — decisión 1)
- **Spike previo (30–60 min):** verificar si Beds24 API V2 expone el envío de mensajes al hilo de Airbnb del huésped.
- **Si viable:** workflow que, al entrar reserva Airbnb, envíe mensaje por el hilo Airbnb avisando "la comunicación es preferente por WhatsApp" + cómo identificarse.
- **Si no viable:** documentar y caer al fallback (validar WA + contacto manual). No bloquea el resto del bloque.

---

## Bloque E — Pausa global de Tlali con timeout

> Decisión 7: global, timeout, respuesta vía WhatsApp externo.

- **NO cortar la conexión Evolution.** Usar bandera en Supabase. Razones: cortar Evolution pierde el registro de mensajes entrantes durante el apagado y re-vincular reproduce el dolor del 401 de la línea interna.
- **`config` key nuevo:** `tlali_pausado_hasta` (timestamp). `NULL` o pasado = activo; futuro = pausado.
- **Concierge:** primer nodo tras dedupe checa `now() < tlali_pausado_hasta`. Si pausado → **no responde**, pero registra el mensaje entrante (para que el humano lo vea en WhatsApp externo). Evolution sigue conectado.
- **App:** control en el dashboard que setea `tlali_pausado_hasta = now() + X` (selector de duración: 1h, 4h, hasta fin del día, manual). Botón "reactivar ahora" = set a `now()`.
- **Reactivación:** automática al vencer el timestamp (no requiere acción). Sin riesgo de dejar a Tlali mudo indefinidamente.
- **Respuesta humana:** vía WhatsApp Web/Business externo (la app solo silencia). Sin chat embebido en esta fase.
- **Validación:** pausar → enviar mensaje de prueba → confirmar que Tlali no responde y que el mensaje queda registrado → esperar timeout → confirmar reactivación.

---

## Bloque F — Notas de voz en el Concierge

> Diagnóstico del PDF confirmado correcto. Decisión 3: duplicado MCP, merge UI.

### Roturas identificadas (ambas reales)
1. `Preparar Datos de Mensaje` lee `body.data.message.conversation` → **vacío** en audio (el contenido viene en `message.audioMessage`).
2. `¿Es Media?` solo desvía `["imageMessage","documentMessage"]` → `audioMessage` cae al flujo de texto con texto vacío.

### Solución (rama de transcripción)
1. Detectar `messageType === 'audioMessage'` en el webhook.
2. Bajar el audio de Evolution (base64/URL) — **reusar el patrón de `Ingesta Comprobante`** (`djnNoB36EvzGTpJY`).
3. Transcribir con Whisper / `gpt-4o-mini-transcribe` (OpenAI, credencial ya presente).
4. Inyectar el texto transcrito como `newMessage` → sigue el flujo normal (buffer Redis + agente).

### Proceso seguro (decisión 3)
- Construir y probar la rama en un **duplicado del Concierge por MCP** (aislado).
- **Merge final al `TQKziRbmCiyNC6CQ` productivo lo hace D4ny desde UI.** Razón: actualizar workflows por MCP **descarta las credenciales de Evolution (Header Auth)**; el Concierge es el workflow más crítico y con más nodos — no es lugar para descubrir el strip en producción.
- Entregable de code: el duplicado funcional + instrucciones nodo-por-nodo para el merge manual.
- **Recordar:** tras cualquier edición MCP, reasignar credencial Evolution en UI y verificar.

---

## Bloque G — Orígenes de reserva (personal / cortesía / referido)

> No es "cambiar el dropdown". Cada opción trae lógica de negocio: modelo de datos + permisos (RLS) + ramas en crons. Módulo propio. Depende de B2.

| Origen | Precio | Permiso | Efecto en n8n |
|---|---|---|---|
| `personal` | **$0** | solo `admin` | dispara recordatorio normal al huésped, **suprime adeudos/saldo** |
| `cortesia` | **arbitrario** (capturable) | solo `admin` | reserva normal con monto manual |
| `referido` | **precio canal directo** | (definir) | cotiza directo + **asigna comisión a vendedor** |

- **`personal` toca `Recordatorio Saldo`** (`2e1YxT0uBw8IhxA6`): debe excluir reservas `origen='personal'` del cálculo de saldo y de la notificación a admins por impago.
- **`referido` → comisión de vendedor:** campo nuevo `comision_vendedor` + ¿tabla `vendedores`? + cómo se reporta. **BLOQUEANTE menor:** el monto de comisión está como "??" en el PDF — confirmar con D4ny antes de implementar esa parte. El resto de `referido` (precio directo) puede avanzar sin eso.
- **RLS:** `personal` y `cortesia` solo creables por rol `admin`/`super_admin`. Enforce en política, no solo en UI.
- **Migración:** depende de B2 (taxonomía consolidada).
- **UI:** dropdown de origen en el form de reserva de la app, con campos condicionales (precio arbitrario para cortesía, vendedor+comisión para referido).

---

## Bloque H — Extensión de estadía (huésped en curso)

> Decisión 4: reserva nueva ligada, precio directo. Tool nueva + ajuste a 2 crons.

### H1. Tool `cotizar_extension`
- Reusa `verificar_disponibilidad` **acotado al mismo chalet** y a las noches inmediatamente posteriores a `fecha_salida` de la reserva en curso.
- Si esas noches están bloqueadas (otra directa o bloqueo iCal/Airbnb) → Tlali lo dice sin prometer.
- Precio: `calcular_estadia` sobre las noches extra. Aplica regla de mínimo 2 noches si cruza vie/sáb. **Cotiza a precio directo** (decisión 4), independientemente del canal de la reserva original.

### H2. Modelo: reserva nueva ligada
- **No mutar `fecha_salida` de la original** (rompería `monto_total` pagado/conciliado y los crons de transición).
- Crear reserva nueva contigua con campo/convención `continuacion_de_folio` (FK a la reserva original).
- **Operaciones:** `Recordatorio Operaciones` (`HNqOKOWQvvGruMFz`) y `Transiciones Estado` (`LjYb3trksGdtgFFs`) deben tratar la cadena como **estancia continua**: NO programar limpieza intermedia entre folio original y su continuación; el check-out operativo es el de la última reserva de la cadena.
- **Migración:** campo `continuacion_de_folio` en `reservas` (nullable FK). Nombrada: `agregar_continuacion_reserva`.

---

## Bloque I — Reporte de ingresos por rango de fechas

> Decisión 8: completo (facturado + payout neto + por canal).

- **Presets:** hoy / últimos 7 días / último mes / rango manual.
- **Dos métricas por canal:**
  - **Facturado** = `SUM(monto_total)` (lo cobrado al huésped).
  - **Payout neto** = lo recibido. Para Airbnb usar el payout real ya extraído (`SUM(invoiceItems[].amount)`), **no** `precio − comisión` (ignora promociones y retenciones fiscales).
- **Desglose por canal:** Airbnb / directa-Tlali / website / referido, con ambas columnas.
- **Backend:** query/función Supabase parametrizada por `fecha_desde`/`fecha_hasta` que agregue por `origen`. Considerar función `reporte_ingresos(desde, hasta)`.
- **Frontend:** pestaña en el tab Resumen con selector de rango + tabla facturado vs. neto por canal + total.
- **Comparte lógica con J (simuladora):** la conversión facturado↔neto por canal se escribe **una vez** y la consumen ambos. No duplicar.

---

## Bloque J — Simuladora de precios (pestaña independiente)

> Decisión 2: precio cerrado como principal. Al final: depende de reglas de negocio cerradas.

- **Input:** una fecha (toma la tarifa que corresponde por día de semana) **o** un precio arbitrario.
- **Output principal:** **precio cerrado todo-incluido** (IVA 16% + ISH 5% incorporados, redondeado a la centena) — el número que el huésped ve hoy. Calcular con la misma `calcular_estadia` / `total_redondeado`, no reimplementar.
- **Output secundario (detalle opcional, colapsable):** desglose tarifa + impuestos por canal y **payout estimado**.
- **CRÍTICO — etiquetar como estimador:** el payout que recalcule con porcentajes fijos (las tablas del PDF: comisión 15.5%, IVA 8%, ISR 4%, ISH 5%) **divergirá** del payout real de Airbnb (que varía con/sin RFC y promociones). Etiquetar explícitamente "payout **estimado**", no fuente de verdad. La conciliación real sigue saliendo de `invoiceItems`.
- **Inconsistencia a resolver:** las tablas del PDF muestran impuesto 21% **sumado encima** de la tarifa ($1,000 → $1,210), lo cual **contradice** la arquitectura de precio cerrado (impuestos ya incluidos). El número principal de la simuladora debe ser precio cerrado; el desglose es vista informativa, no otra forma de cobrar.
- **BLOQUEANTE:** comisión de vendedor en referidos = "??" en el PDF. Confirmar antes de incluir ese canal en la simuladora.
- **Reusa la lógica facturado↔neto del Bloque I.**

---

## Bloque K — Calendario público Google (ver A2)

Movido a quick wins (A2). Listado aquí solo por completitud de índice.

---

## Bloque L — Etiquetas de WhatsApp por origen **[GATED]**

> Decisión 6: condicionado a spike de Evolution. NO comprometer implementación hasta verificar.

- **Trampa de plataforma:** Evolution API **no** es WhatsApp Business API oficial. Las labels son función de WhatsApp Business app / Cloud API de Meta. Soporte de labels vía Evolution (Baileys) es **parcial e inestable** y varía por build.
- **Spike de verificación (gate, 30–60 min contra la instancia real):**
  1. ¿La instancia Evolution expone endpoints de labels (crear/asignar/listar)?
  2. ¿Esas etiquetas se reflejan en la app de WhatsApp Business que ve la operación, o solo viven en Evolution?
- **Si SÍ:** al crear contacto (B3), asignar label según `origen`. Taxonomía = la misma de B2 (plataforma/referido/cortesía). Una sola fuente alimenta reserva + contexto Tlali + label.
- **Si NO:** mantener `origen` solo en Supabase. Evaluar migración a API oficial de Meta como decisión futura grande (fuera de alcance).
- **Estado en el plan:** tarea con gate explícito. No se programa implementación hasta resultado del spike.

---

## Resumen de migraciones nombradas (mostrar antes de aplicar)

| Migración | Bloque | Tipo | Cuidado |
|---|---|---|---|
| `crear_tabla_contactos` | B1 | CREATE | seguro |
| `consolidar_origenes_reserva` | B2 | ALTER tipo origen | destructivo — confirmar, mapear valores |
| `agregar_continuacion_reserva` | H2 | ALTER (add col) | seguro |
| `agregar_beds24_booking_id` | C | ALTER (add col) | seguro |
| `agregar_codigo_confirmacion_airbnb` | D2 | ALTER (add col) | seguro, si external_uid no sirve |
| `agregar_comision_vendedor` (+ `vendedores`?) | G | CREATE/ALTER | depende de confirmar "??" |
| `config: tlali_pausado_hasta` | E | INSERT config | seguro |

---

## Gates y bloqueantes abiertos

1. **Spike Beds24 mensajería Airbnb** (D3) — antes de comprometer mensajería saliente.
2. **Spike Evolution labels** (L) — antes de comprometer etiquetas.
3. **`external_uid` ¿guarda código legible?** (D2) — verificar antes de la tool de identificación.
4. **Comisión de vendedor = "??"** (G, J) — confirmar monto/modelo con D4ny.
5. **Envío multi-mensaje de Tlali** (A1) — verificar si el nodo de salida ya lo soporta o requiere split.

---

## Notas de seguridad operativa (recordatorios del proyecto)

- Tras **cualquier** edición MCP de workflow: reasignar credencial Evolution (Header Auth) en UI y verificar nodo por nodo.
- n8n corre la versión **publicada**: `publish` tras editar.
- Mostrar SQL/DDL como migración nombrada antes de ejecutar; DELETE/DROP/ALTER requieren confirmación explícita; INSERT/CREATE pueden proceder.
- No eliminar la entrada manual de reservas como respaldo mientras el iCal del website siga siendo lento.
