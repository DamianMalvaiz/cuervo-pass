-- END-17 · El último filtro que el usuario toca era el único que no corría en
-- Postgres.
--
-- `inicio.tsx` filtraba por tipo EN EL CLIENTE, sobre el top-30 que el servidor
-- ya había truncado. Si en esos treinta no había ningún cuarto, la app decía
-- «SIN REGISTROS DE ESE TIPO» con cincuenta cuartos disponibles en la base.
-- Es el invariante 5 al revés, y la arquitectura entera mueve el filtrado a
-- Postgres precisamente para que esto no pase.
--
-- El filtro va en la funcion INTERNA, no en la envoltura: si se aplicara en
-- `sugerencias_con_ranking` seguiríamos truncando a treinta antes de filtrar, y
-- el bug sobreviviría con otra ropa. Filtrar primero y truncar después es toda
-- la diferencia.
--
-- El parámetro es `text` y no un enum: `publicaciones.tipo` es `text` con un
-- CHECK (migración 0010), y un enum nuevo obligaría a un cast en cada llamada
-- sin ganar nada que el CHECK no dé ya.
--
-- Un tipo desconocido devuelve CERO filas, no el catálogo entero. Falla cerrado
-- (invariante 1): el valor llega del cliente, y devolver todo ante una cadena
-- que no se reconoce es exactamente el fallo que END-17 describe, al revés.
--
-- Reversión: reinstalar los cuerpos de 0033 con `create or replace`.

drop function if exists sugerencias_con_ranking(int);
drop function if exists sugerencias_publicaciones(int);

create or replace function sugerencias_publicaciones(
  p_limite int default 30,
  p_tipo text default null
)
returns table (
  id uuid, titulo text, tipo text, direccion text,
  precio_renta numeric, descripcion text, fotos text[],
  permite_mascotas boolean, amueblado boolean,
  latitud double precision, longitud double precision,
  distancia numeric, score numeric
)
language sql stable security invoker as $$
  with yo as (select * from usuarios where id = auth.uid())
  select
    p.id, p.titulo, p.tipo, p.direccion,
    p.precio_renta, p.descripcion, p.fotos,
    p.permite_mascotas, p.amueblado,
    p.latitud, p.longitud,
    round(d.km::numeric, 2) as distancia,
    score_ajuste(d.km::numeric, p.precio_renta, yo.presupuesto_min, yo.presupuesto_max,
                 yo.distancia_max_km, p.permite_mascotas, yo.mascotas,
                 du.nivel_ruido, yo.nivel_ruido, p.creado_en) as score
  from publicaciones_publicas p
  join perfiles_publicos du on du.id = p.usuario_id
  cross join yo
  cross join lateral (
    select distancia_km(p.latitud, p.longitud,
                        yo.latitud_universidad, yo.longitud_universidad) as km
  ) d
  where p.usuario_id <> auth.uid()
    and (p_tipo is null or p.tipo = p_tipo)
    and (yo.presupuesto_max is null or p.precio_renta <= yo.presupuesto_max * 1.10)
    and (d.km is null or d.km <= coalesce(yo.distancia_max_km, 5))
    and (yo.mascotas = false or p.permite_mascotas = true)
  order by score desc
  limit p_limite;
$$;

revoke execute on function sugerencias_publicaciones(int, text) from public;
grant execute on function sugerencias_publicaciones(int, text) to authenticated;

create or replace function sugerencias_con_ranking(
  p_limite int default 10,
  p_tipo text default null
)
returns table (id uuid, titulo text, tipo text, direccion text,
               precio_renta numeric, descripcion text, fotos text[],
               permite_mascotas boolean, amueblado boolean,
               latitud double precision, longitud double precision,
               distancia numeric, score numeric,
               similitud numeric, score_final numeric, nivel int)
language sql stable security invoker as $$
  with candidatos as (
    -- El `p_tipo` se PROPAGA. Olvidarlo aquí devolvería el catálogo entero sin
    -- error y sin log, con una firma que promete lo contrario: el peor de los
    -- dos mundos. La aserción 67 existe solo para eso.
    select * from sugerencias_publicaciones(30, p_tipo)
  ),
  yo as (select perfil_vector from usuarios where id = auth.uid())
  select c.id, c.titulo, c.tipo, c.direccion, c.precio_renta, c.descripcion,
         c.fotos, c.permite_mascotas, c.amueblado, c.latitud, c.longitud,
         c.distancia, c.score,
         sim.similitud,
         coalesce(round((0.6 * c.score + 0.4 * sim.similitud)::numeric, 4), c.score) as score_final,
         case when sim.similitud is not null then 2 else 1 end as nivel
    from candidatos c
    cross join yo
    -- END-28 · el vector se busca por id en la VISTA, no viaja en la fila.
    left join lateral (
      select round((1 - (v.vector_embedding <=> yo.perfil_vector))::numeric, 4) as similitud
        from publicaciones_publicas v
       where v.id = c.id
         and yo.perfil_vector is not null
         and v.vector_embedding is not null
    ) sim on true
   order by score_final desc
   limit p_limite;
$$;

revoke execute on function sugerencias_con_ranking(int, text) from public;
grant execute on function sugerencias_con_ranking(int, text) to authenticated;
