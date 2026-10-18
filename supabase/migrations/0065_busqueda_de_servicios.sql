-- Búsqueda de Servicios que entiende cómo escribe la gente. Mejora del 18/10/2026.
--
-- ── Lo que se medió en producción (solo lectura) ────────────────────────────
--   · «cafe» encontraba 0 negocios; «café», 1. La búsqueda de `negocios_ordenados` (0055) era `ilike` sobre el nombre: distingue acentos.
--     En un teléfono casi nadie los escribe, así que la búsqueda fallaba justo en el caso más común.
--   · «tacos» encontraba el negocio cuyo NOMBRE lo contiene y ninguno de los que VENDEN tacos (0 por producto), aunque el menú está en la base.
--
-- ── Qué cambia ──────────────────────────────────────────────────────────────
--   1 · La búsqueda ignora acentos y mayúsculas (`unaccent`): «cafe» = «Café», «nandu» = «Ñandú».
--   2 · Busca en el nombre, la descripción y los NOMBRES DE LOS PRODUCTOS del menú (solo los visibles: `negocio_items_publicos`).
--   3 · Si el nombre coincide, va antes que los que solo coinciden por un producto o la descripción (dentro de su nivel de «destacado»).
--       Quien busca «tacos» y escribió «Tacos Beto» espera verlo arriba aunque otro negocio venda tacos y esté más cerca.
--   El PUNTAJE no cambia (sigue en [0, 1] y sin tocar): la relevancia del texto solo reordena, no se mezcla con cercanía ni calidad.
--
-- ── Lo que NO hace ──────────────────────────────────────────────────────────
--   · No tolera erratas («taqeria») ni sinónimos («lonchería» por «comida»): eso pide trigramas o un diccionario, y sin datos de búsqueda reales
--     sería adivinar.
--   · No pondera por cuántos productos coinciden.
--
-- Reversión: volver a crear `negocios_ordenados` con el cuerpo de la 0055 y `drop function normalizar_busqueda(text)`.

create extension if not exists unaccent with schema extensions;

-- Auxiliar interna (no la ejecuta ningún cliente): minúsculas y sin acentos. El diccionario va con nombre completo porque la función corre con
-- `search_path = public` y la forma de un argumento no lo encontraría.
create or replace function normalizar_busqueda(t text)
returns text
language sql
stable
set search_path = public
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')));
$$;
revoke execute on function normalizar_busqueda(text) from public, anon, authenticated;

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
  -- El texto buscado, normalizado y con los comodines de LIKE escapados («50%» no es «todo»). Nulo = sin búsqueda.
  patron as (
    select case when nullif(btrim(coalesce(p_texto, '')), '') is null then null
                else '%' || regexp_replace(normalizar_busqueda(btrim(p_texto)), '([\\%_])', '\\\1', 'g') || '%'
           end as p
  ),
  base as (
    select n.id, n.categoria_id, n.nombre, n.descripcion, n.direccion, n.latitud, n.longitud, n.rango_precio, n.horario,
           n.fotos, n.destacado, n.origen, n.creado_en, n.calificacion, n.num_resenas,
           case when yo.lat is null or yo.lon is null or n.latitud is null or n.longitud is null then null
                else distancia_km(yo.lat::double precision, yo.lon::double precision,
                                  n.latitud::double precision, n.longitud::double precision)
           end as d,
           ((select p from patron) is not null and normalizar_busqueda(n.nombre) like (select p from patron)) as coincide_nombre
      from negocios_publicos n
      left join yo on true
     where auth.uid() is not null
       and (p_categoria is null or n.categoria_id = p_categoria)
       and (
         (select p from patron) is null
         or normalizar_busqueda(n.nombre) like (select p from patron)
         or normalizar_busqueda(coalesce(n.descripcion, '')) like (select p from patron)
         or exists (
           select 1 from negocio_items_publicos i
            where i.negocio_id = n.id and normalizar_busqueda(i.nombre) like (select p from patron)
         )
       )
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
   order by pu.destacado desc, pu.coincide_nombre desc, pu.p desc, pu.nombre asc
   limit least(greatest(coalesce(p_limite, 60), 1), 100);
$$;
revoke execute on function negocios_ordenados(text, text, integer) from public, anon, authenticated;
grant execute on function negocios_ordenados(text, text, integer) to authenticated;
