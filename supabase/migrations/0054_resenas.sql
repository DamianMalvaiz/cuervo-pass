-- Reseñas de negocios y viviendas · Cuervo 360 (fase 4, versión mínima y completa).
--
-- Cualquier estudiante autenticado deja UNA reseña por negocio o por vivienda (1 a 5 estrellas y un texto opcional). El dueño
-- puede RESPONDER, no borrar ni ocultar. Cualquiera puede reportar una reseña; con tres reportes de personas distintas se oculta.
--
-- ── La calificación se CALCULA, nunca se asigna ─────────────────────────────
-- No hay columna de calificación que alguien escriba: `negocios_publicos` y `calificacion_publicaciones` la promedian al leer
-- sobre las reseñas visibles. Un dueño no puede subirse la nota, ni quitarse una mala: no puede escribir ni borrar reseñas ajenas.
--
-- ── Qué NO se puede hacer, y lo hace cumplir la base ────────────────────────
-- · Reseñar lo PROPIO (tu negocio o tu publicación): rechazado.
-- · Reseñar dos veces lo mismo: rechazado (índice único; el cliente lo lee como «ya reseñaste»).
-- · Reseñar algo que no se ve (inactivo, oculto por reportes) o que no existe: el MISMO error (42501). Sin esto, el error de clave
--   foránea distinguiría una publicación que no existe de una oculta, y reseñar serviría para averiguar qué se reportó (como en la
--   0044).
-- · Escribir `respuesta`, `oculta_por_reportes` o `usuario_id` ajeno: sin privilegio por columna. La respuesta pasa por
--   `responder_resena`, que exige ser dueño del objetivo.
--
-- ── Lectura por vistas ──────────────────────────────────────────────────────
-- La tabla se cierra (cada cuenta lee solo la suya). Lo público sale de `resenas_publicas`, con columnas escritas una a una: trae
-- el nombre de usuario del autor y `es_mia`, pero no su id. Una reseña oculta por reportes no sale, y tampoco cuenta en el promedio.
--
-- Códigos: se reutilizan los SQLSTATE estándar (23505 duplicado, 23514 check, 42501 sin permiso); no hay códigos CP nuevos.
--
-- Reversión:
--   drop view if exists resenas_publicas, calificacion_publicaciones;
--   restaurar `negocios_publicos` como en la 0053 (sin las dos últimas columnas);
--   drop function if exists reportar_resena(uuid, text), responder_resena(uuid, text);
--   drop table if exists resenas_reportes, resenas;

create table if not exists resenas (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references usuarios(id) on delete cascade,
  negocio_id          uuid references negocios(id) on delete cascade,
  publicacion_id      uuid references publicaciones(id) on delete cascade,
  estrellas           smallint not null check (estrellas between 1 and 5),
  texto               text check (char_length(texto) <= 600),
  respuesta           text check (char_length(respuesta) <= 600),
  respondida_en       timestamptz,
  oculta_por_reportes boolean not null default false,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  -- Exactamente uno de los dos objetivos.
  constraint resenas_un_objetivo check ((negocio_id is null) <> (publicacion_id is null))
);

-- Una reseña por persona y objetivo.
create unique index if not exists resenas_una_por_negocio on resenas (usuario_id, negocio_id) where negocio_id is not null;
create unique index if not exists resenas_una_por_publicacion on resenas (usuario_id, publicacion_id) where publicacion_id is not null;
create index if not exists resenas_negocio_idx on resenas (negocio_id) where negocio_id is not null and not oculta_por_reportes;
create index if not exists resenas_publicacion_idx on resenas (publicacion_id) where publicacion_id is not null and not oculta_por_reportes;

create table if not exists resenas_reportes (
  resena_id    uuid not null references resenas(id) on delete cascade,
  reportado_por uuid not null references usuarios(id) on delete cascade,
  motivo       text not null check (char_length(motivo) between 1 and 300),
  creado_en    timestamptz not null default now(),
  -- Una persona reporta una reseña una sola vez: los tres reportes que la ocultan son de tres personas distintas.
  primary key (resena_id, reportado_por)
);

drop trigger if exists trg_resenas_actualizado on resenas;
create trigger trg_resenas_actualizado before update on resenas
  for each row execute function actualizar_timestamp();

alter table resenas enable row level security;
alter table resenas_reportes enable row level security;
revoke all on resenas, resenas_reportes from public, anon, authenticated;

-- ── Privilegios por columna ─────────────────────────────────────────────────
grant select, delete on resenas to authenticated;
grant insert (usuario_id, negocio_id, publicacion_id, estrellas, texto) on resenas to authenticated;
grant update (estrellas, texto) on resenas to authenticated;
-- `resenas_reportes`: sin ningún privilegio para el cliente; solo `reportar_resena` escribe.

drop policy if exists resenas_select_propias on resenas;
create policy resenas_select_propias on resenas
  for select to authenticated using (usuario_id = (select auth.uid()));

-- Reseñar: a nombre propio, algo que se VE y que no es tuyo. Un solo error para «no existe», «no se ve» y «es tuyo».
drop policy if exists resenas_insert on resenas;
create policy resenas_insert on resenas
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and (
      (negocio_id is not null
        and exists (select 1 from negocios_publicos np where np.id = negocio_id)
        and not exists (select 1 from negocios n where n.id = negocio_id and n.usuario_id = (select auth.uid())))
      or
      (publicacion_id is not null
        and exists (select 1 from publicaciones_publicas pp where pp.id = publicacion_id)
        and not exists (select 1 from publicaciones p where p.id = publicacion_id and p.usuario_id = (select auth.uid())))
    )
  );

