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

### 4.2 Callback de validación app → huésped (HUECO, decisión #4)
Cuando un humano valida/rechaza en la app, el huésped debe enterarse por WhatsApp.
- **n8n:** crear sub-flujo con Webhook Trigger que reciba
  `{ reserva_id, validada: bool, motivo? }` y mande el mensaje por la instancia
  de huésped.
- **App (este repo):** en `ValidarPagoForm`, tras el update a `confirmada`/
  `cancelada`, `fetch(POST)` al webhook con `VITE_N8N_WEBHOOK_VALIDACION_PAGO`
  (ya existe vacío en `.env*`). Llenar URL + configurar en Vercel. Best-effort: si
  el webhook falla, no romper la validación.

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
- [ ] Ingesta de comprobante: huésped manda media → visión confirma que es ficha
      bancaria → Storage → `pendiente_pago` → escala al número de pagos.
- [ ] Validación dual: finanzas aprueba/rechaza por WhatsApp O en la app; ambos
      actualizan la reserva (idempotente, primero gana).
- [ ] Callback de validación: al validar/rechazar (cualquier canal) el huésped
      recibe confirmación/rechazo por WhatsApp.
- [ ] Personal de finanzas dado de alta en `usuarios` (para `validado_por`).
- [ ] Decisión y acción sobre cotización chalet-agnóstica (§3.2).
- [ ] Decisión sobre enriquecimiento de estatus (§4.3) — o explícitamente diferido
      a Fase 4.

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

*Este archivo se mantiene actualizado durante la Fase 3.*
