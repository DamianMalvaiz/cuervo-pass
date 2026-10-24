-- 0087 · Depas destacados.
--
-- Un arrendador con el plan que destaca (Plus, o su prueba gratis: `planes.destaca`) sale en el carrusel «Destacados» de Departamentos, en Inicio.
--
-- ── De dónde sale «destacado» ───────────────────────────────────────────────
-- Del PLAN, no de una columna que el vendedor escriba: `publicaciones_publicas` lo calcula con `planes_efectivos` (la misma fuente que ya usa
-- `negocios_publicos` para Servicios, 0053). Un plan vencido deja de destacar solo, sin que nadie toque nada.
--
-- ── La función ──────────────────────────────────────────────────────────────
-- `destacadas_publicaciones(limite, tipo)`: `security invoker` sobre la vista, como `nuevas_esta_semana`, con los MISMOS filtros duros que las sugerencias
-- (presupuesto con 10 % de margen, radio de la universidad, mascotas) y sin las propias. No devuelve `vector_embedding`. Orden: por ajuste, el mejor primero.
--
-- Reversión (no se usa, pero se escribe):
--   drop function if exists destacadas_publicaciones(int, text);
--   create or replace view publicaciones_publicas como en la 0014 (sin `destacado`).

create or replace view publicaciones_publicas with (security_invoker = false) as
  select p.id, p.usuario_id, p.titulo, p.tipo, p.direccion, p.latitud, p.longitud,
         p.precio_renta, p.descripcion, p.permite_mascotas, p.amueblado,
         p.servicios_incluidos, p.recamaras, p.fotos, p.vector_embedding, p.creado_en,
         coalesce(pe.destaca, false) as destacado
    from publicaciones p
    left join planes_efectivos pe on pe.usuario_id = p.usuario_id and pe.rol = 'arrendador'
   where p.activa = true and p.oculta_por_reportes = false;

create or replace function destacadas_publicaciones(
  p_limite int default 10,
  p_tipo text default null
)
returns table (
  id uuid, titulo text, tipo text, direccion text,
  precio_renta numeric, descripcion text, fotos text[],
  latitud double precision, longitud double precision,
  distancia numeric, score numeric, creado_en timestamptz
)
language sql stable security invoker
set search_path = public
as $$
  with yo as (select * from usuarios where id = auth.uid())
  select
    p.id, p.titulo, p.tipo, p.direccion,
    p.precio_renta, p.descripcion, p.fotos,
    p.latitud, p.longitud,
    round(d.km::numeric, 2) as distancia,
    score_ajuste(d.km::numeric, p.precio_renta, yo.presupuesto_min, yo.presupuesto_max,
                 yo.distancia_max_km, p.permite_mascotas, yo.mascotas,
                 du.nivel_ruido, yo.nivel_ruido, p.creado_en) as score,
    p.creado_en
  from publicaciones_publicas p
  join perfiles_publicos du on du.id = p.usuario_id
  cross join yo
  cross join lateral (
    select distancia_km(p.latitud, p.longitud, yo.latitud_universidad, yo.longitud_universidad) as km
  ) d
  where p.destacado
    and p.usuario_id <> auth.uid()
    and (p_tipo is null or p.tipo = p_tipo)
    and (yo.presupuesto_max is null or p.precio_renta <= yo.presupuesto_max * 1.10)
    and (d.km is null or d.km <= coalesce(yo.distancia_max_km, 5))
    and (yo.mascotas = false or p.permite_mascotas = true)
  order by score_ajuste(d.km::numeric, p.precio_renta, yo.presupuesto_min, yo.presupuesto_max,
                        yo.distancia_max_km, p.permite_mascotas, yo.mascotas,
                        du.nivel_ruido, yo.nivel_ruido, p.creado_en) desc
  limit p_limite;
$$;

revoke execute on function destacadas_publicaciones(int, text) from public, anon, authenticated;
grant execute on function destacadas_publicaciones(int, text) to authenticated;
