# Fase 3 — Agente 1 (Ventas, M·02)

> Estado: **funcionalmente cerrada** al 2026-05-12. Flujo E2E validado:
> WhatsApp → cotización → reserva en DB → comprobante → validación humana → mensaje al huésped.
> Procesamiento automático de comprobante (imagen del huésped) queda como trabajo abierto.

El plan general vive en `PLAN.md` §4.3. Este archivo documenta lo construido y lo que falta.

---

## 0. Arquitectura

Dos planos:

- **n8n (cloud, no versionado en repo):** 1 workflow principal (`Tlalocan Concierge`) + 6 subworkflows. Todos en el proyecto **"Emi - Reservalia"**.
- **Supabase + App:** migraciones SQL versionadas en `supabase/migrations/`, app React que llama webhook al validar pagos.

Toda la conversación con el huésped pasa por el Concierge. La app solo entra al final para que Admin/Super Admin valide o rechace el comprobante.

---

## 1. Workflows en n8n

Todos `active=true`, autenticados con credencial `Tlalocan Postgres` (Transaction Pooler, puerto 6543 — ver `MEMORY.md` para el bug que motivó esa elección).

| Workflow | ID n8n | Rol |
|---|---|---|
| Tlalocan Concierge | `TQKziRbmCiyNC6CQ` | Bot WhatsApp con buffer Redis 7s. Prompt nuevo con 4 chalets, IVA + hospedaje desglosado, anticipo 50%. |
| Tlalocan - Cotizar Estadia | `7DX5VPXMJRRaqw96` | Tool. Llama `calcular_estadia()` y devuelve desglose por noche con anticipo. |
| Tlalocan - Enviar Fotos Chalets | `cyEKlvqXjHtH1Spv` | Tool. Lee `chalets.fotos_url` y envía hasta 4 fotos por chalet vía Evolution. |
| Tlalocan - Verificar Disponibilidad | `yddmRonPhs2MVNXn` | Tool. Devuelve chalets libres en un rango; marca `escalar_humano:true` si los 4 están ocupados. |
| Tlalocan - Crear Reserva Cotizada | `4wYw9B6qgENSJHCh` | Tool. CTE atómica: re-verifica disponibilidad, upsert huésped, inserta reserva en `cotizada`. Inputs como JSON para evitar bug de CSV split de n8n. |
| Tlalocan - Procesar Comprobante Pago | `fnhLuzLGy93poEuP` | **Infra lista, no conectada al agente todavía.** Descarga media, sube a Storage, marca `pendiente_pago`. |
| Tlalocan - Notificar Validacion Pago | `oVyq9UEjAzMLIX6j` | Webhook público que llama la app tras validar/rechazar. URL: `https://reservalia.app.n8n.cloud/webhook/notificar-validacion-pago` |

### Credenciales en n8n usadas

- `Tlalocan Postgres` (Postgres, Transaction Pooler) — todos los nodos Postgres.
- `Tlalocan Supabase HTTP` (HTTP Custom Auth con apikey + Bearer) — solo el nodo "Subir a Storage" del Procesar Comprobante.
- `Evolution Tlalocan` (HTTP Header Auth) — nodo "Enviar WhatsApp" del Notificar Validación.
- `Supabase account` (Supabase API nativa, pre-existente) — sin uso en estos flows.
- OpenAI + Redis — pre-existentes, usadas por Concierge.

---

## 2. Migraciones aplicadas

- `0024_config_datos_pago.sql` — CLABE Citibanamex, cuenta, sucursal, beneficiario `Giovanna`, `anticipo_porcentaje=50`, `saldo_horas_antes_checkin=48`.
- `0025_config_evolution.sql` — `evolution_server_url` y `evolution_instance_ventas` para que los workflows los lean de DB. **La apikey vive en credencial n8n, no en DB**.

Valores reales (no commiteados) actualizados manualmente en Supabase:
- `evolution_server_url = https://reyes-evolution-api.wmtfcd.easypanel.host`
- `evolution_instance_ventas = Tlalocan`

---

## 3. Cambios en la app

Solo `src/forms/ValidarPagoForm.jsx`:

- Al **validar**: setea `monto_pagado = round(monto_total * 0.5)` (50% configurado en `config.anticipo_porcentaje`; hardcoded en app por simplicidad).
- Al **validar o rechazar**: dispara `fetch(VITE_N8N_WEBHOOK_VALIDACION_PAGO, { method: 'POST', body: { reserva_id, validada, motivo } })`. Errores del fetch no rompen el UPDATE — se loguea en consola.

Vercel env var configurada en Production + Preview (Sensitive, no Development; para dev local agregar a mano en `.env.local`).

---

## 4. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Tarifas | Sin cambios respecto a PLAN — siguen netas + IVA + hospedaje. Tarifa global aplica a los 4 chalets. |
| Anticipo | 50% al reservar, saldo 48h antes del check-in. Configurable en `config`. |
| Datos bancarios | A nombre de Giovanna en Citibanamex. CLABE `002320702360329478`. Editable en `config`. |
| `monto_pagado` en validación | App lo setea al 50% al confirmar. Saldo lo manejará el Agente 2 (Fase 4). |
| Estado al rechazar | `cancelada` (comportamiento pre-existente de la app). Si el huésped reenvía comprobante después, será conversación nueva. Si se necesita "rechazar y permitir reenvío", abrir como follow-up. |
| Validación de pago por rol | Solo `super_admin` + `admin` (matriz PLAN §3.5). Don Dani consideró extender a `ventas` — pendiente discusión. |
| Procesamiento de comprobante por agente | Out of scope. El agente recibe el comprobante, dice "lo validamos" y un humano procesa manual. |
| Architecture cross-project en n8n | Workflows del Agente 1 viven en proyecto "Emi - Reservalia" junto al Concierge. n8n cloud no permite cross-project calls. |

---

## 5. Out of scope (trabajo abierto)

1. **Procesamiento automático del comprobante.** El subworkflow `Procesar Comprobante Pago` existe pero no está cableado como tool del Concierge. Requiere extender el nodo "Preparar Datos de Mensaje" del Concierge para detectar `imageMessage`/`documentMessage` en el payload de Evolution, extraer URL/mimetype, y exponerlo al LLM.
2. **Mensaje al huésped sobre cobro de saldo (48h antes del check-in).** Fase 4 (Agente 2). Requiere extender el schema (`comprobante_saldo_url`, `saldo_subido_en`, `saldo_validado_*`) y un workflow de Schedule Trigger.
3. **Validación de pagos por rol ventas.** Cambio de matriz RLS si se decide.
4. **Rechazo no destructivo.** Hoy rechazar = `cancelada`. Si quiere permitir reenvío de comprobante, cambiar a estado `cotizada` o agregar bandera.

---

## 6. Cómo retomar

Si Don Dani dice "sigamos con Fase 3" o "arreglemos lo del comprobante":

1. Re-leer este archivo + `MEMORY.md` (incluye bugs conocidos de n8n + credencial Postgres).
2. El trabajo natural siguiente es el procesamiento automático del comprobante (punto 1 de §5).
3. Si en cambio se quiere arrancar Fase 4 (Agente 2 — Bienvenida), ver `PLAN.md` §4.4.

Workflow URLs útiles:
- n8n cloud: https://reservalia.app.n8n.cloud
- App producción: https://tlalocan.vercel.app
- Webhook de validación: https://reservalia.app.n8n.cloud/webhook/notificar-validacion-pago
