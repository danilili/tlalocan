# Plan de trabajo — Correcciones tras semana 1 (versión para D4ny)

> **Para qué sirve este documento:** seguir el avance sin meterte al detalle técnico. Qué se va a hacer, en qué orden, qué decisiones de negocio quedan abiertas, y qué tienes que validar tú antes de que cada bloque arranque.
> **El documento técnico paralelo** (`PLAN-CODE-...`) tiene el detalle de implementación.

---

## El hilo conductor

Tus 8 temas no son 8 tareas sueltas. El problema dominante que los amarra: **el sistema se diseñó directo-primero y la realidad llegó Airbnb-primero.** De ahí salen casi todas las prioridades altas: capturar el WhatsApp del huésped Airbnb, hacer que las reservas directas aparten fechas en Airbnb, identificar al huésped por su código.

Y aparece un concepto que ahora cruza todo: **"el origen del huésped"** (plataforma / referido / cortesía / personal) toca cinco cosas a la vez — el dropdown de reservas, el contexto de Tlali, la etiqueta de WhatsApp, qué precio se aplica, y qué hereda una extensión. Por eso lo definimos **una sola vez** en un lugar canónico. Si no, terminarías con cinco definiciones distintas de "referido".

---

## Tus 8 decisiones (ya cerradas)

| # | Tema | Lo que decidiste |
|---|---|---|
| 1 | Mensajería a huéspedes Airbnb | Plan B: mensajes programados nativos de Airbnb (la API directa no se puede). Tapa el hueco crítico sin código. |
| 2 | Simuladora de precios | Mostrar el precio cerrado como número principal. **Prioridad baja.** |
| 3 | Notas de voz | Se construye y prueba en un duplicado; **tú haces el merge final desde la UI** |
| 4 | Extensión de estadía | Reserva nueva ligada (no se toca la original), a precio directo. **No prioritario.** |
| 5 | Contactos | Separar "contactos" de "huéspedes". El contacto se crea al **reservar**, no al escribir. |
| 6 | Etiquetas WhatsApp | Se crean a mano en WhatsApp Business; Evolution las asigna. Verificación corta. |
| 7 | Pausa de Tlali | Apagado global, se reactiva solo por tiempo, respondes desde WhatsApp normal |
| 8 | Reporte de ingresos | Completo: lo facturado vs. lo que realmente recibes, por canal |

---

## Orden de trabajo y por qué

No vamos en el orden del documento, sino por dependencia y riesgo:

### Primero — lo que sale ya, sin riesgo (y tapa el hueco crítico)
- **Concisión de Tlali:** que mande mensajes más breves, en 2–3 envíos, y responda solo a lo que le preguntan. Es ajuste de texto, cero riesgo.
- **Calendario público de Google:** vista de solo lectura de todas las reservas. Se cuelga del iCal que ya existe.
- **Mensajes programados de Airbnb (plan B):** plantillas en tu panel de host que avisan al huésped "prefiere WhatsApp". **Esto cierra el hueco de la semana 1** (clientes con WhatsApp malo sin contacto). Lo configuras tú a mano, cero código.

### Segundo — la base de datos del origen y los contactos
Es la pieza fundacional. Define "el origen" una vez y crea la tabla de contactos separada. Todo lo demás se apoya aquí. **Esta es una de las dos decisiones que duelen si se cambian después** (es migración de esquema), por eso va temprano y con cuidado. Recuerda: el contacto se crea al **reservar**, no cuando alguien escribe.

### Tercero — que las reservas directas aparten en Airbnb (PRIORIDAD)
El "hoyo" de tu tabla. Hoy una reserva creada en la app **no** bloquea esas fechas en Airbnb → riesgo real de doble reserva. Es lo que más dinero puede costar. 

> **Importante:** aunque conectemos esto, **no quitamos la entrada manual de reservas.** El iCal del website es lento (minutos a una hora), así que para fechas muy próximas no protege. La captura manual sigue siendo tu red de seguridad. (Esto matiza lo que escribiste en el PDF de que "ya no hay motivo para ingresar manualmente".)

### Cuarto — contacto del huésped Airbnb (en dos fases, poco a poco)
El cimiento de tu futuro programa de lealtad. La **Fase 1** (tapar el hueco) ya la cubre el plan B de arriba. La **Fase 2**, incremental: crear el contacto de WhatsApp/Google al reservar con su etiqueta de color, validar si el número de Airbnb recibe WhatsApp, actualizarlo si consigues uno bueno, y darle a Tlali identificación por código de reserva. Esta parte la construimos por pasos porque es más compleja de lo que parece.

### Quinto — pausa de Tlali
Botón para apagar a Tlali y tomar tú la conversación. Se hace con una "bandera" en la base de datos, **sin tocar la conexión de WhatsApp** (para no repetir el dolor del 401 de la línea interna). Se reactiva solo tras el tiempo que elijas.

