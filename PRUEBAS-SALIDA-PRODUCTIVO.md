# Pruebas de salida a productivo — Tlalocan

> Creado 2026-06-11 tras los cambios pre-lanzamiento (estrategia directo-primero,
> 4 chalets en venta, escalamiento a sitio web, captura de feedback).
> Todas las pruebas de WhatsApp se hacen escribiendo a la línea de ventas desde un
> número de prueba. Para probar como "huésped" el número debe tener reserva en la
> base; para probar como "prospecto", usar un número sin registro.

## A. Ventas — los 4 chalets en igualdad (cambio 2026-06-11)

- [ ] Prospecto pide fechas libres → Tlali presenta los chalets disponibles (no solo De La Cima) con su diferenciador de una línea.
- [ ] Prospecto indeciso entre chalets → Tlali pregunta qué busca (vista / privacidad / acceso) y sugiere acorde.
- [ ] Pedir fotos sin especificar chalet → Tlali elige según la conversación y manda máximo 2 chalets (ya no siempre Cima+Cañada).
- [ ] Pedir fotos de un chalet específico (ej. Del Fondo) → llegan las fotos correctas con caption del chalet.
- [ ] Repetir la prueba A1 en 2-3 conversaciones distintas → los chalets sugeridos varían (no siempre el mismo primero).
- [ ] Elegir un chalet y cotizar → `cotizar_estadia` recibe el slug correcto (verificar en ejecución n8n que `tarifa_aplicada` es la del chalet elegido).
- [ ] Fechas con un chalet ocupado (De La Cima 12–15 jun tiene reserva) → Tlali ofrece los otros 3 como alternativas.

## B. Escalamiento al sitio web (cambio 2026-06-11)

- [ ] Decir "solo estaba preguntando" → Tlali comparte www.tlalocanchalets.mx (URL sola en su línea), tono de recurso, no de despedida.
- [ ] Decir "lo voy a pensar" / "déjame consultarlo" tras una cotización → comparte el sitio y se mantiene disponible.
- [ ] Hacer muchas preguntas de detalle sin dar fechas → tras varios intercambios comparte el sitio.
- [ ] No dar fechas tras 2 intentos de Tlali → comparte el sitio.
- [ ] Pedir explícitamente "tienen página?" → comparte el sitio de inmediato.
- [ ] Contra-prueba: decir "quiero reservar ya" → NO comparte el sitio; va directo al cierre.
- [ ] Contra-prueba: el sitio se comparte máximo UNA vez por conversación.
- [ ] El link llega como texto plano clickeable en WhatsApp (sin markdown, sin paréntesis).

## C. Precios y cotización

- [ ] Pedir precio sin fechas → da rango $2,100–$2,500 + aclaración de impuestos, sin inventar precio exacto.
- [ ] Cotizar fechas concretas → desglose correcto: noches por tarifa de día + IVA 16% + hospedaje 5% + anticipo 50%.
- [ ] Cotizar 1 noche que incluye viernes o sábado → rechaza por estancia mínima 2 noches y sugiere ampliar.
- [ ] Convención de fechas: "del 15 al 17" → 2 noches (confirma conteo antes de cotizar).
- [ ] Pedir descuento → responde con argumento de canal directo (mejor tarifa, sin comisiones), no ofrece descuento.
- [ ] Mencionar "en Airbnb vi..." → menciona con naturalidad que el canal directo tiene las mejores condiciones.

## D. Reserva y pago

- [ ] Aceptar cotización → pide nombre completo (email opcional), crea reserva `cotizada` y manda instrucciones bancarias tal cual (CLABE, banco, beneficiario).
- [ ] Enviar imagen de comprobante → acuse "Recibimos tu comprobante...", reserva pasa a `pendiente_pago`, visión procesa, escala a finanzas (validar en app mientras la línea interna siga bloqueada).
- [ ] Validar pago desde la app → huésped recibe confirmación por WhatsApp (callback `Notificar Validacion Huesped`).
- [ ] Reserva nueva aparece en el dashboard con folio y montos correctos.

## E. Estancia (huésped con reserva confirmada/en curso)

- [ ] Preguntar chapa / WiFi / cómo llegar → `datos_estancia` responde con datos exactos; URL de Maps en línea propia.
- [ ] Mismo número pregunta 2 veces seguidas la chapa → la da las dos veces (regresión de memoria envenenada, fix 641e2fb).
- [ ] Número SIN reserva pide chapa/WiFi → niega con motivo, no promete contacto humano, ofrece cotizar.
- [ ] Preguntar saldo → monto y datos bancarios correctos, recordatorio de 48h antes del check-in.
- [ ] Preguntar qué hacer / dónde comer → solo lugares de `recomendaciones_locales` (no inventa). NOTA: curar contenido real antes (pendiente Fase 4).
- [ ] Reportar problema en el chalet (ej. "no abre la chapa") → da teléfono de emergencias y escala.

## F. Feedback de experiencia (cambio 2026-06-11)

- [ ] Huésped en día de salida recibe el recordatorio 11:00 MX con checklist (basura, platos, inspección) y la pregunta "¿qué les pareció la experiencia?" — ya SIN mención de Airbnb.
- [ ] Huésped responde su opinión → Tlali llama `guardar_feedback`, agradece, y la fila aparece en `feedback_estancias` con reserva/chalet/huésped resueltos.
- [ ] Opinión con calificación explícita ("le doy un 5") → `calificacion=5` en la fila.
- [ ] Opinión sin calificación → `calificacion` NULL (Tlali no la inventa).
- [ ] Feedback negativo → Tlali se disculpa, guarda igual el comentario y comparte teléfono de emergencias.
- [ ] Huésped que ya salió (reserva `completada`) manda su opinión días después → se guarda ligada a su última reserva.
- [ ] Tlali NO menciona al huésped que su opinión "quedó registrada en un sistema".
- [ ] Reporte: `select c.nombre, f.calificacion, f.comentario, f.created_at from feedback_estancias f left join chalets c on c.id = f.chalet_id` devuelve datos consultables por chalet/periodo.

## G. Recordatorios programados (corriendo desde mayo)

- [ ] Recordatorio de llegada (día de check-in) llega con datos correctos.
- [ ] Recordatorio de saldo (48h antes) llega solo si hay saldo pendiente.
- [ ] Recordatorio de salida 11:00 MX (ver F1).
- [ ] Recordatorio a operaciones/limpieza llega al staff correcto.
- [ ] Transiciones de estado: `confirmada` → `en_curso` → `completada` ocurren solas en las fechas correctas.

## H. Infraestructura

- [ ] iCal Export: el feed expone las reservas directas (para bloquear Airbnb si ese canal se abre después).
- [ ] iCal Import Airbnb: sin listings activos no genera reservas fantasma.
- [ ] Webhook del Concierge: mensajes de texto, imagen y PDF se enrutan bien (texto → agente, media → ingesta comprobante).
- [ ] Debounce Redis: mandar 3 mensajes seguidos rápidos → una sola respuesta que considera los 3.

## Pendientes conocidos (no bloquean, pero anotar)

- Línea interna WhatsApp bloqueada (401) → finanzas valida en app. Reactivar con número con antigüedad (FASE-3 §12).
- Curar `recomendaciones_locales` con lugares reales (seed genérico hoy).
- Query `Recipientes Finanzas` quedó en `super_admin` para pruebas → revertir a `rol in ('admin','super_admin')`.
- Cuando exista el perfil de Google Maps: cambiar la captura de feedback por invitación a reseñar ahí (o ambas).
