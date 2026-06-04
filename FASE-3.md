# Fase 3 — Agente 1: Atención y Ventas al huésped (M·02)

> Entrada operativa para construir el agente de WhatsApp de cara al huésped.
> El plan general está en `PLAN.md`; la app (Fase 2 / M·01) ya está cerrada y
> desplegada (`FASE-2.md`). Esto aterriza la Fase 3.
> **El trabajo NO vive en este repo** — vive en n8n (`reservalia.app.n8n.cloud`),
> Evolution API y Redis. Este repo solo cambia en un punto: el webhook de
> validación de pago (§7). Esquema vivo en proyecto `Tlalocan`
> (ref `spnqatgiopfjczqwlzms`).

---

## 0. Qué hace este agente

Atiende por WhatsApp a un prospecto/huésped en **un solo número** y lo lleva de
"me interesa" hasta "subí mi comprobante", **sin nunca confirmar la reserva**
(eso lo valida un humano en la app). Después responde dudas de la estancia.

```
(cotiza) → huésped acepta → crea reserva COTIZADA
        → huésped manda comprobante → sube a Storage, pasa a PENDIENTE_PAGO
        → [humano valida en la app] → CONFIRMADA   ← el agente NO hace esto
        → el agente avisa al huésped el resultado (vía webhook, §7)
```

En Fase 3 se construye el **esqueleto + las tools de ventas**. La parte de
estancia (recordatorios, ubicación, wifi, recomendaciones) se le **suma al
mismo agente** en Fase 4 (M·03) sin número nuevo.

---

## 1. Arquitectura — 2 números, no 3 (decisión 2026-06-04)

| Número / instancia | Público | Agente | Fase |
|---|---|---|---|
| **Huésped** | prospecto + huésped | este agente (ventas + estancia) | 3 (ventas), 4 (estancia) |
| **Staff** | personal de limpieza | Agente 3 (limpieza) | 5 |

**Por qué un solo número de cara al huésped:** es el mismo humano antes y después
de reservar; cambiarlo de número entre "venta" y "estancia" es mala UX.

### Flujo del número de huésped

```
WhatsApp (1 número) → Evolution API → webhook n8n
   → [Redis buffer]   junta mensajes seguidos; memoria por número (telefono)
   → [Enriquecer]     lookup en Supabase: huespedes.telefono → reservas + estatus
   → [Agente LLM]     system prompt dinámico con el estatus como CONTEXTO
                      + todas las tools (§3)
   → responde por el mismo número
```

**El estatus es contexto, no candado.** El agente lee fresco el estatus del
contacto en cada turno y lo usa como default, pero su intención puede llevarlo a
otro modo (ej. un huésped confirmado que pregunta por otra fecha → vender).
Por eso es **un solo agente con todas las tools**, no un router rígido.

### Resolución de estatus (en el paso Enriquecer)

Buscar el número entrante en `huespedes.telefono` y traer sus `reservas`:

| Situación del contacto | Modo default |
|---|---|
| Sin registro / sin reserva activa | Prospecto → ventas |
| Reserva `cotizada` o `pendiente_pago` | Cerrando venta / seguimiento de pago |
| Reserva `confirmada` próxima o `en_curso` | Huésped → estancia (Fase 4) |
| Solo reservas `completada`/`cancelada`/`no_show` | Ex-huésped → reactivar / nueva venta |

---

## 2. Accesos y credenciales

> **PENDIENTE LLENAR** — Don Dani los tiene a la mano (no commitear secretos).

```
n8n:               https://reservalia.app.n8n.cloud   (MCP conectado vía /mcp → "claude.ai n8n")
Workflow base:     "Tlalocan Concierge" (existente, 2 tools hardcoded + Redis buffer)

Evolution API:
  URL:             <PENDIENTE>
  API key:         <PENDIENTE>
  Instancia huésped: <PENDIENTE>   (número dedicado de cara al cliente)

Redis:
  Conexión:        <PENDIENTE>     (la misma que ya usa el buffer del Concierge)

Supabase (escritura del agente):
  URL:             https://spnqatgiopfjczqwlzms.supabase.co
  Service role key: <PENDIENTE — guardar SOLO en credenciales de n8n, NUNCA en el prompt ni en git>
  RPC:             calcular_estadia(p_chalet_id, p_fecha_entrada, p_fecha_salida)
  Bucket:          comprobantes-pago  (privado)
```

