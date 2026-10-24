-- 0085 · Varias fotos por producto.
--
-- Cada producto del menú llevaba UNA foto (`foto`). Ahora lleva hasta 5 (`fotos`, la primera es la portada).
--
-- ── `foto` no se borra ──────────────────────────────────────────────────────
-- Sigue existiendo como la PORTADA (la primera de `fotos`): la leen las apps ya instaladas y las vistas. Las dos columnas se mantienen sincronizadas AQUÍ,
-- en un trigger, no en la app: quien escriba solo `foto` (la app anterior) deja `fotos` coherente, y quien escriba `fotos` deja `foto` coherente. Si las dos
-- cambian en la misma escritura, manda `fotos`.
--
-- ── Qué se valida ───────────────────────────────────────────────────────────
-- · Todas las rutas viven bajo `negocios/<id del negocio>/` (antes solo se comprobaba una; la política de Storage de la 0052 ya cubre esa carpeta).
-- · Máximo 5 fotos por producto (check, 23514).
--
-- Reversión (no se usa, pero se escribe):
--   drop trigger if exists trg_validar_foto_item on negocio_items;  (y recrearlo como en la 0053, solo con `foto`)
--   create or replace view negocio_items_publicos como en la 0053 (sin `fotos`);
--   alter table negocio_items drop constraint negocio_items_fotos_max; alter table negocio_items drop column fotos;
--   y guardar_menu como en la 0053.

alter table negocio_items add column if not exists fotos text[] not null default '{}';

alter table negocio_items drop constraint if exists negocio_items_fotos_max;
alter table negocio_items add constraint negocio_items_fotos_max check (cardinality(fotos) <= 5);

-- Lo que ya existía: la foto única pasa a ser la primera (y única) de la lista.
update negocio_items set fotos = array[foto] where foto is not null and cardinality(fotos) = 0;

create or replace function validar_foto_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sincronía: la columna que cambió manda. Si cambiaron las dos, manda `fotos`.
  if tg_op = 'UPDATE' then
    if new.fotos is distinct from old.fotos then
      new.foto := new.fotos[1];
    elsif new.foto is distinct from old.foto then
      new.fotos := case when new.foto is null then '{}'::text[] else array[new.foto] end;
    end if;
  elsif cardinality(new.fotos) > 0 then
    new.foto := new.fotos[1];
  elsif new.foto is not null then
    new.fotos := array[new.foto];
  end if;

  if exists (select 1 from unnest(new.fotos) r where r not like 'negocios/' || new.negocio_id::text || '/%') then
    raise exception 'ruta de foto fuera de la carpeta del negocio' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function validar_foto_item() from public, anon, authenticated;

drop trigger if exists trg_validar_foto_item on negocio_items;
create trigger trg_validar_foto_item
  before insert or update of foto, fotos, negocio_id on negocio_items
  for each row execute function validar_foto_item();

grant insert (negocio_id, nombre, precio, orden, seccion, descripcion, foto, fotos) on negocio_items to authenticated;
grant update (nombre, precio, orden, seccion, descripcion, foto, fotos) on negocio_items to authenticated;

-- Guardar el menú entero (0053), ahora con `fotos`. El JSON puede traer `fotos` (lista) o solo `foto` (la app anterior): si viene `fotos` manda; si no,
-- `foto` se vuelve una lista de una. `security invoker` a propósito, como siempre: corren las políticas y los límites del plan.
-- `set search_path = public`: la 0067 lo fijó con un `alter function`, y un `create or replace` lo pierde si no se repite.
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

  select coalesce(array_agg((e->>'id')::uuid) filter (where e->>'id' is not null), '{}'::uuid[])
    into v_ids from jsonb_array_elements(p_items) e;

  delete from negocio_items where negocio_id = p_negocio and id <> all(v_ids);

  update negocio_items i
     set nombre = x.nombre, precio = x.precio, orden = x.orden,
         seccion = x.seccion, descripcion = x.descripcion, fotos = x.fotos
    from (
      select (e->>'id')::uuid as id, e->>'nombre' as nombre, (e->>'precio')::numeric as precio, (t.ord - 1)::smallint as orden,
             nullif(btrim(e->>'seccion'), '') as seccion, nullif(btrim(e->>'descripcion'), '') as descripcion,
             case when jsonb_typeof(e->'fotos') = 'array' then array(select jsonb_array_elements_text(e->'fotos'))
                  when nullif(e->>'foto', '') is not null then array[e->>'foto']
                  else '{}'::text[] end as fotos
        from jsonb_array_elements(p_items) with ordinality as t(e, ord)
       where e->>'id' is not null
    ) x
   where i.id = x.id and i.negocio_id = p_negocio;

  insert into negocio_items (negocio_id, nombre, precio, orden, seccion, descripcion, fotos)
  select p_negocio, e->>'nombre', (e->>'precio')::numeric, (t.ord - 1)::smallint,
         nullif(btrim(e->>'seccion'), ''), nullif(btrim(e->>'descripcion'), ''),
         case when jsonb_typeof(e->'fotos') = 'array' then array(select jsonb_array_elements_text(e->'fotos'))
              when nullif(e->>'foto', '') is not null then array[e->>'foto']
              else '{}'::text[] end
    from jsonb_array_elements(p_items) with ordinality as t(e, ord)
   where e->>'id' is null;
end;
$$;
revoke execute on function guardar_menu(uuid, jsonb) from public, anon, authenticated;
grant execute on function guardar_menu(uuid, jsonb) to authenticated;

-- La vista pública: mismas columnas y, AL FINAL, `fotos` (un `create or replace view` solo admite columnas nuevas al final).
create or replace view negocio_items_publicos with (security_invoker = false) as
  select i.id, i.negocio_id, i.nombre, i.precio, i.orden, i.seccion, i.descripcion, i.foto, i.fotos
    from negocio_items i
    join negocios_publicos n on n.id = i.negocio_id;
