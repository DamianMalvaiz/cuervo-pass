# Algoritmos de Cuervo 360

Estado: ranking de **Servicios**, **Depas** y **Roomies** documentados (los dos últimos ya existían; aquí se escriben a partir de las migraciones 0031, 0037 y 0024, leídas el 17/10/2026). La **verificación de rostro** (fase 6) se documenta al final. Las reseñas se agregan al cerrarse su fase.

## Ranking de Servicios (`negocios_ordenados`, migración 0055)

```
puntaje = 0.45·cercanía + 0.45·calidad + 0.10·novedad      (cada término en [0, 1])
```

| Término | Fórmula | Notas |
|---|---|---|
| cercanía | `1 / (1 + d/1.5)` | d = km desde TU universidad. 0 km → 1; 1.5 km → 0.5; 6 km → 0.2. Sin dato de ubicación: **0.5 (neutro)**. |
| calidad | `(q − 1)/4`, `q = (v·R + 3·3.5)/(v + 3)` | R = promedio, v = nº de reseñas. Se «encoge» hacia 3.5 con el peso de 3 reseñas. Sin reseñas: 0.625. Una reseña de 5★ da q = 3.9, no 5. |
| novedad | `max(0, 1 − días/30)` | Evita el arranque en frío: un negocio nuevo no queda siempre detrás de los viejos. |

**Orden:** `destacado desc`, `puntaje desc`, `nombre asc`. Destacado es un NIVEL (lo promete el plan pagado), no una suma.
**Límite** por llamada: 1–100 (por defecto 60). Búsqueda por nombre y categoría en el servidor (invariante 5).

### Búsqueda de texto (0065, 18/10/2026)
Medido en producción antes del cambio: «cafe» encontraba 0 negocios y «café», 1 (la búsqueda distinguía acentos); «tacos» encontraba el negocio que se llama así y
ninguno de los que venden tacos (0 por producto, aunque el menú está en la base). Ahora la búsqueda ignora acentos y mayúsculas (`unaccent`) y mira el nombre, la
descripción y los nombres de los productos visibles; si el **nombre** coincide, va antes que los que solo coinciden por producto o descripción (dentro de su nivel de
«destacado»). El **puntaje no cambia**: la relevancia del texto reordena, no se mezcla con cercanía ni calidad.
No tolera erratas («taqeria») ni sinónimos: eso pediría trigramas o un diccionario y, sin datos de búsquedas reales, sería adivinar.

### Abierto ahora (0070, 18/10/2026)
El horario es estructurado (`negocio_horarios`: día ISO 1–7, `abre`, `cierra`, hasta 21 turnos; `cierra` < `abre` cruza la medianoche; `cierra` es exclusivo; zona
`America/Mexico_City`). `negocio_abierto_en(negocio, instante)` mira el turno de HOY y el que empezó AYER y sigue abierto. **Tres estados**: abierto, cerrado y
`null` (sin horario estructurado: no se sabe, y no se inventa). El filtro «Abierto ahora» (`p_solo_abiertos`) se aplica en el servidor y solo deja los que **se sabe**
que están abiertos. El estado **no entra al puntaje**: filtra, no reordena. Se comprueba con `npx supabase test db` (573 aserciones) y con `npx jest src/lib/__tests__/horario.test.ts`.

### Límites honestos
- Sin personalización: no existe historial de uso de Servicios; no se inventa.
- «Abierto ahora» no entiende festivos ni cierres excepcionales: es el horario habitual.
- Un negocio sin horario estructurado queda fuera del filtro «Abierto ahora» (puede estar abierto; no se sabe).
- Pesos (0.45/0.45/0.10), escala 1.5 km, prior 3.5 y peso 3 son **decisiones de producto, no medidas**. Cambiarlos requiere migración con prueba.
- Las estrellas que ve el usuario son las reseñas reales; el puntaje nunca se muestra.

### Cómo se comprueba
- `npx supabase test db`: aserciones de `supabase/tests/rls.test.sql` (más cerca gana, mejor calificado gana, nuevo gana a igualdad, destacado primero, ACL solo `authenticated`).
- `npx jest src/services/__tests__/servicios src/components/__tests__/TarjetaNegocio`.
- Aplicación en producción: **pendiente** (sin verificar hasta que se aplique la 0055).

### Evaluación de sensibilidad (`scripts/evaluar-ranking.mjs`, 17/10/2026, producción, solo lectura)

```bash
node --env-file=.env --env-file=.env.server scripts/evaluar-ranking.mjs
```

Recalcula el puntaje con la misma fórmula y varía un parámetro cada vez (pesos, escala de distancia, prior).
Resultado con los 25 negocios sembrados: el top-5 no cambia en ninguna de las 6 variantes.

**Lo que esto NO prueba:** los 25 negocios están a ≤ 0.5 km y ninguno tiene reseñas, así que "calidad" es igual para todos y el
orden lo decide solo la cercanía. La estabilidad es real pero poco informativa; el efecto de la calidad y del prior solo se verá
con reseñas reales (la prueba de pgTAP sí fija su comportamiento con datos sintéticos). Pesos sin validar con usuarios.

