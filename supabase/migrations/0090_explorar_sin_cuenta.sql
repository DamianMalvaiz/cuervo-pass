-- 0090 · Explorar sin cuenta (la web).
--
-- La web se puede EXPLORAR sin iniciar sesión, como en Airbnb: se ven las viviendas y los negocios, pero con datos REDUCIDOS. Desde la 0061 `anon` no tiene NADA en
-- `public`; esta migración abre cinco vistas de lista blanca y nada más.
--
-- ── Lo que se ve y lo que NO ────────────────────────────────────────────────
-- SE VE:   título, tipo, precio, recámaras, condiciones, la ZONA (la dirección sin su primer tramo: calle y número), la ubicación REDONDEADA a ~1 km, cuántas fotos hay, si es
--          destacado, la calificación y, de un negocio, su descripción, su horario, si está abierto ahora y sus productos.
-- NO SALE: la dirección exacta, las coordenadas exactas, el teléfono, quién publica (`usuario_id`), la descripción de una VIVIENDA (el dueño puede haber escrito ahí su
--          teléfono), el vector, las rutas de las fotos (llevan el id de la cuenta) y las reseñas con su autor.
--
-- ── Las fotos ───────────────────────────────────────────────────────────────
-- El almacenamiento es privado y `anon` no firma nada. Las fotos para quien no tiene cuenta las servirá una Edge Function con la llave de servicio, que solo firma las de
-- lo que estas vistas ya enseñan. Aquí solo se dice CUÁNTAS hay (`num_fotos`).
--
-- ── Una trampa de PostgreSQL ────────────────────────────────────────────────
-- Las FUNCIONES que llama una vista se ejecutan con los permisos de quien la consulta, no con los del dueño de la vista. Por eso `anon` necesita EXECUTE sobre las dos que usan
-- estas vistas: `zona_aproximada` (pura) y `negocio_abierto_en` (la usa `negocios_publicos`). Son las ÚNICAS funciones de `public` que `anon` ejecuta: una prueba lo fija exacto.
--
-- ── Cómo se protege lo que NO está ──────────────────────────────────────────
-- Vistas `security definer` (el dueño de la vista lee las tablas; `anon` solo la vista), con la lista de columnas fijada EXACTA en `rls.test.sql`: lo que protege aquí es
-- lo que no aparece, y una columna nueva tiene que añadirse a esa lista a propósito. Solo SELECT: una vista con unión no admite escrituras y además `anon` no tiene más.
--
-- Reversión (no se usa, pero se escribe):
--   drop view if exists explorar_publicaciones, explorar_negocios, explorar_productos, explorar_horarios, explorar_categorias;
--   drop function if exists zona_aproximada(text);

-- La zona de una dirección: lo que queda sin su primer tramo (calle y número). Una dirección sin comas no tiene zona que decir: no se enseña la calle.
create or replace function zona_aproximada(p_direccion text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(btrim(regexp_replace(coalesce(p_direccion, ''), '^[^,]*,', '')), '')
   where position(',' in coalesce(p_direccion, '')) > 0
     and nullif(btrim(regexp_replace(coalesce(p_direccion, ''), '^[^,]*,', '')), '') is not null
     and btrim(regexp_replace(coalesce(p_direccion, ''), '^[^,]*,', '')) <> ',';
$$;
revoke execute on function zona_aproximada(text) from public, anon, authenticated;
grant execute on function zona_aproximada(text) to anon, authenticated;

-- Viviendas visibles (activas y no ocultas por reportes: lo decide `publicaciones_publicas`).
create or replace view explorar_publicaciones with (security_invoker = false) as
  select p.id, p.titulo, p.tipo, p.precio_renta, p.recamaras, p.amueblado, p.permite_mascotas, p.servicios_incluidos,
         zona_aproximada(p.direccion) as zona,
         round(p.latitud::numeric, 2)::double precision as latitud_aprox,
         round(p.longitud::numeric, 2)::double precision as longitud_aprox,
         coalesce(cardinality(p.fotos), 0) as num_fotos,
         p.destacado,
         c.calificacion, c.num_resenas,
         p.creado_en
    from publicaciones_publicas p
    left join calificacion_publicaciones c on c.publicacion_id = p.id;

-- Negocios visibles (activos, no ocultos y dentro del límite de su plan: lo decide `negocios_publicos`).
create or replace view explorar_negocios with (security_invoker = false) as
  select n.id, n.categoria_id, n.nombre, n.descripcion,
         zona_aproximada(n.direccion) as zona,
         round(n.latitud, 2)::double precision as latitud_aprox,
         round(n.longitud, 2)::double precision as longitud_aprox,
         n.horario,
         coalesce(cardinality(n.fotos), 0) as num_fotos,
         n.destacado, n.calificacion, n.num_resenas, n.abierto_ahora,
         n.creado_en
    from negocios_publicos n;

create or replace view explorar_productos with (security_invoker = false) as
  select i.id, i.negocio_id, i.nombre, i.precio, i.seccion, i.descripcion,
         coalesce(cardinality(i.fotos), 0) as num_fotos,
         i.estrella, i.orden
    from negocio_items_publicos i;

create or replace view explorar_horarios with (security_invoker = false) as
  select h.negocio_id, h.dia, h.abre, h.cierra
    from negocio_horarios_publicos h;

create or replace view explorar_categorias with (security_invoker = false) as
  select c.id, c.nombre, c.icono, c.orden
    from categorias_servicio c;

revoke all on explorar_publicaciones, explorar_negocios, explorar_productos, explorar_horarios, explorar_categorias from public, anon, authenticated;
grant select on explorar_publicaciones, explorar_negocios, explorar_productos, explorar_horarios, explorar_categorias to anon, authenticated;

-- Las viviendas no la necesitan, pero `negocios_publicos` calcula `abierto_ahora` con ella: sin esto `anon` no podría leer ni un negocio.
grant execute on function negocio_abierto_en(uuid, timestamptz) to anon;
