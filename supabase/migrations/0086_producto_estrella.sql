-- 0086 · Producto estrella.
--
-- El vendedor marca hasta 6 productos de su tienda como «estrella»: salen primero, en un carrusel, en la ficha de su negocio.
--
-- ── Qué NO es ───────────────────────────────────────────────────────────────
-- · No es el «Destacado» del plan (0053): ese pone el NEGOCIO primero en las listas de Servicios y lo paga quien tiene el plan.
-- · No es «más vendido»: la app no mide ventas (las compras se acuerdan por chat). Es una elección del vendedor.
--
-- ── Qué se valida ───────────────────────────────────────────────────────────
-- Máximo 6 estrellas por negocio, comprobado dentro de `guardar_menu` (23514): el menú se guarda ENTERO en una transacción, así que si se pasa nada cambia.
--
-- Reversión (no se usa, pero se escribe):
--   create or replace view negocio_items_publicos como en la 0085 (sin `estrella`); guardar_menu como en la 0085;
--   revoke del grant de columna; alter table negocio_items drop column estrella.

alter table negocio_items add column if not exists estrella boolean not null default false;

grant insert (negocio_id, nombre, precio, orden, seccion, descripcion, foto, fotos, estrella) on negocio_items to authenticated;
grant update (nombre, precio, orden, seccion, descripcion, foto, fotos, estrella) on negocio_items to authenticated;

-- `guardar_menu` (0085), ahora con `estrella` y su tope. `set search_path = public`: lo fijó la 0067 y un `create or replace` lo pierde si no se repite.
create or replace function guardar_menu(p_negocio uuid, p_items jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'menu invalido' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_array_elements(p_items) e where coalesce((e->>'estrella')::boolean, false)) > 6 then
    raise exception 'mas de 6 productos estrella' using errcode = '23514';
  end if;

  select coalesce(array_agg((e->>'id')::uuid) filter (where e->>'id' is not null), '{}'::uuid[])
    into v_ids from jsonb_array_elements(p_items) e;

  delete from negocio_items where negocio_id = p_negocio and id <> all(v_ids);

  update negocio_items i
     set nombre = x.nombre, precio = x.precio, orden = x.orden,
         seccion = x.seccion, descripcion = x.descripcion, fotos = x.fotos, estrella = x.estrella
    from (
      select (e->>'id')::uuid as id, e->>'nombre' as nombre, (e->>'precio')::numeric as precio, (t.ord - 1)::smallint as orden,
             nullif(btrim(e->>'seccion'), '') as seccion, nullif(btrim(e->>'descripcion'), '') as descripcion,
             case when jsonb_typeof(e->'fotos') = 'array' then array(select jsonb_array_elements_text(e->'fotos'))
                  when nullif(e->>'foto', '') is not null then array[e->>'foto']
                  else '{}'::text[] end as fotos,
             coalesce((e->>'estrella')::boolean, false) as estrella
        from jsonb_array_elements(p_items) with ordinality as t(e, ord)
       where e->>'id' is not null
    ) x
   where i.id = x.id and i.negocio_id = p_negocio;

  insert into negocio_items (negocio_id, nombre, precio, orden, seccion, descripcion, fotos, estrella)
  select p_negocio, e->>'nombre', (e->>'precio')::numeric, (t.ord - 1)::smallint,
         nullif(btrim(e->>'seccion'), ''), nullif(btrim(e->>'descripcion'), ''),
         case when jsonb_typeof(e->'fotos') = 'array' then array(select jsonb_array_elements_text(e->'fotos'))
              when nullif(e->>'foto', '') is not null then array[e->>'foto']
              else '{}'::text[] end,
         coalesce((e->>'estrella')::boolean, false)
    from jsonb_array_elements(p_items) with ordinality as t(e, ord)
   where e->>'id' is null;
end;
$$;
revoke execute on function guardar_menu(uuid, jsonb) from public, anon, authenticated;
grant execute on function guardar_menu(uuid, jsonb) to authenticated;

-- La vista pública: mismas columnas y, AL FINAL, `estrella`.
create or replace view negocio_items_publicos with (security_invoker = false) as
  select i.id, i.negocio_id, i.nombre, i.precio, i.orden, i.seccion, i.descripcion, i.foto, i.fotos, i.estrella
    from negocio_items i
    join negocios_publicos n on n.id = i.negocio_id;
