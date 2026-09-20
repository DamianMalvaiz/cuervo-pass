-- END-08 · El Nivel 2 escondía publicaciones válidas sin decirlo.
--
-- `sugerencias_con_ranking` (0015) descartaba toda publicación sin embedding:
--
--   where yo.perfil_vector is not null and c.vector_embedding is not null
--
-- Y `obtenerSugerencias` devolvía Nivel 2 con que hubiera UNA sola fila. De
-- veinte publicaciones viables con tres vectorizadas, el usuario veía TRES y
-- creía que ese era el catálogo. Las otras diecisiete pasaban el filtro duro
-- perfectamente: presupuesto, distancia y mascotas.
--
-- Es AUD-01 una capa más arriba —lista incompleta, sin error, sin log, sin
-- pista— y el error de fondo es de granularidad. Lo que degrada cuando falta un
-- embedding no es la EXISTENCIA de la lista: es el ORDEN de una fila. Un `where`
-- convierte una degradación por fila en una amputación del conjunto.
--
-- Aquí el filtro se vuelve un `left join lateral`. Sin vector no hay similitud
-- —`null`, no cero, porque cero es una afinidad medida y esto es su ausencia— y
-- el orden cae al score de filtros duros, sin castigo adicional.
--
-- `nivel` pasa a ser columna POR FILA. Eso permite que la pantalla diga
-- «12 DE 20 CON AFINIDAD SEMÁNTICA» en vez de una bandera binaria, que además
-- es mejor demostración: el número prueba que el motor corre y hasta dónde
-- alcanza, en vez de afirmarlo.
--
-- Reversión: reinstalar el cuerpo de 0015 con `create or replace`.

drop function if exists sugerencias_con_ranking(int);

create or replace function sugerencias_con_ranking(p_limite int default 10)
returns table (id uuid, titulo text, tipo text, direccion text,
               precio_renta numeric, descripcion text, fotos text[],
               permite_mascotas boolean, amueblado boolean,
               latitud double precision, longitud double precision,
               distancia numeric, score numeric,
               similitud numeric, score_final numeric, nivel int)
-- `security invoker` a propósito, igual que 0015: corre con la identidad de
-- quien llama y lee VISTAS, no tablas. Ponerlo en definer aquí escondería que
-- las policies funcionan.
language sql stable security invoker as $$
  with candidatos as (
    select * from sugerencias_publicaciones(30)
  ),
  yo as (select perfil_vector from usuarios where id = auth.uid())
  select c.id, c.titulo, c.tipo, c.direccion, c.precio_renta, c.descripcion,
         c.fotos, c.permite_mascotas, c.amueblado, c.latitud, c.longitud,
         c.distancia, c.score,
         sim.similitud,
         -- Sin similitud el orden es el score de filtros tal cual. No se
         -- sustituye por 0.5 ni por ninguna otra invención: mezclar un valor
         -- fabricado con uno medido produce un número que nadie puede defender.
         coalesce(round((0.6 * c.score + 0.4 * sim.similitud)::numeric, 4), c.score) as score_final,
         case when sim.similitud is not null then 2 else 1 end as nivel
    from candidatos c
    cross join yo
    -- El lateral no filtra: cuando su `where` no se cumple devuelve cero filas y
    -- el `left join` conserva la publicación con `similitud` en null. Esa es
    -- toda la diferencia con el `where` que tenía antes.
    left join lateral (
      select round((1 - (c.vector_embedding <=> yo.perfil_vector))::numeric, 4) as similitud
       where yo.perfil_vector is not null
         and c.vector_embedding is not null
    ) sim on true
   order by score_final desc
   limit p_limite;
$$;

revoke execute on function sugerencias_con_ranking(int) from public;
grant execute on function sugerencias_con_ranking(int) to authenticated;
