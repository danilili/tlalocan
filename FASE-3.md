# Fase 3 — Agente 1: Atención y Ventas al huésped (M·02)

> Entrada operativa del agente de WhatsApp de cara al huésped.
> El plan general está en `PLAN.md`; la app (Fase 2 / M·01) ya está cerrada y
> desplegada (`FASE-2.md`).
> **El trabajo NO vive en este repo** — vive en n8n (`reservalia.app.n8n.cloud`),
> Evolution API y Redis. Este repo solo cambia en un punto: el webhook de
> validación de pago (§5.2). Esquema vivo en proyecto `Tlalocan`
> (ref `spnqatgiopfjczqwlzms`).

> **CONTEXTO IMPORTANTE (2026-06-04):** al conectar el MCP de n8n descubrimos que
> el agente **ya está construido y muy avanzado** — el PLAN lo describía como "1
> workflow con 2 tools hardcoded", pero la realidad son **6 workflows** trabajados
> hasta 2026-05-23. Esta fase es por tanto **auditar + completar huecos +
> reconciliar**, NO construir de cero. (Misma lección que con git: verificar el
> estado real antes de asumir.)

---

## 0. Qué hace este agente

Atiende por WhatsApp en **un solo número** (de cara al huésped) y lleva al
prospecto de "me interesa" hasta "aparté con anticipo", **sin confirmar la
reserva** (eso lo valida un humano en la app). Modelo de venta: **anticipo 50%**,
saldo 48h antes del check-in.

```
(cotiza) → acepta → crea reserva COTIZADA + datos bancarios del anticipo
        → manda comprobante → [hueco, ver §4] → PENDIENTE_PAGO
        → [humano valida en la app] → CONFIRMADA   ← el agente NO hace esto
        → el agente avisa al huésped el resultado  ← [hueco, ver §5.2]
```

---

## 1. Arquitectura — 2 números, no 3 (decisión 2026-06-04)

| Número / instancia | Público | Flujo | Fase |
|---|---|---|---|
| **Huésped** | prospecto + huésped | agente ventas + estancia | 3 (ventas), 4 (estancia) |
| **Interno** (router por rol) | staff limpieza · finanzas | tareas · validación de pagos | 3 (finanzas §4.1), 5 (limpieza) |

**Dos números** (Don Dani no tiene líneas extra). El interno enruta por el
**teléfono del remitente** (lookup en `usuarios`/`staff`): limpieza → tareas;
finanzas → validación de pagos. No se mezcla con el de huésped (clientes vs
internos no deben colisionar).

Un solo número de cara al huésped: es el mismo humano antes y después de
reservar. La parte de **estancia** (recordatorios, ubicación, wifi) se le **suma
al mismo agente** en Fase 4, sin número nuevo. El **enriquecimiento de estatus**
(distinguir prospecto vs huésped registrado consultando `huespedes.telefono` →
`reservas`) es lo que habilita esa unificación; hoy NO existe (ver §4) y es más
relevante para Fase 4 que para ventas puras.

---

## 2. Inventario real en n8n (verificado 2026-06-04)

Proyecto en `reservalia.app.n8n.cloud`. Workflow principal + 5 subworkflows-tool.

| Workflow | ID | Qué hace | Estado |
|---|---|---|---|
| **Tlalocan Concierge** (main) | `TQKziRbmCiyNC6CQ` | Webhook → Redis buffer (debounce 15s) → memoria Redis → agente "Tlali" (GPT-4o-mini) → envía respuesta vía Evolution | ✅ activo |
| Tlalocan - Cotizar Estadia | `7DX5VPXMJRRaqw96` | `calcular_estadia()` + anticipo (`config.anticipo_porcentaje`, default 50) | ✅ |
| Tlalocan - Enviar Fotos Chalets | `cyEKlvqXjHtH1Spv` | lee `chalets.fotos_url`, manda fotos vía Evolution | ✅ |
| Tlalocan - Verificar Disponibilidad | `yddmRonPhs2MVNXn` | chalets libres por rango; `escalar_humano:true` si los 4 ocupados | ✅ |
| Tlalocan - Crear Reserva Cotizada | `4wYw9B6qgENSJHCh` | CTE atómica: re-verifica, upsert huésped, inserta `cotizada`, devuelve datos bancarios | ✅ |
| Tlalocan - Procesar Comprobante Pago | `fnhLuzLGy93poEuP` | descarga media, sube a Storage `comprobantes-pago/{id}/`, pasa a `pendiente_pago` | ⚠️ existe pero NO cableada (ver §4) |

