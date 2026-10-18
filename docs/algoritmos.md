# Algoritmos de Cuervo 360

Estado: ranking de **Servicios**, **Depas** y **Roomies** documentados (los dos últimos ya existían; aquí se escriben a partir de las migraciones 0031, 0037 y 0024, leídas el 17/10/2026). Las reseñas se agregan al cerrarse su fase.

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

### Límites honestos
- Sin personalización: no existe historial de uso de Servicios; no se inventa.
- Sin «abierto ahora»: el horario es texto libre.
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

## Roomies (`sugerencias_roomies`, 0024)

Orden: `similitud desc nulls last`, luego `creado_en desc`. La similitud es el coseno entre el vector del perfil y el de la búsqueda
del roomie; quien aún no tiene vector sale al final, no desaparece. Solo roomies `activo` y distintos de ti.

- **Se muestra como etiqueta** (Alta ≥ 0.75, Media ≥ 0.55, resto sin etiqueta), no como calificación, para no aparentar precisión.

### Brecha honesta de explicabilidad
Servicios y Depas dicen *por qué* (distancia, precio, reseñas). **Roomies no puede**: el orden sale de un embedding de texto
libre y no se descompone en razones legibles. Se declara así en lugar de inventar razones. Umbrales 0.75/0.55 sin calibrar con datos reales.