**El agente escribe a Supabase con service role key vía HTTP Request nodes**
(decisión §scope #2), saltándose RLS. Es el patrón estándar para un bot backend.
La key vive solo en credenciales de n8n. Endurecer a un rol Postgres dedicado con
permisos mínimos queda como mejora posterior.

---

## 3. Tools del agente (Fase 3 — ventas)

Todas pegan a Supabase con la service role key. Tipos/valores **verificados
contra el esquema vivo 2026-06-04**.

### 3.1 `cotizar_estadia(chalet_id, fecha_entrada, fecha_salida)`
- Llama al RPC `calcular_estadia`. Devuelve `{ noches, desglose, subtotal_neto,
  iva, impuesto_hospedaje, total, tarifa_aplicada }`.
- El agente presenta: noches, subtotal, IVA (16%), impuesto hospedaje (5%) y
  **total**. (Reemplaza el `cotizar_estadia` hardcoded del Concierge.)

### 3.2 `enviar_fotos_chalets(chalet_id?)`
- Query a `chalets.fotos_url[]` (y `nombre`, `descripcion`, `capacidad`).
- Sin `chalet_id` → resumen de los 4. (Reemplaza el `enviar_fotos_chalets`
  hardcoded.)

### 3.3 `verificar_disponibilidad(chalet_id, fecha_entrada, fecha_salida)`
- Consulta `reservas` del chalet con fechas que solapen.
- **Bloquea si hay cualquier estado activo:** `cotizada`, `pendiente_pago`,
  `confirmada`, `en_curso` (misma regla estricta que la app — decisión #3).
- Devuelve disponible / no disponible. Si el choque es con `cotizada`/
  `pendiente_pago`, el mensaje al huésped reconoce que está "en proceso de
  apartado" y se ofrece avisar; en duda, escala a Don Dani.

### 3.4 `buscar_o_crear_huesped(telefono, nombre?, apellidos?, email?)`
- Busca por `huespedes.telefono`. Si existe → usa su `id`.
- Si no → insert con `origen_inicial = 'whatsapp_directo'`.

### 3.5 `crear_reserva_cotizada(...)`
- Se llama **cuando el huésped acepta y dice que va a pagar**. NO antes (una
  cotización a secas no crea fila).
- Antes de insertar: re-correr `verificar_disponibilidad` (anti-carrera).
- Insert en `reservas`:
  - `huesped_id`, `chalet_id`, `fecha_entrada`, `fecha_salida`, `num_huespedes`
  - montos snapshot de `calcular_estadia`: `subtotal_neto`, `iva`,
    `impuesto_hospedaje`, `monto_total`
  - `estado = 'cotizada'`, `origen = 'agente_whatsapp'`
  - `notas` opcional. `creada_por` queda NULL (es el bot, no un usuario).
- Devuelve `reserva_id`. Mensaje al huésped: instrucciones de pago + pedir
  comprobante.

### 3.6 `procesar_comprobante_pago(reserva_id, media_url)`
- El agente detecta media (imagen/PDF) del huésped.
- Descarga el media de WhatsApp (Evolution).
- Sube a `comprobantes-pago/{reserva_id}/comprobante.{ext}` (bucket privado).
- Update reserva: `comprobante_url`, `comprobante_subido_en = now()`,
  `estado = 'pendiente_pago'`.
- El trigger de DB crea las notificaciones a super_admin/admin (la campana de la
  app suena en realtime — ya funciona desde Fase 2).
- Responde: "Recibimos tu comprobante. En cuanto lo validemos te confirmamos."

> **Nota:** el agente NO crea `confirmada` jamás (decisión #9 del PLAN §4).
> Modificar/cancelar/reagendar y disputas de pago quedan **fuera** (decisión #5)
> → escalar a Don Dani.

---

## 4. Prompt del agente

- Reescribir el prompt del Concierge: **4 chalets correctos** (De La Cima,
  De La Cañada, Del Fondo, De La Entrada), precios desde Supabase (no hardcodear),
  tono cordial y conciso.
- **System prompt dinámico:** el paso Enriquecer inyecta un bloque con el estatus
  del contacto y, si aplica, los datos de su reserva activa (chalet, fechas,
  estado, monto). El agente lo usa como contexto para decidir modo.
- Reglas duras en el prompt: nunca prometer `confirmada`; siempre pasar por
  validación humana; ante modificación/cancelación/disputa → escalar a Don Dani
  (`config.telefono_super_admin`).

---

## 5. Memoria y buffer (Redis)

- Reusar el patrón Redis del Concierge: buffer que junta varios mensajes seguidos
  y los procesa como uno, **keyed por número de WhatsApp**.
- La memoria de conversación persiste a través de la transición venta→huésped
  (mismo contacto). No se reinicia al reservar.
- La **fuente de verdad del estatus es Supabase**, no la memoria — el buffer es
  solo continuidad conversacional.

---

## 6. Datos relevantes del esquema (verificados 2026-06-04)

- `reservas.estado` ∈ `cotizada, pendiente_pago, confirmada, en_curso,
  completada, cancelada, no_show`.
- `reservas.origen` ∈ `directa, airbnb, booking, referido, agente_whatsapp,
  app_manual` → el agente usa **`agente_whatsapp`**.
- `huespedes.origen_inicial` ∈ `website, airbnb, booking, referido,
  whatsapp_directo, walk_in, otro` → huésped nuevo del agente usa
  **`whatsapp_directo`**.
- `reservas` (columnas a insertar): `huesped_id, chalet_id, fecha_entrada,
  fecha_salida, num_huespedes, subtotal_neto, iva, impuesto_hospedaje,
  monto_total, estado, origen, notas`.
- Comprobante: `comprobante_url, comprobante_subido_en` + `estado='pendiente_pago'`.
- `config` (lookup útil): `checkin_hora` 15:00, `checkout_hora` 12:00,
  `wifi_password_global`, `codigo_chapa_global`, `telefono_super_admin`,
  `zona_horaria` America/Mexico_City.

---

## 7. Cierre del ciclo — webhook app → n8n (entra en Fase 3, decisión #4)

Cuando un humano valida/rechaza el pago en la app, el huésped debe enterarse por
WhatsApp. Para eso:

1. **n8n:** crear un sub-flujo con Webhook Trigger que reciba
   `{ reserva_id, validada: bool, motivo? }` y mande el mensaje al huésped por la
   instancia de huésped (confirmación con datos, o rechazo con motivo).
2. **App (este repo):** en `ValidarPagoForm`, tras el update a `confirmada` /
   `cancelada`, hacer `fetch(POST)` al webhook usando
   `VITE_N8N_WEBHOOK_VALIDACION_PAGO` (ya existe vacío en `.env.example` /
   `.env.local`). Llenar la URL del webhook y configurarla también en Vercel.
   Disparo "best-effort": si el webhook falla, no romper la validación (loguear).

---

## 8. Orden sugerido de trabajo

1. Conectar MCP de n8n (`/mcp` → "claude.ai n8n"). Inspeccionar el Concierge
   actual: patrón Redis, conexión Evolution, estructura.
2. Llenar §2 con los accesos reales (Evolution, Redis, service role).
3. Montar el esqueleto del workflow nuevo: Webhook Evolution → Redis buffer →
   nodo Enriquecer (lookup estatus) → nodo Agente.
4. Construir las tools §3.1–§3.6 como sub-flujos HTTP a Supabase. Probar cada una
   aislada (cotizar, disponibilidad, crear cotizada, comprobante).
5. Redactar el prompt §4 con system prompt dinámico.
6. Sub-flujo del webhook de validación §7 + cambio en `ValidarPagoForm`.
7. Cutover: apuntar la instancia de huésped al workflow nuevo; dejar el Concierge
   viejo como respaldo hasta validar.

---

## 9. Definition of Done — Fase 3

- [ ] Un prospecto cotiza por WhatsApp y recibe desglose correcto (datos reales).
- [ ] Acepta → se crea reserva `cotizada` (origen `agente_whatsapp`) con montos
      snapshot correctos.
- [ ] `verificar_disponibilidad` bloquea overlaps con la misma regla que la app.
- [ ] Huésped manda comprobante → sube a Storage → reserva pasa a `pendiente_pago`
      → la campana de la app suena (realtime) a super_admin/admin.
- [ ] Humano valida en la app → webhook → el huésped recibe confirmación por
      WhatsApp. Rechazo → recibe motivo.
- [ ] El agente nunca crea `confirmada`; modificaciones/cancelaciones escalan a
      Don Dani.
- [ ] Concierge viejo retirado o claramente marcado como respaldo.

---

## 10. Fuera de alcance de Fase 3

- Tools y comportamiento de **estancia** (recordatorios 24h/checkout, ubicación,
  wifi, recomendaciones locales) → Fase 4 (M·03), mismo agente y número.
- Agente de **limpieza/staff** → Fase 5 (M·04), número aparte.
- Modificar/cancelar/reagendar reservas y disputas de pago por WhatsApp → escalar
  a humano.
- Pasarela de pagos / facturación / integraciones Airbnb·Booking → fuera del
  proyecto entero.

---

## 11. Si te trabas

- Probar `calcular_estadia` y queries de disponibilidad en el SQL Editor de
  Supabase antes de cablearlas en n8n.
- Si una escritura del agente falla, verificar que use service role (no la
  publishable/anon, que choca con RLS).
- Si el comprobante no sube, revisar las storage policies del bucket
  `comprobantes-pago` (se validaron en el smoke test de Fase 2, §19.2).
- Cualquier cosa fuera de lo documentado, parar y preguntarle a Don Dani.

---

*Este archivo se mantiene actualizado durante la Fase 3.*