### El agente "Tlali" (en el main)
- Nombre Tlali, asesora mexicana, cierre de venta, mensajes cortos estilo WhatsApp.
- Convención de fechas robusta (último día = salida, no se cobra como noche).
- Metodología de 7 pasos: apertura → descubrimiento → disponibilidad → cotización
  → enamoramiento (fotos) → cierre → espera comprobante.
- **4 tools cableadas** al agente: `cotizar_estadia`, `enviar_fotos_chalets`,
  `verificar_disponibilidad`, `crear_reserva_pendiente_pago` (esta crea en
  `cotizada` pese al nombre).
- Memoria Redis chat keyed por `remoteJid`, ventana 10.

### Cómo escribe a Supabase
Los subworkflows usan **nodo Postgres** (`executeQuery`) con credencial de
conexión directa a la DB — **no** HTTP/REST con service-role. Salta RLS a nivel
de conexión. (Corrige la suposición previa de este doc.)

### Cómo habla con WhatsApp
Evolution manda `server_url`, `apikey`, `instance` y `data.key.remoteJid` **en el
payload del webhook**; los nodos los reusan. No hay credencial Evolution separada
que documentar — viene en cada request.

---

## 3. Hallazgos / inconsistencias

### 3.1 Drift de precios — RESUELTO 2026-06-04
El prompt de Tlali decía tarifas viejas ($1,500/$2,000) mientras la DB ya tiene
$2,100/$2,500 (cambio de hoy). La tool `cotizar_estadia` devuelve los precios
nuevos (correcto), pero el prompt afirmaba los viejos. **Corregido a mano:** la
sección `# TARIFAS` ya no hardcodea precios como autoridad — la tool manda, con un
rango aproximado ($2,100–$2,500) solo para conversar.

### 3.2 Cotización chalet-agnóstica vs tarifa por chalet — TENSIÓN LATENTE
`cotizar_estadia` recibe solo `checkin/checkout` (sin chalet) y por dentro usa
**siempre el primer chalet activo** (`order by orden_display limit 1` = De La
Cima). Funciona **mientras los 4 cuesten igual** (hoy sí). Pero hoy habilitamos
tarifa por chalet: el día que los precios difieran, el agente cotizaría siempre el
de De La Cima, sin importar el chalet elegido. **Decisión pendiente:** o la tool
recibe `chalet_slug` y cotiza el real, o se asume precio uniforme y se documenta.
(`crear_reserva_pendiente_pago` sí recibe `chalet_slug` y recalcula con el chalet
correcto — así que el monto de la reserva creada es correcto; solo la cotización
mostrada usaría De La Cima.)

**Verificado 2026-06-10:** los precios viven en la tabla `tarifas` (una estándar
`chalet_id=null` + 4 por-chalet, creadas 06-04). **Los 4 chalets tienen HOY el mismo
precio** (lun-jue $2,100 / vie-sáb $2,500 / dom $2,100) → el bug es **latente, sin
impacto actual**. **RESUELTO 2026-06-10:** `cotizar_estadia` ya recibe `chalet_slug` (opcional). El query
de `Calcular Estadia` resuelve `coalesce(chalet por slug, primer chalet activo)` →
cotiza el chalet real cuando se pasa el slug, y cae al default (De La Cima) cuando se
omite. Verificado a nivel query (slug→su tarifa). En el Concierge el tool `cotizar_estadia`
expone `chalet_slug` (AI decide) y el prompt instruye pasarlo cuando el huésped ya eligió.
Ya es seguro tener tarifas por-chalet distintas.

---

## 4. Trabajo restante real de Fase 3

### 4.1 Ingesta + validación + escalamiento de comprobante (diseño 2026-06-04)

**Estado actual:** el subworkflow `Procesar Comprobante Pago`
(`fnhLuzLGy93poEuP`) recibe `reserva_id, media_url, mimetype`, descarga, sube a
Storage `comprobantes-pago/{id}/comprobante.{ext}` (Postgres + HTTP custom auth) y
actualiza la reserva a `pendiente_pago` **solo si está en `cotizada`/
`pendiente_pago`**. Sólido, pero: **no valida la imagen, no está cableado, y el
webhook del huésped solo lee texto** (`body.data.message.conversation`). Hoy el
huésped manda la ficha y **no pasa nada** → la reserva se queda en `cotizada`.

