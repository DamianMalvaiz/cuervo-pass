-- Horario ESTRUCTURADO de los negocios y «Abierto ahora». Plan de excelencia 1.1.
--
-- ── El hueco ────────────────────────────────────────────────────────────────
-- `negocios.horario` es texto libre («Lun a sáb · 8 am a 9 pm»): se puede MOSTRAR pero no CALCULAR. La pregunta que primero se hace quien busca un servicio —¿está
-- abierto ahora?— no se podía contestar, ni filtrar, ni usar para ordenar. De los 25 negocios de ejemplo, 24 tienen un horario de formato regular y 1 no tiene horas.
--
-- ── Qué hace ────────────────────────────────────────────────────────────────
-- · `negocio_horarios`: una fila por TURNO (día ISO 1 = lunes … 7 = domingo, hora de apertura y de cierre). Varios turnos por día; un cierre menor que la apertura cruza
--   la medianoche (20:00–02:00); «24 horas» se guarda 00:00–23:59. Máximo 21 turnos por negocio. El texto libre se conserva: sirve para notas («con cita»).
-- · `negocio_abierto_en(negocio, instante)`: la regla, en UN sitio y con el instante como parámetro (así se prueba con fechas fijas). Hora de México (America/Mexico_City);
--   el cierre es EXCLUSIVO (a las 18:00 en punto ya está cerrado); un turno que cruza la medianoche cuenta también el día siguiente. Devuelve NULO si el negocio no tiene
--   horario estructurado: «no sé» no es «cerrado» ni «abierto».
-- · `negocios_publicos.abierto_ahora`: columna nueva al final de la vista (`create or replace` solo deja AÑADIR).
-- · `negocio_horarios_publicos`: los turnos de los negocios VISIBLES, para pintar el horario semanal en la ficha.
-- · `guardar_horario(negocio, turnos)`: reemplaza todos los turnos de golpe y en una transacción, con el mismo idioma que `guardar_menu`; RLS decide quién puede.
-- · `negocios_ordenados`: parámetro `p_solo_abiertos` (el filtro de la pantalla) y la columna `abierto_ahora`. En el ORDEN, un negocio que se sabe cerrado baja bajo los que están
--   abiertos o de los que no se sabe, dentro de su nivel de «destacado» y después de la coincidencia por nombre. El puntaje no cambia.
--
-- ── Lo que NO hace ──────────────────────────────────────────────────────────
-- No conoce días festivos ni cierres extraordinarios, ni zonas horarias distintas a la de México. Lo que declara el dueño es lo que se calcula.
--
-- Reversión:
--   drop function if exists guardar_horario(uuid, jsonb), negocio_abierto_en(uuid, timestamptz);
--   drop view if exists negocio_horarios_publicos; drop table if exists negocio_horarios;
--   -- volver a crear `negocios_publicos` como en la 0054 y `negocios_ordenados` como en la 0065.

create table if not exists negocio_horarios (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  dia        smallint not null check (dia between 1 and 7),
  abre       time not null,
  cierra     time not null,
  constraint horario_abre_distinto_de_cierra check (abre <> cierra)
);
create index if not exists negocio_horarios_negocio_idx on negocio_horarios (negocio_id);

alter table negocio_horarios enable row level security;
revoke all on negocio_horarios from public, anon, authenticated;
grant select, delete on negocio_horarios to authenticated;
grant insert (negocio_id, dia, abre, cierra) on negocio_horarios to authenticated;
grant update (dia, abre, cierra) on negocio_horarios to authenticated;
grant all on negocio_horarios to service_role;

create or replace function limitar_horarios_negocio()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from negocio_horarios where negocio_id = new.negocio_id) >= 21 then
    raise exception 'demasiados turnos de horario' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function limitar_horarios_negocio() from public, anon, authenticated;
drop trigger if exists trg_limitar_horarios_negocio on negocio_horarios;
create trigger trg_limitar_horarios_negocio before insert on negocio_horarios for each row execute function limitar_horarios_negocio();

drop policy if exists horarios_select_dueno on negocio_horarios;
create policy horarios_select_dueno on negocio_horarios
  for select to authenticated
  using (exists (select 1 from negocios n where n.id = negocio_id and n.usuario_id = (select auth.uid())));
