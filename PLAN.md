# Tlalocan — Plan de implementación (v2)

> Fuente de verdad del proyecto. Léelo antes de cualquier decisión técnica.
> Cotización aprobada: COT-2026-0042 · $50,000 MXN · 4 módulos.

---

## 0. Contexto del negocio

**Tlalocan** es un conjunto vacacional en Mazamitla con **4 chalets** para parejas (crecerá a 7; los otros 3 están en construcción).

Chalets actuales:
- De La Cima
- De La Cañada
- Del Fondo
- De La Entrada

Los 4 también se rentan en Airbnb (fuera del alcance de este proyecto).

**Tarifas vigentes (iguales para los 4):**

- Domingo a jueves: **$1,500 MXN/noche** (precio neto)
- Viernes y sábado: **$2,000 MXN/noche** (precio neto)

**Impuestos** (siempre se cobran, siempre se desglosan en cotización):

- IVA: **16%**
- Impuesto Estatal al Hospedaje: **5%**
- Total al huésped ≈ tarifa neta × 1.21

**Stakeholders:**

- **Don Dani** (propietario / Super Admin) — `333 570 2682` — `reservaciones@tlalocanchalets.mx`
- **Valentina** — promotora de Tlalocan (rol final por definir, probablemente Admin o Ventas)

