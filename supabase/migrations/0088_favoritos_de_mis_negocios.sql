-- 0088 · Cuántas personas guardaron mi negocio.
--
-- El panel del vendedor dice «te guardaron N». `favoritos_negocios` es PRIVADA (0073): cada quien ve solo lo suyo y nunca se dice QUIÉN guardó un negocio. Esta
-- función devuelve solo el NÚMERO, y solo para los negocios del propio vendedor: quien pregunta por un negocio ajeno no recibe fila (ni siquiera un cero).
--
-- Distinta de `favoritos_por_publicacion` (0045), que cuenta también las publicaciones visibles de otros: aquí el dato es de métricas del dueño, no público.
--
-- Reversión (no se usa, pero se escribe):
--   drop function if exists favoritos_por_negocio(uuid[]);

create or replace function favoritos_por_negocio(p_ids uuid[])
returns table (negocio_id uuid, total integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;

  if coalesce(cardinality(p_ids), 0) > 50 then
    raise exception 'demasiados ids' using errcode = '54000';
  end if;

  return query
    select n.id,
           (select count(*)::integer from favoritos_negocios f where f.negocio_id = n.id)
      from negocios n
     where n.id = any(p_ids)
       and n.usuario_id = auth.uid();
end;
$$;

-- Las TRES concesiones por defecto (0036): anon no tiene nada que hacer aquí.
revoke execute on function favoritos_por_negocio(uuid[]) from public, anon, authenticated;
grant execute on function favoritos_por_negocio(uuid[]) to authenticated;