## Depas (`score_ajuste`, 0031; mezcla con afinidad, 0037)

```
score  = 0.30·distancia + 0.30·presupuesto + 0.25·compatibilidad + 0.15·novedad
final  = 0.6·score + 0.4·similitud        (si no hay vector de alguna de las dos partes: final = score)
```

- **distancia** `1 − km/distancia_max` (5 km si no la dio); sin geocodificar: 0.5 neutro.
- **presupuesto** 1 en tu mínimo, 0 en tu máximo (lineal); sin presupuesto: 0.5. El filtro duro admite hasta 10 % sobre tu tope.
- **compatibilidad** 0.25 repartido: mascotas (asimétrico: sin mascota, que las acepten no estorba) y mismo nivel de ruido.
- **novedad** baja a 0 en 30 días. **similitud** = coseno entre embeddings de perfil y publicación (servicio de IA).
- **Se explica en la app:** la ficha enseña «1.2 km · $500 bajo tu tope · afinidad 0.87» (`PorQue`) y las razones (`PorQueEsBuena`).

## Roomies (`sugerencias_roomies`, 0024; compatibilidad y razones desde la 0066)

**Medido en producción antes de cambiarlo (18/10/2026):** el orden era solo el coseno entre el perfil y la búsqueda del roomie, y no podía decir por qué. Los cosenos de
150 pares (5 perfiles × 30 roomies) van de 0.16 a 0.56 (mediana 0.39); la tarjeta etiquetaba «Alta» desde 0.75, que **nunca ocurría**. En los 30 roomies de demostración
`nivel_ruido` era nulo, el horario «mixto» y `presupuesto_aportacion` nulo en todos.

**Ahora:**
```
compatibilidad = promedio ponderado de lo que SÍ se puede comparar (nulo si falta el dato de alguno de los dos):
    ruido 0.30      igual 1 · contiguo (bajo–medio, medio–alto) 0.5 · bajo–alto 0
    tabaco 0.25     igual 1 · distinto 0
    horario 0.15    igual 1 · alguno «mixto» 0.5 · diurno–nocturno 0
    mascotas 0.15   igual 1 · distinto 0.4
    aportación 0.15 dentro de TU presupuesto 1 · fuera: decae con la distancia relativa al máximo
afinidad       = coseno reescalado a [0, 1] con una banda FIJA [0.15, 0.60] (la observada)
puntaje        = 0.5·compatibilidad + 0.5·afinidad      (orden de la lista)
```
- Lo que **no tiene dato se ignora** y los pesos se re-normalizan: ni castiga ni premia. Sin ningún dato la compatibilidad es nula (vale 0.5 en el puntaje) y la tarjeta dice
  «sin datos para comparar», **no** «baja».
- Sin vector, la afinidad aporta 0: el roomie baja en la lista pero no desaparece (lo que ya hacía `nulls last`).
- El servidor devuelve además **frases legibles** (`coincidencias`, `diferencias`): «Mismo nivel de ruido», «Ninguno fuma», «Uno tiene mascotas y el otro no», «Horarios
  opuestos», «Su aportación queda fuera de tu presupuesto». La tarjeta las enseña, hasta 3.
- La **etiqueta** («Compatibilidad alta/media/baja», cortes 0.75 / 0.5) sale de la compatibilidad por reglas —la que se explica—, y el coseno solo ordena.
- Seguridad: sigue `security definer` por `vector_busqueda`, que no sale. Del otro lado solo usa lo ya público (`perfiles_publicos` y la aportación del anuncio).

### Límites honestos
- Pesos, banda y cortes son **decisiones de producto, no validadas** con personas ni con convivencia real. La banda sale de 150 pares de demostración.
- No predice que dos personas se lleven bien: ordena por señales **declaradas** y dice cuáles.
- Las frases dependen de que la persona haya llenado el cuestionario: quien no lo hizo aparece con menos razones.
- Los roomies de demostración no tenían ruido, horario ni aportación; `scripts/completar-roomies-demo.mjs` (fabricados, deterministas) los completa para que la demo enseñe razones.

## Verificación de rostro (fase 6: `/verificar-rostro`, Edge Function `verificar-rostro`, migración 0056)

**Qué es:** una AYUDA para el admin que revisa una verificación de vendedor. Compara una selfie con la foto de la INE. **No aprueba
nada**: aprobar sigue siendo `resolver_verificacion`, llamada por una persona.

| Pieza | Decisión |
|---|---|
| Modelo | InsightFace `buffalo_l` (identidad) + addon de liveness, en CPU: ~1.4 s por verificación, ~12 s de carga la primera vez |
| Identidad | coseno ≥ **0.30** entre la selfie y la cara mayor de la INE |
| Vida | puntaje ≥ **0.90**; **sin puntaje no pasa** (se pide otra selfie) |
| Orden de decisión | 1 sola cara en la selfie → puntaje de vida presente → vida ≥ 0.90 → identidad ≥ 0.30 |
| Estados | `coincide` · `no_coincide` · `no_vivo` · `repetir_selfie` · `sin_rostro_ine` |
| Intentos | 5 por cada envío de verificación; se reinician si la persona reenvía la evidencia |
| Qué se guarda | estado + 2 cifras + modelo + consentimiento (fecha y versión del aviso), en `verificaciones_biometria` |
| Qué NO se guarda | la selfie, la imagen de la INE usada, el vector facial |
| Quién lo ve | solo el servicio (script del admin). La persona recibe «recibida» o «repite la foto»: ni cifras ni causa |

