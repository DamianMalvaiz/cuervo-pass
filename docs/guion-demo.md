# Guion de la demostración en vivo · Cuervo 360

Un solo recorrido, dos teléfonos (o uno y la laptop), unos 15 minutos. Lo que no esté probado en un teléfono **no se enseña**: se dice
que está pendiente. Un ✓ que no se vio es lo que más cuesta en una evaluación.

## Antes (la víspera y una hora antes)

| # | Qué | Comando o acción |
|---|---|---|
| 1 | Cuentas de demostración | `node --env-file=.env --env-file=.env.server scripts/preparar-demo.mjs` (lee el plan) y luego con `--aplicar` |
| 2 | Imágenes de MUESTRA al teléfono del vendedor | `python3 scripts/generar-muestras-demo.py` → pasar `demo-material/*.jpg` a la galería (**nunca** una INE verdadera) |
| 3 | Vectores de afinidad de las cuentas nuevas | `node --env-file=.env --env-file=.env.server --env-file=ai-service/.env scripts/backfill-embeddings.mjs` |
| 4 | Túnel de la IA y datos | `./scripts/tunel.sh` y `node scripts/verificar.mjs` (debe salir sin ✗) |
| 5 | Barreras de seguridad contra producción | `node --env-file=.env --env-file=.env.server scripts/prueba-rls.mjs` |
| 6 | Pagos simulados SOLO durante la demo | Pedirle a Claude que encienda `demo_mode` al empezar y lo apague al terminar. **Apagado = pagos rechazados (CP010)** |
| 7 | Cuentas reales ya con sesión cerrada | Nunca registrar una cuenta real delante de quien evalúa |
| 8 | Teléfono A = **estudiante** (`demo.estudiante@…`), teléfono B = **vendedor** (`demo.vendedor@…`) | Contraseña de demostración: la imprime `preparar-demo.mjs` |

Después de la demo: `preparar-demo.mjs --limpiar --aplicar` quita las tres cuentas y lo suyo; `rm -rf respaldos/*`; `demo_mode` en `false`.

## Recorrido

### 1. El estudiante busca (teléfono A, ~4 min)
1. **Inicio → Depas.** Se ven las sugerencias ordenadas por ajuste. Abrir una: la ficha dice **por qué** (distancia, cuánto bajo tu tope, afinidad).
   *Decir:* distancia 30 %, presupuesto 30 %, compatibilidad 25 %, novedad 15 %, y 40 % de afinidad semántica (`docs/algoritmos.md`).
2. **Roomies.** El orden es por similitud de texto y se muestra como Alta/Media. *Decir con honestidad:* aquí no se puede descomponer en razones.
3. **Servicios.** Los destacados van primero; luego por cercanía y calidad. Las tarjetas dicen «a X km». Los 25 negocios de ejemplo llevan el rótulo
   **«Negocio de ejemplo»** y no tienen estrellas inventadas. *Decir:* hoy ninguno tiene reseñas, así que decide la cercanía
   (`node --env-file=.env --env-file=.env.server scripts/evaluar-ranking.mjs` lo muestra con números).
4. Abrir «Taquería Demo 360» (la negocio real de `demo.comerciante`): ficha con menú, horario y **sin reseñas todavía**.

### 2. El vendedor se verifica (teléfono B, ~5 min)
1. Perfil → **Tus funciones**: «Comerciante · Sin verificar». Tocarla → pantalla de verificación.
2. Llenar nombre y dirección, elegir de la galería las **imágenes de MUESTRA** (frente, reverso, local), marcar el consentimiento, **Enviar a revisión**.
   Debe decir «En revisión». *Mostrar* que «Publicar» sigue sin dejarlo publicar.
3. **En la laptop (el admin):** `node --env-file=.env --env-file=.env.server scripts/revisar-verificaciones.mjs` → aparece la solicitud con enlaces temporales a la evidencia
   (10 min). Abrir una imagen. Luego `… --aprobar <usuario_id> comerciante`.
   *Decir:* la aprobación es **manual**; la comparación de rostro está construida pero **apagada** hasta publicar el aviso de privacidad v3 (ver abajo).
4. En B, recargar Perfil: «Verificada». Aparece la pestaña **Publicar**, con la **prueba gratis de 15 días** que empieza al aprobar.

### 3. El vendedor publica y vende (teléfono B, ~3 min)
1. Publicar → **Nuevo negocio** (nombre, categoría, dirección, fotos). Límites visibles según el plan (sin plan: 0; prueba: lo del plan Básico).
2. **Menú** del negocio: agregar una sección y dos productos.
3. **Planes** → elegir uno → pagar. Con `demo_mode` encendido el cobro es **simulado** y la pantalla lo dice; no se procesa ninguna tarjeta.

### 4. La reseña y la respuesta (A → B, ~2 min)
1. A: abrir el negocio nuevo → **escribir una reseña** (estrellas + texto). Ahí aparece la primera calificación real.
2. B: ver la reseña y **responderla**. A: ver la respuesta. *(Un reporte de reseña existe; no hace falta enseñarlo.)*
3. Volver a Servicios en A: el negocio con reseña ya pesa por calidad, suavizada hacia 3.5 (una sola reseña de 5★ no lo dispara).

### 5. Chat (A ↔ B, ~1 min)
«Escribir en la app» desde una publicación; el mensaje llega al otro teléfono sin recargar.

## Si preguntan por…
| Tema | Respuesta honesta |
|---|---|
| Biometría | Construida y probada en local con InsightFace (0 de 299 impostores, 0 de 11 ataques de pantalla), **apagada** a propósito hasta que el aviso de privacidad v3 la cubra. Ayuda al admin, no aprueba. ~1 de cada 3 selfies reales pide repetir. Modelos solo de investigación no comercial. Cotas, no tasas: `docs/algoritmos.md` |
| Pagos | Simulados; no hay pasarela. `demo_mode` apagado en producción |
| Aviso de privacidad | El vigente (v2) **no menciona la INE**: la v3 está en borrador y necesita revisión legal. Dicho en `docs/aviso-privacidad-v3-borrador.md` |
| Pesos del ranking | Decisiones de producto, no medidas ni validadas con usuarios; se pueden mover con una migración y su prueba |
| «¿Son datos reales?» | Los 25 negocios de ejemplo y las 100 cuentas de roomies son fabricados y rotulados; las tres cuentas de la demo también |

## Si algo falla en vivo
- **Servicios sale vacío o falla:** la lista usa la función `negocios_ordenados` (0055); si el error es de red, la app lo dice como fallo de red, no como «no hay negocios».
- **La IA no responde:** la app baja a Nivel 1 (sin afinidad) y lo indica en el encabezado. `./scripts/tunel.sh` y volver a fijar `AI_SERVICE_URL`.
- **El pago da «no disponible»:** `demo_mode` está apagado. Se enciende pidiéndoselo a Claude, no a mano a media demo.
- **No hay nada que aprobar:** `revisar-verificaciones.mjs` dice «No hay verificaciones pendientes»: el vendedor aún no envió.

## Qué NO hacer
Registrar una cuenta real, mostrar `respaldos/`, abrir `.env*`, enseñar una INE verdadera, o afirmar algo de esta lista sin haberlo visto en el teléfono ese mismo día.
