# Plan de Diseño — Gestión y Propagación de Precios (Tlalocan)

> Documento de diseño para ejecutar en Claude Code. NO es código; es el plan
> consensuado con decisiones cerradas. Estado: 2026-06-25.
> Stack: Supabase (fuente de verdad) → n8n (propagación) → Beds24/Airbnb + MotoPress/WordPress + Tlali.

---

## 0. Objetivo

Que el admin gestione precios desde la app (nueva pestaña), escribiendo en Supabase,
y que esos precios se propaguen a los 3 canales con sus reglas:
- **Tlali (WhatsApp):** lee Supabase en vivo (cero propagación).
- **Airbnb (vía Beds24):** push de calendario por API.
- **Website (MotoPress):** dos tarifas (reembolsable / no reembolsable).

Principio rector: **Supabase es SIEMPRE la autoridad.** Los canales obedecen; cambios
manuales en un canal serán sobrescritos por el siguiente push. (El equipo debe saber:
"los precios solo se tocan en la app, nunca en los canales".)

---

## 1. Modelo de datos — lo que YA existe (no rediseñar)

Tabla `tarifas` ya soporta:
- `chalet_id` nullable → NULL = tarifa GLOBAL (afecta los 4); uuid = específica de un chalet.
- `vigente_desde` / `vigente_hasta` → vigencia → TEMPORADAS (Navidad, vacaciones).
- `prioridad` (int) → resuelve qué tarifa gana cuando varias aplican.
- `precio_lun_jue` / `precio_vie_sab` / `precio_domingo` → entre semana / fin de semana.
- `iva_pct` (16), `impuesto_hospedaje_pct` (5).
- `descuento_directo_pct` → ver PUNTO ABIERTO #1 (reembolsable vs no reembolsable).
- `activa` (bool).

### Reglas de prioridad (DECIDIDO)
- Tarifa regular/global: prioridad baja (ej. 0). Espectro amplio 6-12 meses.
- Tarifa de temporada: prioridad ALTA (ej. 100). Sobrescribe a la regular en su rango de fechas.
- El "precio que gana" para un (chalet, fecha) = la tarifa activa, vigente en esa fecha,
  de mayor prioridad; desempate por especificidad (chalet específico > global) y por vigente_desde más reciente.

### Función única de resolución (CLAVE DE ARQUITECTURA)
- Debe existir UNA función `precio_del_dia(chalet_id, fecha, canal)` (o equivalente) que
  resuelva prioridad/vigencia y devuelva el precio que aplica ese día.
- Los TRES canales deben beber de la misma función, para no divergir.
- `calcular_estadia` (que ya usa Tlali) debe apoyarse en esta misma resolución.
- VERIFICAR en Code: que calcular_estadia respeta prioridad/vigencia correctamente hoy.

---

## 2. PUNTO ABIERTO #1 — Reembolsable vs No Reembolsable (resolver en Code antes de construir)

Hallazgo: lo que se modelaba como "descuento_directo_pct" (10% canal directo) en realidad
son DOS PRODUCTOS TARIFARIOS distintos:
- **Tarifa reembolsable** (más cara, cancelable).
- **Tarifa no reembolsable** (más barata, sin cancelación).

Decisión de diseño pendiente (evaluar en Code):
- ¿Dos columnas de precio explícitas (precio_reembolsable / precio_no_reembolsable)?
- ¿O mantener un precio base + un pct para derivar la otra?
- Impacto en: calcular_estadia, lo que cotiza Tlali, lo que se empuja a Airbnb, y los dos rates de MotoPress.
- Reconciliar con el uso actual de descuento_directo_pct (hoy = 10% en los 4 chalets) para no romper Tlali.

---

## 3. UI — Nueva pestaña "Precios" (app React/Vite)

Tres bloques:
1. **Precio global** (entre semana / fin de semana) → escribe fila con chalet_id NULL, prioridad base.
2. **Precio por chalet** → override individual (4 filas con chalet_id), prioridad base.
3. **Temporadas** → crear / ver / editar tarifas con vigente_desde/hasta y prioridad ALTA.
   - Listado de temporadas activas con su rango y precio.
   - Crear nueva (nombre, rango de fechas, precios, ¿global o por chalet?).

Consideraciones UI:
- Mostrar qué precio resuelve para una fecha dada (preview), para que el admin vea el efecto de prioridades.
- Validar solapamientos de temporada (avisar, no necesariamente bloquear).
- super_admin UID: 1f49c8ef-ac7f-4195-bf20-7f3c83f5c880.

---

## 4. Motor de propagación — n8n (DECIDIDO: Opción B)

La app SOLO escribe en Supabase. Un workflow n8n "Propagar Precios" hace los push.
Razón: reusa credenciales (Evolution, Beds24), desacopla la app de los canales, reintentos viven en n8n.