drop policy if exists horarios_insert_aprobado on negocio_horarios;
create policy horarios_insert_aprobado on negocio_horarios
  for insert to authenticated
  with check (
    tiene_rol_aprobado('comerciante')
    and exists (select 1 from negocios n where n.id = negocio_id and n.usuario_id = (select auth.uid()))
  );
drop policy if exists horarios_update_dueno on negocio_horarios;
create policy horarios_update_dueno on negocio_horarios
  for update to authenticated
  using (exists (select 1 from negocios n where n.id = negocio_id and n.usuario_id = (select auth.uid())))
  with check (exists (select 1 from negocios n where n.id = negocio_id and n.usuario_id = (select auth.uid())));
drop policy if exists horarios_delete_dueno on negocio_horarios;
create policy horarios_delete_dueno on negocio_horarios
  for delete to authenticated
  using (exists (select 1 from negocios n where n.id = negocio_id and n.usuario_id = (select auth.uid())));

-- La regla. `security definer` para leer los turnos sin concederle la tabla a quien la llama; devuelve NULO si el negocio no está visible o no tiene horario.
create or replace function negocio_abierto_en(p_negocio uuid, p_instante timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select (p_instante at time zone 'America/Mexico_City') as local
  ), h as (
    select * from negocio_horarios where negocio_id = p_negocio
  )
  select case
    when not exists (select 1 from h) then null
    else exists (
      select 1 from h, t
       where
         -- Un turno de HOY.
         (h.dia = extract(isodow from t.local)::int
            and ((h.abre < h.cierra and t.local::time >= h.abre and t.local::time < h.cierra)
              or (h.abre > h.cierra and t.local::time >= h.abre)))
         -- O un turno de AYER que cruzó la medianoche y sigue en curso.
         or (h.dia = case when extract(isodow from t.local)::int = 1 then 7 else extract(isodow from t.local)::int - 1 end
               and h.abre > h.cierra and t.local::time < h.cierra)
    )
  end;
$$;
revoke execute on function negocio_abierto_en(uuid, timestamptz) from public, anon, authenticated;
grant execute on function negocio_abierto_en(uuid, timestamptz) to authenticated;

create or replace view negocios_publicos with (security_invoker = false) as
  select n.id, n.categoria_id, n.nombre, n.descripcion, n.direccion, n.latitud, n.longitud, n.rango_precio, n.horario,
         n.fotos,
         case when n.usuario_id is null then n.destacado else coalesce(pe.destaca, false) end as destacado,
         n.origen, n.creado_en,
         (select round(avg(r.estrellas)::numeric, 1) from resenas r where r.negocio_id = n.id and not r.oculta_por_reportes) as calificacion,
         (select count(*)::integer from resenas r where r.negocio_id = n.id and not r.oculta_por_reportes) as num_resenas,
         negocio_abierto_en(n.id, now()) as abierto_ahora
    from (
      select n0.*, row_number() over (partition by n0.usuario_id order by n0.creado_en, n0.id) as pos
        from negocios n0
       where n0.activo and not n0.oculto_por_reportes
    ) n
    left join planes_efectivos pe on pe.usuario_id = n.usuario_id and pe.rol = 'comerciante'
   where n.usuario_id is null or n.pos <= coalesce(pe.limite_principal, 0);

create or replace view negocio_horarios_publicos with (security_invoker = false) as
  select h.negocio_id, h.dia, h.abre, h.cierra
    from negocio_horarios h
    join negocios_publicos n on n.id = h.negocio_id;
revoke all on negocio_horarios_publicos from public, anon, authenticated;
grant select on negocio_horarios_publicos to authenticated;