### Sexto — notas de voz
Que Tlali entienda audios. Tu diagnóstico técnico en el PDF era correcto. Se construye en un duplicado seguro y tú haces el ensamble final.

### Séptimo — orígenes de reserva (personal / cortesía / referido)
Más grande de lo que parece: no es solo cambiar el menú desplegable. Cada opción trae reglas (personal = $0 y solo admin; cortesía = precio libre; referido = precio directo + comisión a vendedor, que va como placeholder).

### Después (no urgentes)
- **Extensión de estadía:** que Tlali cotice cuando un huésped en curso quiere quedarse más noches. Camino B (reserva ligada). **No es prioridad ahora.**
- **Reporte de ingresos por rango:** hoy / 7 días / mes / rango manual, mostrando lo facturado **y** lo que realmente recibes, por canal.
- **Simuladora de precios:** la pestaña "interesantísima" que pediste. **Prioridad baja**, módulo independiente al final.

---

## Lo que ya resolviste (ronda 2026-06-28)

Estas validaciones ya quedaron cerradas. Las dejo registradas para memoria:

- **Comisión del vendedor:** será un porcentaje fijo. Por ahora va como **placeholder** (un campo configurable que llenas cuando lo definas). No frena nada.
- **Mensajería Airbnb:** confirmado que **no se puede automatizar por API** (Airbnb solo da acceso a partners grandes). Vamos con el **plan B: mensajes programados nativos de Airbnb** — plantillas que configuras una vez en tu panel de host y se mandan solas a cada reserva, avisando "prefiere WhatsApp". Esto **tapa el hueco crítico** de la semana 1 (clientes con WhatsApp malo que quedaban sin contacto por ningún lado), sin código.
- **Etiquetas de WhatsApp:** confirmaste que se crean a mano en WhatsApp Business y Evolution las asigna. Eso simplifica la verificación.
- **Inconsistencia de precios:** aclarada — es solo el redondeo (±$99). El comportamiento de Tlali (tarifa → impuestos → redondea) es correcto. La simuladora mostrará el precio cerrado como número real.
- **Simuladora:** prioridad baja, proyecto independiente. No bloquea nada.
- **Contactos:** el contacto se crea al hacer una reserva (aunque esté pendiente de pago), no cuando alguien escribe. El de WhatsApp/Google es además del de Supabase.
- **Extensión de estadía:** camino B (reserva ligada), y no es prioridad ahora.

## Lo que aún tienes que validar / autorizar

Quedan pocas cosas, y ninguna frena el arranque:

### 1. Verificaciones técnicas que hago yo (te aviso cuando lleguemos)
- **Código Airbnb:** confirmaste que está guardado en Supabase; solo verifico en qué campo y formato, antes de construir la identificación por código.
- **Etiquetas:** verifico (~30 min) que Evolution pueda asignar una etiqueta que tú ya creaste en WhatsApp Business.
- **Contacto en Google:** verifico cómo se crea el contacto en tu libreta de Google (vía Evolution o vía Google directamente).

### 2. El hueco crítico de la semana 1 — cómo queda cubierto
El problema que detectaste (número de WhatsApp malo = sin mensaje ni por WhatsApp ni por Airbnb) se cierra con el **plan B de Airbnb** desde el arranque. Lo importante, como dijiste, es atender clientes en todos los frentes: el plan B garantiza eso ya, y la parte más fina (validar y actualizar el número de Airbnb) la construimos poco a poco, en una segunda fase, sin que el hueco siga abierto mientras tanto.

---

## Las dos decisiones que duelen si cambias de opinión

Casi todo es reversible barato. Estas dos no, porque son cambios de estructura de la base de datos:

- **Separar contactos de huéspedes** (decisión 5). Si después prefieres mezclarlos, es una migración dolorosa.
- **Extensión como reserva nueva ligada** (decisión 4). El modelo de cómo se ligan las reservas es difícil de revertir.

Si en algún momento dudas, que sea en estas dos donde te detengas a pensar antes de que arranquen.

---

## Valor de venta para Esteban (lo que sale "gratis" de esto)

Tres de estos bloques refuerzan tu pitch a Paso del Ciervo sin trabajo extra:
- **Reporte de ingresos por canal:** "ve exactamente qué te deja cada canal en el periodo que quieras".
- **Simuladora de precios:** mismo argumento, proyectando hacia adelante.
- **Pausa de Tlali + toma de control humano:** muestra que el sistema no es una caja negra; la operación manda cuando quiere.

---

## Resumen en una línea

Arrancamos por lo que no tiene riesgo y tapa el hueco crítico (concisión de Tlali, calendario Google, **mensajes programados de Airbnb**), luego la base de datos del origen/contactos, luego cerramos el hoyo de overbooking con Beds24, y de ahí seguimos. La extensión de estadía y la simuladora quedan para después (no urgentes). Casi todas tus validaciones ya están resueltas; lo que queda son verificaciones técnicas cortas que hago yo sobre la marcha.
