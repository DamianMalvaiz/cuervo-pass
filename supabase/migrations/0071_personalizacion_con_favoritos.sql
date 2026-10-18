-- Personalización con favoritos y «Parecidos a este» · Fase 1.2 del plan de excelencia.
--
-- ── Qué cambia ──────────────────────────────────────────────────────────────
-- Hasta ahora la afinidad de un depa era el coseno entre TU perfil (cuestionario) y la publicación. Lo que guardas en favoritos
-- no influía en nada. Ahora la similitud mezcla dos cosas:
--
--   similitud = (1 − w)·coseno(tu perfil, publicación) + w·coseno(centroide de tus favoritos, publicación)
--   w         = 0.75 · n / (n + 3)            n = favoritos con vector
--
-- Es Rocchio en su forma de FUSIÓN TARDÍA: en vez de mover el vector del perfil (pgvector no multiplica un vector por un escalar,
-- y mezclar vectores cambiaría su norma) se mezclan los dos cosenos, que dicen lo mismo y son comparables. Con 1 favorito w = 0.19;
-- con 3, 0.38; con 10, 0.58; nunca pasa de 0.75: tu cuestionario siempre pesa al menos un cuarto. Sin favoritos, w = 0 y el
-- resultado es EXACTAMENTE el de antes. Sin perfil pero con favoritos, rige solo el centroide.
--
-- Una publicación que YA guardaste no se auto-refuerza: su similitud se calcula solo con tu perfil (si no, estaría cerca de su
-- propio centroide y subiría por haberla guardado).
--
-- La lista (`sugerencias_con_ranking`) y la ficha (`afinidad_de_para`) usan la MISMA fórmula: tocar una tarjeta no debe cambiar
-- el número por el que la tocaste (lección de la 0039).
--
-- ── Explicable ──────────────────────────────────────────────────────────────
-- Ambas devuelven `parecido_a`: el título de TU favorito más cercano, pero solo si el coseno ≥ 0.70. Medido el 18/10/2026 sobre
-- las 114 publicaciones con vector (6 441 pares): mediana 0.42, p90 0.73, p99 0.95. 0.70 ≈ el 10 % más parecido: un umbral bajo
-- haría que casi todo «se parezca» a algo y la explicación dejaría de decir algo. Es una decisión de producto, no una medida.
--
-- ── Privacidad ──────────────────────────────────────────────────────────────
-- Solo se leen TUS favoritos (RLS) y solo publicaciones visibles (`publicaciones_publicas`). Ningún vector sale al cliente
-- (invariante de la 0033): se devuelven el coseno ya redondeado y un título. `parecido_a` es un título que tú ya guardaste.
--
-- ── Parecidos a este ────────────────────────────────────────────────────────
-- `publicaciones_parecidas(publicación, límite)`: las publicaciones visibles más cercanas por coseno, mínimo 0.60 (≈ p70),
-- sin las tuyas y sin la misma. Tope de 12. Con pocos cientos de filas la comparación es exacta; si la tabla crece por encima de
-- unos miles habrá que pasar a una consulta con el índice ivfflat.
--
-- Reversión: reinstalar los cuerpos de 0037 (`sugerencias_con_ranking`) y 0031/0036 (`afinidad_de_para`, `afinidad_de`) con
-- `drop function` + `create function`, y `drop function if exists publicaciones_parecidas(uuid, int);`

drop function if exists sugerencias_con_ranking(int, text, text);

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
               similitud numeric, score_final numeric, nivel int,
               parecido_a text)