**Diseño acordado:**

```
Huésped manda imagen/PDF
 → webhook detecta media → resuelve reserva activa del huésped
   (última cotizada/pendiente_pago por teléfono)
 → [VISIÓN] ¿es ficha bancaria? extrae monto / fecha / referencia (GPT-4o-mini)
     · No  → "eso no parece un comprobante, ¿me lo reenvías?" (no escala)
     · Sí  → Procesar Comprobante Pago (sube a Storage, pasa a pendiente_pago)
            → ESCALA al NÚMERO DE PAGOS (finanzas) con: huésped, chalet, fechas,
              anticipo esperado, monto detectado, la imagen y un FOLIO corto
 → Finanzas responde por WhatsApp: "APROBAR <folio>" / "RECHAZAR <folio> <motivo>"
   → actualiza reserva (confirmada/cancelada) → notifica al huésped (§4.2)
```

**Reglas / pendientes de implementación:**
- **Visión = filtro + asistente, NUNCA auto-aprueba.** Descarta basura y pre-llena
  el monto; la validación sigue siendo humana (regla de oro).
- **Validación dual (WhatsApp + app):** ambos canales actualizan la misma reserva;
  el primero gana. **Idempotencia:** actuar solo si sigue en `pendiente_pago`; si
  no, responder "ya fue validada".
- **Identidad:** validar por WhatsApp llena `validado_por` → mapear el teléfono del
  admin a un registro en `usuarios` (alta del personal de finanzas como usuarios).
- **Folio:** referencia corta por reserva para que el admin diga cuál aprueba
  (con varios pagos pendientes a la vez). Definir esquema (¿columna folio? ¿slice
  del UUID? ¿reply citado de Evolution?).
- **Número:** finanzas vive en el **número interno compartido** (no hay líneas
  extra para uno dedicado). El router lo distingue del staff de limpieza por el
  teléfono del remitente.

**Avance 2026-06-04:**
- Columna `reservas.folio` creada (migración `0024`, secuencia desde 1001) para
  que finanzas referencie el pago a validar.
- Subworkflow de visión **construido**: `Tlalocan - Validar Comprobante (Vision)`
  (ID `K9qTzLN1nnu9FJmB`). Entrada `media_url, mimetype, monto_esperado` → GPT-4o-mini
  visión → `{ es_comprobante, monto, fecha, referencia, banco, confianza, motivo }`.
  **Pendiente:** enlazar a mano la credencial `OpenAi account` en el nodo
  "OpenAI Vision" (el auto-assign del SDK la omitió), luego probar y cablear.

### 4.2 Callback de validación app → huésped (CONSTRUIDO 2026-06-05)
Cuando un humano valida/rechaza en la app, el huésped debe enterarse por WhatsApp.
- **n8n:** sub-flujo `Tlalocan - Notificar Validacion Huesped` (ID `7SFqV2P5LdAEihAA`)
  **construido**. Webhook `POST /webhook/validacion-pago-huesped` recibe
  `{ reserva_id, validada: bool, motivo? }` → Lookup Postgres (huésped, chalet,
  fechas, montos + `evolution_server_url`/`evolution_instance_ventas` de `config`)
  → Code arma mensaje (confirmación o rechazo+motivo) → envía por Evolution
  (instancia **ventas** = huésped). Patrón copiado de `Notificar Operaciones`
  (`xuXo3Bh9t4pimqtd`). El apikey de Evolution sale de la credencial n8n
  `Header Auth account` (única `httpHeaderAuth`), NO de la DB.
  - **Pendiente manual (Don Dani, el SDK no auto-asigna credenciales):**
    1. Enlazar credencial **Postgres** (`Tlalocan Postgres`) en nodo "Lookup Datos".
    2. Enlazar credencial **Header Auth** (`Header Auth account`) en "Enviar WhatsApp".
    3. **Activar** el workflow (queda inactivo al crearse).
- **App (este repo):** `ValidarPagoForm` **ya** dispara `notificarHuesped(...)` →
  `POST` a `VITE_N8N_WEBHOOK_VALIDACION_PAGO` con `{reserva_id, validada, motivo?}`
  tras un cambio efectivo (best-effort, no rompe la validación). La URL ya está en
  `.env.local`; **falta configurarla en Vercel**.