drop policy if exists resenas_update_propia on resenas;
create policy resenas_update_propia on resenas
  for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists resenas_delete_propia on resenas;
create policy resenas_delete_propia on resenas
  for delete to authenticated using (usuario_id = (select auth.uid()));

-- ── Responder (solo el dueño del objetivo) ──────────────────────────────────
-- Texto vacío QUITA la respuesta; la reseña nunca se borra desde aquí.
create or replace function responder_resena(p_resena uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if v_uid is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;
  if v_texto is not null and char_length(v_texto) > 600 then
    raise exception 'respuesta demasiado larga' using errcode = '23514';
  end if;

  -- «No existe», «está oculta» y «no es tuya» dan el mismo error.
  if not exists (
    select 1 from resenas r
     where r.id = p_resena and not r.oculta_por_reportes
       and (
         (r.negocio_id is not null and exists (select 1 from negocios n where n.id = r.negocio_id and n.usuario_id = v_uid))
         or (r.publicacion_id is not null and exists (select 1 from publicaciones p where p.id = r.publicacion_id and p.usuario_id = v_uid))
       )
  ) then
    raise exception 'no puedes responder esta resena' using errcode = '42501';
  end if;

  update resenas
     set respuesta = v_texto, respondida_en = case when v_texto is null then null else now() end
   where id = p_resena;
end;
$$;
revoke execute on function responder_resena(uuid, text) from public, anon, authenticated;
grant execute on function responder_resena(uuid, text) to authenticated;

-- ── Reportar ────────────────────────────────────────────────────────────────
create or replace function reportar_resena(p_resena uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) < 1 or char_length(p_motivo) > 300 then
    raise exception 'motivo invalido' using errcode = '23514';
  end if;

  -- Solo se reporta lo que se VE y que no escribiste tú. Mismo error para «no existe», «oculta» y «es tuya».
  if not exists (select 1 from resenas_publicas rp where rp.id = p_resena and not rp.es_mia) then
    raise exception 'no puedes reportar esta resena' using errcode = '42501';
  end if;

  insert into resenas_reportes (resena_id, reportado_por, motivo)
  values (p_resena, v_uid, btrim(p_motivo))
  on conflict (resena_id, reportado_por) do nothing;

  -- Tres personas distintas la ocultan.
  update resenas set oculta_por_reportes = true
   where id = p_resena and (select count(*) from resenas_reportes where resena_id = p_resena) >= 3;
end;
$$;
revoke execute on function reportar_resena(uuid, text) from public, anon, authenticated;
grant execute on function reportar_resena(uuid, text) to authenticated;

-- ── Vistas públicas ─────────────────────────────────────────────────────────
-- Solo lo VISIBLE: ni reseñas ocultas por reportes, ni las de un negocio o publicación que ya no se ven.
create or replace view resenas_publicas with (security_invoker = false) as
  select r.id, r.negocio_id, r.publicacion_id, r.estrellas, r.texto, r.respuesta, r.respondida_en, r.creado_en,
         u.nombre_usuario as autor,
         (r.usuario_id = (select auth.uid())) as es_mia
    from resenas r
    join usuarios u on u.id = r.usuario_id
   where not r.oculta_por_reportes
     and (
       (r.negocio_id is not null and exists (select 1 from negocios_publicos np where np.id = r.negocio_id))
       or (r.publicacion_id is not null and exists (select 1 from publicaciones_publicas pp where pp.id = r.publicacion_id))
     );
revoke all on resenas_publicas from public, anon, authenticated;
grant select on resenas_publicas to authenticated;

-- La calificación de una vivienda: se CALCULA aquí, sobre las reseñas visibles. (Va en una vista aparte y no como columnas de
-- `publicaciones_publicas`, que leen el motor de sugerencias y varias pantallas.)
create or replace view calificacion_publicaciones with (security_invoker = false) as
  select r.publicacion_id, round(avg(r.estrellas)::numeric, 1) as calificacion, count(*)::integer as num_resenas
    from resenas r
   where r.publicacion_id is not null and not r.oculta_por_reportes
   group by r.publicacion_id;
revoke all on calificacion_publicaciones from public, anon, authenticated;
grant select on calificacion_publicaciones to authenticated;

-- La de un negocio: dos columnas NUEVAS al final de la vista (mismas columnas y tipos antes, por eso `create or replace`).
create or replace view negocios_publicos with (security_invoker = false) as
  select n.id, n.categoria_id, n.nombre, n.descripcion, n.direccion, n.latitud, n.longitud, n.rango_precio, n.horario,
         n.fotos,
         case when n.usuario_id is null then n.destacado else coalesce(pe.destaca, false) end as destacado,
         n.origen, n.creado_en,
         (select round(avg(r.estrellas)::numeric, 1) from resenas r where r.negocio_id = n.id and not r.oculta_por_reportes) as calificacion,
         (select count(*)::integer from resenas r where r.negocio_id = n.id and not r.oculta_por_reportes) as num_resenas
    from (
      select n0.*, row_number() over (partition by n0.usuario_id order by n0.creado_en, n0.id) as pos
        from negocios n0
       where n0.activo and not n0.oculto_por_reportes
    ) n
    left join planes_efectivos pe on pe.usuario_id = n.usuario_id and pe.rol = 'comerciante'
   where n.usuario_id is null or n.pos <= coalesce(pe.limite_principal, 0);
