# Fase 4 — Agente 2 (Bienvenida y estancia, M·03)

> Kickoff doc. Lee `MEMORY.md`, `PLAN.md` §4.4, `FASE-3.md` antes que esto si es la primera vez.
> Fase 3 (Agente 1) cerrada y mergeada al 2026-05-12 (commit `eb8f3db`).

---

## 0. Alcance del sprint

**MVP funcional** (esta sesión):

| # | Entregable | Trigger | Cuándo |
|---|---|---|---|
| 1 | Polish del Mensaje 1 (confirmación) | Webhook desde la app al validar pago | Inmediato |
| 2 | Recordatorio de llegada | Schedule diario | 24h antes del check-in (hora `config.hora_recordatorio_llegada` = 10:00) |
| 3 | Recordatorio del saldo | Schedule diario | 48h antes del check-in |
| 4 | Recordatorio de salida + reseña | Schedule diario | Día del check-out a `config.hora_recordatorio_salida` = 11:00 |

**Fuera de alcance** (para próxima sesión):
- Agente conversacional durante la estancia (responder preguntas WiFi/chapa/recomendaciones).
- Procesamiento automático del comprobante del saldo (requiere extender schema con `comprobante_saldo_url`, `saldo_subido_en`, `saldo_validado_*`).
- Recomendaciones locales en el prompt (se mete cuando se construya el conversacional).

---

## 1. Decisiones cerradas con Don Dani

| Tema | Decisión |
|---|---|
| Ubicación de los 4 chalets | Comparten ubicación física (mismo estacionamiento). Un solo link Maps sirve para todos. |
| Texto base de indicaciones | "Entra al fraccionamiento Paso del Ciervo, identifícate en la caseta de vigilancia diciendo que vas a Tlalocan. Sigue las indicaciones hasta tu chalet." |
| Reseñas | Dirigir a **Airbnb** por ahora (Google Maps todavía no listo). |
| Saldo sin pagar a 24h del check-in | Escalar a humano (notificación admin) + recordatorio automático. **No auto-cancelar**. |
| Instancia Evolution | Reutilizar `Tlalocan` (la del Agente 1). Mismo nombre de remitente "Tlali". |
| Beneficiario completo | `Giovanna Jacqueline Alexa Anaya Rodriguez` (actualizado en `config.beneficiario_pago`). |
| Link Google Maps fraccionamiento | **Pendiente** — Don Dani lo va a pasar. Si no llega antes de armar workflows, dejar placeholder en `config.ubicacion_maps_global`. |

---

## 2. Workflows a crear/modificar

### Patrón estándar a seguir (igual que Fase 3)

Todos los workflows nuevos:
- Viven en proyecto **"Emi - Reservalia"** de n8n (mismo donde están los de Fase 3).
- Usan credencial `Tlalocan Postgres` (Transaction Pooler 6543 — ver `MEMORY.md` para el bug que motivó esa elección).
- Usan credencial `Evolution Tlalocan` (HTTP Header Auth) para mandar mensajes.
- Leen settings de Evolution desde `config` (`evolution_server_url`, `evolution_instance_ventas`).
- Patrón Schedule Trigger: corre 1 vez al día a las 8:00 AM `America/Mexico_City`, consulta reservas elegibles, manda mensajes en batch con delay 1500ms entre cada uno (batching del HTTP Request node).

### Lista de workflows

**A) Refactor `Tlalocan - Notificar Validacion Pago`** (id `oVyq9UEjAzMLIX6j`, ya existe)
- Sumar al mensaje de confirmación el contacto de Don Dani (`config.telefono_super_admin`) como referencia para emergencias.
- Considerar agregar una línea: *"Te escribiré 24h antes del check-in con las indicaciones para llegar."*

**B) Nuevo `Tlalocan - Recordatorio Llegada`**
- Schedule Trigger: diario 10:00 AM MX.
- Lookup: `reservas WHERE estado='confirmada' AND fecha_entrada = current_date + 1`.
- Por cada reserva, mandar mensaje al huésped con:
  - Saludo cordial con nombre.
  - Datos del chalet (nombre, link Maps global).
  - Indicaciones de llegada (texto cerrado en §1).
  - Check-in: 15:00. Check-out: 12:00.
  - Código de chapa: usar `chalets.codigo_chapa` si está poblado, si no `config.codigo_chapa_global` (= "2998").
  - WiFi password: usar `chalets.wifi_password` si está poblado, si no `config.wifi_password_global` (= "Pasodelciervo2026").
  - Cierre cordial: "Cualquier duda escríbeme aquí, Tlali ✨".

**C) Nuevo `Tlalocan - Recordatorio Saldo`**
- Schedule Trigger: diario 10:00 AM MX.
- Lookup: `reservas WHERE estado='confirmada' AND fecha_entrada = current_date + 2 AND monto_pagado < monto_total`.
- Manda recordatorio con CLABE + monto restante.
- **Sub-rama:** si `fecha_entrada = current_date + 1 AND monto_pagado < monto_total` → crear notificación tipo `sistema` en `notificaciones` para Super Admin + Admin con tipo `huesped_pregunta` o nuevo tipo `saldo_no_pagado` (decisión: agregar a check constraint o reutilizar `sistema`).

