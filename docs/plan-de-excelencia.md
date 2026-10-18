# Plan de excelencia · 18/10/2026

Pedido: que la app no solo funcione, sino que sea **autónoma** (funciona bien por sí sola, sin depender de nadie ni de nada que no controlemos, sin errores en lo que
promete) y que destaque **por mucho**, no por poco. Esto es una evaluación crítica con evidencia, no una lista de deseos: cada brecha dice cómo se midió, y lo que no
se pudo medir se dice.

## 1 · Qué significa «autónoma», en barras medibles

| # | Barra | Cómo se comprueba |
|---|---|---|
| B1 | Ninguna pieza que dependa de una persona o de una máquina personal | El servicio de IA no vive en una laptop; el sistema funciona con tu laptop apagada |
| B2 | Todo fallo se ve y se dice | Cada error llega a un sitio donde alguien lo mira, y la pantalla lo dice (no se calla) |
| B3 | Los recorridos críticos están probados de punta a punta, en CI | Pruebas E2E que corren solas en cada push |
| B4 | Presupuestos de rendimiento cumplidos | Bytes por tarjeta, tamaño del paquete, tiempo de la primera lista |
| B5 | Accesibilidad verificada en el dispositivo | Contraste medido, objetivos táctiles, lector de pantalla, escalado de texto |
| B6 | Seguridad sin hallazgos abiertos sin justificar | Asesor de Supabase, `prueba-rls`, pruebas por tipo de objeto |
| B7 | Los algoritmos se evalúan, no se creen | Una evaluación reproducible con datos etiquetados por personas |
| B8 | El modelo de datos permite lo que la interfaz promete | Sin «texto libre» donde se necesita estructura |

## 2 · Dónde estamos, con evidencia

**B1 — NO se cumple (el mayor riesgo de «autonomía»).** El servicio de IA corre en tu laptop detrás de un túnel de Cloudflare de dominio efímero (`scripts/tunel.sh`).
`scripts/verificar.mjs` falló hoy en «Túnel» y «Cadena de IA». La app degrada a Nivel 1 (bien diseñado), pero la afinidad semántica —lo que nos diferencia— muere si la laptop se apaga.

**B2 — Parcial.** `lib/registro.ts` centraliza los avisos, pero salen a la consola del teléfono: en producción nadie los ve. Cero monitoreo. Bien: «falló la red» se distingue de «no hay dato».

**B3 — NO se cumple.** 1646 pruebas unitarias y 466 aserciones de base de datos, pero ningún recorrido de punta a punta. No hay `adb`, emulador ni Maestro en este entorno. Cobertura ponderada 92.1 %,
pero **los archivos menos cubiertos son los críticos**: `services/mensajes.service.ts` 48.8 % (el chat), `lib/storage.ts` 61.7 % (subida de fotos), `hooks/usePublicaciones` 59.3 %.

**B4 — Brecha medida.**
- Fotos: 422 archivos, 79 MB, **192 KB de promedio** (máx. 623 KB), 3.4 por publicación. Las listas cargan la foto completa en cada tarjeta: ~30 tarjetas ≈ **5.8 MB** por pantalla en datos móviles.
  No hay miniaturas. Una miniatura de ~25 KB bajaría eso ~85 %.
- Paquete JS: **17 MB** (Hermes). Es pesado para esta app; sin analizar qué lo infla.

**B5 — Sin verificar en dispositivo.** Hay script de contraste y de objetivos táctiles en verde, pero la prueba de escalado de texto y el modo oscuro real siguen «solo se puede hacer en un dispositivo» (`docs/prueba-escalado.md`).

**B6 — Bien, con deuda documentada.** El asesor de Supabase marca: 1 ERROR `auth_users_exposed` (la vista `perfiles_publicos` lee `auth.users` para `correo_verificado`, solo un booleano, pero es una dependencia innecesaria),
7 ERROR `security_definer_view` (las vistas públicas son definer **por diseño**, para ocultar columnas), 13 funciones con `search_path` sin fijar, 2 extensiones en `public`, 1 par de políticas permisivas duplicadas en `roomies`,
protección contra contraseñas filtradas apagada (es del panel). Hoy se cerró el hueco grave de las vistas escribibles (0061).

**B7 — NO se cumple.** Los pesos de Depas, Servicios y Roomies son decisiones de producto sin validar. Medido: la afinidad declarada al 40 % de Depas explica ~15 % del orden. No hay conjunto etiquetado ni métrica.

**B8 — Brechas de modelo.**
- `horario` es texto libre: no se puede decir «abierto ahora», que es lo primero que pregunta quien busca un servicio.
- Los favoritos solo existen para publicaciones, no para negocios.
- No hay centro de notificaciones dentro de la app (la tabla `notificaciones` existe y el cliente no la lee).
- Los negocios no tienen métricas para su dueño: un plan de pago sin números que lo justifiquen.

## 3 · Plan por fases (con tamaño y por qué)

