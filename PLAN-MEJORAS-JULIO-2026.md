# Plan de Mejoras Tlalocan — Julio 2026

> Para ejecutar en Claude Code. Principio: **certeza sobre prisa** — mostrar SQL/DDL antes
> de ejecutar, validar incremental, confirmación explícita para operaciones destructivas.
>
> Frentes: (A) fix duplicados de escalación, (B) huésped perdido, (C) bloqueos de fechas
> en app, (D) calendario maestro en app.

---

## Contexto del diagnóstico (2026-07-12)

- **Duplicados confirmados con datos**: el 12-jul se crearon 9 escalaciones `checkout`
  para 4 folios (1036×3, 1048×3, 1051×2, 1041×1). Cada una genera 2 mensajes a Valentina
  (aviso 🚪 + timeout ⏰) → ~18 mensajes en una hora.
- **Causa raíz**: `Crear Escalacion` (workflow `NOoRAxLr7EmbWzup`) inserta sin verificar
  si ya existe una escalación abierta para la misma reserva+tipo. Cada mensaje nuevo del
  huésped ("¿a qué hora vienen?", "sigo esperando") hace que Tlali escale de nuevo, y cada
  inserción dispara su propio aviso y su propio timer de 15 min.
- **El workflow Timeout Checkout (`ypQk8Zaby3LbJptu`) funciona bien**: el reclamo atómico
  (`update ... where estado='abierta' returning id`) + IF guard operan correctamente.
  No tocar su lógica central.
- **Dato operativo**: las 9 escalaciones cerraron por timeout — Valentina no respondió
  ninguna en 15 min. Reforzar onboarding al protocolo de folios (pendiente existente).
- **Bloqueos hoy**: el tool de staff crea bloqueos como reservas `origen='cortesia'`
  (folios 1054, 1055), mezclándolos con cortesías reales (1042, 1043). Hay que separar.
- **MCP-safe**: `NOoRAxLr7EmbWzup` y `ypQk8Zaby3LbJptu` usan apikey del payload por
  expresión (NO credencial Evolution en el nodo) → se pueden editar vía MCP sin riesgo
  de perder credenciales. El subworkflow del **Agente Estancia** (`28gdShAAQ0SecHyG`) sí
  hay que verificar credenciales (OpenAI/Redis/Postgres) después de cualquier edición MCP,
  o editar el prompt directo en la UI de n8n.

---

## A. Fix: escalaciones duplicadas (prioridad 1)

### A1. Migración Supabase — candado de idempotencia

```sql
-- migración: escalaciones_unica_abierta
create unique index if not exists escalaciones_abierta_unica
  on public.escalaciones (reserva_id, tipo)
  where estado = 'abierta';
```

Nota: verificar antes que no existan 2+ escalaciones abiertas del mismo (reserva, tipo)
(hoy todas están cerradas, debería pasar limpio).

### A2. Rediseñar la CTE de `Crear Escalacion` (n8n, vía MCP)

Nueva lógica: primero buscar escalación **abierta** existente para la reserva+tipo;
si existe, devolverla con `ya_existia = true` y NO insertar. Si no existe, insertar
(el índice único protege contra carrera). Forma general:

```sql
with r as (
  -- (igual que hoy: resolver reserva activa por teléfono)
), existente as (
  select e.id as escalacion_id, true as ya_existia
  from public.escalaciones e, r
  where e.reserva_id = r.reserva_id and e.tipo = $2 and e.estado = 'abierta'
  limit 1
), ins as (
  insert into public.escalaciones (reserva_id, folio, huesped_telefono, chalet_nombre, tipo, motivo)
  select r.reserva_id, r.folio, $1, r.chalet_nombre, $2, convert_from(decode($3,'base64'),'UTF8')
  from r
  where not exists (select 1 from existente)
  on conflict do nothing
  returning id as escalacion_id, false as ya_existia
)
select coalesce(e.escalacion_id, i.escalacion_id) as escalacion_id,
       coalesce(e.ya_existia, i.ya_existia, false) as ya_existia,
       r.folio, r.chalet_nombre, r.huesped_nombre,
       (select value from public.config where key='telefono_operaciones') as telefono_operaciones
from r
left join existente e on true
left join ins i on true;
```

### A3. Rama `ya_existia` en el workflow

- `Preparar Aviso`: si `ya_existia`, devolver `ok=true, yaExistia=true` con mensaje al
  agente: *"Ya hay una escalación abierta para este huésped (folio X). NO se avisó de
  nuevo a Valentina. Dile al huésped que sigues esperando confirmación del equipo."*
- IF nuevo antes de `Enviar a Valentina`: si `yaExistia` → saltar directo a `Respuesta`
  (sin aviso, sin timeout).