**D) Nuevo `Tlalocan - Recordatorio Salida`**
- Schedule Trigger: diario 11:00 AM MX.
- Lookup: `reservas WHERE estado='confirmada' AND fecha_salida = current_date` (o `estado='en_curso'` si se implementa la transición automática check-in → en_curso).
- Manda mensaje de despedida con check-out 12:00, agradecimiento, e invita a reseñar en Airbnb.

**E) (Opcional)** Tarea de mantenimiento: transición `confirmada → en_curso` el día del check-in a las 15:00, y `en_curso → completada` el día del check-out a las 12:00. Puede ser un trigger SQL o un workflow extra. PLAN.md no lo especifica explícitamente. Decisión: discutir al inicio del sprint.

---

## 3. Workflows existentes referenciados

| Workflow | ID | Rol |
|---|---|---|
| Tlalocan Concierge | `TQKziRbmCiyNC6CQ` | Agente 1 (Ventas). |
| Tlalocan - Notificar Validacion Pago | `oVyq9UEjAzMLIX6j` | Webhook que llama la app — al validar el pago, manda el Mensaje 1. **Es lo que vamos a polir (entregable A).** |
| Función SQL `calcular_estadia` | — | Por si necesitamos cotizar saldo restante. |

URLs de referencia:
- n8n cloud: `https://reservalia.app.n8n.cloud`
- Evolution API: `https://reyes-evolution-api.wmtfcd.easypanel.host`
- App: `https://tlalocan.vercel.app`

---

## 4. Esquema de DB — campos relevantes ya existentes

De `chalets`:
- `ubicacion_maps` (text) — link Maps por chalet, override del global si está.
- `instrucciones_llegada` (text) — texto específico por chalet, override.
- `codigo_chapa` (text) — override del global.
- `wifi_password` (text) — override del global.

De `config` (todos pre-existen, no hace falta migración nueva en esta sesión salvo que agreguemos `ubicacion_maps_global`):
- `checkin_hora` = "15:00"
- `checkout_hora` = "12:00"
- `wifi_password_global` = "Pasodelciervo2026"
- `codigo_chapa_global` = "2998"
- `telefono_super_admin` = "+523335702682"
- `hora_recordatorio_llegada` = "10:00"
- `hora_recordatorio_salida` = "11:00"
- `zona_horaria` = "America/Mexico_City"
- `evolution_server_url` = (URL real seteada en Fase 3)
- `evolution_instance_ventas` = "Tlalocan"
- **Falta:** `ubicacion_maps_global` (Don Dani lo pasa).

De `reservas`:
- `estado` ya soporta `confirmada`, `en_curso`, `completada`.
- `monto_pagado` se setea al 50% al validar pago (Fase 3).

---

## 5. Bugs y patrones aprendidos en Fase 3

(Re-leer `MEMORY.md` para detalle completo. Resumen:)

- **n8n Postgres + Supabase pooler:** usar Transaction Pooler (puerto 6543) en credencial `Tlalocan Postgres`. Session Pooler tiene bug SCRAM con users que contienen punto.
- **n8n queryReplacement CSV split:** pasar inputs complejos como **un único JSON** (`$1::jsonb`) en vez de CSV separado por comas. Evita pérdida de campos vacíos consecutivos.
- **MCP `update_workflow` solo cambia draft:** hay que llamar `publish_workflow` después para que la nueva versión sea activa. Y al publicar, las credenciales asignadas a nodos suelen desasociarse — pedirle al usuario que reasigne en la UI.
- **MCP `create_workflow_from_code` puede devolver 500 falso positivo:** el workflow SÍ se crea. Antes de reintentar, hacer `search_workflows` para verificar.
- **Cross-project en n8n cloud:** los workflows nuevos creados via MCP caen en el proyecto personal por default. Si el caller vive en otro proyecto, hay que mover al destino correcto (no se permiten cross-project calls).
- **HTTP Request a Evolution:** `delay` debe ser **número** (no string). Usar `specifyBody='json'` con expresión literal `{{ { ... } }}` evita problemas de tipo.
- **Bundle de Vercel:** después de cambios en env vars o `.env*`, hacer `Cmd+Shift+R` para forzar bundle fresco. Cache del browser puede mostrar versión vieja por horas.

---

## 6. Cómo retomar (próxima sesión)

1. Bash: `git pull origin main` para tener Fase 3 mergeada local.
2. Leer este archivo + `MEMORY.md` + `PLAN.md` §4.4.
3. Confirmar con Don Dani el link de Google Maps del fraccionamiento (si todavía no lo tiene, dejar placeholder en `config.ubicacion_maps_global`).
4. Arrancar por el entregable más simple: **A (polish Mensaje 1)**. Es solo editar el Code "Formatear Mensaje" del workflow `Notificar Validacion Pago` ya existente.
5. Después **D (Recordatorio Salida)** porque es el más simple de los Schedule Triggers.
6. Después **B (Recordatorio Llegada)** que tiene más campos.
7. Cerrar con **C (Recordatorio Saldo)** que tiene la lógica de escalar a humano.
8. Commit consolidado al final con migración nueva si hace falta (e.g. agregar `ubicacion_maps_global`).