### 4.3 Enriquecimiento de estatus (prospecto vs huésped)
No existe. Para ventas puras no es urgente (todos se tratan como prospecto). Se
vuelve necesario al unificar estancia en Fase 4. **Decisión:** ¿adelantarlo en
Fase 3 (nodo de lookup tras el webhook que inyecta estatus al prompt) o dejarlo
para Fase 4?

---

## 5. Cambios concretos a ejecutar

### 5.1 En n8n
1. Verificar si hay flujo de media existente; si no, añadir manejo de imagen/PDF
   en el webhook del main y cablear `Procesar Comprobante Pago`.
2. Crear el sub-flujo del callback de validación (§4.2).
3. (Si se decide) nodo de enriquecimiento de estatus (§4.3).
4. (Si se decide) pasar `chalet_slug` a `cotizar_estadia` (§3.2).

> **Edición de workflows existentes en producción:** el `update_workflow` del MCP
> exige reenviar TODO el workflow como código SDK (regenera de cero). Para cambios
> quirúrgicos en flujos en vivo, **editar a mano en la UI** es más seguro. Usar el
> SDK para workflows NUEVOS (ej. el callback) o cuando el cambio sea grande.

### 5.2 En este repo
- `ValidarPagoForm`: disparar `VITE_N8N_WEBHOOK_VALIDACION_PAGO` al validar/
  rechazar. Llenar la env var local y en Vercel.

---

## 6. Datos del esquema (verificados 2026-06-04)

- `reservas.estado` ∈ `cotizada, pendiente_pago, confirmada, en_curso,
  completada, cancelada, no_show`. Agente crea en `cotizada`.
- `reservas.origen` → `agente_whatsapp`. `huespedes.origen_inicial` →
  `whatsapp_directo` (huésped nuevo del agente).
- `config` relevante: `anticipo_porcentaje` (usado por Cotizar), `checkin_hora`
  15:00, `checkout_hora` 12:00, `wifi_password_global`, `codigo_chapa_global`,
  `telefono_super_admin`, `zona_horaria` America/Mexico_City.
- RPC `calcular_estadia(chalet_id, entrada, salida)`. Bucket privado
  `comprobantes-pago`.

---

## 7. Definition of Done — Fase 3

- [x] Agente cotiza por WhatsApp con desglose + anticipo (datos reales).
- [x] Crea reserva `cotizada` con montos snapshot y datos bancarios.
- [x] `verificar_disponibilidad` con escalamiento si los 4 ocupados.
- [x] Prompt reconciliado con precios nuevos (§3.1).
- [x] Ingesta de comprobante: subworkflow `Tlalocan - Ingesta Comprobante`
      (`djnNoB36EvzGTpJY`) **probado de punta a punta 2026-06-09** (resuelve reserva
      → baja media → visión → Storage → `pendiente_pago` → acuse al huésped). Único
      pendiente: escalamiento saliente a finanzas (credencial `Evolution Interno`). Ver §12.
- [~] Validación dual: app YA es idempotente (`ValidarPagoForm` actualiza solo si
      sigue en `pendiente_pago`, primero gana). Falta el lado WhatsApp de finanzas.
- [x] Callback de validación: **validado end-to-end 2026-06-10** desde la app
      desplegada → webhook (`VITE_N8N_WEBHOOK_VALIDACION_PAGO` ya en Vercel) → sub-flujo
      `7SFqV2P5LdAEihAA` (credenciales enlazadas, activo) → huésped notificado por
      WhatsApp (instancia ventas, que sí entrega).
- [x] Personal de finanzas dado de alta en `usuarios` (Giovanna admin + Daniel
      super_admin, 2026-06-05) — para `validado_por`.
- [x] Cotización chalet-agnóstica (§3.2): **RESUELTO 2026-06-10**. `cotizar_estadia`
      ahora recibe `chalet_slug` (opcional) y cotiza el chalet real (verificado: slug →
      su tarifa; vacío → default De La Cima). Tool en Concierge con `chalet_slug` (AI
      decide) + prompt actualizado + publicado.
- [x] Enriquecimiento de estatus (§4.3): **diferido a Fase 4** (no urgente para ventas;
      necesario al unificar estancia).

