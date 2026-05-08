# Fase 2 — Instrucciones para Claude Code

> Este archivo es la entrada operativa para Claude Code. Léelo completo antes de tocar archivos.
> El plan general está en `PLAN.md` — esto solo aterriza la Fase 2 (módulo M·01: App de gestión).
> La Fase 1 (Supabase) ya está aplicada y verificada. Esquema vivo en proyecto `Tlalocan` (ref `spnqatgiopfjczqwlzms`).

---

## 0. Contexto rápido

La app actual es un dashboard de demo en `src/App.jsx` (584 líneas, todo hardcoded). Tu trabajo es:

1. Refactorizarla en módulos.
2. Conectarla a Supabase (cliente + auth + queries reales).
3. Agregar el formulario de Nueva Reserva (lo central del módulo).
4. Agregar validación de pagos.
5. Agregar notificaciones en tiempo real.
6. Implementar control por rol (Super Admin / Admin / Ventas).
7. Mantener el diseño visual actual.

**No rediseñar.** Los tokens (`T`), tipografías y componentes visuales se conservan.

**Trabajar en branch `fase-2-app`, no en `main`.** Commits granulares con mensajes en español, formato `tipo: descripción`.

---

## 1. Credenciales y URLs

```
Proyecto Supabase:    Tlalocan
Project ref:          spnqatgiopfjczqwlzms
URL:                  https://spnqatgiopfjczqwlzms.supabase.co
Publishable key:      sb_publishable_txLSCvy-EYV658SF9YE0Bw_xJWT_Th4
Anon legacy key:      (también disponible, no usar para nuevos clientes — usar publishable)
```

**Variables de entorno** (`.env.local`, no commitear):

```bash
VITE_SUPABASE_URL=https://spnqatgiopfjczqwlzms.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_txLSCvy-EYV658SF9YE0Bw_xJWT_Th4

# Webhooks de n8n — pendientes hasta Fase 3, dejar vacíos por ahora
VITE_N8N_WEBHOOK_NUEVA_RESERVA=
VITE_N8N_WEBHOOK_VALIDACION_PAGO=
```

Agregar `.env.local` y `.env*.local` al `.gitignore`. Crear `.env.example` con los keys vacíos para documentar.

---

## 2. Stack y dependencias

Mantener: `react`, `react-dom`, `recharts`, `vite`.

**Agregar:**

```json
"@supabase/supabase-js": "^2.45.0",
"react-router-dom": "^6.26.0",
"date-fns": "^3.6.0"
```

`date-fns` para manejo de fechas (parse, format, comparar). Locale español.

**No agregar:** Tailwind, MUI, Chakra, axios, redux, zustand. Mantener el stack mínimo.

---

## 3. Estructura objetivo

Refactorizar en este árbol:

```
src/
├── lib/
│   ├── supabase.js          # cliente Supabase singleton
│   ├── design-tokens.js     # objeto T (extraer del App.jsx actual)
│   ├── branding.config.js   # nombre, logo, colores (para fork-ability futura)
│   └── format.js            # formatters: dinero MXN, fechas, telefonos
├── components/
│   ├── Card.jsx
│   ├── MetricCard.jsx
│   ├── Modal.jsx
│   ├── badges/
│   │   ├── StatusBadge.jsx       # badge para estado de reserva
│   │   ├── SourceBadge.jsx       # badge para origen
│   │   └── TaskBadge.jsx         # badge para tipo/estado de tarea
│   ├── FadeIn.jsx
│   ├── NotificationBell.jsx     # campanita en header con realtime
│   ├── RequireRole.jsx          # wrapper para visibilidad por rol
│   └── LoadingState.jsx         # estado de carga genérico
├── tabs/
│   ├── ResumenTab.jsx
│   ├── ReservasTab.jsx
│   ├── HuespedesTab.jsx
│   ├── ChaletsTab.jsx           # NUEVO — solo super_admin
│   ├── StaffTab.jsx
│   └── ConfigTab.jsx            # NUEVO — solo super_admin
├── forms/
│   ├── NuevaReservaForm.jsx
│   ├── ValidarPagoForm.jsx
│   └── EditarTarifaForm.jsx
├── hooks/
│   ├── useAuth.js               # sesión + logout
│   ├── useRol.js                # rol del usuario actual
│   ├── useChalets.js
│   ├── useReservas.js
│   ├── useHuespedes.js
│   ├── useTareas.js
│   ├── useNotificaciones.js
│   └── useConfig.js             # constantes del negocio
├── pages/
│   ├── LoginPage.jsx
│   └── DashboardPage.jsx        # layout principal con tabs
├── App.jsx                      # router (BrowserRouter + rutas)
└── main.jsx
```