### Por qué la persona no ve las cifras
`no_coincide` y `no_vivo` se ven iguales para ella. Si supiera cuál falló, o qué tan cerca quedó, tendría un instrumento para afinar una
suplantación contra los umbrales. La tabla ni siquiera se concede a `authenticated` (RLS filtra filas, no columnas).

### Qué se midió (local, `experimentos/biometrico/RESULTADOS.md`, fuera de git por llevar fotos personales)
Rondas del 17/10/2026, `buffalo_l`, la credencial de una sola persona como referencia:

| Prueba | Resultado |
|---|---|
| Impostores (LFW, 299 personas) | 0 aceptados; similitud máxima 0.137 |
| Tus fotos normales y con filtro | identidad ≥ 0.478 |
| Tus fotos difíciles (tapabocas, gorra, celular tapando…) | 0.243 a 0.611 (2 de 6 por debajo de 0.30: rechazo deseado) |
| Ataques de pantalla (11) | 0 aceptados. Liveness máx. 0.788 contra 0.950 mínimo de las reales |
| La identidad SIN liveness ante esos ataques | 10 de 11 habrían pasado: lo que protege es el liveness |
| Motor real del servicio (ronda 5) | reales: 5 coinciden, 4 piden repetir, 2 no coinciden · ataques 0/11 · impostores 0/60 |

### Límites honestos (no minimizar)
- **Uso real:** ~1 de cada 3 selfies reales pide repetir (selfie demasiado cerca o recortada). Es un costo de usabilidad, no una falla de seguridad.
- **Cotas, no tasas:** «0 de 299» ≈ hasta ~1 % de falsos aceptados; «0 de 11 ataques» ≈ hasta ~25 %. Se probó **un monitor, una luz, una persona**; sin fotos impresas, vídeo ni máscaras.
- **Umbrales sin calibrar con estudiantes mexicanos** y el 0.90 de vida se eligió con los mismos datos (puede estar sobreajustado).
- **Un parecido entre estudiantes de la misma universidad** puede dar similitudes más altas que las de LFW (figuras públicas, mayoría de otros países).
- **Licencias:** código de InsightFace MIT; los modelos `buffalo_*` son **solo para investigación no comercial**; el addon de liveness **no declara licencia**.
  Es un proyecto académico sin fines de lucro. Para una producción comercial habría que cambiar de modelo y repetir las mediciones.
- **Intento perdido:** si el ai-service falla tras reservar el intento, la Edge Function lo devuelve (`devolver_intento_biometria`, 0057). Sin verificar de punta a punta.

### Cómo se comprueba
- `cd ai-service && .venv/bin/python -m pytest tests/test_rostro.py` (reglas con un motor falso; CI no instala InsightFace).
- `npx jest test-utils/__tests__/verificar-rostro` (política de la Edge Function) · `npx jest src/components/__tests__/SeccionRostro src/lib/__tests__/rostro`.
- `npx supabase test db` (0056: permisos, tope de intentos, reinicio al reenviar).
- Motor real: `experimentos/biometrico/probar_servicio.py` dentro de la imagen del experimento (local).
- **Sin verificar de punta a punta:** la Edge Function desplegada llamando al ai-service real, y la pantalla en un teléfono. Está apagada
  (`BIOMETRIA_ACTIVA=false` en el servicio, `BIOMETRIA_HABILITADA=false` en la app) hasta que el aviso de privacidad v3 esté publicado.

## Hallazgo de calibración en Depas (medido el 18/10/2026, sin cambiar nada todavía)

Para `demo.estudiante` sobre las 114 publicaciones activas (consulta de solo lectura con `score_ajuste` y el coseno de los vectores):

| | mínimo | promedio | máximo | desviación |
|---|---|---|---|---|
| `score` (distancia, presupuesto, compatibilidad, novedad) | 0.125 | 0.238 | 0.668 | 0.137 |
| similitud semántica (coseno) | 0.147 | 0.356 | 0.491 | 0.085 |

El orden final es `0.6·score + 0.4·similitud`. Lo que realmente mueve el orden es cada término multiplicado por su peso: 0.6·0.137 ≈ 0.082 contra 0.4·0.085 ≈ 0.034.
**El peso declarado de la afinidad (40 %) no se cumple en la práctica:** como los cosenos viven en una banda estrecha (0.15–0.49), la afinidad explica alrededor del
15 % de la variación del orden (ignorando la covarianza). Es un hallazgo de calibración, **no una prueba de que el orden sea peor**: no hay datos de relevancia
etiquetados para saber qué orden prefieren las personas. Con 1 perfil y 114 publicaciones es una muestra pequeña. Cualquier cambio (por ejemplo reescalar el coseno a
[0, 1] con una banda fija) debe presentarse como calibración de pesos, no como mejora de precisión.
