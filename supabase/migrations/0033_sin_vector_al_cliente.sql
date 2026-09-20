-- END-28 · Trescientos ochenta y cuatro flotantes al teléfono, por fila.
--
-- `sugerencias_publicaciones` devolvía `vector_embedding vector(384)` en su
-- tabla de retorno. El cliente **nunca** lo lee: toda la similitud de coseno se
-- calcula del lado de Postgres (§18), y `database.types.ts` ya advierte que el
-- vector se lee de vuelta como texto y que no hace falta parsearlo en el
-- cliente.
--
-- Medido contra producción el 19/09/2026: **el 85 % del payload**, 4 697 bytes
-- por fila. Con `limite = 30` son unos 140 KB por refresco, en red móvil, para
-- nada. Y se paga en cada regreso a la pantalla de sugerencias.
--
-- `sugerencias_con_ranking` sí lo necesita, así que se une por id en vez de
-- recibirlo de vuelta. El vector no sale de la base en ningún momento.
--
-- Reversión: reinstalar los cuerpos de 0031 y 0027 con `create or replace`.

drop function if exists sugerencias_con_ranking(int);
drop function if exists sugerencias_publicaciones(int);

create or replace function sugerencias_publicaciones(p_limite int default 30)
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
    and (yo.presupuesto_max is null or p.precio_renta <= yo.presupuesto_max * 1.10)
    and (d.km is null or d.km <= coalesce(yo.distancia_max_km, 5))
    and (yo.mascotas = false or p.permite_mascotas = true)
  order by score desc
  limit p_limite;
$$;

revoke execute on function sugerencias_publicaciones(int) from public;
grant execute on function sugerencias_publicaciones(int) to authenticated;

create or replace function sugerencias_con_ranking(p_limite int default 10)
returns table (id uuid, titulo text, tipo text, direccion text,
               precio_renta numeric, descripcion text, fotos text[],
               permite_mascotas boolean, amueblado boolean,
               latitud double precision, longitud double precision,
               distancia numeric, score numeric,
               similitud numeric, score_final numeric, nivel int)
language sql stable security invoker as $$
  with candidatos as (
    select * from sugerencias_publicaciones(30)
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
    -- El vector se busca AQUÍ, por id, en vez de venir arrastrado desde la
    -- función de candidatos. Se lee de la vista pública, que es la misma que ya
    -- decidió qué publicaciones son visibles: leer la tabla se evaluaría como
    -- `authenticated` y devolvería cero filas — AUD-01 otra vez.
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

revoke execute on function sugerencias_con_ranking(int) from public;
grant execute on function sugerencias_con_ranking(int) to authenticated;