**Sitio web:** [tlalocanchalets.mx](https://tlalocanchalets.mx) — WordPress con tema premium Luviana de MotoPress. Fuera de alcance la integración con tarifas, pero queda anotado para posibilidad futura.

**Operación:**

- Check-in: 3:00 pm
- Check-out: 12:00 pm
- WiFi (mismo password en los 4 chalets, podría diferenciarse en futuro): `Pasodelciervo2026`
- Código de chapa (mismo en los 4 chalets, podría diferenciarse en futuro): `2998`
- Acceso: por Paso del Ciervo, los huéspedes se identifican en la entrada del fraccionamiento.

---

## 1. Alcance (cotización aprobada)

| Módulo | Entregable | Peso | Monto |
|---|---|---|---|
| **M·01** | App de gestión — núcleo operativo | 40% | $20,000 |
| **M·02** | Agente 1 — Ventas y reservas | 20% | $10,000 |
| **M·03** | Agente 2 — Bienvenida y salida | 20% | $10,000 |
| **M·04** | Agente 3 — Coordinación de limpieza | 20% | $10,000 |

**Fuera de alcance:** integraciones Airbnb/Booking, facturación CFDI, pasarela de pagos, reportes avanzados, capacitación presencial, propagación de tarifas al sitio WordPress.

---

## 2. Estado actual

### 2.1 App (este repo)

Frontend React + Vite. **M·01 construido y desplegado** (Fase 2 cerrada — ver `FASE-2.md` §19–20). La demo hardcoded original (`src/App.jsx`, 584 líneas) se refactorizó en módulos (`tabs/`, `forms/`, `hooks/`, `components/`, `pages/`, `lib/`) y se conectó a Supabase: auth real, login, formulario de nueva reserva con `calcular_estadia`, validación de pago, notificaciones realtime y control por rol.

Tabs: Resumen · Reservas · Huéspedes · Chalets · Staff · Config (los 2 últimos solo super_admin).

Diseño: se conservó (tokens dorados/oscuros, Cormorant Garamond + DM Sans). **No rediseñar visualmente.**

Repo en GitHub (branch `fase-2-app`, pendiente PR → `main`). Desplegada en Vercel (`tlalocan.vercel.app`) con env vars configuradas. MCP de GitHub disponible para manejo de versiones.

**Pensar la app desde el inicio como producto fork-able**: en el futuro se podría revender a otros negocios de hospedaje similares. No multi-tenant — cada cliente sería su propio fork con su propia DB. Sin `tenant_id` en tablas. Branding configurable vía `branding.config.js`.

### 2.2 Supabase

**Don Dani ya creó el proyecto `Tlalocan` dedicado.** Empezamos limpio: nada de prefijos, ninguna tabla heredada. La tabla `cabanas` del proyecto Emi se ignora — aquí se llama `chalets` (palabra correcta del negocio).

### 2.3 n8n

Existe un workflow: `Tlalocan Concierge` (agente vendedor) con tools `cotizar_estadia` y `enviar_fotos_chalets`, ambos hardcoded. **Ya usa Redis como buffer de memoria** (recibe varios mensajes seguidos y los procesa como uno solo). Este patrón se replica obligatoriamente en los 3 agentes.

Filosofía: **muchos flujos pequeños, no uno gigantesco.** Más fácil de mantener y debuggear.

### 2.4 WhatsApp

Evolution API. **Una instancia por agente** (3 instancias totales: ventas, bienvenida, limpieza). Cada una con su propio número o número compartido si Evolution lo permite — verificar al construir M·03.

---

## 3. Esquema de datos — Supabase (proyecto Tlalocan)

Sin prefijos. RLS habilitada en TODAS las tablas desde el día uno. Por roles, no por tenant.

### 3.1 `chalets`

```sql
create table chalets (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null unique,        -- "De La Cima"
  slug                  text not null unique,        -- "de-la-cima"
  descripcion           text,
  capacidad             int default 2,
  fotos_url             text[] default '{}',         -- URLs de Supabase Storage
  ubicacion_maps        text,                        -- link de Google Maps
  instrucciones_llegada text,                        -- texto específico del chalet (override del default)
  codigo_chapa          text,                        -- override del global, null = usa el global
  wifi_password         text,                        -- override del global, null = usa el global
  activa                boolean default true,
  orden_display         int default 0,               -- para ordenar en la app
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);
```

**Carga inicial:** los 4 chalets con `codigo_chapa = null` y `wifi_password = null` (heredan del global). Las fotos se migran del WordPress actual a Supabase Storage (ver §3.10).

### 3.2 `tarifas`

Diseñada para soportar precio por chalet, temporadas, festivos — sin construir todo aún.

```sql
create table tarifas (
  id                       uuid primary key default gen_random_uuid(),
  chalet_id                uuid references chalets(id),  -- null = aplica a todos
  nombre                   text not null,                -- "Tarifa estándar 2026"
  vigente_desde            date not null,
  vigente_hasta            date,                         -- null = sin fin definido
  precio_lun_jue           numeric not null,             -- precio NETO sin impuestos
  precio_vie_sab           numeric not null,
  precio_domingo           numeric not null,             -- separado por flexibilidad futura
  iva_pct                  numeric not null default 16,
  impuesto_hospedaje_pct   numeric not null default 5,
  prioridad                int default 0,                -- mayor gana sobre menor
  activa                   boolean default true,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);
```

**Carga inicial (actualizada 2026-06-04 — una tarifa por chalet + una global de fallback):**

Cada chalet tiene su **propia tarifa** (override específico) aunque hoy compartan precio, para soportar promociones/precios por chalet sin migrar después. Se conserva además una tarifa global (`chalet_id = NULL`) como fallback. Todas con:
```
vigente_desde: 2026-01-01
vigente_hasta: NULL
precio_lun_jue: 2100        # dom–jue
precio_vie_sab: 2500        # vie–sáb
precio_domingo: 2100
iva_pct: 16
impuesto_hospedaje_pct: 5
prioridad: 0
```
- Por chalet: `nombre = "Tarifa <nombre chalet> 2026"`, `chalet_id = <chalet>`.
- Global: `nombre = "Tarifa estándar 2026"`, `chalet_id = NULL`.

Definición en `supabase/seed.sql` (secciones 2 y 4). Precios anteriores eran 1500/2000.

**Función SQL `calcular_estadia(chalet_id, fecha_entrada, fecha_salida)`:**

Devuelve:
```json
{
  "noches": 3,
  "desglose": [
    { "fecha": "2026-05-08", "dia_semana": "vie", "precio_neto": 2500 },
    { "fecha": "2026-05-09", "dia_semana": "sab", "precio_neto": 2500 },
    { "fecha": "2026-05-10", "dia_semana": "dom", "precio_neto": 2100 }
  ],
  "subtotal_neto": 7100,
  "iva": 1136,
  "impuesto_hospedaje": 355,
  "total": 8591,
  "tarifa_aplicada": "Tarifa De La Cima 2026"
}
```

**Lógica de resolución de tarifa** (en orden):
1. Tarifa con `chalet_id` específico que cubra la fecha → mayor `prioridad` gana.
2. Si no hay específica, tarifa con `chalet_id = NULL`.
3. Si la fecha no cae en ninguna tarifa, error explícito.

**Quien actualiza tarifas:** Super Admin desde la app. La actualización en DB se propaga automáticamente a los agentes (consultan en vivo). Propagación al sitio WordPress: fuera de alcance.

### 3.3 `huespedes`

```sql
create table huespedes (
  id                       uuid primary key default gen_random_uuid(),
  nombre                   text not null,
  apellidos                text,
  telefono                 text not null unique,    -- WhatsApp con código país, e.g. 5213335702682
  email                    text,
  notas                    text,                    -- preferencias, alergias, info general
  origen_inicial           text                     -- de dónde llegó la PRIMERA vez
                             check (origen_inicial in ('website','airbnb','booking','referido','whatsapp_directo','walk_in','otro')),
  total_noches             int default 0,           -- denormalizado, suma de noches de reservas completadas
  total_estancias          int default 0,           -- count de reservas completadas
  total_gastado            numeric default 0,       -- denormalizado
  primera_visita           date,
  ultima_visita            date,
  evaluacion_anfitrion     int                      -- 1 a 5, lo califica Don Dani / Admin
                             check (evaluacion_anfitrion between 1 and 5),
  evaluacion_notas         text,                    -- "muy limpio", "dejó la cocina hecha un desastre", etc.
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);
```

`total_noches`, `total_estancias`, `total_gastado`, `ultima_visita` se actualizan vía trigger cuando una reserva pasa a `completada`.

### 3.4 `reservas`

```sql
create table reservas (
  id                  uuid primary key default gen_random_uuid(),
  huesped_id          uuid not null references huespedes(id),
  chalet_id           uuid not null references chalets(id),
  fecha_entrada       date not null,
  fecha_salida        date not null,
  num_huespedes       int default 2,

  -- montos snapshot al momento de crear
  subtotal_neto       numeric not null,
  iva                 numeric not null,
  impuesto_hospedaje  numeric not null,
  monto_total         numeric not null,
  monto_pagado        numeric default 0,

  estado              text not null default 'pendiente_pago'
                        check (estado in (
                          'cotizada',          -- agente cotizó pero no se pagó
                          'pendiente_pago',    -- huésped pagó, falta validar comprobante
                          'confirmada',        -- pago validado por Admin/Super Admin
                          'en_curso',          -- huésped ya hizo check-in
                          'completada',        -- huésped salió
                          'cancelada',
                          'no_show'
                        )),

  origen              text default 'directa'
                        check (origen in ('directa','airbnb','booking','referido','agente_whatsapp','app_manual')),

  -- comprobante de pago
  comprobante_url     text,                    -- URL en Supabase Storage (subido por Agente 1)
  comprobante_subido_en timestamptz,
  validado_por        uuid references usuarios(id),
  validado_en         timestamptz,
  motivo_rechazo      text,                    -- si Admin rechaza el pago

  -- notas operativas
  notas               text,                    -- notas generales (las pone quien crea)
  notas_limpieza_post text,                    -- lo llena staff de limpieza vía Agente 3 al terminar aseo de salida

  -- override de claves por reserva (futuro)
  codigo_acceso_override text,

  -- auditoría
  creada_por          uuid references usuarios(id),  -- null si la creó el agente
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),

  -- evita doble booking
  exclude using gist (
    chalet_id with =,
    daterange(fecha_entrada, fecha_salida, '[)') with &&
  ) where (estado in ('confirmada','en_curso'))
);
```

**Notas:**

- La constraint `exclude` previene reservas solapadas en el mismo chalet, pero solo a partir de `confirmada`. `pendiente_pago` no bloquea — esto evita que un huésped que no termine de pagar bloquee fechas. Riesgo: dos huéspedes podrían pagar las mismas fechas. Mitigación: el Agente 1 verifica disponibilidad **incluyendo** `pendiente_pago` antes de cotizar; si hay otra `pendiente_pago` activa, avisa al humano.
- `notas_limpieza_post` alimenta `evaluacion_anfitrion` del huésped (manualmente por ahora).

### 3.5 `usuarios`

Extiende `auth.users` de Supabase con campos del negocio.

```sql
create table usuarios (
  id              uuid primary key references auth.users(id) on delete cascade,
  nombre          text not null,
  rol             text not null check (rol in ('super_admin','admin','ventas')),
  telefono        text,                          -- para notificaciones por WhatsApp si las agregamos
  avatar_url      text,
  activo          boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
```

**Roles y permisos** (se implementan vía RLS):

| Acción | Super Admin | Admin | Ventas |
|---|---|---|---|
| Ver todos los chalets | ✅ | ✅ | ✅ |
| Editar chalets | ✅ | ❌ | ❌ |
| Ver tarifas | ✅ | ✅ | ✅ |
| Editar tarifas | ✅ | ❌ | ❌ |
| Ver todas las reservas | ✅ | ✅ | ✅ |
| Crear reservas (`pendiente_pago` o `confirmada`) | ✅ | ✅ | ✅ (solo `pendiente_pago`) |
| Validar/rechazar pagos | ✅ | ✅ | ❌ |
| Ver/editar huéspedes | ✅ | ✅ | ✅ |
| Ver tareas de staff | ✅ | ✅ | ❌ |
| Asignar/editar tareas | ✅ | ✅ | ❌ |
| Ver métricas financieras | ✅ | ✅ | ❌ |
| Ver dashboard de ingresos | ✅ | ✅ | parcial (sin montos totales) |
| Crear/editar usuarios | ✅ | ❌ | ❌ |
| Editar staff | ✅ | ✅ | ❌ |

**Carga inicial:** un solo `super_admin` para Don Dani (`reservaciones@tlalocanchalets.mx`). Don Dani crea Admin y Ventas desde la app.

### 3.6 `staff`

```sql
create table staff (
  id              uuid primary key default gen_random_uuid(),
  puesto          text not null check (puesto in (
                    'encargada_limpieza',
                    'encargado_mantenimiento',
                    'otro'
                  )),
  nombre_visible  text,                          -- opcional: "Lupita" o vacío
  telefono        text not null unique,          -- WhatsApp del miembro
  activo          boolean default true,
  created_at      timestamptz default now()
);
```

> Nota: este modelo se basa en lo que sabemos hoy. Hay que pulirlo con Valentina (y con el comportamiento real del agente) antes de Fase 5.

### 3.7 `tareas`

```sql
create table tareas (
  id              uuid primary key default gen_random_uuid(),
  chalet_id       uuid not null references chalets(id),
  reserva_id      uuid references reservas(id),  -- null si es tarea ad-hoc
  staff_id        uuid references staff(id),     -- asignado automáticamente al crearse
  tipo            text not null check (tipo in (
                    'limpieza_salida',
                    'prep_llegada',
                    'mantenimiento',
                    'revision',
                    'otro'
                  )),
  titulo          text not null,
  descripcion     text,
  programada_para timestamptz not null,
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente','en_curso','completada','cancelada','rechazada')),
  iniciada_en     timestamptz,
  completada_en   timestamptz,
  notas_staff     text,                          -- lo que reporta el staff por WhatsApp
  foto_evidencia  text,                          -- URL en Supabase Storage de la foto que envía el staff
  validacion_visual_ok boolean,                  -- el agente analiza la foto y dice si está OK
  validacion_visual_notas text,                  -- "se ve limpio", "falta tender la cama", etc.
  created_at      timestamptz default now()
);
```

**Asignación automática** (se hace al insertar):
- `limpieza_salida`, `prep_llegada` → `encargada_limpieza` activa
- `mantenimiento`, `revision` → `encargado_mantenimiento` activo
- Si hay varias personas con el mismo puesto activo, round-robin o la primera. Refinar al momento.

### 3.8 `notificaciones`

```sql
create table notificaciones (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references usuarios(id),
  tipo            text not null check (tipo in (
                    'pago_pendiente_validar',
                    'reserva_nueva',
                    'tarea_asignada',
                    'tarea_completada',
                    'tarea_rechazada',
                    'huesped_pregunta',
                    'sistema'
                  )),
  titulo          text not null,
  mensaje         text not null,
  link_app        text,                          -- ruta interna, e.g. /reservas/abc-123
  leida           boolean default false,
  created_at      timestamptz default now()
);
```

Las notificaciones se reflejan en la app vía Supabase Realtime (sin polling). Email se manda en paralelo desde n8n para tipos críticos (`pago_pendiente_validar`, `reserva_nueva`).

### 3.9 `config`

Constantes del negocio en DB (no en código), para que Don Dani pueda editarlas sin tocar nada.

```sql
create table config (
  key         text primary key,
  value       text not null,
  descripcion text,
  updated_at  timestamptz default now()
);
```

**Carga inicial:**
```
checkin_hora              = "15:00"
checkout_hora             = "12:00"
wifi_password_global      = "Pasodelciervo2026"
codigo_chapa_global       = "2998"
telefono_super_admin      = "+523335702682"
email_reservaciones       = "reservaciones@tlalocanchalets.mx"
sitio_web                 = "https://tlalocanchalets.mx"
zona_horaria              = "America/Mexico_City"
hora_recordatorio_llegada = "10:00"   -- 24h antes del check-in
hora_recordatorio_salida  = "11:00"   -- día del check-out
```

### 3.10 Storage

Buckets de Supabase Storage:

- `chalets-fotos/` — público. Subdirectorios por slug del chalet (`de-la-cima/foto-1.jpg`).
- `comprobantes-pago/` — privado, acceso solo a Admin y Super Admin. Subdirectorios por reserva_id.
- `tareas-evidencia/` — privado, acceso a Admin y Super Admin. Subdirectorios por tarea_id.
- `avatars/` — público. Para usuarios y staff.

**Migración inicial de fotos:** las fotos actuales viven en URLs externas del WordPress. En Fase 1 se descargan y se suben a `chalets-fotos/`. Esto evita dependencia del sitio WordPress y permite a Don Dani gestionar fotos desde la app.

### 3.11 Triggers

1. **`reservas.estado → completada`** → recalcular `total_noches`, `total_estancias`, `total_gastado`, `ultima_visita`, `primera_visita` en `huespedes`.
2. **`reservas` insert** → auto-generar `tareas`:
   - `prep_llegada` programada para el día de entrada a las 11:00 am.
   - `limpieza_salida` programada para el día de salida a las 12:00 pm.
   - Sin `staff_id` — se asigna por trigger separado (siguiente).
3. **`tareas` insert** → asignación automática por puesto.
4. **`reservas.estado → pendiente_pago` con `comprobante_url not null`** → crea notificación tipo `pago_pendiente_validar` para todos los `super_admin` y `admin` activos.
5. **`reservas.estado → confirmada`** (validación de pago) → dispara webhook a Agente 2 (vía pg_net o desde la app).
6. **`updated_at`** automático en todas las tablas con esa columna.

### 3.12 RLS — políticas base

```sql
-- chalets: lectura todos los autenticados, escritura solo super_admin
create policy "chalets_read" on chalets for select
  using (auth.uid() in (select id from usuarios where activo = true));
create policy "chalets_write" on chalets for all
  using (auth.uid() in (select id from usuarios where rol = 'super_admin'));
```

(Patrón análogo para el resto, según matriz §3.5. Detalles en Fase 1.)

---

## 4. Fases de trabajo

### Fase 1 — Cimientos en Supabase

1. Crear todas las tablas: `chalets`, `tarifas`, `huespedes`, `reservas`, `usuarios`, `staff`, `tareas`, `notificaciones`, `config`.
2. Crear función `calcular_estadia()`.
3. Crear todos los triggers (§3.11).
4. Crear buckets de Storage y políticas.
5. Habilitar RLS con políticas por rol (§3.12).
6. Cargar `config` con valores iniciales.
7. Cargar `tarifas` con la tarifa estándar 2026.
8. Cargar los 4 chalets en `chalets`. Migrar fotos del WordPress a Supabase Storage.
9. Crear el primer usuario `super_admin` para Don Dani (manual desde Supabase Auth).
10. Cargar 1-2 reservas de prueba para validar todo el flujo.

**Entregable:** SQL en `supabase/migrations/0001_init.sql` (ejecutable en orden), seed en `supabase/seed.sql`.

### Fase 2 — App de gestión (M·01)

#### 2.1 Refactor estructural

```
src/
├── lib/
│   ├── supabase.js          # cliente
│   ├── design-tokens.js     # objeto T actual
│   └── branding.config.js   # nombre, logo, colores (para fork-ability)
├── components/
│   ├── Card.jsx
│   ├── MetricCard.jsx
│   ├── Modal.jsx
│   ├── badges/
│   ├── FadeIn.jsx
│   └── NotificationBell.jsx
├── tabs/
│   ├── ResumenTab.jsx
│   ├── ReservasTab.jsx
│   ├── HuespedesTab.jsx
│   ├── ChaletsTab.jsx       # NUEVO (solo super_admin)
│   ├── StaffTab.jsx
│   └── ConfigTab.jsx        # NUEVO (super_admin: tarifas, config, usuarios)
├── forms/
│   ├── NuevaReservaForm.jsx
│   ├── ValidarPagoForm.jsx
│   └── EditarTarifaForm.jsx
├── hooks/
│   ├── useAuth.js
│   ├── useRol.js
│   ├── useChalets.js
│   ├── useReservas.js
│   ├── useHuespedes.js
│   ├── useTareas.js
│   └── useNotificaciones.js
├── App.jsx                  # router + layout
└── main.jsx
```

#### 2.2 Auth y permisos

- Login real con Supabase Auth (email/password). Eliminar el "cualquier credencial funciona".
- Hook `useRol()` lee `usuarios.rol` del usuario logueado.
- Componente `<RequireRole roles={['super_admin','admin']}>...</RequireRole>` para esconder UI según rol.
- Tabs y botones se ocultan según rol (matriz §3.5). RLS es la garantía real, la UI es solo cortesía.

#### 2.3 Formulario "Nueva reserva"

Modal accesible desde tab Reservas (botón "+ Nueva reserva"). Campos:

- Nombre completo del huésped (autocomplete contra `huespedes` por teléfono)
- Teléfono WhatsApp (formato internacional, validado)
- Email (opcional)
- Origen (select: directa, airbnb, booking, referido, walk_in)
- Chalet (select con los 4 activos)
- Fecha entrada / fecha salida
- Núm. huéspedes (default 2)
- Notas (textarea)
- **Cálculo automático del costo** al elegir fechas + chalet (llama a `calcular_estadia`). Muestra desglose: subtotal neto, IVA, impuesto hospedaje, **total**.
- Validación: no permitir fechas que solapen con `confirmada`/`en_curso` en ese chalet. Avisar (no bloquear) si hay `pendiente_pago` en ese rango.
- **Estado al crear:**
  - Si la crea Super Admin/Admin → puede elegir `confirmada` o `pendiente_pago`.
  - Si la crea Ventas → solo `pendiente_pago`.
- Al guardar:
  1. Upsert en `huespedes` por teléfono.
  2. Insert en `reservas`.
  3. Si `confirmada` → trigger dispara webhook al Agente 2.
  4. Si `pendiente_pago` → notificación a Super Admin/Admin.

#### 2.4 Validación de pago

Cuando llega comprobante (subido por Agente 1, ver §4.3) o manualmente:

- Tab Reservas muestra badge "⏱ Pago pendiente" en reservas con estado `pendiente_pago` y `comprobante_url not null`.
- Click → modal con foto del comprobante + botones "✓ Validar" y "✗ Rechazar".
- Validar → estado pasa a `confirmada`, registra `validado_por` y `validado_en`, dispara Agente 2.
- Rechazar → estado pasa a `cancelada`, registra `motivo_rechazo`, notifica al huésped vía Agente 1.

#### 2.5 Notificaciones

- Componente `<NotificationBell />` en el header con badge de no-leídas.
- Realtime de Supabase escucha cambios en `notificaciones` filtrado por `usuario_id`.
- Click en notificación → navega al `link_app` y marca como leída.
- En paralelo, n8n manda email a `reservaciones@tlalocanchalets.mx` para `pago_pendiente_validar` y `reserva_nueva` (configurar SMTP cuando llegue el momento).

#### 2.6 Tabs por rol

- **Resumen**: todos. Métricas filtradas por rol (Ventas no ve montos totales).
- **Reservas**: todos. Ventas no ve botones de validar pago.
- **Huéspedes**: todos.
- **Chalets**: super_admin (CRUD) + admin (lectura).
- **Staff**: super_admin + admin.
- **Config**: solo super_admin (tarifas, usuarios, constantes).

#### 2.7 Métricas reales

El tab Resumen reemplaza arrays hardcoded por queries a Supabase:
- Ingresos del mes: `sum(monto_total)` de reservas `completada` o `confirmada` con `fecha_entrada` en el mes.
- Ocupación: noches reservadas / noches disponibles totales (4 chalets × días del mes).
- # reservas: count del mes.
- % directas: count(`origen='directa'`) / count(total) del mes.

### Fase 3 — Agente 1: Ventas (M·02)

1. Inspeccionar workflow `Tlalocan Concierge` y replicar el patrón de Redis buffer de memoria como base para los demás agentes.
2. **Reemplazar `cotizar_estadia`**: ahora llama a `calcular_estadia()` en Supabase. Devuelve total con impuestos desglosados. El agente debe presentar al huésped: noches, subtotal, IVA, impuesto hospedaje, **total**.
3. **Reemplazar `enviar_fotos_chalets`**: query a `chalets.fotos_url`.
4. **Actualizar prompt** para mencionar los 4 chalets correctos y apoyarse en datos de Supabase.
5. **Tool nueva `verificar_disponibilidad(chalet_id, entrada, salida)`**: consulta `reservas`. Considera `confirmada`, `en_curso`, y `pendiente_pago` (esta última con aviso explícito).
6. **Tool nueva `crear_reserva_pendiente_pago(...)`**: cuando huésped acepta y dice que va a pagar, el agente crea reserva en estado `cotizada`. NO en `pendiente_pago` todavía — eso pasa cuando llega el comprobante.
7. **Tool nueva `procesar_comprobante_pago(reserva_id, media_url)`**:
   - El agente detecta cuando el huésped envía una imagen/PDF de comprobante.
   - Descarga el media de WhatsApp.
   - Sube a `comprobantes-pago/{reserva_id}/comprobante.{ext}` en Storage.
   - Actualiza la reserva: `comprobante_url`, `comprobante_subido_en`, estado → `pendiente_pago`.
   - El trigger §3.11.4 crea las notificaciones a Super Admin/Admin.
   - Responde al huésped: "Recibimos tu comprobante. En cuanto lo validemos te confirmamos por aquí."
8. **Tool nueva `notificar_validacion(reserva_id, validada: bool, motivo?)`**: la app llama esto al validar/rechazar. El agente envía mensaje al huésped (confirmación o rechazo con motivo).
9. **Decisión: el agente NO crea reservas en estado `confirmada` directamente.** Siempre pasa por validación humana.

### Fase 4 — Agente 2: Bienvenida y estancia (M·03)

1. Webhook que recibe `reserva_id` cuando se confirma.
2. **Mensaje 1 (inmediato):** confirmación con datos del chalet, fechas, monto pagado, contacto Don Dani. Cordial pero conciso.
3. **Mensaje 2 (24h antes del check-in, hora configurable):**
   - Indicaciones de llegada: Paso del Ciervo, identificarse en entrada del fraccionamiento.
   - Link Google Maps del chalet (`chalets.ubicacion_maps`).
   - Check-in 3 pm, check-out 12 pm.
   - Código de chapa: `2998` (o el específico del chalet/reserva si está override).
   - WiFi: `Pasodelciervo2026` (o el específico).
4. **Mensaje 3 (día de salida, 11 am):** recordatorio de check-out, agradecimiento, invitación a volver. Pide opcionalmente reseña/foto.
5. **Acompañamiento durante estancia:** atiende preguntas del huésped:
   - WiFi, código, horarios.
   - **Recomendaciones de lugares cercanos** (restaurantes, atractivos de Mazamitla). Construir una base de "lugares recomendados" — puede ser tabla `recomendaciones_locales` simple o un texto largo en el prompt del agente. Decisión cuando lleguemos.
6. **Programación**: Schedule Trigger en n8n consultando reservas próximas. Patrón Redis igual que Agente 1.

### Fase 5 — Agente 3: Limpieza (M·04)

> Mucho de esto se va a refinar sobre la marcha. Validar con Valentina antes de empezar.

1. Cron diario revisa `tareas` con `programada_para` en próximos 2 días.
2. Asignación automática (ya hecha por trigger §3.11.3 al crearse la tarea).
3. Agente envía WhatsApp al staff: chalet, tipo, fecha/hora, instrucciones especiales.
4. Staff responde por WhatsApp:
   - "iniciada" → tarea pasa a `en_curso`, registra `iniciada_en`.
   - "lista" + foto → tarea pasa a `completada` provisionalmente, foto se sube a Storage.
     - **Validación visual con LLM multimodal**: el agente analiza la foto y verifica que efectivamente esté limpio/listo. Llena `validacion_visual_ok` y `validacion_visual_notas`.
     - Si OK → notifica a Don Dani con foto y resultado.
     - Si no OK → pide al staff corregir, no marca completada hasta que pase la validación. Si insiste o se rechaza varias veces, escala a Don Dani.
   - "no puedo" + razón → tarea pasa a `rechazada`, notifica a Don Dani.
5. La app refleja el estado en tiempo real (Realtime).

### Fase 6 — Pruebas E2E y entrega

1. Reservas de prueba que recorren los 3 agentes:
   - Cotización por WhatsApp → comprobante → validación → confirmación → check-in → check-out → limpieza con foto.
2. README actualizado + manual breve para Don Dani (PDF o Notion, a definir).
3. Manual breve para Valentina y futuro usuario de Ventas.
4. Entrega de código fuente y accesos.
5. 30 días de correcciones sin costo (cláusula de la cotización).

---

## 5. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Proyecto Supabase | Nuevo proyecto `Tlalocan` (ya creado por Don Dani). Sin prefijos. |
| Nomenclatura | "chalets" (no "cabañas"). Idioma del código en inglés, UI y mensajes en español. |
| Tarifas | Iguales para los 4. Diseño preparado para precio por chalet, temporadas, festivos. |
| Impuestos | IVA 16% + Hospedaje 5%. Siempre cobrados, siempre desglosados al huésped. |
| WiFi | Una sola password (`Pasodelciervo2026`). Estructura preparada para diferenciación futura. |
| Código de chapa | Uno solo (`2998`). Estructura preparada para diferenciación futura. |
| App | Reutilizar repo y diseño actual. Refactorizar `App.jsx`. NO rediseñar visualmente. |
| App fork-ability | Camino (a): cada cliente fork del repo + su propio Supabase. Sin multi-tenancy. Branding configurable. |
| Login | Supabase Auth con email/password. |
| Roles | Super Admin, Admin, Ventas. RLS por rol. |
| Validación de pagos | Humana, desde la app. Reciben notificación: Super Admin + Admin. |
| Comprobante | Subido automáticamente por Agente 1 cuando huésped envía media. Don Dani/Admin valida desde app. |
| Notificaciones | Push (Realtime) + Email para tipos críticos. |
| Storage de fotos | Supabase Storage. Migrar fotos de WordPress en Fase 1. |
| Agente: arquitectura | Una instancia Evolution por agente. Flujos chicos y modulares en n8n. |
| Agente: memoria | Redis buffer de memoria obligatorio en los 3 agentes (patrón ya usado en el agente actual). |
| Agente 1 reservas | Solo cotiza, sube comprobante, marca `pendiente_pago`. No crea `confirmada`. |
| Agente 3 asignación | Automática según puesto. |
| Agente 3 fotos | Validación visual con LLM multimodal. |

---

## 6. Decisiones pendientes (no bloquean inicio)

1. **Recomendaciones locales para Agente 2:** ¿tabla en DB o lista larga en el prompt? Decidir al llegar a Fase 4.
2. **Round-robin vs primera-disponible** para asignación de tareas cuando hay varios staff con mismo puesto. Refinar al onboardear staff real.
3. **Rol exacto de Valentina** (Admin o Ventas). Decidir cuando empiece a usar la app.
4. **Una instancia Evolution por agente con números distintos, o número compartido**: verificar capacidades de Evolution al construir M·03.
5. **Manual de usuario:** PDF, Notion, o pantalla de ayuda dentro de la app. Decidir antes de Fase 6.
6. **Backup / export periódico:** Supabase tiene snapshots en planes pagos. Documentar política cuando se confirme el plan.
7. **SMTP para emails:** definir credenciales (Resend, SendGrid, Gmail SMTP, etc.) cuando lleguemos a Fase 2.6.

---

## 7. Variables de entorno

### App (`.env.local`)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_N8N_WEBHOOK_NUEVA_RESERVA=
VITE_N8N_WEBHOOK_VALIDACION_PAGO=
```

### n8n (credenciales por workflow)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (solo en n8n, NUNCA en la app)
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_VENTAS` / `_BIENVENIDA` / `_LIMPIEZA`
- `REDIS_URL` (ya disponible)
- `OPENAI_API_KEY` o `ANTHROPIC_API_KEY` (visión multimodal para Agente 3)
- `SMTP_*` (cuando se configure email)

> Las variables vencen cada 7 días y se actualizan periódicamente. No persistirlas en commits.

---

## 8. Cómo trabajar este plan en Claude Code

**Orden recomendado:**

1. Leer este archivo completo.
2. **Fase 1 (Supabase):** generar `supabase/migrations/0001_init.sql` con todas las tablas, índices, triggers, y la función `calcular_estadia`. Generar `supabase/seed.sql` con `config`, tarifa inicial, y los 4 chalets. Validar ejecutando contra el proyecto `Tlalocan`.
3. **Fase 2 (App):** refactorizar `src/App.jsx` en módulos. Commits granulares. Branch nueva, no main.
4. Esperar confirmación de Don Dani antes de tocar n8n (Fases 3-5).
5. Cualquier desviación de este plan se discute primero.

**Convenciones:**

- Idioma del código: inglés (variables, funciones, comentarios técnicos).
- Idioma de UI y mensajes a usuarios: español.
- Commits en español, formato `tipo: descripción` (`feat: formulario nueva reserva`).
- Sin emojis en commits ni en código.
- Sin `console.log` en commits a main.
- Branch por fase: `fase-1-supabase`, `fase-2-app`, etc. PR a main al cerrar fase.
- TypeScript opcional pero recomendado en archivos nuevos. Si se introduce, documentarlo aquí.

---

*Plan vivo. Actualizar cuando cambien decisiones.*
*v2 — Generado tras revisión de Don Dani.*
