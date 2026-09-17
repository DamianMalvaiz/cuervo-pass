-- Semana 10, sección 15 extendida a roomings: aquí no hay un "Nivel 1" de
-- filtros duros como presupuesto/distancia (ambos ya buscan roomie cerca de
-- la misma universidad) — el orden por afinidad es directamente similitud de
-- coseno entre el perfil de quien busca y el de cada candidato.
--
-- Sin `security definer`: cualquier autenticado ya puede leer perfiles
-- activos directo (policy de usuarios, migración 0001), así que unir con
-- usuarios aquí no expone nada que un select normal no exponga ya.
create or replace function ordenar_roomings_por_similitud(vector_perfil vector(384), ids_candidatos uuid[])
returns table(id uuid, similitud double precision)
language sql
stable
as $$
  select r.id, 1 - (u.perfil_vector <=> vector_perfil) as similitud
  from roomings r
  join usuarios u on u.id = r.usuario_id
  where r.estado = 'activo'
    and r.id = any(ids_candidatos)
    and u.perfil_vector is not null
  order by u.perfil_vector <=> vector_perfil;
$$;

grant execute on function ordenar_roomings_por_similitud(vector, uuid[]) to authenticated;