language sql stable security invoker set search_path = public as $$
  with candidatos as (
    select * from sugerencias_publicaciones(30, p_tipo, p_orden)
  ),
  yo as (select perfil_vector from usuarios where id = auth.uid()),
  favs as (
    select avg(p.vector_embedding) as centroide, count(*)::int as n
      from favoritos f
      join publicaciones_publicas p on p.id = f.publicacion_id
     where f.usuario_id = auth.uid() and p.vector_embedding is not null
  ),
  puntuadas as (
    select c.*, sim.similitud, near.titulo as cercano, near.coseno as coseno_cercano
      from candidatos c
      cross join yo
      cross join favs
      join publicaciones_publicas v on v.id = c.id
      cross join lateral (
        select
          case
            when v.vector_embedding is null then null
            when yo.perfil_vector is not null and favs.n > 0
                 and not exists (select 1 from favoritos x where x.usuario_id = auth.uid() and x.publicacion_id = c.id)
              then round(((1 - 0.75 * favs.n / (favs.n + 3.0)) * (1 - (v.vector_embedding <=> yo.perfil_vector))
                          + (0.75 * favs.n / (favs.n + 3.0)) * (1 - (v.vector_embedding <=> favs.centroide)))::numeric, 4)
            when yo.perfil_vector is not null
              then round((1 - (v.vector_embedding <=> yo.perfil_vector))::numeric, 4)
            when favs.n > 0
                 and not exists (select 1 from favoritos x where x.usuario_id = auth.uid() and x.publicacion_id = c.id)
              then round((1 - (v.vector_embedding <=> favs.centroide))::numeric, 4)
          end as similitud
      ) sim
      left join lateral (
        select p.titulo, (1 - (p.vector_embedding <=> v.vector_embedding))::numeric as coseno
          from favoritos f
          join publicaciones_publicas p on p.id = f.publicacion_id
         where f.usuario_id = auth.uid() and p.id <> c.id
           and p.vector_embedding is not null and v.vector_embedding is not null
         order by p.vector_embedding <=> v.vector_embedding
         limit 1
      ) near on true
  )
  select p.id, p.titulo, p.tipo, p.direccion, p.precio_renta, p.descripcion,
         p.fotos, p.permite_mascotas, p.amueblado, p.latitud, p.longitud,
         p.distancia, p.score,
         p.similitud,
         coalesce(round((0.6 * p.score + 0.4 * p.similitud)::numeric, 4), p.score) as score_final,
         case when p.similitud is not null then 2 else 1 end as nivel,
         case when p.coseno_cercano >= 0.70 then p.cercano end as parecido_a
    from puntuadas p
   -- El orden elegido MANDA sobre el reordenamiento por afinidad (0037).
   order by
     (case when p_orden = 'precio' then p.precio_renta end) asc nulls last,
     (case when p_orden = 'cercania' then p.distancia end) asc nulls last,
     coalesce(round((0.6 * p.score + 0.4 * p.similitud)::numeric, 4), p.score) desc
   limit p_limite;
$$;

revoke execute on function sugerencias_con_ranking(int, text, text) from public, anon, authenticated;
grant execute on function sugerencias_con_ranking(int, text, text) to authenticated;

-- ── La ficha: la MISMA fórmula, para un usuario dado ────────────────────────
drop function if exists afinidad_de(uuid);
drop function if exists afinidad_de_para(uuid, uuid);

