# Tlalocan Chalets — Panel de Control

Dashboard de administración para Tlalocan Chalets (Mazamitla). Frontend React + Vite, backend Supabase (proyecto `Tlalocan`, ref `spnqatgiopfjczqwlzms`).

Plan general en [PLAN.md](PLAN.md). Instrucciones de la fase actual en [FASE-2.md](FASE-2.md).

## Stack

- **Vite** + **React 18** (JSX, sin TypeScript)
- **react-router-dom** para navegación
- **@supabase/supabase-js** (auth, queries, Storage, Realtime)
- **recharts** para gráficas
- **date-fns** para fechas
- **Cormorant Garamond** + **DM Sans** (Google Fonts)

## Desarrollo local

```bash
npm install
cp .env.example .env.local
# editar .env.local con las credenciales del proyecto Supabase
npm run dev
```

Abre `http://localhost:5173`.

### Variables de entorno (`.env.local`)

```bash
VITE_SUPABASE_URL=https://spnqatgiopfjczqwlzms.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>

# Webhooks de n8n — vacíos hasta Fase 3
VITE_N8N_WEBHOOK_NUEVA_RESERVA=
VITE_N8N_WEBHOOK_VALIDACION_PAGO=
```

`.env.local` está en `.gitignore` — nunca commitear.

## Estructura

```
src/
├── App.jsx                 # router (BrowserRouter + Routes)
├── main.jsx
├── index.css
├── lib/
│   ├── supabase.js         # cliente singleton
│   ├── design-tokens.js    # paleta T (oro/oscuro/etc.)
│   ├── branding.config.js  # nombre, contacto, flags por tenant
│   └── format.js           # formatMoney, formatDate, normalizePhone
├── components/             # Card, MetricCard, Modal, FadeIn, badges/, NotificationBell, RequireRole
├── tabs/                   # ResumenTab, ReservasTab, HuespedesTab, StaffTab, ChaletsTab, ConfigTab
├── forms/                  # NuevaReservaForm, ValidarPagoForm, EditarChaletForm
├── hooks/                  # useAuth, useRol, useChalets, useReservas, useHuespedes, useTareas, useConfig, useNotificaciones
└── pages/
    ├── LoginPage.jsx
    └── DashboardPage.jsx
```

Convenciones: idioma del código en inglés (variables, comentarios técnicos), idioma de UI en español. Sin barrel files. Componentes pequeños (objetivo ≤ 200 líneas por archivo).

## Setup inicial del backend

Las migraciones de Supabase están en [supabase/migrations/](supabase/migrations/) (0001 a 0020) y ya se aplicaron en el proyecto remoto. Para un fork limpio o ambiente nuevo:

1. Aplicar migraciones (Supabase CLI o ejecutarlas manualmente en SQL Editor en orden numérico).
2. Ejecutar [supabase/seed.sql](supabase/seed.sql) para cargar `config`, la tarifa estándar y los 4 chalets.
3. Crear el primer super_admin **manualmente**:
   - En Supabase Auth → Users, agregar usuario con email `reservaciones@tlalocanchalets.mx`.
   - En SQL Editor:
     ```sql
     insert into public.usuarios (id, nombre, rol, telefono, activo)
     values (
       '<auth-user-uuid>',
       'Don Dani',
       'super_admin',
       '+523335702682',
       true
     );
     ```
4. **Activar Realtime** para la tabla `notificaciones`:
   - Database → Replication → publication `supabase_realtime` → toggle on para `notificaciones`.
   - Sin esto, la campana de notificaciones no recibe nuevos eventos en vivo.

## Roles y matriz de visibilidad

| Tab        | super_admin | admin           | ventas              |
|------------|:----------:|:---------------:|:-------------------:|
| Resumen    | ✅          | ✅              | ✅ sin montos       |
| Reservas   | ✅          | ✅ + validar pago | ✅ ver + crear pendiente |
| Huéspedes  | ✅          | ✅              | ✅                  |
| Staff      | ✅          | ✅              | ❌                  |
| Chalets    | ✅ CRUD     | ✅ lectura      | ❌                  |
| Config     | ✅          | ❌              | ❌                  |

La UI usa `<RequireRole>` y filtros por rol; la garantía real es RLS de Supabase (migraciones 0017–0019).

## Deploy a Vercel

1. Conectar el repo en [vercel.com](https://vercel.com) — Vercel detecta Vite automáticamente.
2. Definir las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Project Settings → Environment Variables.
3. `vercel.json` ya incluye los rewrites para que las rutas SPA funcionen (`/reservas`, `/chalets`, etc.) — sin él, esas rutas devolverían 404 al recargar.

## Troubleshooting

- **No puedo entrar al login:** confirma que el usuario exista tanto en `auth.users` como en `public.usuarios` con `activo = true`.
- **Una RLS policy bloquea algo que debería:** revisar `supabase/migrations/0017_*.sql` y `0018_*.sql`. La matriz de roles está ahí.
- **El cálculo de estadía da error:** probar manualmente con `select calcular_estadia('<chalet-id>'::uuid, '2026-06-15'::date, '2026-06-18'::date);`.
- **Realtime no llega:** verificar publication `supabase_realtime` (Database → Replication).
- **Comprobante no se ve en validar pago:** el bucket `comprobantes-pago` es privado; `ValidarPagoForm` genera signed URL automáticamente. Si falla, revisar políticas del bucket en Storage.

## Branches y flujo

- `main`: estado entregable (al cierre de cada fase).
- `fase-2-app`: trabajo de Fase 2 (esta entrega). PR a `main` al cerrar.
- Commits en español, formato `tipo: descripción` (`feat`, `fix`, `refactor`, `chore`, `docs`). Sin emojis.

## Estado del proyecto

- **Fase 1 (Supabase):** completada — esquema vivo en proyecto remoto.
- **Fase 2 (App de gestión):** en curso en `fase-2-app`.
- **Fases 3–5 (Agentes n8n + Evolution API):** pendientes.
- **Fase 6 (Pruebas E2E + entrega):** pendiente.

---

*Documentación viva. Actualizar cuando cambien decisiones.*
