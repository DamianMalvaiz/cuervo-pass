-- Semana 9, sección 15: similitud de coseno con pgvector, aplicada SOLO al
-- subconjunto que ya pasó el Nivel 1 (filtros ponderados en el cliente,
-- src/lib/scoring.ts) — nunca reemplaza esos filtros, los reordena por
-- significado dentro de lo que ya es viable en presupuesto/distancia.
--
-- Sin `security definer` a propósito: como función normal, respeta la RLS de
-- quien la llama — ya solo puede tocar publicaciones activas (misma policy
-- que un select directo), así que no hace falta elevar privilegios aquí.
create or replace function ordenar_por_similitud(vector_perfil vector(384), ids_candidatos uuid[])
returns table(id uuid, similitud double precision)
language sql
stable
as $$
  select p.id, 1 - (p.vector_embedding <=> vector_perfil) as similitud
  from publicaciones p
  where p.activa = true
    and p.id = any(ids_candidatos)
    and p.vector_embedding is not null
  order by p.vector_embedding <=> vector_perfil;
$$;

grant execute on function ordenar_por_similitud(vector, uuid[]) to authenticated;