Cada componente en su propio archivo. Sin barrel files (`index.js`) — más explícito. JSX, sin TypeScript.

---

## 4. Esquema y mapeo de datos

El esquema completo está en `supabase/migrations/0001_*.sql` a `0020_*.sql`. Datos seed en `supabase/seed.sql`.

**Tablas que la app usa:**

| Tabla | Quién lee | Quién escribe |
|---|---|---|
| `usuarios` | todos los autenticados | super_admin (CRUD), cada uno su propio registro |
| `chalets` | todos los autenticados | super_admin |
| `tarifas` | todos los autenticados | super_admin |
| `huespedes` | todos los autenticados | todos los autenticados (delete: admin/super) |
| `reservas` | todos los autenticados | admin/super_admin (insert también ventas con estado pendiente_pago/cotizada) |
| `staff` | admin/super_admin | admin/super_admin |
| `tareas` | admin/super_admin | admin/super_admin |
| `notificaciones` | el usuario destinatario | nadie directamente (las crean triggers); update solo para `leida` |
| `config` | todos los autenticados | super_admin |

**Función RPC importante:** `calcular_estadia(chalet_id uuid, fecha_entrada date, fecha_salida date)` devuelve JSONB con desglose de la estadía + impuestos. Llamar así desde la app:

```js
const { data, error } = await supabase.rpc('calcular_estadia', {
  p_chalet_id: chaletId,
  p_fecha_entrada: '2026-06-15',
  p_fecha_salida: '2026-06-18'
});
// data = { noches, desglose, subtotal_neto, iva, impuesto_hospedaje, total, ... }
```

**Las URLs de fotos ya están pobladas** en `chalets.fotos_url[]` apuntando a Supabase Storage. La app las consume directamente sin procesamiento.

---

## 5. Auth y roles

### Login

`LoginPage.jsx`: email + password. Llama a `supabase.auth.signInWithPassword(...)`. Sin "registro" público — los usuarios los crea el super_admin.

### Sesión

`useAuth()`:
- Lee la sesión de Supabase con `supabase.auth.getSession()` al montar.
- Suscribe a `onAuthStateChange` para mantenerse al día.
- Expone: `{ session, user, loading, signOut() }`.

Si no hay sesión, redirige a `/login`. Si hay sesión pero el `user.id` no existe en `public.usuarios` o `usuarios.activo = false`, hacer signOut y mostrar mensaje "Tu cuenta está desactivada. Contacta al administrador."

### Rol

`useRol()`:
- Una vez autenticado, lee `public.usuarios` filtrado por `id = user.id`.
- Cachea el rol mientras dure la sesión.
- Expone: `{ rol, nombre, telefono, avatarUrl, isLoading }` y helpers `isSuperAdmin`, `isAdmin`, `isVentas`.

### Visibilidad por rol

`<RequireRole roles={['super_admin','admin']}>...</RequireRole>` — esconde el children si el rol del usuario no está en la lista. Para uso en UI únicamente; la garantía real es RLS en Supabase.

### Matriz de visibilidad por tab

| Tab | super_admin | admin | ventas |
|---|---|---|---|
| Resumen | ✅ todo | ✅ todo | ✅ sin montos totales |
| Reservas | ✅ todo | ✅ todo (incluye validar pago) | ✅ ver + crear `pendiente_pago`, sin botón validar |
| Huéspedes | ✅ | ✅ | ✅ |
| Chalets | ✅ CRUD | ✅ solo lectura | ❌ oculto |
| Staff | ✅ | ✅ | ❌ oculto |
| Config | ✅ | ❌ oculto | ❌ oculto |

---

## 6. Refactor del App.jsx actual

El `App.jsx` actual tiene:

