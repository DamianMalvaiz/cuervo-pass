-- END-32 · La pantalla de inicio pintaba el mismo contenido hasta cuatro veces.
--
-- Tres carruseles y una lista, todos sobre el MISMO conjunto:
--   «Mejor afinidad contigo» era `filtradas.slice(0, 8)` — un prefijo LITERAL de
--   la lista que empezaba veinticuatro fichas más abajo.
--   «Más cerca de tu campus» y «Las de menor renta» eran reordenamientos.
-- No es arquitectura de información: es indecisión renderizada.
--
-- ── Por qué el ORDEN va al servidor, aunque la orden dijera «en el sitio» ────
-- «Las de menor renta» ordenaba por precio el top-30 **ya truncado por score**.
-- O sea: las más baratas de las treinta que mejor encajan, no las más baratas.
-- Es END-17 con otro disfraz — el mismo defecto que B.3 acaba de quitar de los
-- chips de tipo—, y ponerlo en el cliente lo habría reintroducido un día
-- después de corregirlo.
--
-- El orden entra por parámetro en la función INTERNA, la que trunca. Ordenar
-- primero y cortar después es toda la diferencia, igual que con `p_tipo`.
--
-- La expresión de orden usa `case` por clave en vez de tres funciones distintas:
-- para `precio` la primera clave lleva el precio y las otras van todas a null
-- —todas iguales, así que no ordenan—, y la última queda de desempate. Es el
-- único modo de tener orden variable en una función `language sql`, que no
-- admite SQL dinámico.
--
-- ── El carrusel que queda ───────────────────────────────────────────────────
-- `nuevas_esta_semana` trae lo que la lista NO tiene: lo reciente. La lista
-- ordena por encaje; esto ordena por fecha. Que un carrusel exista se justifica
-- por traer OTRA información, no por presentar la misma con otro peine.
--
-- Respeta `p_tipo` a propósito: un carrusel de novedades que ignorara el chip
-- activo contradiría a la pantalla en la que vive —con «Cuarto» seleccionado
-- ofrecería departamentos—, y esa contradicción es de la misma familia que la
-- que END-32 denuncia.
--
-- Reversión: reinstalar los cuerpos de 0034 con `create or replace` y
-- `drop function nuevas_esta_semana(int, text);`

drop function if exists sugerencias_con_ranking(int, text);
drop function if exists sugerencias_publicaciones(int, text);

create or replace function sugerencias_publicaciones(
  p_limite int default 30,
  p_tipo text default null,
  p_orden text default 'ajuste'
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
  order by
    (case when p_orden = 'precio' then p.precio_renta end) asc nulls last,
    (case when p_orden = 'cercania' then d.km end) asc nulls last,
    score_ajuste(d.km::numeric, p.precio_renta, yo.presupuesto_min, yo.presupuesto_max,
                 yo.distancia_max_km, p.permite_mascotas, yo.mascotas,
                 du.nivel_ruido, yo.nivel_ruido, p.creado_en) desc
  limit p_limite;
$$;

revoke execute on function sugerencias_publicaciones(int, text, text) from public, anon, authenticated;
grant execute on function sugerencias_publicaciones(int, text, text) to authenticated;

create or replace function sugerencias_con_ranking(
  p_limite int default 10,
  p_tipo text default null,
  p_orden text default 'ajuste'
)
returns table (id uuid, titulo text, tipo text, direccion text,
               precio_renta numeric, descripcion text, fotos text[],
               permite_mascotas boolean, amueblado boolean,
               latitud double precision, longitud double precision,
               distancia numeric, score numeric,
               similitud numeric, score_final numeric, nivel int)
language sql stable security invoker as $$
  with candidatos as (
    select * from sugerencias_publicaciones(30, p_tipo, p_orden)
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
    left join lateral (
      select round((1 - (v.vector_embedding <=> yo.perfil_vector))::numeric, 4) as similitud
        from publicaciones_publicas v
       where v.id = c.id
         and yo.perfil_vector is not null
         and v.vector_embedding is not null
    ) sim on true
   -- El orden elegido MANDA sobre el reordenamiento por afinidad. Si alguien
   -- pidió «menor renta» y la lista sale ordenada por score_final, el control no
   -- controla nada.
   order by
     (case when p_orden = 'precio' then c.precio_renta end) asc nulls last,
     (case when p_orden = 'cercania' then c.distancia end) asc nulls last,
     coalesce(round((0.6 * c.score + 0.4 * sim.similitud)::numeric, 4), c.score) desc
   limit p_limite;
$$;

revoke execute on function sugerencias_con_ranking(int, text, text) from public, anon, authenticated;
grant execute on function sugerencias_con_ranking(int, text, text) to authenticated;

-- ── El único carrusel ───────────────────────────────────────────────────────
create or replace function nuevas_esta_semana(
  p_limite int default 10,
  p_tipo text default null
)
returns table (
  id uuid, titulo text, tipo text, direccion text,
  precio_renta numeric, descripcion text, fotos text[],
  latitud double precision, longitud double precision,
  distancia numeric, score numeric, creado_en timestamptz
)
language sql stable security invoker as $$
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
    select distancia_km(p.latitud, p.longitud,
                        yo.latitud_universidad, yo.longitud_universidad) as km
  ) d
  -- El MISMO filtro duro que las sugerencias. Una novedad que no puedes pagar o
  -- que está fuera de tu radio no es una novedad para ti: es ruido con fecha.
  where p.usuario_id <> auth.uid()
    and p.creado_en >= now() - interval '7 days'
    and (p_tipo is null or p.tipo = p_tipo)
    and (yo.presupuesto_max is null or p.precio_renta <= yo.presupuesto_max * 1.10)
    and (d.km is null or d.km <= coalesce(yo.distancia_max_km, 5))
    and (yo.mascotas = false or p.permite_mascotas = true)
  order by p.creado_en desc
  limit p_limite;
$$;

-- Invariante 9: revoke explícito a los tres, y grant a quien de verdad llama.
revoke execute on function nuevas_esta_semana(int, text) from public, anon, authenticated;
grant execute on function nuevas_esta_semana(int, text) to authenticated;