-- Reemplaza TODOS los turnos del negocio. `security invoker`: RLS decide quién (solo la dueña aprobada); un fallo a mitad deshace todo.
create or replace function guardar_horario(p_negocio uuid, p_turnos jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_turnos is null or jsonb_typeof(p_turnos) <> 'array' or jsonb_array_length(p_turnos) > 21 then
    raise exception 'horario invalido' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_turnos) e
     where jsonb_typeof(e) <> 'object'
        or coalesce(e->>'dia', '') !~ '^[1-7]$'
        or coalesce(e->>'abre', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or coalesce(e->>'cierra', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or e->>'abre' = e->>'cierra'
  ) then
    raise exception 'horario invalido' using errcode = '22023';
  end if;

  delete from negocio_horarios where negocio_id = p_negocio;
  insert into negocio_horarios (negocio_id, dia, abre, cierra)
  select p_negocio, (e->>'dia')::smallint, (e->>'abre')::time, (e->>'cierra')::time
    from jsonb_array_elements(p_turnos) e;
end;
$$;
revoke execute on function guardar_horario(uuid, jsonb) from public, anon, authenticated;
grant execute on function guardar_horario(uuid, jsonb) to authenticated;

drop function if exists negocios_ordenados(text, text, integer);

create or replace function negocios_ordenados(
  p_categoria text default null,
  p_texto     text default null,
  p_limite    integer default 60,
  p_solo_abiertos boolean default false
)
returns table (
  id uuid, categoria_id text, nombre text, descripcion text, direccion text,
  latitud numeric, longitud numeric, rango_precio smallint, horario text, fotos text[],
  destacado boolean, origen text, creado_en timestamptz,
  calificacion numeric, num_resenas integer, abierto_ahora boolean,
  distancia_km double precision, puntaje double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (
    select u.latitud_universidad as lat, u.longitud_universidad as lon from usuarios u where u.id = auth.uid()
  ),
  -- El texto buscado, normalizado y con los comodines de LIKE escapados («50%» no es «todo»). Nulo = sin búsqueda.
  patron as (
    select case when nullif(btrim(coalesce(p_texto, '')), '') is null then null
                else '%' || regexp_replace(normalizar_busqueda(btrim(p_texto)), '([\\%_])', '\\\1', 'g') || '%'
           end as p
  ),
  base as (
    select n.id, n.categoria_id, n.nombre, n.descripcion, n.direccion, n.latitud, n.longitud, n.rango_precio, n.horario,
           n.fotos, n.destacado, n.origen, n.creado_en, n.calificacion, n.num_resenas, n.abierto_ahora,
           case when yo.lat is null or yo.lon is null or n.latitud is null or n.longitud is null then null
                else distancia_km(yo.lat::double precision, yo.lon::double precision,
                                  n.latitud::double precision, n.longitud::double precision)
           end as d,
           ((select p from patron) is not null and normalizar_busqueda(n.nombre) like (select p from patron)) as coincide_nombre
      from negocios_publicos n
      left join yo on true
     where auth.uid() is not null
       and (p_categoria is null or n.categoria_id = p_categoria)
       -- «Abierto ahora» pide SABERLO: un negocio sin horario estructurado (nulo) no califica, en vez de afirmarse abierto.
       and (not coalesce(p_solo_abiertos, false) or n.abierto_ahora is true)
       and (
         (select p from patron) is null
         or normalizar_busqueda(n.nombre) like (select p from patron)
         or normalizar_busqueda(coalesce(n.descripcion, '')) like (select p from patron)
         or exists (
           select 1 from negocio_items_publicos i
            where i.negocio_id = n.id and normalizar_busqueda(i.nombre) like (select p from patron)
         )
       )
  ),
  puntuado as (
    select b.*,
           (0.45 * (case when b.d is null then 0.5 else 1.0 / (1.0 + b.d / 1.5) end)
          + 0.45 * ((((coalesce(b.num_resenas, 0) * coalesce(b.calificacion, 0) + 3 * 3.5)
                       / (coalesce(b.num_resenas, 0) + 3)) - 1.0) / 4.0)
          + 0.10 * greatest(0.0, 1.0 - extract(epoch from (now() - b.creado_en)) / 86400.0 / 30.0)
           )::double precision as p
      from base b
  )
  select pu.id, pu.categoria_id, pu.nombre, pu.descripcion, pu.direccion, pu.latitud, pu.longitud, pu.rango_precio,
         pu.horario, pu.fotos, pu.destacado, pu.origen, pu.creado_en, pu.calificacion, pu.num_resenas, pu.abierto_ahora,
         pu.d as distancia_km, pu.p as puntaje
    from puntuado pu
   order by pu.destacado desc, pu.coincide_nombre desc, coalesce(pu.abierto_ahora, true) desc, pu.p desc, pu.nombre asc
   limit least(greatest(coalesce(p_limite, 60), 1), 100);
$$;
revoke execute on function negocios_ordenados(text, text, integer, boolean) from public, anon, authenticated;
grant execute on function negocios_ordenados(text, text, integer, boolean) to authenticated;
