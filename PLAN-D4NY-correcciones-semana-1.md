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
| 1 | Mensajería a huéspedes Airbnb | Explorar enviarles mensaje vía Beds24 (con verificación previa de que se puede) |
| 2 | Simuladora de precios | Mostrar el precio cerrado (lo que el huésped ve hoy) como número principal |
| 3 | Notas de voz | Se construye y prueba en un duplicado; **tú haces el merge final desde la UI** |
| 4 | Extensión de estadía | Reserva nueva ligada (no se toca la original), a precio directo |
| 5 | Contactos | Separar "contactos" (todos los que escriben) de "huéspedes" (con reserva) |
| 6 | Etiquetas WhatsApp | Condicionado: primero verificar si tu Evolution lo soporta |
| 7 | Pausa de Tlali | Apagado global, se reactiva solo por tiempo, respondes desde WhatsApp normal |
| 8 | Reporte de ingresos | Completo: lo facturado vs. lo que realmente recibes, por canal |

---

## Orden de trabajo y por qué

No vamos en el orden del documento, sino por dependencia y riesgo:

### Primero — lo que sale ya, sin riesgo
- **Concisión de Tlali:** que mande mensajes más breves, en 2–3 envíos, y responda solo a lo que le preguntan. Es ajuste de texto, cero riesgo.
- **Calendario público de Google:** vista de solo lectura de todas las reservas. Se cuelga del iCal que ya existe.

### Segundo — la base de datos del origen y los contactos
Es la pieza fundacional. Define "el origen" una vez y crea la tabla de contactos separada. Todo lo demás se apoya aquí. **Esta es una de las dos decisiones que duelen si se cambian después** (es migración de esquema), por eso va temprano y con cuidado.

### Tercero — que las reservas directas aparten en Airbnb (PRIORIDAD)
El "hoyo" de tu tabla. Hoy una reserva creada en la app **no** bloquea esas fechas en Airbnb → riesgo real de doble reserva. Es lo que más dinero puede costar. 

> **Importante:** aunque conectemos esto, **no quitamos la entrada manual de reservas.** El iCal del website es lento (minutos a una hora), así que para fechas muy próximas no protege. La captura manual sigue siendo tu red de seguridad. (Esto matiza lo que escribiste en el PDF de que "ya no hay motivo para ingresar manualmente".)

### Cuarto — capturar y validar el contacto del huésped Airbnb
El cimiento de tu futuro programa de lealtad. Incluye: verificar si el número que da Airbnb sí recibe WhatsApp, y darle a Tlali la capacidad de identificar a un huésped por su código de reserva Airbnb.

### Quinto — pausa de Tlali
Botón para apagar a Tlali y tomar tú la conversación. Se hace con una "bandera" en la base de datos, **sin tocar la conexión de WhatsApp** (para no repetir el dolor del 401 de la línea interna). Se reactiva solo tras el tiempo que elijas.

### Sexto — notas de voz
Que Tlali entienda audios. Tu diagnóstico técnico en el PDF era correcto. Se construye en un duplicado seguro y tú haces el ensamble final.

### Séptimo — orígenes de reserva (personal / cortesía / referido)
Más grande de lo que parece: no es solo cambiar el menú desplegable. Cada opción trae reglas (personal = $0 y solo admin; cortesía = precio libre; referido = precio directo + comisión a vendedor).

### Octavo — extensión de estadía
Que Tlali cotice cuando un huésped en curso quiere quedarse más noches.

### Noveno — reporte de ingresos por rango
Hoy / 7 días / mes / rango manual, mostrando lo facturado **y** lo que realmente recibes, por canal.

### Décimo — simuladora de precios
La pestaña "interesantísima" que pediste. Va al final porque depende de cerrar reglas de negocio.

---

## Lo que tienes que validar TÚ (gates y bloqueantes)

Estos son los puntos donde el trabajo se detiene a esperarte. Resolverlos pronto desbloquea bloques enteros.

### 1. Comisión del vendedor (referidos) — está en "??"
En tus tablas pusiste la comisión del vendedor como "??". Bloquea la parte de comisiones de **dos** bloques (orígenes de reserva y simuladora). El resto de "referido" (precio directo) puede avanzar sin esto, pero la comisión no. **Necesito que definas:** ¿es un % fijo, un monto, varía por vendedor? ¿Lo registras en algún lado hoy?

### 2. ¿Qué guarda tu sistema del código Airbnb?
Para que Tlali identifique a un huésped por su código de reserva (el `HMXXXX` que el huésped conoce), necesito confirmar si el campo `external_uid` guarda ese código legible o un número interno de Beds24 que el huésped no conoce. Es una verificación técnica que hago yo, pero te aviso por si tienes el dato a mano.

### 3. Dos verificaciones técnicas previas ("spikes")
- **Mensajería por Airbnb:** antes de prometer que podemos mandar mensajes a huéspedes vía Airbnb, verifico (30–60 min) si Beds24 lo permite. Si no, caemos al plan B (solo validar WhatsApp + contacto manual).
- **Etiquetas de WhatsApp:** tu Evolution **no** es WhatsApp Business oficial, así que las etiquetas pueden no estar disponibles o ser inestables. Verifico contra tu instancia antes de comprometerlo. Si no se puede, el origen vive solo en la base de datos.

### 4. Inconsistencia de precios a tener clara
Tus tablas del PDF muestran el impuesto (21%) **sumado encima** de la tarifa ($1,000 → $1,210). Pero tu sistema actual cobra **precio cerrado** con impuestos ya incluidos. No es un error, pero son dos formas distintas de mostrar lo mismo. Decidiste (bien) que la simuladora muestre el **precio cerrado** como número principal, y el desglose como detalle informativo. Solo para que lo tengas presente: el desglose es vista, no otra forma de cobrar.

### 5. El payout de la simuladora es un ESTIMADO
La simuladora calculará un "payout estimado" con porcentajes fijos. Ese número **no** es el payout real de Airbnb (que varía con/sin RFC y con promociones). El real ya lo sacas de los datos reales de Airbnb. Por eso la simuladora dirá "estimado" — es para proyectar y para vender a Esteban ("mira qué te deja cada canal"), no para conciliar.

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

Arrancamos por lo que no tiene riesgo (concisión de Tlali, calendario Google), luego la base de datos del origen/contactos, luego cerramos el hoyo de overbooking con Beds24, y de ahí seguimos hacia las capacidades nuevas. Tú desbloqueas: la comisión del vendedor, y autorizas los dos spikes cuando lleguemos.