---

## 8. Fuera de alcance de Fase 3

- Tools/comportamiento de **estancia** → Fase 4 (M·03), mismo agente y número.
- Agente de **limpieza/staff** → Fase 5 (M·04), número aparte.
- Modificar/cancelar/reagendar y disputas de pago por WhatsApp → escalar a humano.

---

## 9. Si te trabas

- Inspeccionar workflows con el MCP de n8n (`get_workflow_details`) antes de tocar.
- Probar SQL/RPC en el SQL Editor de Supabase antes de cablear en n8n.
- Editar flujos de producción a mano en la UI; SDK para flujos nuevos.
- Cualquier cosa fuera de lo documentado, parar y preguntarle a Don Dani.

---

## 10. Estado al cierre de sesión — 2026-06-04

**Decidido esta sesión:**
- Arquitectura **2 números** (sin líneas extra): huésped (ventas+estancia) e
  interno compartido (staff limpieza + finanzas, router por teléfono).
- Comprobante: visión filtra+asiste (no auto-aprueba) → escala a finanzas →
  validación dual WhatsApp+app (idempotente). Folio para referenciar el pago.

**Hecho (commiteado en `fase-3-agente-ventas`, SIN push):**
- Bug en vivo resuelto: prompt de Tlali ya no hardcodea precios (drift 1500/2000
  vs DB 2100/2500). *Editado a mano en n8n por Don Dani.*
- Migración `0024_reservas_folio.sql` (columna `folio`, aplicada en vivo).
- Subworkflow `Tlalocan - Validar Comprobante (Vision)` (`K9qTzLN1nnu9FJmB`).
- Docs reescritos al estado real (este archivo + PLAN §2.3/§2.4/§5).

**Pendiente manual de Don Dani (destraba el resto):**
1. Enlazar la credencial `OpenAi account` en el nodo "OpenAI Vision" del
   subworkflow `K9qTzLN1nnu9FJmB` (1 clic; el SDK no la auto-asignó).
2. Conseguir la **instancia interna de Evolution** (URL, API key, instancia) — basta
   1 línea nueva (eSIM/virtual/Cloud API).
3. Datos del **personal de finanzas** (nombre + teléfono) para alta en `usuarios`.
4. (Opcional) Una **URL pública de un comprobante** de muestra para probar la visión.

**Siguiente trabajo (cuando haya lo de arriba):**
- Probar el subworkflow de visión con una imagen real.
- Manejo de media en el webhook del huésped + resolver reserva activa + cablear
  `Procesar Comprobante Pago` + visión + escalamiento al número interno (finanzas).
- Flujo en el número interno: parsear `APROBAR/RECHAZAR <folio>` → actualizar
  reserva (idempotente) → notificar huésped.
- App: `ValidarPagoForm` dispara `VITE_N8N_WEBHOOK_VALIDACION_PAGO` al validar.
- Decidir cotización chalet-agnóstica (§3.2) y enriquecimiento de estatus (§4.3).

