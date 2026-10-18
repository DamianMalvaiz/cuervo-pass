# Algoritmos de Cuervo 360

Estado: **ranking de Servicios** documentado. Los demás (reseñas, afinidad de roomies) se añaden aquí al cerrarse su fase.

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
