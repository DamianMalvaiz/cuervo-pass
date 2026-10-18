-- Ranking de Servicios · Cuervo 360 (fase 5, los algoritmos).
--
-- Hasta aquí la lista de Servicios salía ordenada por «destacado» y por nombre: un orden sin criterio sobre lo que le conviene a
-- quien busca. `negocios_ordenados` lo ordena por un PUNTAJE explicable, calculado en el servidor (invariante 5: lo que se filtra
-- y se ordena se hace en la base, no en el teléfono sobre una página ya recortada).
--
-- ── La fórmula ──────────────────────────────────────────────────────────────
--   puntaje = 0.45·cercanía + 0.45·calidad + 0.10·novedad            (cada término en [0, 1])
--
--   cercanía = 1 / (1 + d/1.5)      d = km desde TU universidad. 0 km → 1; 1.5 km → 0.5; 6 km → 0.2.
--                                   Sin dato de ubicación (tuya o del negocio): 0.5, NEUTRO. Faltar el dato no castiga ni premia.
--   calidad  = (q − 1) / 4         q = (v·R + m·C) / (v + m): el promedio de estrellas R con v reseñas, «encogido» hacia un
--                                   prior C = 3.5 con el peso de m = 3 reseñas. Con pocas reseñas manda el prior; con muchas, R.
--                                   Un negocio SIN reseñas vale 0.625 (el prior): ni mejor ni peor que lo desconocido, y por
--                                   encima de uno con calificación mala y verificada. Una sola reseña de 5 estrellas no lo
--                                   dispara: (5 + 10.5)/4 = 3.9.
--   novedad  = max(0, 1 − días/30)  los primeros 30 días de un negocio reciben un empujón decreciente: sin él, un negocio nuevo
--                                   (sin reseñas ni historial) quedaría siempre detrás de los viejos (arranque en frío).
--
-- ── Destacado va PRIMERO, y se dice ─────────────────────────────────────────
-- El orden es: destacado (sale del plan pagado, 0053) y luego puntaje. «Aparece primero en las listas» es lo que promete el plan
-- Destacado, así que se cumple como un NIVEL, no como una suma que un mal negocio pudiera perder. Dentro de cada nivel manda el
-- puntaje. Desempate estable por nombre.
--
-- ── Qué NO hace, a propósito ────────────────────────────────────────────────
-- · No usa lo que la persona hizo antes (no hay historial de uso de Servicios todavía): no se inventa personalización.
-- · No sabe si está «abierto ahora»: el horario es texto libre.
-- · Los pesos y el prior son decisiones de producto, no medidas: están escritos aquí y en docs/algoritmos.md, con las pruebas que
--   fijan SU COMPORTAMIENTO (más cerca gana, mejor calificado gana, el nuevo gana a igualdad, el destacado va primero). Cambiarlos
--   es una migración con su prueba, no un ajuste silencioso.
--
-- ── Seguridad ───────────────────────────────────────────────────────────────
-- `security definer` solo para leer la ubicación de la universidad de QUIEN llama (su fila de `usuarios`); lo demás lo lee de
-- `negocios_publicos`, que ya filtra lo visible y respeta el plan. No devuelve nada si no hay sesión. Invariante 9: revoke
-- explícito y grant a authenticated. El límite se acota a 100 por llamada.
--
-- Reversión:
--   drop function if exists negocios_ordenados(text, text, integer);

create or replace function negocios_ordenados(
  p_categoria text default null,
  p_texto     text default null,
  p_limite    integer default 60
)
returns table (
  id uuid, categoria_id text, nombre text, descripcion text, direccion text,
  latitud numeric, longitud numeric, rango_precio smallint, horario text, fotos text[],
  destacado boolean, origen text, creado_en timestamptz,
  calificacion numeric, num_resenas integer,
  distancia_km double precision, puntaje double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (
    select u.latitud_universidad as lat, u.longitud_universidad as lon from usuarios u where u.id = auth.uid()
  ),
  base as (
    select n.id, n.categoria_id, n.nombre, n.descripcion, n.direccion, n.latitud, n.longitud, n.rango_precio, n.horario,
           n.fotos, n.destacado, n.origen, n.creado_en, n.calificacion, n.num_resenas,
           case when yo.lat is null or yo.lon is null or n.latitud is null or n.longitud is null then null
                else distancia_km(yo.lat::double precision, yo.lon::double precision,
                                  n.latitud::double precision, n.longitud::double precision)
           end as d
      from negocios_publicos n
      left join yo on true
     where auth.uid() is not null
       and (p_categoria is null or n.categoria_id = p_categoria)
       -- Búsqueda por nombre en el SERVIDOR; los comodines de LIKE del texto se escapan («50%» no es «todo»).
       and (nullif(btrim(coalesce(p_texto, '')), '') is null
            or n.nombre ilike '%' || regexp_replace(btrim(p_texto), '([\\%_])', '\\\1', 'g') || '%')
  ),
  puntuado as (
    select b.*,
           (0.45 * (case when b.d is null then 0.5 else 1.0 / (1.0 + b.d / 1.5) end)
          + 0.45 * ((((coalesce(b.num_resenas, 0) * coalesce(b.calificacion, 0) + 3 * 3.5)
                       / (coalesce(b.num_resenas, 0) + 3)) - 1.0) / 4.0)
          + 0.10 * greatest(0.0, 1.0 - extract(epoch from (now() - b.creado_en)) / 86400.0 / 30.0)
           )::double precision as p
      from base b
  )
  select pu.id, pu.categoria_id, pu.nombre, pu.descripcion, pu.direccion, pu.latitud, pu.longitud, pu.rango_precio,
         pu.horario, pu.fotos, pu.destacado, pu.origen, pu.creado_en, pu.calificacion, pu.num_resenas,
         pu.d as distancia_km, pu.p as puntaje
    from puntuado pu
   order by pu.destacado desc, pu.p desc, pu.nombre asc
   limit least(greatest(coalesce(p_limite, 60), 1), 100);
$$;
revoke execute on function negocios_ordenados(text, text, integer) from public, anon, authenticated;
grant execute on function negocios_ordenados(text, text, integer) to authenticated;