### Disparo
- App guarda cambio en `tarifas` → dispara webhook a n8n (o n8n hace polling/trigger).
- Evaluar: webhook directo desde la app vs trigger de Supabase (DB webhook) → n8n.

### Canal 1: Tlali — NADA que hacer
- Tlali llama calcular_estadia que lee tarifas en vivo. Al cambiar tarifas, ya queda actualizado.

### Canal 2: Airbnb / Beds24 — push de calendario
- Horizonte: empujar 6-12 meses a futuro por bloques (DECIDIDO).
- Por cada chalet: resolver precio_del_dia para cada día del horizonte → generar payload
  POST /inventory/rooms/calendar (agrupar días de igual precio en bloques, "to" inclusivo).
- Requiere: renovación automática del access token Beds24 (cachear ~23h con el refreshToken).
- Idempotente: re-empujar el mismo precio no debe causar problemas (ya validado: modified vacío si igual).
- Mapear: usar beds24_room_id de cada chalet (ya en tabla chalets).
- IMPORTANTE: para Airbnb se empuja el precio que corresponda (definir si es el reembolsable
  o una tarifa Airbnb-específica; Airbnb maneja sus propias políticas de cancelación). Resolver con PUNTO ABIERTO #1.

### Canal 3: Website / MotoPress — PUNTO ABIERTO #2 (requiere SPIKE en Code)
- MotoPress NO tiene una API de precios tan clara como Beds24. Sus precios viven en
  estructuras internas de WordPress (rates + seasons del plugin Hotel Booking).
- Caminos a investigar (spike, no comprometido):
  1. API REST de WordPress/MotoPress: ¿expone endpoints para crear/editar rates y seasons?
  2. Conector `dani` (WordPress MCP): ¿alcanza las estructuras de MotoPress?
  3. Escritura directa en BD de WordPress (postmeta/tablas MotoPress): más frágil.
  4. Alternativa: configurar reembolsable/no-reembolsable UNA VEZ en MotoPress como dos
     "rates", y solo sincronizar los montos base por temporada.
- Modelo de precio en el sitio (DECIDIDO):
  - Tarifa ALTA = "reembolsable" (cancelable).
  - Tarifa BAJA = "no reembolsable".
  - Mostrar ambas al cliente como dos opciones de tarifa.
- ENTREGABLE DEL SPIKE: determinar el mecanismo viable de escritura de precios en MotoPress
  antes de comprometer la implementación de este canal.

---

## 5. Orden de ejecución sugerido (Code)

Principio: lo conocido y de bajo riesgo primero; WordPress/MotoPress AL FINAL (es lo más
incierto y NO debe bloquear el resto).

**FASE 1 — Fundamentos**
1. Resolver PUNTO ABIERTO #1 (modelo reembolsable/no-reembolsable) — afecta todo lo demás.
2. Asegurar/ajustar la función única precio_del_dia + verificar calcular_estadia respeta prioridades.

**FASE 2 — UI y canal Tlali (validable sin tocar canales externos)**
3. UI de precios (pestaña) escribiendo en tarifas.
   - Al terminar esto, Tlali YA refleja cambios (lee en vivo). Canal Tlali = listo, sin trabajo extra.

**FASE 3 — Propagación a Airbnb/Beds24 (API conocida, ya ensayada a mano)**
4. Workflow n8n de propagación a Beds24 + renovación automática de token.
5. Disparo app→n8n (webhook o DB trigger de Supabase).
   - Al terminar esto: app → Supabase → Tlali + Airbnb funcionando de punta a punta.

**FASE 4 — WordPress / MotoPress (ÚLTIMA, incierta, requiere investigación)**
6. SPIKE MotoPress (PUNTO ABIERTO #2): investigar el mecanismo viable de escritura de precios
   (API REST WP/MotoPress, conector dani, escritura directa en BD, o config única de rates).
7. Según hallazgo del spike: implementar el canal website (dos tarifas reembolsable/no-reembolsable)
   y construir cómo WordPress escucha/recibe los cambios de precio.
   - Esta fase es la última a propósito: si se complica o se difiere, las otras 3 ya entregan valor.

Validación incremental (estilo Daniel): cada fase verificable antes de la siguiente.
Tlali primero (gratis), Beds24 segundo (ensayado), MotoPress al final (incierto y aislado).

---

## 6. Riesgos / notas
- Token Beds24 expira 24h: el workflow de propagación necesita renovarlo solo (cachear refreshToken).
- Actualizar workflows n8n vía MCP pierde credencial Evolution en nodos HTTP → reasignar manual.
- Supabase autoridad total: documentar que precios NO se tocan en los canales directamente.
- MotoPress sin tráfico no auto-sincroniza el iCal (separado de precios, pero misma lógica de "necesita disparo").
- Empujar 12 meses × 4 chalets = volumen; usar agrupación por bloques de Beds24.