- Diseño visual completo en un objeto `T` (tokens) — extraer a `lib/design-tokens.js`.
- Login mock — reemplazar por `LoginPage.jsx` real.
- Tabs con datos hardcoded — extraer cada tab a su archivo y conectar a hooks.
- `Card`, `MetricCard`, badges — extraer a `components/`.
- Lógica de animaciones — `FadeIn` a `components/`.

Mantener fielmente: tipografías (Cormorant Garamond + DM Sans), paleta dorada/oscura, microinteracciones, espaciados.

---

## 7. Hooks de datos — patrón estándar

Cada hook expone `{ data, loading, error, refetch }` y usa `supabase.from(...)` directo. Sin librería de cache (sin React Query) por ahora — si crece, migramos.

Ejemplo `useChalets.js`:

```js
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useChalets({ activeOnly = true } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('chalets').select('*').order('orden_display');
    if (activeOnly) query = query.eq('activa', true);
    const { data, error } = await query;
    if (error) setError(error);
    else setData(data ?? []);
    setLoading(false);
  }, [activeOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
```

`useReservas` filtros por: rango de fechas, chalet, estado, huésped. `useHuespedes` busca por nombre/teléfono.

---

## 8. Formulario "Nueva reserva" — el componente más importante

Ubicación: `forms/NuevaReservaForm.jsx`. Se abre como modal desde tab Reservas con un botón `+ Nueva reserva`.

**Campos:**

1. **Huésped:**
   - Buscador por teléfono (con autocomplete contra `huespedes`).
   - Si encuentra → autocompleta nombre, apellidos, email.
   - Si no encuentra → muestra inputs vacíos para crear huésped nuevo (nombre, apellidos, email opcional, origen_inicial select).
2. **Chalet:** select con los 4 activos (de `useChalets`).
3. **Fechas:** entrada y salida. Validación: salida > entrada.
4. **Núm. huéspedes:** number, default 2.
5. **Notas:** textarea opcional.

**Cálculo automático del costo:** al cambiar chalet + fechas, llamar a `calcular_estadia` y mostrar:

```
3 noches  ·  vie $2,000  +  sáb $2,000  +  dom $1,500
─────────────────────────────────────
Subtotal               $5,500.00
IVA (16%)               $880.00
Impuesto hospedaje (5%) $275.00
─────────────────────────────────────
Total                  $6,655.00 MXN
```

**Validación de disponibilidad** antes de habilitar "Guardar":
- Query a `reservas` con: mismo `chalet_id`, fechas que solapen, estado in `('confirmada', 'en_curso')` → si hay match, deshabilitar guardar y mostrar "Fechas no disponibles".
- También chequear `pendiente_pago` en el rango → mostrar warning amarillo "Hay otra reserva pendiente de pago en estas fechas. Confirma con el huésped antes de proceder."

**Estado al crear** (depende del rol):
- super_admin / admin: select con opciones `pendiente_pago`, `confirmada`. Default `pendiente_pago`.
- ventas: estado fijo `pendiente_pago`, no muestra el select.

**Al guardar:**

1. Si huésped es nuevo, hacer `insert` en `huespedes`. Si ya existía, usar el id encontrado.
2. Llamar `calcular_estadia` para obtener montos snapshot.
3. `insert` en `reservas` con todos los datos + montos del cálculo.
4. Si la reserva queda `confirmada`, los triggers ya generan tareas automáticamente — la app no hace nada extra.
5. Si la reserva queda `pendiente_pago` (sin comprobante aún), no se notifica a nadie hasta que llegue el comprobante.
6. Cerrar modal y recargar lista de reservas.

---

## 9. Validación de pago

En tab Reservas, fila de reserva con `estado = pendiente_pago` y `comprobante_url != null` muestra badge dorado `⏱ Pago pendiente`.

Click → modal `ValidarPagoForm.jsx` con:

- Foto del comprobante (descargada del bucket privado vía signed URL — `supabase.storage.from('comprobantes-pago').createSignedUrl(...)`).
- Datos clave de la reserva (huésped, chalet, fechas, monto total).
- Botones:
  - **✓ Validar pago** → update reserva a `estado = 'confirmada'`, `validado_por = user.id`, `validado_en = now()`. Cierra modal y refresca.
  - **✗ Rechazar** → abre input de motivo, update a `estado = 'cancelada'`, `motivo_rechazo = ...`, `validado_por`, `validado_en`. Cierra y refresca.