Tamaños: S = horas, M = una sesión larga, L = varias sesiones. **Congelar funciones nuevas antes de la prueba en vivo; las fases 0 y 1 son las que más suben la nota.**

### Fase 0 — Autonomía y confiabilidad (antes de la prueba en vivo)
| # | Qué | Tamaño | Barra | Necesita de ti |
|---|---|---|---|---|
| 0.1 | **IA fuera de tu laptop**: servicio contenedorizado en un anfitrión con URL fija (propuesta: Hugging Face Space con Docker, gratuito, o Fly.io). El proxy y los secretos ya existen | L | B1 | Crear la cuenta y dar el token |
| 0.2 | **Registro de errores propio**: `lib/registro.ts` ya es el único sumidero; se le añade envío (sin datos personales, con límite de tasa) a una tabla, y el panel de admin los lista | M | B2 | — |
| 0.3 | **Higiene del asesor**: `search_path` fijo en las 13 funciones, `correo_verificado` como columna mantenida por trigger (se quita `auth.users` de la vista), fusionar políticas de `roomies` | S–M | B6 | Aplicar la migración |
| 0.4 | **Miniaturas**: subir dos tamaños, derivar la ruta (`x.jpg` → `x_t.jpg`), rellenar las 422 existentes con un script; las listas piden la miniatura | M | B4 | Aplicar y correr el script |
| 0.5 | **Pruebas de lo crítico poco cubierto**: chat (`mensajes.service`), subida de fotos (`storage.ts`), sugerencias | M | B3 | — |
| 0.6 | Análisis del paquete de 17 MB y recorte de lo que sobre | M | B4 | — |

### Fase 1 — Que se sienta superior
| # | Qué | Tamaño | Barra |
|---|---|---|---|
| 1.1 | **Horario estructurado + «Abierto ahora»** (tabla de horarios, editor, insignia y filtro). Cambio de tabla, y se migran los 25 negocios sembrados | L | B8 |
| 1.2 | **Personalización real**: el vector del perfil se mueve hacia lo que guardas (Rocchio sobre `favoritos`) y «Parecidos a este» en la ficha (pgvector entre publicaciones). Explicable: «te lo mostramos porque guardaste X» | M | B7 |
| 1.3 | **Conjunto de evaluación etiquetado**: tú calificas ~40 pares (perfil, publicación) y medimos NDCG de cada versión del orden. Lo único que permite decir «mejoramos» con honestidad | M | B7 |
| 1.4 | Calibrar Depas (afinidad reescalada, ruido ordinal), con la métrica de 1.3 | S | B7 |
| 1.5 | **Centro de notificaciones** con insignia (la tabla ya existe) | M | B8 |
| 1.6 | **Favoritos de negocios** | M | B8 |
| 1.7 | Revisión visual completa en el teléfono (ver §5) | M | B5 |

### Fase 2 — Distinguirse
| # | Qué | Tamaño |
|---|---|---|
| 2.1 | Mapa de descubrimiento (Mapbox) de Servicios y Depas | L |
| 2.2 | Panel del vendedor con métricas (vistas, favoritos, contactos, reseñas) | L |
| 2.3 | Pagos reales de prueba (Mercado Pago sandbox + webhook en Edge Function) | L |
| 2.4 | E2E con Maestro en CI (emulador de GitHub Actions) | L |

## 4 · Decisiones que necesito de ti
1. **0.1 — ¿Dónde alojamos la IA?** Recomendación: **Hugging Face Space (Docker)** por URL fija y cero costo; límite: se duerme tras inactividad y el primer arranque tarda (la app ya degrada a Nivel 1 mientras tanto). Alternativa de pago: Fly.io o Cloud Run. Necesito que crees la cuenta y me pases un token (o lo despliegas tú con mis archivos).
2. **1.3 — ¿Puedes dedicar ~1 hora a calificar pares?** Sin etiquetas humanas, ningún algoritmo puede demostrar que mejora.
3. **Orden y límite:** propongo Fase 0 completa → prueba en vivo → Fase 1 → decidir Fase 2 con el tiempo que quede.

## 5 · Cosas visuales que ya veo (revisión de código; falta verla en el teléfono)
- Quedan etiquetas en mayúsculas sostenidas (`QUÉ BUSCA`, `AFINIDAD…`) en varias tarjetas: es el rezago del sistema anterior.
- Las tarjetas de «Mis publicaciones» y de Inicio de depas no muestran estrellas aunque ya existen las reseñas.
- No hay miniaturas ni esqueleto con forma de la imagen real en las listas.
- El menú del negocio no se reordena arrastrando, y el editor no avisa de cambios sin guardar.
- Sin sistema de animación de entrada ni transiciones compartidas: la app se siente correcta, no memorable.

## 6 · Lo que NO voy a prometer
- «Los mejores» no es verificable sin usuarios. Lo verificable es cada barra de §1.
- Los pesos de los algoritmos seguirán siendo decisiones de producto hasta que exista 1.3.
- La biometría sigue apagada hasta el aviso v4 y la revisión legal.