- Recordar: **publish después de editar**, y una operación MCP por llamada
  (`addNode` estático primero, luego `setNodeParameter` para expresiones).

### A4. Refuerzo de prompt — Agente Estancia

Agregar al systemMessage: si ya escalaste en esta conversación (está en tu memoria) y el
huésped insiste, NO vuelvas a llamar `escalar_a_operaciones`; tranquilízalo y recuérdale
que el equipo ya fue notificado. *(Editar en UI de n8n o verificar credenciales después.)*

### A5. QA

1. Simular checkout: primer mensaje → 1 escalación, 1 aviso, 1 timeout.
2. Segundo mensaje del mismo huésped a los 3 min → 0 avisos nuevos, 0 timeouts nuevos,
   respuesta del agente de "sigo esperando".
3. Timeout a los 15 min → 1 solo mensaje ⏰ a Valentina.

---

## B. Huésped perdido — video + croquis + aviso a Valentina

Decisiones tomadas: **un solo video genérico**; escalación **solo aviso, sin timeout**.
Contexto clave: mala recepción dentro de Paso del Ciervo → **todo debe salir en un solo
turno** (video + croquis + texto), sin diálogo de ida y vuelta.

### B1. Assets y config

- Subir el video (D4ny lo entrega) a Supabase Storage, bucket público
  `media-llegada/video-como-llegar.mp4`.
  - Límite WhatsApp/Evolution: ~16 MB para video. Si pesa más, comprimir
    (H.264, 720p, CRF ~28 suele bastar).
- Config nuevas: `video_llegada_url`. Ya existe `croquis_llegada_url` (reusar).

### B2. Nuevo tool del Agente Estancia: `ayuda_llegada` (workflow n8n nuevo)

Crear vía MCP (workflow nuevo = sin riesgo de credenciales; asignar credencial Postgres
manualmente después). Entradas: `remoteJid`, `server_url`, `apikey`, `instance`,
`descripcion_ubicacion` (dónde dice estar el huésped: caseta / estacionamiento / otro).

Flujo:
1. Resolver reserva activa por teléfono (en_curso, confirmada con `fecha_entrada = hoy`,
   o confirmada con llegada mañana — el caso real es día de llegada). Guard regex teléfono.
2. Enviar al huésped en secuencia (misma instancia ventas):
   a. `sendMedia` video (`video_llegada_url`) con caption corto,
   b. `sendMedia`/imagen croquis (`croquis_llegada_url`),
   c. `sendText` con instrucciones del chalet (`instrucciones_llegada` del chalet de su
      reserva) + "Valentina ya sabe que estás en camino, alguien va a alcanzarte".
3. Registrar escalación `tipo='llegada'` (agregar al CHECK de `escalaciones.tipo` si
   existe constraint — **verificar `pg_constraint` antes**). Estado `abierta` para que
   Valentina pueda responder por protocolo de folio, pero **sin disparar timeout**.
   El candado A1 aplica también aquí (no re-avisar si ya hay una abierta).
4. Avisar a Valentina: 🧭 *Huésped perdido — {chalet} (folio X). {Nombre}, tel {tel}.
   Dice estar en: {descripcion_ubicacion}. Ya le mandé video + croquis. Manda a alguien
   a acompañarlo.* (sin timer).
5. Inyectar en memoria Redis del huésped lo enviado (patrón de Timeout Checkout).

### B3. Registro en el Agente Estancia

- Agregar el tool con `toolWorkflow` — **incluir `workflowInputs.schema` completo**
  (aprendizaje crítico: sin schema, los `$fromAI` no se exponen y llegan null).
- Prompt: detonadores explícitos — "no encuentro", "estamos perdidos", "ya llegamos a la
  caseta y no sabemos", "¿dónde está el chalet?", "no encontramos el estacionamiento".
  Instrucción: usar el tool DE INMEDIATO, sin pedir más datos que una descripción breve
  de dónde están; asumir que la señal puede cortarse.
- Verificar credenciales del Agente Estancia después de la edición MCP (o editar en UI).

### B4. QA

1. Mensaje "estamos en la caseta y no encontramos nada" desde teléfono con reserva
   `en_curso`/llegada hoy → recibe video + croquis + texto; Valentina recibe 1 aviso.
2. Repetir el mensaje 5 min después → reenvía material al huésped pero NO duplica aviso
   a Valentina (o responde "ya viene alguien" — definir en prompt).
3. Teléfono sin reserva activa → respuesta cortés sin escalación.

---

## C. App: bloqueos de fechas

Decisión de modelo: **reusar `reservas`** con `origen='bloqueo'` (disponibilidad, iCal
export y calendario los respetan sin lógica extra), separándolos de cortesías reales.

### C1. Migración Supabase

