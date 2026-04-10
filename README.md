# Tlalocan Chalets — Panel de Control (Demo)

Dashboard de administración para Tlalocan Chalets, Mazamitla.  
**Este es un frontend de demostración con datos hardcodeados** — no tiene conexiones a backend ni APIs.

## Deploy rápido en Vercel

### Opción 1: Desde GitHub (recomendado)

1. Sube este folder a un repo de GitHub
2. Ve a [vercel.com](https://vercel.com) y haz login
3. Click "New Project" → importa el repo
4. Vercel detecta Vite automáticamente → click "Deploy"
5. Listo — te da una URL tipo `tlalocan-dashboard.vercel.app`

### Opción 2: Desde terminal con Vercel CLI

```bash
npm install
npx vercel
```

Sigue las instrucciones — selecciona las opciones default.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`

## Estructura

```
├── index.html          # Entry point con Google Fonts
├── public/
│   └── favicon.svg     # Favicon con T dorada
├── src/
│   ├── main.jsx        # React mount
│   ├── index.css       # Reset + global styles
│   └── App.jsx         # Dashboard completo (componente único)
├── package.json
└── vite.config.js
```

## Stack

- **Vite** — build tool
- **React 18** — UI
- **Recharts** — gráficas
- **Cormorant Garamond** — tipografía display (marca)
- **DM Sans** — tipografía body

## Datos de demo

Todos los datos son ficticios pero realistas para un negocio de cabañas en Mazamitla:
- 4 chalets con precios reales del sitio web
- Huéspedes con nombres inventados
- Ingresos, ocupación y gastos creíbles
- Staff de ejemplo

## Personalización

Para conectar a Supabase en el futuro, reemplazar los arrays hardcodeados
en `App.jsx` con llamadas a la API de Supabase usando `@supabase/supabase-js`.