create or replace function afinidad_de_para(p_usuario_id uuid, p_publicacion_id uuid)
returns table (score numeric, similitud numeric, score_final numeric, nivel int, parecido_a text)
language sql
stable
security definer   -- lee `usuarios` de un id dado; la envoltura pública acota a auth.uid()
set search_path = public
as $$
  with yo as (select * from usuarios where id = p_usuario_id),
  pub as (
    select p.*, du.nivel_ruido as ruido_publicador
      from publicaciones_publicas p
      join perfiles_publicos du on du.id = p.usuario_id
     where p.id = p_publicacion_id
  ),
  favs as (
    select avg(p.vector_embedding) as centroide, count(*)::int as n
      from favoritos f
      join publicaciones_publicas p on p.id = f.publicacion_id
     where f.usuario_id = p_usuario_id and p.vector_embedding is not null
  ),
  es_favorita as (
    select exists (select 1 from favoritos x where x.usuario_id = p_usuario_id and x.publicacion_id = p_publicacion_id) as si
  ),
  calculo as (
    select
      score_ajuste(
        distancia_km(pub.latitud, pub.longitud, yo.latitud_universidad, yo.longitud_universidad)::numeric,
        pub.precio_renta, yo.presupuesto_min, yo.presupuesto_max, yo.distancia_max_km,
        pub.permite_mascotas, yo.mascotas, pub.ruido_publicador, yo.nivel_ruido, pub.creado_en
      ) as score,
      case
        when pub.vector_embedding is null then null
        when yo.perfil_vector is not null and favs.n > 0 and not ef.si
          then round(((1 - 0.75 * favs.n / (favs.n + 3.0)) * (1 - (pub.vector_embedding <=> yo.perfil_vector))
                      + (0.75 * favs.n / (favs.n + 3.0)) * (1 - (pub.vector_embedding <=> favs.centroide)))::numeric, 4)
        when yo.perfil_vector is not null
          then round((1 - (pub.vector_embedding <=> yo.perfil_vector))::numeric, 4)
        when favs.n > 0 and not ef.si
          then round((1 - (pub.vector_embedding <=> favs.centroide))::numeric, 4)
      end as similitud,
      (select case when (1 - (p.vector_embedding <=> pub.vector_embedding)) >= 0.70 then p.titulo end
         from favoritos f
         join publicaciones_publicas p on p.id = f.publicacion_id
        where f.usuario_id = p_usuario_id and p.id <> p_publicacion_id
          and p.vector_embedding is not null and pub.vector_embedding is not null
        order by p.vector_embedding <=> pub.vector_embedding
        limit 1) as parecido_a
    from pub cross join yo cross join favs cross join es_favorita ef
  )
  select
    c.score,
    c.similitud,
    coalesce(round((0.6 * c.score + 0.4 * c.similitud)::numeric, 4), c.score) as score_final,
    case when c.similitud is not null then 2 else 1 end as nivel,
    c.parecido_a
  from calculo c;
$$;

revoke execute on function afinidad_de_para(uuid, uuid) from public, anon, authenticated;
grant execute on function afinidad_de_para(uuid, uuid) to service_role;

create or replace function afinidad_de(p_publicacion_id uuid)
returns table (score numeric, similitud numeric, score_final numeric, nivel int, parecido_a text)
language sql
stable
security definer
set search_path = public
as $$
  select * from afinidad_de_para(auth.uid(), p_publicacion_id);
$$;

revoke execute on function afinidad_de(uuid) from public, anon, authenticated;
grant execute on function afinidad_de(uuid) to authenticated;

-- ── Parecidos a este ────────────────────────────────────────────────────────
create or replace function publicaciones_parecidas(p_publicacion uuid, p_limite int default 6)
returns table (id uuid, titulo text, tipo text, direccion text, precio_renta numeric, fotos text[], similitud numeric)
language sql stable security invoker set search_path = public as $$
  select b.id, b.titulo, b.tipo, b.direccion, b.precio_renta, b.fotos,
         round((1 - (b.vector_embedding <=> a.vector_embedding))::numeric, 4) as similitud
    from publicaciones_publicas a
    join publicaciones_publicas b on b.id <> a.id
   where a.id = p_publicacion
     and a.vector_embedding is not null
     and b.vector_embedding is not null
     and b.usuario_id <> auth.uid()
     and (1 - (b.vector_embedding <=> a.vector_embedding)) >= 0.60
   order by b.vector_embedding <=> a.vector_embedding
   limit least(greatest(coalesce(p_limite, 6), 1), 12);
$$;

revoke execute on function publicaciones_parecidas(uuid, int) from public, anon, authenticated;
grant execute on function publicaciones_parecidas(uuid, int) to authenticated;