```sql
-- migración: origen_bloqueo
-- 1. Ampliar CHECK de reservas.origen para incluir 'bloqueo'
--    (consultar pg_get_constraintdef antes de recrear el constraint)
-- 2. Crear huésped de sistema único: nombre 'Bloqueo Operativo',
--    telefono '0000000000', origen_inicial 'otro'
```

- `estado='confirmada'`, `monto_total=0`, `notas` = motivo del bloqueo.
- UPDATE de folios 1054 y 1055 a `origen='bloqueo'` (**requiere confirmación explícita
  de D4ny antes de ejecutar** — es modificación de datos productivos).

### C2. RLS / permisos

- Verificar policies actuales de `reservas` para rol `ventas`. Asegurar INSERT permitido
  al menos para `origen='bloqueo'` (y decidir si UPDATE/cancelación de bloqueos también).

### C3. Frontend (React/Vite)

- Botón "Bloquear fechas" (visible para `ventas`, `admin`, `super_admin`).
- Formulario mínimo: chalet (o "todos" → crea 4 reservas), rango de fechas, motivo
  (se guarda en `notas`). Sin datos de huésped — se asigna el huésped de sistema.
- Validación: rechazar si hay traslape con reserva activa del mismo chalet (mismo query
  que usa disponibilidad).
- En listas de reservas: badge gris "Bloqueo" y ocultar campos de pago.
- Acción "liberar bloqueo" = pasar a `cancelada` (con confirmación).

### C4. Alinear el tool de staff (Agente Interno)

- Cambiar el tool de bloqueo para usar `origen='bloqueo'` + huésped de sistema (mismo
  modelo que la app). Cuidado: si el workflow tiene nodos con credencial Evolution,
  editar en UI de n8n; si usa apikey por payload, MCP es seguro.

---

## D. App: calendario maestro

Decisión: **timeline horizontal tipo Airbnb en desktop** (filas = 4 chalets, columnas =
días), **lista/agenda en móvil**. Disponible para rol `ventas`.

### D1. Implementación

- Componente custom con CSS Grid (4 chalets no justifica librería con licencia premium
  tipo FullCalendar Scheduler). Sin dependencias nuevas.
- Desktop: ventana deslizable de ~4–6 semanas, navegación ←/→ y "hoy". Barras por
  reserva que cruzan celdas (check-in medio día / check-out medio día, estilo Airbnb).
- Móvil (breakpoint): vista agenda — lista cronológica agrupada por día con chips por
  chalet y estado.
- Colores por estado (paleta Forest & Moss): confirmada verde `#2C5F2D`, en_curso gold
  `#C9A227`, pendiente_pago/cotizada terracota `#B85042` (o contorno), completada gris
  verdoso, **bloqueo gris con patrón rayado**.
- Click/tap en barra → navegar al detalle de reserva existente (ruta actual de la app).
- Tooltip/preview: folio, huésped, fechas, estado, saldo.

### D2. Datos

- Un solo query por rango visible:
  `select ... from reservas where fecha_salida >= :desde and fecha_entrada <= :hasta
   and estado not in ('cancelada','no_show')` + join chalets/huespedes.
- Ordenar filas por `chalets.orden_display`. Realtime de Supabase opcional (fase 2);
  refetch al navegar es suficiente para arrancar.

### D3. QA

- Reserva que cruza el borde de la ventana visible se dibuja recortada correctamente.
- Bloqueos se distinguen visualmente de cortesías y reservas.
- Rol `ventas`: ve calendario y bloqueos, puede crear bloqueo, no ve funciones de admin.

---

## Orden de ejecución sugerido

| # | Entrega | Frente | Riesgo |
|---|---|---|---|
| 1 | Índice único + CTE idempotente + rama `ya_existia` + prompt | A | Bajo (MCP-safe) |
| 2 | Migración `origen='bloqueo'` + huésped sistema + UPDATE 1054/1055 | C1 | Medio (datos prod, pedir "adelante") |
| 3 | Formulario de bloqueos en app + RLS | C2–C3 | Bajo |
| 4 | Tool `ayuda_llegada` + assets + registro en Agente Estancia | B | Medio (verificar credenciales Estancia) |
| 5 | Calendario maestro | D | Bajo (solo frontend + query) |
| 6 | Alinear tool de staff a `origen='bloqueo'` | C4 | Bajo |

Prerrequisito del frente B: **D4ny entrega el video** (revisar peso ≤16 MB antes de subir).

## Pendientes que este plan NO cubre (seguimiento aparte)

- Onboarding real de Valentina al protocolo de respuesta por folio (hoy 0/9 respondidas).
- Guards de regex de teléfono en crons Recordatorio Llegada/Salida (edición en UI n8n).
- DDL pendiente de caseta (`notificar_caseta_llegada_hoy` + trigger).
