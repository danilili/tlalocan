# Plan de implementación — Correcciones tras semana 1 de operación

> **Audiencia:** equipo de implementación (code).
> **Origen:** `correcciones_tras_una_semana_de_operacion.pdf` + decisiones de arquitectura cerradas 2026-06-28.
> **Principio rector:** *certeza sobre prisa*. Mostrar SQL antes de ejecutar, validar incrementalmente, migraciones nombradas, confirmar destructivo.
> **Convención:** código en inglés; UI/commits/mensajes al huésped en español.
> **Documento canónico** (fusión 2026-06-29): cuerpo con decisiones refinadas + estado de ejecución de Code. Reemplaza las dos versiones divergentes previas.

---

## Estado de ejecución (actualizado 2026-06-29)

| Bloque | Estado | Notas |
|---|---|---|
| **B — Modelo de datos: origen + contactos** | ✅ **HECHO** (falta B3) | Migraciones `consolidar_origenes_reserva_catalogo`, `consolidar_origenes_reserva_fk` (Opción A: `reservas.origen` ahora FK al catálogo), `crear_tabla_contactos`. **B3 diferido y NO ejecutado** → se retoma con el disparador corregido (al crear reserva, no al escribir; ver Bloque B3). |
| **C — Beds24 push (anti-overbooking)** | ✅ **HECHO y validado E2E** | Push en `confirmada`, release en `cancelada`/`no_show` **y en DELETE** (botón rojo). Migraciones `agregar_beds24_booking_id`, `beds24_anti_eco_guard`, `trigger_push_reserva_beds24`, `push_reserva_beds24_delete_release`. Workflow n8n `Tlalocan - Push Reserva Beds24` (`n2yU2wMZx4lCOOu4`) publicado. Propagación a Airbnb medida <15 min (ida y vuelta). |
| **A — Quick wins** | ✅ **HECHO** | A1 (concisión + split multi-globo + modelo gpt-4.1-mini + no-escalar-en-ventas) aplicado en UI y validado. A2 calendarios Google **confirmados** (4 URLs separadas). A3 mensajes Airbnb sincronizados con los de Tlali (horarios estrictos, recordatorio de salida la víspera 18:00). Ver §Bloque A. |
| **F — Notas de voz** | ✅ **HECHO y EN PRODUCCIÓN** | Rama de transcripción (Whisper) mergeada al Concierge productivo `TQKziRbmCiyNC6CQ`, publicada y validada en vivo. Duplicado de build eliminado. Ver §Bloque F. |
| **E — Pausa global de Tlali** | ⏸️ **DIFERIDO** (documentado) | Diseño Nivel 2 "mute real" (toggle `readMessages`/`alwaysOnline` Evolution + reconciliador para auto-resume) cerrado y escrito. No prioritario ahora. Ver §Bloque E. |
| **D — Fase 2 (validación WhatsApp)** | ✅ **CERRADO 2026-07-02** | Migración `huespedes_whatsapp_valido`; workflow `Tlalocan - Valida WhatsApp` (`v5mzMp2pe5orQJNI`) publicado, cron 16:00 MX; backfill validado; **badge en producción (PR #10 mergeado)**. Gotcha: `/chat/whatsappNumbers` rechaza duplicados → dedupe en `Preparar Lote`. Bonus: limpieza de 5 huéspedes + 6 reservas de prueba (el DELETE del folio 1033 disparó el release Beds24 en vivo — Bloque C revalidado). |
| **G — Orígenes + calendario + extensión + pagos** | ✅ **CERRADO 2026-07-02 (PR #11 mergeado a prod)** | 3 rondas de diseño con D4ny. Final: captura manual = 4 orígenes (`captura_manual`: website/referido/**extensión**/cortesía), extensión ligada (`continuacion_de_reserva_id`, −15%, pago único cobrado, botón "Extender reservación" en estancias en curso — **"Eliminar reserva" fuera de la UI**), **ledger `pagos`** (mixtos, trigger sync `monto_pagado`, abonos en Editar, ValidarPago registra monto), descuento efectivo −10% (pago completo al crear), RangeCalendar de ocupación. 7 migraciones BD; cero cambios n8n. Ver §Bloque G. |
| H, I, J, L | ⬜ debajo de la línea de prioridad | — |
| B3 · D2.1 · K(=A2) | ⏸️/✅ | B3 aparcado (estético). D2.1 contacto-WhatsApp diferido (estético). K = A2 (hecho). |

> **Hallazgo de Code (resuelve gate del código Airbnb):** `reservas.codigo_airbnb` ya guarda el código legible `HMXXXX` poblado → **no** hace falta la migración `agregar_codigo_confirmacion_airbnb` de D2.3. La tool `identificar_por_codigo_airbnb` puede empatar directo contra ese campo.
> **Nota:** B y C viven en Supabase (DDL) + n8n (workflows); **no tocaron código de la app**. El dropdown de origen de la app es subconjunto del catálogo, compatible con la nueva FK.
> **B3 se salvó por estar diferido:** el texto del plan viejo decía "contacto al iniciar conversación"; como no se ejecutó, no hay retrabajo. El diseño correcto (disparo al crear reserva) está en el Bloque B3 de este documento.

---

## 0. Decisiones cerradas (contexto para todo el plan)

| # | Tema | Decisión |
|---|---|---|
| 1 | Mensajería Airbnb | **Plan B confirmado: mensajes programados nativos de Airbnb** (panel host, sin código). API directa de Airbnb no accesible (no somos partner). Spike Beds24 **archivado como mejora futura opcional** — Beds24 (Preferred) sí expone envío de mensajes, pero no lo perseguimos ahora. |
| 2 | Simuladora de precios | **Precio cerrado** como número principal. Desglose derivado del cerrado, etiquetado aproximado. **Prioridad baja, módulo independiente.** |
| 3 | Notas de voz | Construir rama en **duplicado por MCP**; **merge final al Concierge productivo lo hace D4ny desde UI**. |
| 4 | Extensión de estadía | **Reserva nueva ligada** (no mutar la original), cotizada a **precio directo**. **No prioritario.** |
| 5 | Contactos | **Separar `contactos` (todos) de `huespedes`**. Disparador de creación de contacto = **creación de reserva** (aunque esté pendiente de pago), NO inicio de conversación. Implementar **en dos fases** (ver Bloque D). |
| 6 | Etiquetas WhatsApp | Las etiquetas se **crean a mano en la app de WhatsApp Business**; Evolution solo las **asigna** (no las crea). Spike reducido: verificar asignación, no creación. |
| 7 | Pausa de Tlali | **Global**, reactivación por **timeout**, respuesta humana vía **WhatsApp externo**. |
| 8 | Reporte de ingresos | **Completo**: facturado + payout neto + por canal, con rango de fechas. |

**Entidad transversal `origen`:** una sola taxonomía canónica alimenta dropdown de reservas, contexto de Tlali, etiqueta de WhatsApp, tarifa aplicada y herencia en extensiones. Definirla una vez (Bloque B) y referenciarla en todos los módulos.

**Comisión de vendedor (referidos):** porcentaje fijo configurable, valor **placeholder** (ej. `0`) hasta que D4ny lo defina. La lógica queda lista; solo falta el número. No bloquea.

---

## Secuencia de implementación (por dependencia y riesgo)

```
A. Quick wins (sin riesgo de infra)        ──► independientes, salen ya
   · A1 concisión Tlali · A2 calendario Google · A3 plan B Airbnb (mensajes programados)
B. Modelo de datos: origen + contactos     ──► ✅ HECHO (falta B3, diferido)
C. Beds24 push (app → bloquea Airbnb)       ──► ✅ HECHO Y VALIDADO E2E
D. Contactos Airbnb (2 fases) + identificación ──► depende de B; Fase 1 ya cubierta por A3
E. Pausa de Tlali (global + timeout)         ──► toca Concierge (check al inicio)
F. Notas de voz                              ──► duplicado MCP, merge UI
G. Orígenes de reserva (personal/cortesía/referido) ──► depende de B
─── debajo de la línea de prioridad: no urgentes ───
H. Extensión de estadía                      ──► NO PRIORITARIO. tool nueva + crons
I. Reporte de ingresos por rango             ──► frontend + query
J. Simuladora de precios                     ──► PRIORIDAD BAJA. módulo independiente
K. Calendario público Google                 ──► (movido a A2)
L. Etiquetas WhatsApp                         ──► spike reducido (asignación, no creación)
```

---

## Bloque A — Quick wins (sin riesgo de infraestructura)

### A1. Concisión de Tlali (ajuste de prompt)  ✅ HECHO (aplicado en UI por D4ny, validado en prospección)
- **Workflow:** Tlalocan Concierge (`TQKziRbmCiyNC6CQ`), nodo del agente OpenAI.
- **Cambio:** ajustar el system prompt para: (a) respuestas más breves; (b) dividir en 2–3 mensajes en vez de un bloque largo; (c) responder con precisión **solo** a lo preguntado, sobre todo a huéspedes.
- **Riesgo:** nulo a nivel infra (es texto). Pero el envío multi-mensaje puede requerir ajuste del nodo de salida de Evolution si hoy concatena. Verificar si el prompt puede emitir separadores y el flujo los parte, o si hay que añadir un nodo split.
- **Validación:** batería corta de mensajes de prueba (saludo, pregunta puntual de WiFi, cotización) revisando longitud y número de envíos.

**Implementación final (2026-06-29, todo en UI, sin MCP):**
1. **Prompt:** nueva sección `# LONGITUD Y CORTE DE MENSAJES` (alta en jerarquía) + `Mensajes cortos (1-3 lineas)` + token de corte `[[corte]]`.
2. **Multi-globo:** el nodo de salida `sendText` envía 1 globo por llamada. Se añadió un nodo Code (`Code in JavaScript`, entre `Limpiar Cola` y `Enviar Respuesta a WhatsApp`) que parte `output` por `[[corte]]` en N items (`pairedItem:{item:0}`); el HTTP node corre 1 vez por item → globos en orden. La salida cambió a `"text": $json.text`. Degrada a 1 globo si no hay token.
3. **Modelo:** subido `gpt-4o-mini` → **`gpt-4.1-mini`** (mejor adherencia a reglas y a tool-calling).
4. **Bug de tools (consecuencia del modelo obediente):** los `$fromAI('campo', 'desc', 'string')` de parámetros opcionales generan esquema **required**; `gpt-4.1-mini` obedeció "omítelo" → error `Required → at chalet_slug`. **El 4º arg (default) de `$fromAI` NO existe en n8n 2.27 (`invalid syntax`).** Fix: **regla en el prompt** (sección `# HERRAMIENTAS`) — "SIEMPRE incluye todos los parámetros; opcional que no aplique → `''`, nunca omitir". `''` satisface el `Required` y los subworkflows ya tratan vacío = todos/general. Cubre las 6 tools con opcionales.
5. **Ventas nunca escala a humano:** se removieron los 3 "un asesor humano te contactará" (HERRAMIENTAS/verificar, MODO VENTAS paso 3, CASOS ESPECIALES sin disponibilidad) + regla global al inicio de `# MODO VENTAS`. Sin disponibilidad o caso complejo en ventas → ofrecer otras fechas y/o **remitir al sitio web**, nunca prometer contacto humano. (El `telefono_emergencias` de estancia se conserva: eso no es ventas.)

### A2. Calendario público de Google (prioridad media del PDF)
- **Qué:** dar visibilidad del conjunto de reservas de todos los canales en un calendario Google público (solo lectura).
- **Cómo:** es un consumidor más del `iCal Export v2` (`QzvtLHPtGEDSiukZ`) que ya existe. Google Calendar puede suscribirse por URL iCal (sin datos personales, ya cumple).
- **Tarea:** suscribir un calendario Google a las 4 URLs `…/tlalocan-ical/<slug>`, o construir un feed agregado único si se quiere una sola vista. Evaluar latencia de refresh de Google (puede ser de horas; documentarlo como limitación, igual que el iCal lento).
- **Riesgo:** bajo. No toca Supabase ni el Concierge.

### A3. Plan B de mensajería Airbnb — mensajes programados nativos **[tapa el hueco crítico]**
- **Problema que resuelve:** en la semana 1 se detectó que con números de WhatsApp inválidos **no salía mensaje ni por WhatsApp ni por Airbnb** — el huésped quedaba sin contactar por ningún frente.
- **Solución (sin código):** configurar **mensajes programados / quick replies nativos de Airbnb** en el panel de host. Se entregan por el canal de Airbnb (que siempre funciona, porque ahí vive la reserva), avisando que **la comunicación es preferente por WhatsApp** + cómo identificarse con Tlali.
- **Investigación confirmada (2026-06-28):** la API directa de Airbnb no es accesible (solo partners aprobados). Beds24 (partner Preferred) **sí** expone envío de mensajes a Airbnb, pero se **archiva como mejora futura opcional** — el plan B cubre el caso sin dependencia técnica. Es plantilla fija (sin datos dinámicos); si en el futuro se requiere mensajería rica, reabrir el spike Beds24.
- **Quién:** configuración manual de D4ny en Airbnb. Code documenta el texto sugerido de las plantillas y los momentos del ciclo (al reservar / antes de check-in).
- **Riesgo:** nulo. No toca el sistema.

---

## Bloque B — Modelo de datos fundacional: `origen` + `contactos`  ✅ HECHO (falta B3)

> Fundacional. C, D, E, G, H consumen esto. Hacerlo bien aquí evita 5 definiciones divergentes de "referido".

### B1. Tabla `contactos` (separada de `huespedes`)  ✅
- **Decisión 5:** `contactos` separada de `huespedes` (con relación comercial).
- **Migración aplicada:** `crear_tabla_contactos`.
- **Esquema** (implementado):
  - `id` (uuid pk), `telefono` (10 díg, único), `nombre` nullable, `estado_contacto` ∈ `lead`/`prospecto`/`huesped`, `origen` (FK a taxonomía), `whatsapp_verificado` (bool), `primer_contacto_en`, `ultimo_contacto_en`, `huesped_id` nullable (FK a `huespedes` cuando se concreta).
- **Relación:** un `contacto` se promueve a `huesped` al crear primera reserva (set `huesped_id`, `estado_contacto='huesped'`).
- **RLS:** misma política de rol que `huespedes`.

### B2. Taxonomía canónica de `origen`  ✅
- Antes `reservas.origen` ∈ `directa`, `airbnb`, `booking`, `referido`, `agente_whatsapp`, `app_manual`.
- **Nuevos valores de negocio:** `personal`, `cortesia`, `referido` (con semántica de precio/permiso, ver Bloque G).
- **Implementado:** catálogo `origenes_reserva` con metadatos (`clave`, `etiqueta_es`, `aplica_precio`, `solo_admin`, `label_whatsapp`). **Opción A elegida:** `reservas.origen` es ahora **FK al catálogo**.
- **Migraciones aplicadas:** `consolidar_origenes_reserva_catalogo` (crea catálogo) + `consolidar_origenes_reserva_fk` (convierte `reservas.origen` a FK, con mapeo de valores existentes).
- **Compatibilidad app:** el dropdown de origen de la app es subconjunto del catálogo, compatible con la FK. No se tocó código de la app.

### B3. Creación de contacto al **crear reserva** (no al iniciar conversación)  ⏸️ APARCADO (prioridad baja)

> **ACLARACIÓN 2026-06-29 (D4ny):** para D4ny "crear contacto" significa el **contacto VISIBLE en WhatsApp** (número + nombre + etiqueta de color por origen), NO una fila en la tabla `contactos`. Eso corresponde a **D2.1 (libreta Google) + L (etiqueta WhatsApp)**, es un **spec estético / prioridad baja** y queda **DIFERIDO**. La tabla `contactos` (registro interno para reportes/dedup/lealtad) **también se aparca**: no es lo que se pidió y no es prioridad ahora.
>
> **Diseño técnico de B3 ya resuelto (guardado para cuando se retome):** trigger `reservas_upsert_contacto` `AFTER INSERT ON reservas` → función `upsert_contacto_desde_reserva()` `SECURITY DEFINER`. Disparo en BD (cubre las 3 vías: Tlali, app, Airbnb). Normaliza `huespedes.telefono` a 10 díg (hay de 10/12/13). `whatsapp_verificado=true` solo si `origen='agente_whatsapp'`. `origen`/`nombre` keep-first en conflicto. `estado_contacto='huesped'`. Backfill = 11 contactos (`contactos` está vacía, 0 tel inválidos). Migración nombrada `b3_upsert_contacto_desde_reserva`. NO aplicado.

- **Corrección de diseño (decisión 5 refinada):** el disparador NO es "cuando alguien escribe" (llenaba la base de números basura), sino **"cuando se crea una reserva"** (aunque esté `cotizada`/pendiente de pago). Solo se crean contactos de gente con reserva real → cero ruido.
- **⚠️ Para Code:** el texto del plan viejo decía "al iniciar conversación". Como B3 quedó **diferido y NO ejecutado**, no hay retrabajo — pero al retomarlo, usar este disparador (crear reserva), NO el viejo.
- **Workflow:** en `crear_reserva_pendiente_pago` (`4wYw9B6qgENSJHCh`) o en el trigger de creación de reserva: **upsert** en `contactos` con `origen` heredado de la reserva, `estado_contacto='huesped'`.
- **Anti-basura:** el upsert por teléfono protege duplicados. Para reservas Airbnb con número proxy/inválido, marcar `whatsapp_verificado=false` hasta confirmar (ver Bloque D, Fase 2).

---

## Bloque C — Beds24 push (app/directa → bloquea Airbnb) **[PRIORIDAD]**  ✅ HECHO Y VALIDADO E2E

> El "HOYO" de la tabla del PDF. Reservas creadas en la app/Tlali no apartaban fechas en Airbnb → riesgo de overbooking. **Cerrado.**

- **Implementado:** push a Beds24 en `confirmada`; release en `cancelada`/`no_show` **y en DELETE** (botón rojo de la app).
- **Migraciones aplicadas:** `agregar_beds24_booking_id`, `beds24_anti_eco_guard`, `trigger_push_reserva_beds24`, `push_reserva_beds24_delete_release`.
- **Workflow n8n:** `Tlalocan - Push Reserva Beds24` (`n2yU2wMZx4lCOOu4`), publicado.
- **Mapeo `chalet_id` → Beds24:** De La Entrada 337213/697368, De La Cima 337352/697556, Del Fondo 337360/697576, De La Cañada mapped.
- **Anti-eco:** guard implementado (`beds24_anti_eco_guard`) — una reserva que entra POR Beds24 no se re-empuja.
- **Validación E2E:** propagación a Airbnb medida **<15 min** (ida y vuelta). ✅
- **Red de seguridad (vigente):** **no eliminar la entrada manual de reservas en la app.** El iCal del website es lento (minutos–1h); para fechas próximas no protege.

---

## Bloque D — Contacto de huésped Airbnb + identificación (DOS FASES)

> Cimiento del futuro programa de lealtad. **Partido en dos fases** porque la validación/actualización del número Airbnb es más compleja de lo que parece (testear número, condicionales, actualizar Supabase). Vamos poco a poco.

### Fase 1 — Tapar el hueco crítico (ya cubierta por A3)
- El problema real de la semana 1 (cliente con WhatsApp malo = sin contacto por ningún frente) lo resuelve **A3 (mensajes programados de Airbnb)**. No requiere este bloque.
- Prioridad: hacer A3 primero garantiza atención en todos los frentes mientras la Fase 2 se construye incremental.

### Fase 2 — Contacto Google/WhatsApp + validación de número (incremental)

**D2.1 — Contacto de WhatsApp/Google al reservar**  ⏸️ DIFERIDO (estético, prioridad baja — confirmado D4ny 2026-06-29)
- **Esto ES lo que D4ny llama "crear contacto".** Es un spec **estético** (que la operación vea nombre + etiqueta en vez de número pelón): útil pero **NO prioritario**. Depende de 2 spikes abiertos: (a) ¿Evolution escribe el nombre o se necesita **Google Contacts API**?, (b) ¿Evolution **asigna** etiqueta existente? (Bloque L). Las etiquetas se crean a mano en WhatsApp Business primero. Honestidad: "ponerlo en WhatsApp" pasa por Google API + puente no oficial a labels (Baileys) → más incierto que confiable. Retomar junto con L cuando suba de prioridad.
- **Además** del registro en `contactos` de Supabase (que sigue siendo fuente de verdad), crear un **contacto en la libreta de Google** (cuenta vinculada al WhatsApp Business, `dnl.mendez.a@gmail.com`) para que la operación, al tomar control vía WhatsApp externo, vea **nombre + etiqueta de color** en vez de número pelón.
- **Verificar vía:** ¿Evolution puede crear el contacto en la libreta, o se crea por Google Contacts API con la cuenta de D4ny? Spike corto.
- Disparador: creación de reserva (igual que B3).

**D2.2 — Validación del número (booleano vía Baileys)  🔧 SIMPLIFICADO 2026-07-01, 2ª ronda (decisión D4ny)**

> **Racional de la simplificación:** Airbnb ya manda mensaje de confirmación automático (A3), WhatsApp ya cubre las reservas directas, y Baileys permite saber si un número existe **sin enviar nada**. La versión anterior (mensaje de confirmación + estados validado/confirmado/invalido + identificación por código) agregaba parches al Concierge, que ya es demasiado grande. **Mejor avanzar rápido con parches sencillos y aplicar el trabajo duro a soluciones de fondo (Bloque M).**

- **Un solo booleano:** `huespedes.whatsapp_valido` (`true`/`false`, `NULL` = sin verificar) + `whatsapp_verificado_en` (timestamptz). El número existe en WhatsApp o no. Nada más.
- **Cómo se verifica:** `POST /chat/whatsappNumbers/{instance}` de Evolution (consulta pura, el huésped no recibe nada, cero riesgo anti-spam).
- **Workflow nuevo n8n "Tlalocan - Valida WhatsApp" (independiente, NO toca el Concierge):** cron diario 16:00 MX → barre `huespedes` con teléfono real (10 díg, no centinela `+airbnb-`) y `whatsapp_valido IS NULL` → check Evolution → update booleano. La columna es el guard de idempotencia (cada número se verifica una vez).
  - **Cobertura retroactiva incluida (decisión D4ny):** el barrido valida también los números de reservaciones previas a la publicación del workflow — al ser consulta sin mensaje, no hay riesgo de contactar a huéspedes pasados.
  - Centinela `+airbnb-` (reserva sin teléfono) → queda `NULL`; la UI lo muestra como "sin teléfono".
- **Badge en la app (frontend):** indicador junto al teléfono en detalle de reserva/huésped: ✓ WhatsApp válido / ✗ sin WhatsApp / — sin verificar. **Los estados son una implementación en la app** (D4ny dixit): el booleano es el dato; la semántica visual vive en el frontend. Único cambio de este plan que toca código de la app.
- **Valor operativo del `false`:** la operación sabe de antemano que a ese huésped se le contacta por Airbnb (los recordatorios de WhatsApp no le van a llegar), sin alertas ni pasos extra.
- **Supuesto asumido (D4ny):** el teléfono viaja desde el primer webhook (empíricamente cierto: folios 1016–1035, 10/10 con tel de 10 díg). **Que la realidad demuestre lo contrario** — si aparecen casos de teléfono tardío, se revisa entonces.
- **⚠️ Limitación conocida y ASUMIDA (no se arregla ahora):** el dedupe de `Beds24 - Webhook Reservas` (por `bookId`, TTL Redis 24h) descarta como "duplicado" cualquier modificación del booking dentro de 24h — incluye teléfono tardío **y también cancelaciones el mismo día de la creación** (la reserva quedaría `confirmada` en Supabase). Documentado; se ataca si la realidad lo presenta.
- **Dato real (histórico):** los números proxy/enmascarados de Airbnb (Felipe, folio 1027) el check los clasifica solos como `false` — sin trato especial.

**D2.3 — Identificación por código de reserva Airbnb  ❌ CANCELADO (decisión D4ny 2026-07-01, 2ª ronda)**
- **Razón:** riesgo real de malfuncionamiento — otro parche por prompt sobre un Concierge ya demasiado grande, para un escenario poco frecuente. Se descarta en esta fase.
- **Si se retoma algún día**, será DESPUÉS del refactor multi-agente (Bloque M), como capacidad de un agente de identificación dedicado — no como parche.
- **Lo que se conserva del análisis** (para entonces): el código `HMXXXX` ya vive poblado en `reservas.codigo_airbnb` (no hace falta migración); el match debería limitarse a reservas vigentes/futuras; y el número desde el que escribe el huésped es, por definición, un WhatsApp bueno que vale la pena capturar.

---

## Bloque E — Pausa global de Tlali con timeout  ⏸️ DIFERIDO (documentado, no prioritario — D4ny 2026-06-29)

> Decisión 7: global, timeout, respuesta vía WhatsApp externo.
> **Diseño REFINADO 2026-06-29 (decisión de D4ny):** el flag solo (no-responder) **no basta** — deja a Evolution leyendo/online, lo que estorba el handover a un humano. Se eligió **Nivel 2 "mute real" sin desconectar** (el humano contesta en el MISMO número desde WhatsApp Web, así que la sesión Evolution debe seguir viva; cortarla = dolor de QR/401 y no permite auto-resume por timeout).

**Arquitectura acordada (para cuando se retome):**
1. **Supabase (`config`):** `tlali_pausado_hasta` (timestamptz; `NULL`/pasado=activo, futuro=pausado) + `tlali_evolution_muteado` (bool, idempotencia del reconciliador). Migración `config_tlali_pausado_hasta`.
2. **Mute real en Evolution** (lo que el flag solo no hacía): al pausar, `POST /settings/set/{instance}` con `readMessages:false` (corta acuses "visto" → huésped no ve doble palomita azul sin respuesta; humano ve no-leídos) y `alwaysOnline:false` (no aparece en línea). Typing no se toca (el workflow no llega a enviar). Al reactivar, restaurar `readMessages:true` / `alwaysOnline` previo. **Verificar campos exactos de `/settings/set` contra la instancia antes de construir.**
3. **Concierge:** check `Pausa Activa?` tras `Es Mensaje Nuevo` (lee `tlali_pausado_hasta`). Pausado → se detiene sin responder; el webhook se sigue registrando (NO se pierde el log, sin cortar Evolution). Cambio chico, por UI (productivo).
4. **Reconciliador (n8n cron ~1 min):** alinea Evolution con el flag → pausado y no-muteado → mute + `muteado=true`; venció timeout y muteado → restaura + `muteado=false`. Es lo que hace el **auto-resume al expirar** (las settings de Evolution no se revierten solas). Idempotente: solo llama a Evolution cuando cambia el estado.
5. **App (dashboard, frontend):** botón "Pausar" + selector (1h/4h/fin del día/manual) → setea `tlali_pausado_hasta` y dispara mute inmediato; botón "Reactivar ahora" → `now()` + restaura. Respuesta humana vía WhatsApp Web/Business externo (la app solo silencia; sin chat embebido).

**Orden de construcción sugerido:** (1) migración config → (2) mute Evolution + reconciliador n8n → (3) check Concierge (UI) → (4) frontend al final.
**Validación:** pausar → mensaje de prueba → confirmar que Tlali no responde, NO marca visto, no aparece online, y el mensaje queda registrado → esperar timeout → confirmar reactivación automática (settings de Evolution restauradas).

---

## Bloque F — Notas de voz en el Concierge  ✅ HECHO y EN PRODUCCIÓN

> **Estado 2026-06-29:** rama de transcripción **mergeada al Concierge productivo `TQKziRbmCiyNC6CQ`, publicada y validada en vivo.** Tlali ya entiende notas de voz. El duplicado de construcción `Qru8aIdAZkFeWSDS` fue **eliminado** tras el merge (ya no existe). Revisión pre-publish confirmó nodos + conexiones + código intactos; credencial OpenAI de `Transcribir Audio` verificada en UI.
>
> **Rama (5 nodos) entre `Restaurar Payload Webhook` y `¿Es Media?`:** `¿Es Audio?` (IF messageType=audioMessage) → [TRUE] `Descargar Audio` (HTTP getBase64FromMediaMessage) → `Audio a Binario` (Code base64→binary) → `Transcribir Audio` (OpenAI audio/transcribe, whisper-1, lang es, onError=continuar + 2 retries, credencial `OpenAi account 2` tS3CFrhyGCHmtwIP) → `Inyectar Transcripcion` (Code: clona payload, conversation=texto, messageType='conversation') → `¿Es Media?`; [FALSE] → `¿Es Media?`. Único cambio a nodo existente: `Preparar Datos de Mensaje`.newMessage → `$('¿Es Media?').item.json.body.data.message.conversation`. Fallback: transcripción vacía → "(nota de voz no entendida)".
>
> **Merge UI (D4ny):** copiar/pegar los 5 nodos del duplicado al productivo `TQKziRbmCiyNC6CQ`; borrar conexión `Restaurar→¿Es Media?`; reconectar `Restaurar→¿Es Audio?`, `¿Es Audio?`[true]→`Descargar Audio`, `¿Es Audio?`[false]→`¿Es Media?`, `Inyectar Transcripcion→¿Es Media?`; cambiar `Preparar`.newMessage; verificar credencial OpenAI en `Transcribir Audio` + Redis/Postgres; Publish.

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

## Bloque G — Orígenes de reserva (cortesía / referido) + calendario de ocupación  🔧 DECISIONES CERRADAS 2026-07-02

> Depende de B2 (catálogo ya en prod con `aplica_precio` y `solo_admin`). **Decisiones de D4ny 2026-07-02:** (1) vendedor = texto libre; (2) `referido` capturable por rol `ventas` (es dato contable para comisión); (3) **cortesía puede ir en $0 → `personal` se ELIMINA por redundante** (uso del dueño = cortesía $0); (4) la captura manual **NO permite airbnb/booking** (Beds24 los carga solo; se filtra por `es_canal_externo` del catálogo).

| Origen | Precio | Permiso | Efecto en n8n |
|---|---|---|---|
| ~~`personal`~~ | — | — | **desactivado del catálogo**: lo cubre cortesía $0 |
| `cortesia` | **arbitrario ≥ 0** (capturable, $0 válido) | solo `admin` | ninguno: con $0 el Recordatorio Saldo la excluye solo (`monto_pagado < monto_total` = falso); con monto se comporta normal |
| `referido` | **precio canal directo** | admin y `ventas` | ninguno: cotiza directo normal; comisión = dato contable |

**Hallazgos que achican el bloque (verificados 2026-07-02):**
- `Recordatorio Saldo` NO se toca (exclusión natural por monto $0). Push Beds24 NO se toca (dispara por estado, no origen → cortesía confirmada bloquea Airbnb, deseado). **Concierge NO se toca** (estos orígenes solo se capturan por humanos en la app).
- El dropdown actual está hardcodeado en `NuevaReservaForm.jsx` y no lee el catálogo — ese es el cambio central de UI.

**Piezas:**
- **G1 — Dropdown desde catálogo:** hook `useOrigenes` → `origenes_reserva` con `activo=true AND NOT es_canal_externo`; `solo_admin` visibles solo para admin. Nueva reserva + Editar reserva.
- **G2 — Precio según `aplica_precio`:** `arbitrario` (cortesía) → campo de monto manual ($0 válido), sin cálculo automático; `directo` → flujo actual con `calcular_estadia`; referido muestra además campo `vendedor`.
- **G3 — Comisión placeholder:** columna `reservas.vendedor` (text) + `config.comision_vendedor_pct = 0`. El reporte (Bloque I) calculará comisiones cuando el % se defina; el dato del vendedor se captura desde ya.
- **G4 — Candados en BD:** política de INSERT consulta el catálogo — origen debe estar activo y no ser canal externo; orígenes `solo_admin` solo con rol admin. UPDATE ya exige admin (sin cambios).
- **G5 — Calendario de ocupación en el form (pedido D4ny 2026-07-02):** componente propio `RangeCalendar` (date-fns, sin dependencias nuevas) que sustituye los inputs de fecha en Nueva reserva: muestra por chalet los días ocupados (noches de reservas activas: cotizada/pendiente_pago/confirmada/en_curso — el mismo criterio del check de solape actual) y no permite seleccionar rangos que crucen una noche ocupada. Regla de noches: la fecha de salida de una reserva SÍ puede ser la entrada de otra. Fuente: tabla `reservas` (Airbnb ya entra por Beds24, así que refleja todos los canales).

### G — REDISEÑO 3ª ronda (D4ny 2026-07-02, tras revisar el preview del PR #11)

- **Captura manual = SOLO 4 orígenes** vía columna nueva `origenes_reserva.captura_manual`: `website` (solo admin, cubre la falta de integración web), `referido` (ventas, precio directo NO editable, vendedor requerido), **`extension` (NUEVO)** (ventas, vendedor requerido, comisión), `cortesia` (solo admin, precio libre). `directa`/`app_manual`/`agente_whatsapp` siguen activos en el sistema (histórico + Tlali) pero fuera de la captura manual. RLS por `captura_manual` + `solo_admin`.
- **Extensión:** field que la LIGA a una reserva en curso (`reservas.continuacion_de_reserva_id`, adelanta H2); al elegirla se fija el chalet y la entrada = salida de la original. Precio = tarifa directa con **descuento `config.descuento_extension_pct` (inicial 15%)**. **Pago ÚNICO y COBRADO al crear** (estado forzado `confirmada`, un solo pago por el total).
- **Pagos (tabla nueva `pagos`):** `reserva_id`, `forma_pago` ∈ `mercadopago`/`efectivo`/`transferencia`, `monto`, `registrado_por`, `created_at`. **Pagos mixtos** = N filas. Trigger aditivo mantiene `reservas.monto_pagado` en sincronía (no pisa el flujo Airbnb, que escribe monto_pagado directo sin filas). UI: botón "+ Agregar pago" en Nueva reserva (anticipo si `pendiente_pago`) y en Editar reserva (abonos posteriores). ValidarPago (comprobantes Tlali) pasa a registrar fila `transferencia` en el ledger.
- **Descuento efectivo (`config.descuento_efectivo_pct`, inicial 10%, incentivo):** aplica ADICIONAL al total cuando la reserva se paga COMPLETA en efectivo al momento de crearla (un solo pago efectivo = total). Con pagos mixtos o anticipos parciales NO aplica (regla determinista v1). Stackea con el 15% de extensión (multiplicativo).
- **Valentina** coordina extensiones a criterio (staff comms deshabilitada); ella cobra y comisiona. Idea Tlali-ofrece-extensión → ver Bloque H (post-refactor M).

---

## Bloque H — Extensión de estadía (huésped en curso) **[PARCIALMENTE ADELANTADO EN G]**

> Decisión 4: reserva nueva ligada, precio directo. Tool nueva + ajuste a 2 crons.
> **ACTUALIZACIÓN 2026-07-02:** el rediseño del Bloque G adelanta la parte de captura: origen `extension` (rol ventas, vendedor requerido, liga `continuacion_de_reserva_id` a la reserva en curso, precio directo con descuento configurable 15%, pago único cobrado al crear). **La coordinación operativa queda a criterio de Valentina** (comunicación con staff deshabilitada; ella cobra y comisiona extensiones) — los crons de operaciones NO se ajustan aún (H2 sigue pendiente si algún día se automatiza).
> **Idea futura registrada (D4ny 2026-07-02, POST-refactor Bloque M):** ajustar el workflow Recordatorio de Salida para que, si NO hay entrada al día siguiente en ese chalet, Tlali ofrezca la extensión al huésped y confirme la respuesta a Valentina. NO construir antes del refactor del Concierge; de momento la extensión es 100% a discreción/manual.

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

## Bloque I — Reporte de ingresos por rango de fechas  ⏸️ DIFERIDO (decisión D4ny 2026-07-02)

> Decisión 8: completo (facturado + payout neto + por canal).
> **DIFERIDO hasta conocer las necesidades reales de conciliación de Giovanna (contabilidad Tlalocan)** — mejor un diseño quirúrgico a sus necesidades que un reporte especulativo. Los datos crudos YA se capturan desde el Bloque G: ledger `pagos` (forma de pago), `reservas.vendedor` (comisiones) y payout Airbnb (`airbnb_payout`). Cuando la necesidad se presente, el reporte se construye encima sin migrar nada.
> **Siguiente fase elegida en su lugar: Bloque M (refactor Concierge multi-agente)** — en workflow COMPLETAMENTE NUEVO, dejando el Concierge actual en productivo y sin cambios hasta el cutover.

- **Presets:** hoy / últimos 7 días / último mes / rango manual.
- **Dos métricas por canal:**
  - **Facturado** = `SUM(monto_total)` (lo cobrado al huésped).
  - **Payout neto** = lo recibido. Para Airbnb usar el payout real ya extraído (`SUM(invoiceItems[].amount)`), **no** `precio − comisión` (ignora promociones y retenciones fiscales).
- **Desglose por canal:** Airbnb / directa-Tlali / website / referido, con ambas columnas.
- **Backend:** query/función Supabase parametrizada por `fecha_desde`/`fecha_hasta` que agregue por `origen`. Considerar función `reporte_ingresos(desde, hasta)`.
- **Frontend:** pestaña en el tab Resumen con selector de rango + tabla facturado vs. neto por canal + total.
- **Comparte lógica con J (simuladora):** la conversión facturado↔neto por canal se escribe **una vez** y la consumen ambos. No duplicar.

---

## Bloque J — Simuladora de precios (pestaña independiente) **[PRIORIDAD BAJA]**

> Decisión 2: precio cerrado como principal. **D4ny confirmó: módulo independiente, prioridad baja.** Al final.

- **Input:** una fecha (toma la tarifa que corresponde por día de semana) **o** un precio arbitrario.
- **Output principal:** **precio cerrado todo-incluido** (IVA 16% + ISH 5% incorporados, redondeado a la centena) — el número que el huésped ve hoy. Calcular con la misma `calcular_estadia` / `total_redondeado`, no reimplementar.
- **Output secundario (detalle opcional, colapsable):** desglose tarifa + impuestos por canal y **payout estimado**.
- **CRÍTICO — etiquetar como estimador:** el payout que recalcule con porcentajes fijos (las tablas del PDF: comisión 15.5%, IVA 8%, ISR 4%, ISH 5%) **divergirá** del payout real de Airbnb (que varía con/sin RFC y promociones). Etiquetar explícitamente "payout **estimado**", no fuente de verdad. La conciliación real sigue saliendo de `invoiceItems`.
- **Inconsistencia "tarifa+impuestos" vs precio cerrado — aclarada con D4ny:** es el mismo dinero mirado de dos formas, PERO **el redondeo a la centena rompe la equivalencia exacta** (diferencia de hasta $99, documentada en SISTEMA-TLALOCAN §7). El comportamiento de Tlali (tarifa → +impuestos → redondea, variable ±$99) es **correcto**. Por eso la simuladora debe **derivar el desglose DESDE el precio cerrado** (el número real que se cobra), nunca al revés. Si calculara tarifa+impuesto por separado, podría mostrar $6,050 cuando se cobra $6,000. El cerrado es la verdad; el desglose, vista informativa aproximada.
- **Comisión de vendedor en referidos:** placeholder configurable (ver Bloque G). No bloquea; el canal referido en la simuladora usa el placeholder hasta tener el número.
- **Reusa la lógica facturado↔neto del Bloque I.**

---

## Bloque K — Calendario público Google (ver A2)

Movido a quick wins (A2). Listado aquí solo por completitud de índice.

---

## Bloque L — Etiquetas de WhatsApp por origen **[spike reducido]**

> Decisión 6 refinada por D4ny: las etiquetas se **crean a mano en la app de WhatsApp Business**; Evolution solo las **asigna**. El spike ya no es "¿se puede crear?", sino "¿Evolution puede asignar una etiqueta existente a un contacto?".

- **Memoria de D4ny confirmada:** las labels se crean primero en WhatsApp Business y desde ahí Evolution (Baileys) las puede leer/asignar — no crearlas desde cero de forma confiable.
- **Setup manual (D4ny):** crear en WhatsApp Business las etiquetas de color: `plataforma`, `referido`, `cortesia`, `personal`.
- **Spike reducido (gate, ~30 min):** verificar que la instancia Evolution pueda **asignar** una etiqueta existente a un contacto, y que se refleje en la app de WhatsApp Business que ve la operación.
- **Si SÍ:** al crear contacto (B3 / D2.1), asignar label según `origen`. Taxonomía = la misma de B2. Una sola fuente alimenta reserva + contexto Tlali + label de color.
- **Si NO:** mantener `origen` solo en Supabase. Migración a API oficial de Meta = decisión futura grande (fuera de alcance).
- **Encaja con D2.1:** la etiqueta de color es justo lo que hace útil el contacto de Google/WhatsApp (la operación ve origen de un vistazo al tomar control).

---

## Bloque M — Refactorización del Concierge a multi-agente **[SIGUIENTE FASE — declarado 2026-07-01]**

> **ACTUALIZACIÓN 2026-07-04: el plan de diseño ya existe → `PLAN-BLOQUE-M-concierge-multiagente.md`** (router híbrido + 3 agentes, cutover a paridad, identificación por código Airbnb como fase M4). Gates pendientes de D4ny en su §8.
>
> **Decisión de D4ny:** el Concierge (`TQKziRbmCiyNC6CQ`) ya es demasiado grande — un solo agente cubre por criterio del prompt un montón de escenarios (ventas, estancia, identificación, pagos, audio…), y cada corrección de este plan le añade otro parche (D2.3, flip `confirmado`, pausa E en su día). **D4ny asume explícitamente el riesgo de los parches de esta fase**, con el compromiso de que la refactorización a **múltiples agentes especializados por escenario** (ventas / huésped en estancia / identificación / soporte, con un router al frente) es **la siguiente fase** después de cerrar este plan. No se diseña aquí; queda declarado para que cada parche se haga sabiendo que ese refactor viene (parches chicos, autocontenidos, fáciles de extraer).

---

## Resumen de migraciones nombradas (mostrar antes de aplicar)

| Migración | Bloque | Tipo | Cuidado |
|---|---|---|---|
| `crear_tabla_contactos` | B1 | CREATE | ✅ aplicada |
| `consolidar_origenes_reserva_catalogo` | B2 | CREATE catálogo | ✅ aplicada |
| `consolidar_origenes_reserva_fk` | B2 | ALTER `reservas.origen`→FK | ✅ aplicada (Opción A, mapeo hecho) |
| `agregar_beds24_booking_id` | C | ALTER (add col) | ✅ aplicada |
| `beds24_anti_eco_guard` | C | función/guard | ✅ aplicada |
| `trigger_push_reserva_beds24` | C | trigger | ✅ aplicada |
| `push_reserva_beds24_delete_release` | C | trigger DELETE | ✅ aplicada |
| `huespedes_whatsapp_valido` | D2.2 | ALTER (add `whatsapp_valido` bool + `whatsapp_verificado_en`) | ⬜ pendiente (arranca ya) |
| ~~`huespedes_telefono_airbnb`~~ | D2.3 | — | ❌ cancelada junto con D2.3 |
| `agregar_continuacion_reserva` | H2 | ALTER (add col) | ⬜ pendiente (H no prioritario) |
| ~~`agregar_codigo_confirmacion_airbnb`~~ | D2.3 | — | ❌ no necesaria: `reservas.codigo_airbnb` ya existe |
| `reservas_vendedor_referido` | G3 | ALTER (add col `vendedor` text) | ⬜ pendiente |
| `config_comision_vendedor_pct` | G3 | INSERT config (placeholder `0`) | ⬜ pendiente |
| `origenes_reserva_reglas` | G4 | UPDATE catálogo (desactiva `personal`) + política INSERT | ⬜ pendiente |
| `config: tlali_pausado_hasta` | E | INSERT config | ⬜ pendiente |

---

## Gates y bloqueantes abiertos

**Resueltos:**
- ~~Spike Beds24 mensajería Airbnb~~ → API directa Airbnb no accesible; se va con **plan B (mensajes programados)**. Beds24 archivado como opcional futuro.
- ~~Comisión de vendedor "??"~~ → **placeholder configurable**, no bloquea.
- ~~Inconsistencia de precios~~ → es redondeo, comportamiento correcto; simuladora deriva desde precio cerrado.
- ~~Código Airbnb: campo/formato~~ → **resuelto por Code:** vive en `reservas.codigo_airbnb`, legible `HMXXXX`, poblado. Migración extra cancelada.

**Aún abiertos:**
1. **Spike Evolution labels (reducido)** (L) — verificar que Evolution pueda *asignar* etiqueta existente (no crear). ~30 min.
2. **Spike Google Contacts** (D2.1) — ¿Evolution crea el contacto en la libreta, o se usa Google Contacts API?
3. ~~Envío multi-mensaje de Tlali (A1)~~ → **resuelto:** nodo Code splitea por `[[corte]]` → N globos. Ver §A1.
4. ~~¿Cuándo está disponible el teléfono del huésped Airbnb?~~ → **cerrado por decisión:** se asume que viaja desde el primer webhook (empíricamente 10/10 folios recientes); que la realidad demuestre lo contrario.
5. ~~Dedupe de modificaciones del webhook Beds24~~ → **limitación conocida ASUMIDA**, documentada en §D2.2 (afecta tel tardío y cancelaciones <24h). No se arregla ahora.
6. ~~Flip `confirmado` / texto del mensaje~~ → **no aplican:** el mensaje de confirmación y los estados se eliminaron en la simplificación (booleano solo).

---

## Notas de seguridad operativa (recordatorios del proyecto)

- Tras **cualquier** edición MCP de workflow: reasignar credencial Evolution (Header Auth) en UI y verificar nodo por nodo.
- n8n corre la versión **publicada**: `publish` tras editar.
- Mostrar SQL/DDL como migración nombrada antes de ejecutar; DELETE/DROP/ALTER requieren confirmación explícita; INSERT/CREATE pueden proceder.
- No eliminar la entrada manual de reservas como respaldo mientras el iCal del website siga siendo lento.