Solo super_admin y admin ven y usan estos botones (RLS lo enforce; UI lo esconde para ventas).

---

## 10. Notificaciones realtime

`useNotificaciones()`:

1. Al montar, fetch inicial: `supabase.from('notificaciones').select('*').eq('usuario_id', user.id).order('created_at', { ascending: false }).limit(50)`.
2. Subscribe a Supabase Realtime:
   ```js
   supabase
     .channel('notif-channel')
     .on('postgres_changes', {
       event: 'INSERT',
       schema: 'public',
       table: 'notificaciones',
       filter: `usuario_id=eq.${user.id}`
     }, (payload) => {
       setNotificaciones(prev => [payload.new, ...prev]);
     })
     .subscribe();
   ```
3. `marcarComoLeida(id)` → update.
4. `unreadCount` derivado.

`<NotificationBell />` en el header: ícono campana con badge de count. Click abre dropdown con últimas 10. Click en notificación → `navigate(notif.link_app)` y marca como leída.

**Importante:** activar Realtime para la tabla `notificaciones` desde el dashboard de Supabase si no está activado (Database → Replication → publication `supabase_realtime`).

---

## 11. Tab Resumen — métricas reales

Reemplazar arrays hardcoded por queries:

- **Ingresos del mes:** `select sum(monto_total) from reservas where estado in ('completada','confirmada') and fecha_entrada between primer_día and último_día`.
- **Ocupación %:** `(noches reservadas en el mes) / (4 chalets × días del mes) × 100`.
- **# Reservas del mes:** count.
- **% Reservas directas:** count(`origen='directa'`) / count(total).

Ventas no ve los `monto_total` ni totales — su tarjeta muestra solo los counts y el % ocupación.

Las gráficas (`recharts`) se mantienen pero alimentadas con queries reales agrupadas por mes/origen.

---

## 12. Branding configurable

`lib/branding.config.js`:

```js
export const branding = {
  appName: 'Tlalocan',
  appTagline: 'Refugio sagrado para dos',
  supportEmail: 'reservaciones@tlalocanchalets.mx',
  supportPhone: '+52 333 570 2682',
  logo: { /* svg inline o url */ },
  colors: {
    bg: '#0d0e0a',
    fg: '#ece4d3',
    accent: '#c8a96a',
    // ...
  },
  showFinancialMetricsForVentas: false,
};
```

Cualquier referencia hardcoded a "Tlalocan" en componentes debe leer de aquí. Esto permite que un fork futuro cambie solo este archivo.

---

## 13. Convenciones