**Git:** rama `fase-3-agente-ventas`, último commit de docs/folio/visión. `main` y
`fase-2-app` quedaron con Fase 2 mergeada (PR #3). La rama de Fase 3 NO se ha
pusheado aún.

---

## 11. Estado al cierre de sesión — 2026-06-05

**Verificado al abrir (los docs coincidían con la realidad, sin drift):**
- Concierge (`TQKziRbmCiyNC6CQ`) sin cambios; webhook sigue leyendo solo texto.
- Subworkflow visión (`K9qTzLN1nnu9FJmB`): Don Dani ya **enlazó la credencial
  OpenAI** y lo activó (pendiente manual #1 del 06-04, resuelto).

**Hecho esta sesión (SIN commit aún):**
- **App `ValidarPagoForm`** ahora es idempotente (update solo si sigue en
  `pendiente_pago`; si otro canal ganó, avisa "ya fue validada") y dispara el
  callback `notificarHuesped(...)` best-effort. `npm run build` OK.
- **Callback §4.2 construido**: `Tlalocan - Notificar Validacion Huesped`
  (`7SFqV2P5LdAEihAA`), webhook `/webhook/validacion-pago-huesped`. Decisión de
  diseño resuelta copiando `Notificar Operaciones`: server_url/instance de `config`,
  apikey de la credencial n8n `Header Auth account` (no en DB).
- `.env.local`: `VITE_N8N_WEBHOOK_VALIDACION_PAGO` lleno con la URL del callback.

**Pendiente manual de Don Dani (destraba el callback):**
1. En `7SFqV2P5LdAEihAA`: enlazar credencial **Postgres** (`Tlalocan Postgres`) en
   "Lookup Datos" + **Header Auth** (`Header Auth account`) en "Enviar WhatsApp",
   y **activar** el workflow (el SDK no auto-asigna credenciales).
2. Configurar `VITE_N8N_WEBHOOK_VALIDACION_PAGO` en **Vercel** (ya está en local).
3. Confirmar que `Header Auth account` es efectivamente el apikey de la instancia
   **ventas** de Evolution (es la única `httpHeaderAuth` y la que usa Notificar
   Operaciones, así que debería; verificar al probar).

**Sigue bloqueado (pendientes manuales viejos):**
- Instancia **interna** de Evolution: **obtenida 2026-06-05**. Número interno en WA
  normal (chip Telcel en el Redmi de Tlalocan; ventas sigue en WA Business). En
  `config`: `evolution_instance_interno` = `Tlalocan Interno`, `telefono_interno` =
  `5213320445606`. **Apikey** va en credencial n8n nueva `Evolution Interno`
  (httpHeaderAuth, header `apikey`) — NO en la DB (igual que ventas). **Pendiente:**
  crear esa credencial + confirmar instancia "open".
- **Alta de finanzas: HECHA 2026-06-05.** Giovanna Anaya en `usuarios` (rol `admin`
  — el CHECK solo permite super_admin/admin/ventas, sin `finanzas`; `usuarios.id`
  tiene FK a `auth.users`, así que se creó su cuenta de auth primero). tel
  `5213319416414` para mapear el validador de WhatsApp → `validado_por`.

**Flujo interno APROBAR/RECHAZAR — CONSTRUIDO 2026-06-05**
- `Tlalocan - Validacion Finanzas (WhatsApp)` (`9vAEtuZbYDaTaTBN`), webhook
  `POST /webhook/finanzas-interno`. Finanzas escribe `APROBAR <folio>` o
  `RECHAZAR <folio> <motivo>` → valida remitente (su tel en `usuarios`, rol
  admin/super_admin = `validado_por`) → update idempotente (solo si
  `pendiente_pago`) → responde a finanzas → notifica al huésped reusando el
  callback `7SFqV2P5LdAEihAA`. La respuesta a finanzas usa el `apikey` del webhook
  entrante (instancia interna) → **no necesita** la credencial `Evolution Interno`.
- **Pendiente manual (Don Dani):**
  1. Enlazar credencial **`Tlalocan Postgres`** en nodo "Procesar Validacion" + **activar**.
  2. En Evolution: apuntar el **webhook de la instancia interna** (evento
     messages-upsert) a `https://reservalia.app.n8n.cloud/webhook/finanzas-interno`.

**Sigue pendiente:**
- Credencial n8n `Evolution Interno` (apikey instancia interna) — necesaria solo
  para el escalamiento *saliente* del Concierge a finanzas, no para el flujo de arriba.
- Manejo de media + escalamiento a finanzas en el Concierge (PRODUCCIÓN → a mano en UI).

---

## 12. Estado al cierre de sesión — 2026-06-09 (lectura de media)

**Verificado al abrir (sin drift):** Concierge (`TQKziRbmCiyNC6CQ`) sigue leyendo
solo texto (`body.data.message.conversation`). Visión (`K9qTzLN1nnu9FJmB`) y
Procesar Comprobante (`fnhLuzLGy93poEuP`) **asumen un `media_url` HTTP-fetcheable**
— pero el media de WhatsApp por Evolution viene cifrado, no como URL pública. Ese
era el puente faltante. Teléfono en `huespedes.telefono` = **solo dígitos**
(`crear_reserva` hace `.replace(/\D/g,'')`).

**Construido esta sesión — subworkflow `Tlalocan - Ingesta Comprobante`
(`djnNoB36EvzGTpJY`)** vía SDK (workflow NUEVO = seguro). Orquesta toda la cadena:
1. **Resolver Reserva** (Postgres): última `cotizada`/`pendiente_pago` por teléfono
   (normaliza `remoteJid` a dígitos). Si no hay → acuse "no encuentro reserva".
2. **Obtener Base64** (HTTP) → `POST {server_url}/chat/getBase64FromMediaMessage/{instance}`
   con header `apikey` del webhook (instancia ventas). Resuelve el cifrado.
3. **Preparar Media** (Code): arma `dataUri` (`data:<mime>;base64,…`) para visión,
   detecta PDF, calcula anticipo esperado.
4. **Es PDF?** → PDF: marca comprobante sin lectura (decisión 06-09). Imagen:
   **Analizar Visión** (Execute Workflow → `K9qTzLN1nnu9FJmB`, le pasa el `dataUri`
   como `media_url` — OpenAI acepta data URIs).
5. **Es Comprobante?** → no: acuse "eso no parece comprobante". Sí:
   **Comprobante a Binario** (base64→binario) → **Subir a Storage**
   (`comprobantes-pago/{id}/comprobante.ext`) → **Actualizar Reserva** (idempotente,
   solo si `cotizada`/`pendiente_pago`).
6. **Actualizó?** → no: acuse "ya validada". Sí: **Construir Escalamiento** (folio,
   huésped, chalet, fechas, anticipo, monto detectado) → **Acuse al Huésped**
   (ventas) → **Recipientes Finanzas** (`usuarios` rol admin/super_admin activos con
   tel) → **Enviar a Finanzas**: `sendMedia` con la imagen + caption por la
   **instancia interna** (`evolution_instance_interno` + `evolution_server_url` de
   `config`).

**Pendiente manual de Don Dani (destraba todo):**
1. **Rama de media en el Concierge** (PRODUCCIÓN → a mano en la UI, NO con SDK):
   - Insertar un nodo **IF "¿Es Media?"** justo después del **Webhook**.
     Condición (OR, loose): `{{ $json.body.data.messageType }}` equals `imageMessage`
     **o** equals `documentMessage`.
   - **true** → nodo **Execute Sub-workflow** → `Tlalocan - Ingesta Comprobante`
     (`djnNoB36EvzGTpJY`), inputs (referenciar `$('Webhook').item.json.body…`):
     `remoteJid`=`…data.key.remoteJid`, `server_url`=`…server_url`,
     `apikey`=`…apikey`, `instance`=`…instance`, `message_id`=`…data.key.id`,
     `key_remote_jid`=`…data.key.remoteJid`, `key_from_me`=`…data.key.fromMe`,
     `mimetype`=`{{ $json.body.data.message.imageMessage?.mimetype ?? $json.body.data.message.documentMessage?.mimetype }}`.
   - **false** → conectar al ya existente **"Obtener Mensajes Previos"** (flujo texto).
   - Reapuntar la salida del **Webhook**: Webhook → "¿Es Media?" (en vez de →
     "Obtener Mensajes Previos").
   - La instancia de ventas ya reenvía media al mismo webhook (no hay cambio en
     Evolution para ventas).
2. **Credenciales en `djnNoB36EvzGTpJY`** (el SDK no auto-asigna las HTTP; las 3
   Postgres SÍ quedaron con `Tlalocan Postgres`):
   - **Subir a Storage** → enlazar la credencial **httpCustomAuth de Supabase
     Storage** (la MISMA que usa `Procesar Comprobante Pago > Subir a Storage`).
   - **Enviar a Finanzas** → enlazar credencial **httpHeaderAuth `Evolution Interno`**
     (la apikey de la instancia interna; sigue pendiente de crear, §11).
   - "Obtener Base64", "Acuse al Huésped" y "Responder Huésped" NO necesitan
     credencial (usan el `apikey` del webhook como valor de header).

**A verificar al probar** (supuestos sobre la API de Evolution, no confirmados aún):
- `getBase64FromMediaMessage`: si con `{message:{key:{id}}}` no basta, pasar el
  objeto `data` completo del webhook.
- `sendMedia`: cuerpo plano `{number, mediatype, mimetype, media(base64), fileName,
  caption}`; si la versión lo quiere anidado bajo `mediaMessage`, ajustar.
- Code "Comprobante a Binario" usa `this.helpers.prepareBinaryData`; si la versión
  del Code node no lo expone en `this`, probar `$helpers`.
- `Procesar Comprobante Pago` (`fnhLuzLGy93poEuP`) queda **superado** por este
  subworkflow (la ingesta sube a Storage y actualiza inline). Se puede archivar
  cuando la ingesta esté probada.

**PROBADO de punta a punta — 2026-06-09 (ejecución 7815):** huésped manda foto →
Concierge enruta a la ingesta → Resolver Reserva (folio 1001) → getBase64 (Evolution)
→ Visión (`es_comprobante:true`, monto, banco) → Comprobante a Binario
(`prepareBinaryData` ok) → Subir a Storage (200) → reserva a `pendiente_pago` con
`comprobante_url` → Acuse al huésped enviado. Verificados los 3 supuestos (endpoint
`getBase64FromMediaMessage`, helper de binario, forma del flujo).

Tropiezos resueltos en vivo (todos aplicados):
1. **Publicar, no solo guardar:** este n8n corre la versión *publicada*; el IF en
   el Concierge no surtía efecto hasta `publish` (de los 3 workflows: visión, ingesta,
   Concierge).
2. **Lookup por teléfono:** `remoteJid` llega con prefijo `521`, `huespedes.telefono`
   guarda 10 dígitos → query cambiado a match por **últimos 10 dígitos**
   (`right(regexp_replace(...),10)`).
3. **Storage 401:** la credencial `Tlalocan Supabase HTTP` tenía la llave de OTRO
   proyecto (signature verification failed) → service_role correcta de `spnqatgiopfjczqwlzms`.
4. **Acuse 400:** el input `remoteJid` del nodo Execute en el Concierge tenía un
   espacio (`= {{…}}`) → corregido a `={{…}}`.

**Escalamiento a finanzas — CONSTRUIDO y probado correcto, BLOQUEADO por la línea interna (2026-06-10):**
- El nodo `Enviar a Finanzas` arma y envía bien: en la ejecución 7830 Evolution
  aceptó el `sendMedia` (imagen + caption con folio/datos) y devolvió el mensaje
  subido a WhatsApp. La cadena n8n está 100% correcta. Credencial `Evolution Interno`
  creada (apikey instancia interna `E3BD73CD58CB-…`) y enlazada.
- **Bloqueo:** la instancia **`Tlalocan Interno`** NO entrega mensajes salientes vía
  Evolution (companion), aunque reporte `state: open`. `fetchInstances` muestra
  `disconnectionReasonCode: 401` (**loggedOut**) → WhatsApp rechaza la sesión companion
  de ese número. Síntoma: todo envío queda en `PENDING` y nunca llega; **el envío
  manual desde el teléfono sí entrega** y **lo entrante también funciona**.
- **Descartado** (todo probado 2026-06-10): formato de número (el check
  `/chat/whatsappNumbers` confirma JIDs válidos con `1`), tipo de app (se migró a
  **WA Business** en otro equipo y siguió fallando), el equipo/MIUI, estado de sesión
  (restart/logout/re-vínculo/QR nuevo). Settings de la instancia normales.
- **Conclusión:** WhatsApp está restringiendo ese **número nuevo** para uso vía
  API/companion (típico anti-spam; ventas funciona porque solo **responde** a JIDs
  entrantes ya validados, nunca inicia en frío).
- **Recomendación / próximos pasos:**
  1. Usar un **número con antigüedad/historial** para la línea interna (re-vincular la
     instancia a ese número — apikey/credencial/config/webhook no cambian), **o**
     pasar finanzas a **WhatsApp Cloud API** oficial.
  2. Mientras tanto, **finanzas valida en la app** (`ValidarPagoForm` ya es idempotente
     y notifica al huésped) — el sistema opera completo sin el canal WhatsApp de finanzas.
- **Al reactivar:** revertir el query de `Recipientes Finanzas` a
  `rol in ('admin','super_admin')` (hoy quedó en `super_admin` solo, para la prueba),
  pulir el formato de fechas del caption (usar `.slice(0,10)`), y apagar el evento
  de webhook `SEND_MESSAGE` de la instancia interna (solo debe quedar `MESSAGES_UPSERT`).
- **Nota de datos:** se corrigió `usuarios.telefono` de Daniel a `5213335702682`
  (tenía `+523335702682`, sin el `1`). Regla: teléfonos en `usuarios` = `521`+10 dígitos.

**Git:** rama `fase-3-agente-ventas`. Docs actualizados (este §12). Sin push aún.

---

*Este archivo se mantiene actualizado durante la Fase 3.*