- **Idioma del código:** inglés (variables, funciones, comentarios técnicos).
- **Idioma de UI:** español (textos, labels, mensajes).
- **Commits:** español, formato `tipo: descripción`. Tipos: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`. Sin emojis.
- **Branch:** trabajar en `fase-2-app`, abrir PR a `main` al cerrar fase.
- **Sin `console.log`** en commits a main.
- **Sin TypeScript** por ahora — JSX puro.
- **Sin Tailwind** ni librerías de UI — mantener el sistema de tokens existente.
- **Componentes pequeños:** un componente por archivo. Si pasa de 200 líneas, partir.

---

## 14. Orden sugerido de commits

1. `chore: setup supabase client y env vars`
2. `chore: agregar dependencias supabase, router, date-fns`
3. `refactor: extraer design tokens a lib/design-tokens.js`
4. `refactor: extraer componentes Card, MetricCard, Modal, badges`
5. `feat: branding.config.js y references desde componentes`
6. `feat: auth real con supabase, login page, useAuth, useRol`
7. `refactor: convertir App.jsx en router; DashboardPage como layout`
8. `feat: useChalets, useHuespedes, useTareas, useConfig`
9. `feat: useReservas con filtros y refetch`
10. `feat: NuevaReservaForm con cálculo via calcular_estadia y validación disponibilidad`
11. `feat: tab Reservas conectado a datos reales`
12. `feat: ValidarPagoForm con comprobante en signed URL`
13. `feat: useNotificaciones con realtime + NotificationBell`
14. `feat: tab Resumen con métricas reales`
15. `feat: tab Huéspedes conectado`
16. `feat: tab Staff con tareas conectadas`
17. `feat: tab Chalets (super_admin) — CRUD básico`
18. `feat: tab Config (super_admin) — tarifas y constantes`
19. `feat: matriz de visibilidad por rol con RequireRole`
20. `docs: actualizar README con instrucciones de desarrollo`

---

## 15. Cosas explícitamente fuera de Fase 2

- Crear/editar tarifas con UI (super_admin las edita en Supabase Studio por ahora; solo lectura en la app — el módulo de edición es nice-to-have de fase posterior).
- Subir fotos nuevas de chalets desde la app (super_admin las sube en Supabase Storage manualmente).
- Cualquier integración con n8n (webhooks pendientes hasta Fase 3).
- Validación visual de tareas con LLM (es del Agente 3, Fase 5).
- Pasarela de pagos, facturación, integraciones Airbnb/Booking (fuera del alcance del proyecto entero).

---

## 16. Definition of Done para Fase 2

> **Estado actual: pruebas finales.** El smoke test local pasó en la mayoría de
> los flujos (ver §19). Falta deploy en Vercel y validación en producción
> antes de cerrar la fase.

Marcar la fase como cerrada cuando:

- [x] Todas las migraciones de `supabase/migrations/` se aplicaron en proyecto Tlalocan.
- [~] App refactorizada en archivos ≤ 200 líneas cada uno *(la mayoría sí; quedaron por encima los formularios y un par de tabs — ver §18.4)*.
- [x] Login real funcional con Supabase Auth *(verificado con super_admin y ventas reales en local)*.
- [x] Cada tab muestra datos reales de Supabase, no hardcoded.
- [x] Formulario nueva reserva: crea huésped + reserva con montos correctos via `calcular_estadia`.
- [x] Validación de disponibilidad antes de guardar *(ahora bloquea cualquier estado activo, no solo confirmada/en_curso)*.
- [x] Validación de pago: ver comprobante (signed URL) + validar/rechazar *(código verificado; pendiente flow E2E real cuando exista Agente 1 que suba comprobantes)*.
- [x] Notificaciones realtime funcionando con Supabase Realtime *(publication activada para `notificaciones`)*.
- [x] Visibilidad por rol en UI (RLS lo respalda en DB) *(verificado con cuenta `ventas` real)*.
- [ ] App desplegada en Vercel (`tlalocan.vercel.app`) con env vars configuradas.
- [ ] Smoke test E2E completo en producción: login super_admin → crear reserva → ver tareas auto-generadas → notificaciones realtime al cambio de estado.
- [ ] Validar SPA fallback en Vercel (navegar directo a `/reservas`, `/chalets`, etc.).
- [ ] PR de `fase-2-app` → `main` mergeado.

---

## 17. Si te trabas

- Si una RLS policy bloquea algo que no debería, revisar `supabase/migrations/0017_*.sql` y `0018_*.sql`.
- Si el cálculo de estadía da raro, probar manualmente con `select calcular_estadia(...)` en SQL Editor de Supabase.
- Si Realtime no llega, verificar que la tabla `notificaciones` esté en la publication `supabase_realtime` (Database → Replication).
- Si el comprobante no se ve, verificar que generes un signed URL — el bucket es privado.
- Cualquier cosa fuera del alcance documentado, parar y preguntarle a Don Dani antes de tomar decisiones grandes.

---

## 18. Estado al cierre de sesión — 2026-05-06

> Resumen para retomar la fase en una nueva sesión. La rama `fase-2-app` tiene 20 commits sobre `main`, `npm run build` pasa, nada se ha pusheado.

### 18.1 Trabajo completado (commits §14)

Los 20 commits del orden sugerido están aplicados, en este orden:

```
2abac57 chore: setup supabase client y env vars
2150158 chore: agregar dependencias supabase, router, date-fns
41174df refactor: extraer design tokens a lib/design-tokens.js
b2409ae refactor: extraer componentes Card, MetricCard, Modal, badges
6e735b4 feat: branding.config.js y references desde App.jsx
f4cb21b feat: auth real con supabase, login page, useAuth, useRol
bce4fc7 refactor: convertir App.jsx en router; DashboardPage como layout
504cd9d feat: useChalets, useHuespedes, useTareas, useConfig
39551d1 feat: useReservas con filtros y refetch
b70c366 feat: NuevaReservaForm con calcular_estadia y validacion
1d39031 feat: tab Reservas conectado a datos reales
ff7a6f0 feat: ValidarPagoForm con comprobante en signed URL
7c2ec2f feat: useNotificaciones realtime + NotificationBell
b5e6191 feat: tab Resumen con metricas reales
e1ec7b5 feat: tab Huespedes conectado a datos reales
6c8ed20 feat: tab Staff con tareas conectadas
95b152a feat: tab Chalets (super_admin) con CRUD basico
f5d53ff feat: tab Config con tarifas, constantes y usuarios
219548d feat: matriz de visibilidad por rol con RequireRole
f326bec docs: actualizar README con instrucciones de desarrollo
```

Adicionales fuera del §14:
- Commit en `main` previo (`8939b43`) que incorporó `PLAN.md`, `FASE-2.md`, `supabase/migrations/`, `seed.sql` y `.gitignore` al repo (el remoto solo tenía la demo).
- `vercel.json` con rewrites para SPA fallback (BrowserRouter rompe `/reservas`, `/chalets`, etc. sin esto en prod).

### 18.2 Pendiente manual (no es código — bloquea verificación E2E)

1. **Crear primer super_admin real** (Supabase Auth + insert en `public.usuarios`). Pasos exactos en `README.md` → "Setup inicial del backend".
2. **Activar Realtime para `notificaciones`**: Supabase Studio → Database → Replication → publication `supabase_realtime` → toggle on para la tabla. Sin esto, la campana no recibe inserts en vivo.
3. **Push de `fase-2-app` y abrir PR contra `main`**. Configurar env vars en Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) antes del deploy.
4. **Smoke test E2E** según §16.

### 18.3 Decisiones tomadas en la sesión que conviene revisar

- **Tabs como rutas (`/reservas`, `/chalets`, etc.) en lugar de state**: deep-linkable y más limpio, pero introduce dependencia de `vercel.json` para SPA fallback.
- **`StatusBadge` unificado** soporta tanto estados de chalet (legacy del Resumen — `occupied/available/cleaning`) como de reserva (`cotizada/pendiente_pago/...`). Si el chalet status decorativo del Resumen molesta, se puede separar.
- **`TaskBadge`** migrado a los estados reales del esquema (`pendiente/en_curso/completada/cancelada/rechazada`). Los keys del demo (`in_progress/pending/completed`) ya no se usan.
- **Calendario de abril** del demo en ReservasTab eliminado. Para volver a tenerlo habría que materializar día-a-día desde reservas; queda para iteración posterior.
- **Bloque "Gastos operativos"** del demo en StaffTab eliminado (no existe en el esquema).
- **`useAuth` y `useRol` sin Context Provider**: cada consumidor instancia su propio `onAuthStateChange`. Hoy son ~3-4 consumidores; aceptable. Si crece la app, pasar a Context.
- **Identidad del committer**: los 20 commits salieron como `Daniel Mendez <danielmendez@192.168.1.3>` porque `user.email` no estaba configurado globalmente. Si quieres que diga `dnl.mendez.a@gmail.com`, configura git y considera rebase para reescribir autores antes de pushear.

### 18.4 Decisiones pendientes para próxima sesión

Cosas que dejé abiertas o que el cliente quizá quiera redirigir:

1. **Archivos > 200 líneas** (la guía de §13 los pide ≤ 200):
   - `src/forms/NuevaReservaForm.jsx` — 352
   - `src/forms/ValidarPagoForm.jsx` — 315
   - `src/tabs/ResumenTab.jsx` — 275
   - `src/tabs/ConfigTab.jsx` — 240
   - `src/forms/EditarChaletForm.jsx` — 219
   - `src/pages/LoginPage.jsx` — 203

   Decisión: ¿partir (extraer subcomponentes / mover styles a constantes) o aceptar que los formularios son densos por naturaleza?

2. **Fotos de chalets**: §15 las dejó fuera de M·01 (super_admin las sube manual en Storage). El tab Chalets solo muestra el count. ¿Agregar uploader en una iteración corta antes de Fase 3, o respetar el alcance?

3. **Edición de tarifas con UI**: §15 también las dejó fuera. La pestaña Config solo muestra lectura. Mismo dilema.

4. **CRUD completo de usuarios**: hoy solo lectura. Crear nuevos usuarios sigue siendo manual (Auth dashboard + insert en `usuarios`). ¿Suficiente para Fase 2 o agregar formulario de invitación?

5. **`SourceBadge`**: solo distingue "airbnb" vs "Directo". El esquema tiene 6 valores de origen (`directa, airbnb, booking, referido, agente_whatsapp, app_manual`). ¿Mantener el binario o etiquetar cada uno?

6. **Calendario de reservas en tab Reservas**: dropeado en commit 11. Vista mensual con días ocupados/libres es valiosa visualmente — ¿restaurar como nice-to-have antes de cerrar Fase 2?

7. **Bundle size**: ~810 KB sin gzip (recharts + supabase + router). Vercel lo gzipea a ~225 KB. Con `manualChunks` se podría partir vendor para mejor caching. No urgente.

8. **Mobile responsive**: el diseño es responsivo en lo básico (flexWrap), pero no se validó en breakpoints chicos. Probar en 375px antes del E2E.

9. **Push y autoría**: ¿push directo a `fase-2-app` en GitHub y abrir PR, o quieres revisar localmente primero? Y la pregunta del committer email (§18.3) se decide aquí.

### 18.5 Cómo retomar

```bash
cd tlalocan-dashboard
git status                    # debe estar limpio en fase-2-app
git log main..fase-2-app      # los 20 commits del §14
npm install                   # si node_modules no está
cp .env.example .env.local    # si .env.local no existe
# editar .env.local con las credenciales
npm run dev
```

Para empezar la próxima sesión: leer §18.2–18.4 y decidir el orden de los pendientes con Don Dani.

---

## 19. Estado al cierre de sesión — 2026-05-08

> **Fase de pruebas finales.** Smoke test local ejecutado por Don Dani
> con super_admin (`reservaciones@tlalocanchalets.mx`) y ventas
> (`dnl.mendez.a@gmail.com`). La rama `fase-2-app` tiene 21 commits sobre
> `main`. Falta push, deploy en Vercel y validación E2E en producción.

### 19.1 Trabajo de esta sesión

Commit nuevo sobre el §14:

```
c5fc89c feat: arreglos y mejoras del smoke test de Fase 2
```

Bugs corregidos:

- **`useRol` race condition al login.** El check de `isInactive`
  disparaba `signOut` en el render entre `onAuthStateChange` seteando el
  `user` y el effect lanzando la query a `public.usuarios`. Ahora
  `isInactive` solo evalúa después de que la query haya completado para
  el `user.id` actual (`queriedUserId === user.id`). Sin esto, todos
  los logins terminaban en "Tu cuenta no está activa".
- **Default inválido de `huespedes.origen_inicial`.** El form usaba
  `'directa'` que no es valor válido del check constraint. Cambiado a
  `'whatsapp_directo'`.

Mejoras de UX:

- **Dropdown del avatar.** Antes el botón circular del header hacía
  `signOut` directo al click. Ahora abre un menú con nombre, email,
  rol y opción "Cerrar sesión". Click fuera lo cierra.
- **Columna chalet visible en lista de reservas.** Antes era subtítulo
  del huésped, ahora es columna propia con énfasis dorado.
- **Botón ✎ por reserva** (super_admin/admin) que abre un modal de
  edición.
- **Ventana de tareas en StaffTab** extendida de 7 a 30 días para que
  las tareas auto-generadas sean visibles desde la app sin esperar
  al día anterior al check-in.

Features:

- **`EditarReservaForm`** (nuevo, 351 líneas). Read-only: huésped y
  chalet. Editable: fechas, # huéspedes, notas, estado. Al cambiar
  fechas recalcula montos vía `calcular_estadia` y verifica
  disponibilidad excluyendo la propia reserva. Botón rojo "Eliminar
  reserva" con confirmación de dos clicks, solo visible para
  super_admin (RLS también lo enforce).
- **Select "Origen de la reserva"** en `NuevaReservaForm`. Sustituye
  el `'app_manual'` hardcoded anterior. Permite a ventas capturar
  el canal real de la reserva (Directa, Airbnb, Booking, Referido,
  Manual/App).
- **Bloqueo estricto de overlaps.** Antes solo bloqueaba
  `confirmada/en_curso` y mostraba warning amarillo permisivo para
  `pendiente_pago`. Ahora bloquea cualquier estado activo
  (`cotizada/pendiente_pago/confirmada/en_curso`). Esto evita el caso
  detectado en el smoke test donde dos reservas overlapeadas se podían
  crear si la primera era `pendiente_pago`.

Migraciones de DB aplicadas vía MCP (en proyecto Tlalocan, NO en este
repo bajo `supabase/migrations/`):

1. **`fix_usuarios_select_policy`** — `usuarios_select_authenticated`
   ahora usa `auth.uid() IS NOT NULL` en vez de la función helper
   `is_authenticated_user()`. Esto rompe el ciclo `SECURITY DEFINER +
   SET search_path` que hacía `auth.uid()` devolver NULL dentro del
   RLS check, bloqueando todos los logins.
2. **`fix_rls_helper_functions`** — `is_authenticated_user`,
   `is_super_admin`, `is_admin_or_super` reescritas como
   `SECURITY INVOKER` (sin `SET search_path`) para que `auth.uid()`
   funcione cuando se invocan desde políticas RLS de otras tablas
   (chalets, reservas, staff, tareas, etc.).
3. **`enable_realtime_notificaciones`** —
   `ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;`
   La campana ya recibe inserts en tiempo real.

> **TODO antes del cierre:** estas 3 migraciones se aplicaron a la DB
> productiva pero no están versionadas en `supabase/migrations/`.
> Hay que crear los archivos `0021_*.sql`, `0022_*.sql`, `0023_*.sql`
> con el SQL exacto para que un fork desde scratch reproduzca el
> estado actual.

### 19.2 Smoke test local — resultados

Ejecutado el 2026-05-08 con DB real, super_admin y ventas reales:

✅ Pasaron:
- Login (super_admin, ventas, cuenta inactiva, credenciales malas)
- Crear reserva (huésped nuevo y existente, cálculo correcto)
- Bloqueo de overlap (post-fix)
- `calcular_estadia` con fechas sin tarifa muestra error en breakdown
- Storage policies del bucket `comprobantes-pago` correctas
- Visibilidad por rol (ventas no ve Chalets/Config/Staff, no ve botón
  validar pago, no ve select de estado al crear reserva)
- Mobile responsive en 375px
- Validación de fechas inválidas (salida ≤ entrada)

🔄 No probados (requieren componentes de fases posteriores):
- Validar/Rechazar pago — requiere comprobante subido por Agente 1
  (Fase 3). El form existe y las policies funcionan.
- Notificaciones realtime al cambio de estado — requiere validar pago.
- SPA fallback en Vercel — requiere deploy.

### 19.3 Decisiones de esta sesión

- **`SourceBadge` queda binario** (Airbnb / Directo). Decisión §18.4 #5
  resuelta: priorizar simplicidad visual.
- **Tareas en StaffTab sin acciones manuales.** Las acciones (iniciar,
  completar con foto, rechazar) son alcance de Fase 5 con el Agente 3
  vía WhatsApp. Si se requiere acción manual desde la app, agregar
  después.
- **`useAuth + useRol` sin Context Provider** sigue aceptable. Conté
  ~6 usos de `useAuth` y ~9 de `useRol` (cada `useRol` instancia un
  `useAuth` interno). Genera ~6-8 suscripciones a `onAuthStateChange`
  pero no causa bug. Migrar a Context cuando crezca la app.

### 19.4 Próximos pasos

1. Push de `fase-2-app` a GitHub.
2. Deploy en Vercel (auto si el repo ya está conectado). Configurar
   env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Smoke test en producción contra `tlalocan.vercel.app`.
4. Validar SPA fallback (navegar directo a `/reservas`, `/chalets`).
5. Versionar las 3 migraciones de §19.1 como archivos en
   `supabase/migrations/`.
6. Abrir PR `fase-2-app` → `main` y mergear.

---

*Este archivo se mantiene actualizado durante la Fase 2. Al cerrar la fase, archivar y referenciar desde PLAN.md.*
